// Blueprint OS 1.3.0 P0: execute REAL TOTP + production step-up source against
// isolated disposable SQLite, not a regex source test or a Production session.
// No Worker, cloud services, GitHub Actions, user account, real keys or .wrangler.
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createHash,createHmac,randomBytes,webcrypto} from "node:crypto";
import {stripTypeScriptTypes} from "node:module";
import {DatabaseSync} from "node:sqlite";
import {fileURLToPath} from "node:url";
import {dirname,join,resolve} from "node:path";
const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const QA_HEAD=process.env.APP_MANAGER_MFA_QA_HEAD||"";
const shaRE=/^[a-f0-9]{40}$/;
const OWNER="owner-p0-mfa@example.invalid";
let qaPhase="PRE_FLIGHT";
function markPhase(name){qaPhase=name;console.log("MFA_QA_PHASE="+name)}
function decodeModule(path,knownExports,dependencies={}){
  const source=readFileSync(join(ROOT,path),"utf8");
  // Pure TS type stripping, followed by import/export stripping for runtime
  // evaluation of the exact implementation. Import dependencies are explicit;
  // no rewrite or reimplementation of the authentication decisions.
  let code=stripTypeScriptTypes(source);
  code=code.replace(/^import\s*[\s\S]*?\s+from\s+["'][^"']+["'];\s*/gm,"");
  code=code.replace(/\bexport (?=(?:async\s+)?function\s|(?:const|class)\s)/g,"");
  assert.ok(!/^\s*import\s|^\s*export\s/m.test(code),
    "BLOCKED_UNSUPPORTED_TS_MODULE_SYNTAX: "+path);
  const argNames=[...Object.keys(dependencies),"crypto"];
  const argValues=[...Object.values(dependencies),webcrypto];
  const factory=new Function(...argNames,code+
    "\nreturn {"+knownExports.join(",")+"};");
  return factory(...argValues);
}
function b32decode(s){
  const letters="ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";let bits=0,n=0;
  const bytes=[];
  for(const char of s.toUpperCase()){
    const x=letters.indexOf(char);
    assert.ok(x>=0,"BLOCKED_QA_INVALID_OTP_BASE32");
    n=(n<<5)|x;bits+=5;
    if(bits>=8){bytes.push((n>>>(bits-8))&255);bits-=8}
  }
  return Buffer.from(bytes);
}
function codeFor(secret,epochMs){
  const buf=Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(Math.floor(epochMs/30000)));
  const hash=createHmac("sha1",b32decode(secret)).update(buf).digest();
  const i=hash[hash.length-1]&15;
  return String((hash.readUInt32BE(i)&0x7fffffff)%1_000_000).padStart(6,"0");
}
function d1Adapter(db){
  // D1 accepts ?1, ?2 as positional indices. node:sqlite treats numbered
  // placeholders as named parameters; convert deterministically for the
  // isolated DB adapter. Never change the owner SQL or its bind arguments.
  return {prepare(sql){
    const indexes=[...sql.matchAll(/[?]([1-9][0-9]*)/g)]
      .map(match=>Number(match[1])-1);
    const stmt=db.prepare(sql.replace(/[?]([1-9][0-9]*)/g,"?"));
    return {bind(...args){
      const values=indexes.length?indexes.map(i=>{
        assert.ok(i>=0&&i<args.length,"BLOCKED_D1_BIND_INDEX_RANGE");return args[i]
      }):args;
      return {
        first:async()=>stmt.get(...values)||null,
        all:async()=>({results:stmt.all(...values)}),
        run:async()=>{const out=stmt.run(...values);return {meta:{changes:out.changes}}}
      };
    }};
  }};
}
function req(path,opts={}){
  const origin="https://local-mfa-qa.invalid";
  return new Request(origin+path,{...opts,headers:{
    origin, ...(opts.headers||{})}});
}
async function gate(auth,env,identity,action="upsert"){
  return auth.productionStepUpGate(
    req("/api/managed-apps",{method:"POST",headers:{"content-type":"application/json"},
      body:JSON.stringify({action,id:"local-qa"})}),env,identity);
}
function query(db,sql,...args){return db.prepare(sql).get(...args)}
async function main(){
  assert.match(QA_HEAD,shaRE,"BLOCKED_EXACT_CANDIDATE_SHA_REQUIRED");
  const {execFileSync}=await import("node:child_process");
  const git=(...a)=>execFileSync("git",["-C",ROOT,...a],
    {encoding:"utf8",windowsHide:true,timeout:15000}).trim();
  assert.equal(git("rev-parse","HEAD"),QA_HEAD,"BLOCKED_QA_SHA_DRIFT");
  assert.equal(git("status","--porcelain","--untracked-files=no"),"",
    "BLOCKED_QA_TRACKED_FILES_DIRTY");
  const TOTPBLOB="46af10e11b2bdd6e6c207fe1ff7cd27e548d85dd";
  const AUTHBLOB="9edf75a2c34b3762ed655a3de8c34acc7aa100ac";
  const MIGRATIONBLOB="811674ebe704bcd1a8a1a374277d3930d98ce226";
  for(const [path,blob] of [
    ["worker/totp.ts",TOTPBLOB],["worker/production-auth.ts",AUTHBLOB],
    ["drizzle/0013_totp_step_up.sql",MIGRATIONBLOB]
  ])assert.equal(git("rev-parse","HEAD:"+path),blob,
    "BLOCKED_OWNER_IMPLEMENTATION_DRIFT: "+path);
  markPhase("SQLITE_SETUP");
  const db=new DatabaseSync(":memory:");
  const originalNow=Date.now;
  const calls={};
  try{
    db.exec("PRAGMA foreign_keys=ON");
    db.exec([
      "CREATE TABLE control_accounts(email TEXT PRIMARY KEY,display_name TEXT,phone TEXT,role TEXT NOT NULL,status TEXT NOT NULL,must_change_password INTEGER NOT NULL DEFAULT 0)",
      "CREATE TABLE control_sessions(session_id_hash TEXT PRIMARY KEY,email TEXT NOT NULL,expires_at INTEGER NOT NULL,created_at INTEGER NOT NULL,last_seen_at INTEGER NOT NULL)",
      "CREATE TABLE control_auth_identities(provider TEXT,provider_email TEXT,account_email TEXT)",
    ].join(";")+";");
    // Apply the REAL MFA migration to a minimal pre-existing schema.
    const migration=readFileSync(join(ROOT,"drizzle","0013_totp_step_up.sql"),"utf8")
      .replaceAll("--> statement-breakpoint","");
    db.exec(migration);
    const seedTime=Math.floor(originalNow()/30000)*30000+1000;
    let fakeMs=seedTime;
    Date.now=()=>fakeMs;
    const env={DB:d1Adapter(db),APPLICATION_MANAGEMENT_MFA_ENCRYPTION_KEY:
      randomBytes(32).toString("base64url")};
    const token=randomBytes(32).toString("base64url");
    const tokenHash=createHash("sha256").update(token).digest("base64url");
    const now=Math.floor(fakeMs/1000);
    db.prepare("INSERT INTO control_accounts(email,display_name,phone,role,status,must_change_password) VALUES(?,?,'','owner','active',0)")
      .run(OWNER,"QA Owner");
    db.prepare("INSERT INTO control_sessions(session_id_hash,email,expires_at,created_at,last_seen_at,auth_method,step_up_at) VALUES(?,?,?,?,?,'google',NULL)")
      .run(tokenHash,OWNER,now+7200,now,now);
    markPhase("OWNER_MODULE_LOAD");
    const totp=decodeModule("worker/totp.ts",[
      "totpEnvironmentConfigured","totpState","beginTotpEnrollment",
      "verifyTotp","completeTotpEnrollment","removeTotp"
    ]);
    const auth=decodeModule("worker/production-auth.ts",[
      "productionIdentity","productionStepUpGate","handleProductionAccount","productionUnauthorized"
    ],{...totp});
    const cookie={"cookie":"__Host-am_prod_session="+token};
    const identityRequest=req("/api/managed-apps",{headers:cookie});
    markPhase("OWNER_SESSION_READ");
    let identity=await auth.productionIdentity(identityRequest,env);
    assert.equal(identity?.email,OWNER,"BLOCKED_REAL_OWNER_SESSION_NOT_FOUND");
    assert.equal(query(db,"SELECT role FROM control_accounts WHERE email=?",OWNER)?.role,
      "owner","BLOCKED_OWNER_DB_ROLE");
    assert.equal(await auth.productionIdentity(req("/api/managed-apps"),env),null,
      "BLOCKED_MISSING_SESSION_AUTHORIZED");
    assert.equal(auth.productionUnauthorized(req("/api/managed-apps")).status,401,
      "BLOCKED_UNAUTHENTICATED_API_NOT_401");
    calls.ownerAuthenticated=true;
    calls.noSessionRejected=true;
    assert.equal(await gate(auth,env,identity),null,
      "BLOCKED_DISABLED_MFA_POLICY_CHANGED");
    markPhase("TOTP_ENROLLMENT");
    const enrolled=await totp.beginTotpEnrollment(env,OWNER,"QA Owner");
    assert.match(enrolled.secret,/^[A-Z2-7]{32}$/,"BLOCKED_TOTP_SECRET_FORMAT");
    assert.equal(new URL(enrolled.uri).protocol,"otpauth:","BLOCKED_TOTP_URI_PROTOCOL");
    const factor=query(db,"SELECT secret_ciphertext,secret_iv,enabled FROM control_mfa_factors WHERE account_email=?",OWNER);
    assert.equal(factor?.enabled,0);
    assert.ok(factor.secret_ciphertext&&factor.secret_iv);
    assert.ok(!JSON.stringify(factor).includes(enrolled.secret),
      "BLOCKED_TOTP_SECRET_PLAINTEXT");
    assert.equal((await totp.totpState(env,OWNER)).pending,true);
    markPhase("TOTP_CRYPTO_NEGATIVE");
    const good=codeFor(enrolled.secret,fakeMs);
    const bad=String((Number(good)+1)%1_000_000).padStart(6,"0");
    assert.equal(await totp.verifyTotp(env,OWNER,bad),false,
      "BLOCKED_INVALID_TOTP_ACCEPTED");
    assert.equal(await totp.verifyTotp({...env,
      APPLICATION_MANAGEMENT_MFA_ENCRYPTION_KEY:randomBytes(32).toString("base64url")},
      OWNER,good),false,"BLOCKED_WRONG_AES_KEY_ACCEPTED");
    calls.encryptedMfaSecret=true;
    markPhase("MFA_ENROLLMENT_HTTP");
    const wrong=await auth.handleProductionAccount(req("/__account/mfa/verify",{
      method:"POST",body:new URLSearchParams({code:bad})}),env,identity);
    assert.equal(wrong.status,401,"BLOCKED_INVALID_ENROLLMENT_CODE_NOT_401");
    assert.equal(query(db,"SELECT enabled FROM control_mfa_factors WHERE account_email=?",OWNER).enabled,0);
    const verify=await auth.handleProductionAccount(req("/__account/mfa/verify",{
      method:"POST",body:new URLSearchParams({code:good})}),env,identity);
    assert.equal(verify.status,200,"BLOCKED_VALID_ENROLLMENT_FAILED");
    assert.equal(query(db,"SELECT enabled FROM control_mfa_factors WHERE account_email=?",OWNER).enabled,1);
    identity=await auth.productionIdentity(identityRequest,env);
    assert.equal(identity.stepUpAt,now,"BLOCKED_SESSION_STEP_UP_NOT_PERSISTED");
    assert.equal(await gate(auth,env,identity),null,
      "BLOCKED_JUST_VERIFIED_STEPUP_REJECTED");
    calls.totpBadRejectedGoodAccepted=true;
    calls.stepUpSessionScoped=true;
    // A separate owner session does not inherit the first session's step-up.
    markPhase("STEPUP_SESSION_SCOPING");
    const another={...identity,sessionHash:"another-session",stepUpAt:null};
    assert.equal((await gate(auth,env,another))?.status,403,
      "BLOCKED_CROSS_SESSION_STEP_UP_REUSE");
    db.prepare("UPDATE control_sessions SET step_up_at=NULL WHERE session_id_hash=?")
      .run(tokenHash);
    identity=await auth.productionIdentity(identityRequest,env);
    assert.equal((await gate(auth,env,identity))?.status,403,
      "BLOCKED_SENSITIVE_ACTION_WITHOUT_STEPUP");
    markPhase("STEPUP_AUTH_HTTP");
    const badStep=await auth.handleProductionAccount(req("/__account/mfa/step-up",{
      method:"POST",body:new URLSearchParams({code:bad})}),env,identity);
    assert.equal(badStep.status,401,"BLOCKED_BAD_STEPUP_NOT_401");
    assert.equal(query(db,"SELECT step_up_at FROM control_sessions WHERE session_id_hash=?",tokenHash).step_up_at,null);
    const validStep=await auth.handleProductionAccount(req("/__account/mfa/step-up",{
      method:"POST",body:new URLSearchParams({code:good})}),env,identity);
    assert.equal(validStep.status,200,"BLOCKED_VALID_STEPUP");
    assert.equal(query(db,"SELECT step_up_at FROM control_sessions WHERE session_id_hash=?",tokenHash).step_up_at,now);
    calls.stepUpWrongRejectedGoodAccepted=true;
    markPhase("STEPUP_TTL_BOUNDARIES");
    for(const [name,age,expected] of [
      ["fifteen_minute_edge",900,403],
      ["fresh_prior",899,null],
      ["future_timestamp",-60,403]
    ]){
      db.prepare("UPDATE control_sessions SET step_up_at=? WHERE session_id_hash=?")
        .run(now-age,tokenHash);
      const current=await auth.productionIdentity(identityRequest,env);
      const actual=await gate(auth,env,current);
      assert.equal(actual?.status??null,expected,
        "BLOCKED_STEPUP_TTL_"+name);
    }
    calls.expiredAndFutureStepUpRejected=true;
    // Fail-closed when a real enabled factor survives but its AES key is absent.
    db.prepare("UPDATE control_sessions SET step_up_at=? WHERE session_id_hash=?")
      .run(now,tokenHash);
    const current=await auth.productionIdentity(identityRequest,env);
    markPhase("MISSING_MFA_KEY_FAIL_CLOSED");
    const broken={DB:env.DB};
    const state=await totp.totpState(broken,OWNER);
    assert.equal(state.enabled,true,"BLOCKED_MISSING_KEY_MASKED_ENABLED_FACTOR");
    assert.equal(state.configured,false,"BLOCKED_MISSING_KEY_REPORTED_AS_CONFIGURED");
    assert.equal((await gate(auth,broken,current))?.status,403,
      "BLOCKED_MISSING_MFA_KEY_BYPASSED");
    calls.missingMfaKeyFailClosed=true;
    // Defensive test: the protected API never creates a new session on its own.
    assert.equal(query(db,"SELECT count(*) AS n FROM control_sessions").n,1);
    markPhase("FINAL_RECEIPT_GATES");
    const checkpoint={
      checkpoint:"P0_TOTP_STEPUP_OFFLINE_RUNTIME_VERIFIED",
      sha:QA_HEAD, ownerSource:"EXACT_PRODUCTION_AUTH_AND_TOTP_TS",
      isolatedSQLite:"REAL_LOCAL_IN_MEMORY",nativeWorkerD1:"NOT_TESTED",
      ownerAccount:true,missingSessionRejected:true,
      invalidAndValidTotp:true,encryptedSecret:true,
      sessionScopedStepUp:true,ttlBoundarySeconds:900,
      futureStepUpRejected:true,missingEncryptionKeyFailClosed:true,
      productionTouched:false,ci:"PENDING",globalD1:"10/10 BLOCKED"
    };
    assert.ok(Object.values(calls).every(Boolean));
    console.log(JSON.stringify(checkpoint));
    console.log(JSON.stringify({result:"P0_TOTP_STEPUP_OFFLINE_NODE_PASS",
      sha:QA_HEAD,testCount:Object.keys(calls).length,
      productionAuth:"QA_SOURCE_EXECUTED_NOT_PRODUCTION_DEPLOYMENT",
      mfa:"NODE_SQLITE_BEHAVIOR_VERIFIED",globalD1:"10/10 BLOCKED"}));
  }finally{Date.now=originalNow;db.close()}
}
main().catch(e=>{
  const errorCode=String(e?.code||e?.name||"UNKNOWN").slice(0,80);
  // Do not print e.actual/e.expected, TOTP secrets, URI, cookies or keys.
  // Only our explicit assertion messages are safe to surface verbatim.
  const explicit=typeof e?.message==="string" && /^BLOCKED_[A-Z0-9_ :./-]+$/.test(e.message)
    ? e.message.slice(0,180) : "NON_EXPLICIT_ASSERTION_OR_RUNTIME_FAILURE";
  const frame=String(e?.stack||"").split("\n")
    .find(line=>/p0-totp-stepup-offline-qa[.]mjs:\d+:\d+/.test(line))||"";
  console.error("P0_TOTP_STEPUP_OFFLINE_NODE_NOT_PASSED: "+JSON.stringify({
    phase:qaPhase,code:errorCode,reason:explicit,
    qaSourceFrame:frame.trim().slice(0,200)
  }));
  process.exitCode=1;
});
