// Blueprint OS 1.3.0: native, local-only Production-auth execution path.
// This test is NOT a Production deployment, ratification, 2FA certification,
// global process-quiescence proof or a replay of previous pilot/E2E PASS.
// Runs actual Worker + Vinext + D1 in new disposable Windows QA namespace.
import assert from "node:assert/strict";
import {spawn,spawnSync} from "node:child_process";
import {createHmac,randomBytes,randomUUID} from "node:crypto";
import {existsSync,mkdirSync,readdirSync,readFileSync,rmSync,writeFileSync} from "node:fs";
import {DatabaseSync} from "node:sqlite";
import {createServer,connect} from "node:net";
import {dirname,join,relative,resolve} from "node:path";
import {fileURLToPath} from "node:url";
import {setTimeout as sleep} from "node:timers/promises";

const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const EXPECTED=process.env.APP_MANAGER_MFA_NATIVE_QA_HEAD||"";
const DEPS=process.env.APP_MANAGER_MFA_NATIVE_QA_WORKERD_DEPS_ROOT
  ?resolve(process.env.APP_MANAGER_MFA_NATIVE_QA_WORKERD_DEPS_ROOT):"";
const WORKERD=join(DEPS,"node_modules","@cloudflare","workerd-windows-64","bin","workerd.exe");
const VITE=join(ROOT,"node_modules","vite","bin","vite.js");
const WRANGLER=join(ROOT,"node_modules","wrangler","bin","wrangler.js");
const QA=join(ROOT,".wrangler","p0-mfa-native-qa-"+randomBytes(8).toString("hex"));
const STATE=join(QA,"persist"), CONFIG=join(QA,"wrangler.qa.jsonc");
const VITE_CONFIG=join(QA,"vite.qa.mjs");
const DB_NAME="app-mfa-native-"+randomBytes(4).toString("hex");
const OWNER="p0-native-mfa@example.invalid";
const secrets=[];
const env={...process.env,CI:"1",WRANGLER_SEND_METRICS:"false",
  CLOUDFLARE_SEND_METRICS:"false",GIT_TERMINAL_PROMPT:"0"};
for(const k of Object.keys(env))
  if(/(?:^|_)(?:API_KEY|API_TOKEN|SECRET|PASSWORD|PRIVATE_KEY|ACCESS_TOKEN)$|^(?:CLOUDFLARE|GOOGLE|NEON|VERCEL)_/i.test(k)
    || k==="NODE_OPTIONS"||k==="MINIFLARE_WORKERD_PATH")delete env[k];
let phase="PREFLIGHT";
function mark(p){phase=p;console.log("MFA_NATIVE_QA_PHASE="+phase)}
function scrub(value){
  let x=String(value||"");
  for(const k of secrets)if(k)x=x.replaceAll(k,"[QA_REDACTED]");
  return x.replace(/Bearer\s+\S+/gi,"Bearer [REDACTED]")
    .replace(/[A-Za-z0-9_-]{42,}/g,"[OPAQUE_REDACTED]").slice(-900);
}
function exec(cmd,args,cwd=ROOT){
  const r=spawnSync(cmd,args,{cwd,env,encoding:"utf8",windowsHide:true,
    timeout:120000,maxBuffer:3*1024*1024});
  if(r.error||r.status!==0)throw Error("BLOCKED_QA_CLI_"+String(args[0]).slice(0,20)+
    ": "+scrub(r.error?.message||r.stderr||r.stdout||r.status));
  return r.stdout.trim();
}
function git(...a){return exec("git",["-C",ROOT,...a])}
function blob(path,id){
  assert.equal(git("rev-parse","HEAD:"+path),id,"BLOCKED_OWNER_BLOB_DRIFT_"+path);
}
function pkg(name,expected,root=ROOT){
  const file=join(root,"node_modules",...name.split("/"),"package.json");
  assert.ok(existsSync(file),"BLOCKED_MFA_NATIVE_DEPENDENCY_MISSING_"+name);
  assert.equal(JSON.parse(readFileSync(file,"utf8")).version,expected,
    "BLOCKED_MFA_NATIVE_DEPENDENCY_DRIFT_"+name);
}
function preflight(){
  assert.equal(process.platform,"win32","BLOCKED_WINDOWS_NATIVE_QA_ONLY");
  assert.match(ROOT,/^[a-z]:\\BaumanWeb\\_qa\\AppManager-P0-native-/i,
    "BLOCKED_NOT_A_DEDICATED_QA_WORKTREE");
  assert.match(EXPECTED,/^[a-f0-9]{40}$/,"BLOCKED_MFA_NATIVE_SHA_REQUIRED");
  assert.equal(git("rev-parse","HEAD"),EXPECTED,"BLOCKED_MFA_NATIVE_HEAD_MISMATCH");
  assert.equal(git("branch","--show-current"),"","BLOCKED_NOT_DETACHED_WORKTREE");
  assert.equal(git("status","--porcelain","--untracked-files=no"),"",
    "BLOCKED_QA_TRACKED_CHANGES");
  blob("worker/totp.ts","46af10e11b2bdd6e6c207fe1ff7cd27e548d85dd");
  blob("worker/production-auth.ts","9edf75a2c34b3762ed655a3de8c34acc7aa100ac");
  blob("worker/index.ts","cd7af7e929238ae47e960308bdff82fdf80a9517");
  blob("drizzle/0013_totp_step_up.sql","811674ebe704bcd1a8a1a374277d3930d98ce226");
  for(const f of [".env",".env.local",".dev.vars",".dev.vars.local"])
    assert.ok(!existsSync(join(ROOT,f)),"BLOCKED_UNEXPECTED_QA_ENV_"+f);
  assert.ok(DEPS&&existsSync(WORKERD)&&existsSync(VITE)&&existsSync(WRANGLER),
    "BLOCKED_NATIVE_QA_OFFLINE_BINARIES");
  pkg("vite","8.0.13");
  pkg("wrangler","4.92.0");
  pkg("@cloudflare/vite-plugin","1.37.1");
  pkg("workerd","1.20261012.1",DEPS);
  pkg("@cloudflare/workerd-windows-64","1.20261012.1",DEPS);
  const v=spawnSync(WORKERD,["--version"],{
    cwd:ROOT,env,encoding:"utf8",windowsHide:true,timeout:12000});
  assert.equal(v.status,0,"BLOCKED_WORKERD_BINARY");
  assert.match(String(v.stdout||"")+String(v.stderr||""),/2026-10-12/,
    "BLOCKED_QA_WORKERD_RELEASE_DATE");
  assert.ok(!existsSync(QA),"BLOCKED_QA_NAMESPACE_COLLISION");
}
async function port(){
  return new Promise((yes,no)=>{
    const s=createServer();s.once("error",no);
    s.listen(0,"127.0.0.1",()=>{const p=s.address().port;s.close(e=>e?no(e):yes(p))});
  });
}
async function listening(p){
  return new Promise(resolve=>{
    const s=connect({host:"127.0.0.1",port:p});let done=false;
    const finish=v=>{if(done)return;done=true;s.destroy();resolve(v)};
    s.once("connect",()=>finish(true));
    s.once("error",()=>finish(false));s.setTimeout(250,()=>finish(false));
  });
}
const diagnostics=new WeakMap();
function launch(portNumber){
  const child=spawn(process.execPath,[VITE,"--config",VITE_CONFIG,
    "--host","127.0.0.1","--port",String(portNumber),"--strictPort"],{
    cwd:ROOT,env:{...env,MINIFLARE_WORKERD_PATH:WORKERD},
    shell:false,windowsHide:true,stdio:["ignore","pipe","pipe"]});
  const log={text:""};diagnostics.set(child,log);
  for(const st of [child.stdout,child.stderr])
    st.on("data",b=>{log.text=(log.text+String(b)).slice(-8000)});
  child.on("error",e=>{log.text=(log.text+"\n"+e.message).slice(-8000)});
  return child;
}
async function stop(child,p){
  if(!child)return;
  if(child.exitCode===null&&child.signalCode===null&&child.pid){
    const r=spawnSync("taskkill",["/PID",String(child.pid),"/T","/F"],{
      cwd:ROOT,env,encoding:"utf8",windowsHide:true,timeout:28000});
    if(r.status!==0&&child.exitCode===null)
      throw Error("BLOCKED_MFA_NATIVE_CAPTURED_TREE_STOP");
  }
  for(let i=0;i<90;i++){
    if(!await listening(p)){
      for(let j=0;j<85&&child.exitCode===null&&child.signalCode===null;j++)
        await sleep(100);
      assert.ok(child.exitCode!==null||child.signalCode!==null,
        "BLOCKED_MFA_NATIVE_PARENT_STILL_ALIVE");
      return;
    }
    await sleep(150);
  }
  throw Error("BLOCKED_MFA_NATIVE_LISTENER_STILL_ALIVE");
}
async function ready(child,base,secret,channel){
  for(let i=0;i<120;i++){
    if(child.exitCode!==null||child.signalCode!==null)
      throw Error("BLOCKED_MFA_NATIVE_WORKER_CRASH "+scrub(diagnostics.get(child)?.text));
    try{
      const r=await fetch(base+"/__deployment",{redirect:"manual",
        headers:{authorization:"Bearer "+secret},signal:AbortSignal.timeout(1300)});
      const x=await r.json().catch(()=>({}));
      if(r.status===200&&x.databaseReady===true&&x.channel===channel
        &&x.productionAuthConfigured===true)return;
    }catch{}
    await sleep(300);
  }
  throw Error("BLOCKED_MFA_NATIVE_READY "+scrub(diagnostics.get(child)?.text));
}
function writeJson(file,value,exclusive=true){
  writeFileSync(file,JSON.stringify(value,null,2),{
    flag:exclusive?"wx":"w",mode:0o600});
}
function formPost(base,path,values,cookie=""){
  return fetch(base+path,{method:"POST",redirect:"manual",
    headers:{origin:base,"content-type":"application/x-www-form-urlencoded",
      ...(cookie?{cookie}:{})},
    body:new URLSearchParams(values),signal:AbortSignal.timeout(24000)});
}
function protectedPost(base,cookie){
  return fetch(base+"/api/managed-apps",{
    method:"POST",redirect:"manual",
    headers:{origin:base,cookie,"content-type":"application/json"},
    // Deliberately invalid payload: must never create/update catalog data.
    body:JSON.stringify({action:"upsert"}),
    signal:AbortSignal.timeout(18000)});
}
function base32Decode(secret){
  let n=0,bits=0;const out=[];const alphabet="ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  for(const c of secret){
    const x=alphabet.indexOf(c);assert.ok(x>=0,"BLOCKED_BAD_QA_BASE32");
    n=(n<<5)|x;bits+=5;
    if(bits>=8){out.push((n>>>(bits-8))&255);bits-=8}
  }
  return Buffer.from(out);
}
function otp(secret,ms=Date.now()){
  const b=Buffer.alloc(8);b.writeBigUInt64BE(BigInt(Math.floor(ms/30000)));
  const h=createHmac("sha1",base32Decode(secret)).update(b).digest();
  const offset=h[19]&15;
  return String((h.readUInt32BE(offset)&0x7fffffff)%1_000_000).padStart(6,"0");
}
function sqliteFiles(dir,depth=0){
  assert.ok(depth<=9,"BLOCKED_SQLITE_CENSUS_DEPTH");
  const out=[];
  if(!existsSync(dir))return out;
  const entries=readdirSync(dir,{withFileTypes:true});
  assert.ok(entries.length<=300,"BLOCKED_SQLITE_CENSUS_WIDTH");
  for(const e of entries){
    assert.ok(!e.isSymbolicLink(),"BLOCKED_SQLITE_CENSUS_LINK");
    const p=join(dir,e.name);
    if(e.isDirectory())out.push(...sqliteFiles(p,depth+1));
    else if(e.isFile()&&/\.sqlite$/i.test(e.name))out.push(p);
  }
  return out;
}
async function inspectMfa(){
  const files=sqliteFiles(STATE);
  assert.ok(files.length>=1&&files.length<=80,"BLOCKED_NATIVE_SQLITE_CENSUS");
  const result=[];
  for(const file of files){
    for(let attempt=1;attempt<=7;attempt++){
      let db,error=null,entry=null;
      try{
        db=new DatabaseSync(file,{readOnly:true});
        const has=db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='control_mfa_factors'").get();
        if(has){
          const rows=db.prepare("SELECT account_email,secret_ciphertext,secret_iv,enabled FROM control_mfa_factors").all();
          const session=db.prepare("SELECT count(*) AS n FROM control_sessions").get();
          entry={rows,sessionCount:session.n,file:relative(STATE,file)};
        }
      }catch(e){error=e}finally{try{db?.close()}catch(e){if(!error)error=e}}
      if(!error){if(entry)result.push(entry);break}
      const code=String(error?.code||"");
      if(!/^SQLITE_(?:IOERR|BUSY|LOCKED)/.test(code)
        && !/disk I\/O error|database is locked/i.test(String(error?.message||"")))
        throw Error("BLOCKED_MFA_D1_READ_"+scrub(code));
      if(attempt===7)throw Error("BLOCKED_MFA_D1_READ_TRANSIENT_EXHAUSTED");
      console.log("MFA_NATIVE_SQLITE_RETRY: "+JSON.stringify({attempt,code}));
      await sleep(140*attempt);
    }
  }
  assert.equal(result.length,1,"BLOCKED_MFA_NATIVE_D1_AMBIGUOUS");
  const x=result[0];
  assert.equal(x.rows.length,1,"BLOCKED_MFA_NATIVE_FACTOR_COUNT");
  assert.equal(x.rows[0].account_email,OWNER,"BLOCKED_MFA_FACTOR_OWNER");
  assert.equal(x.rows[0].enabled,1,"BLOCKED_MFA_FACTOR_NOT_ENABLED");
  assert.ok(x.rows[0].secret_ciphertext&&x.rows[0].secret_iv,
    "BLOCKED_MFA_FACTOR_NOT_ENCRYPTED");
  assert.ok(x.sessionCount>=2,"BLOCKED_MFA_SESSION_NOT_PERSISTED");
  console.log("MFA_NATIVE_D1_INDEPENDENT_READBACK: "+JSON.stringify({
    factorCount:x.rows.length,enabled:true,ciphertextStored:true,
    sessionCount:x.sessionCount,databaseFile:x.file
  }));
}
async function main(){
  preflight();
  const ownerPassword=randomBytes(25).toString("base64url");
  const mfaKey=randomBytes(32).toString("base64url");
  const readbackKey=randomBytes(48).toString("base64url");
  secrets.push(ownerPassword,mfaKey,readbackKey);
  const hostPort=await port(),base="http://127.0.0.1:"+hostPort;
  let child=null,success=false,stopped=false,erased=false;
  mkdirSync(QA,{recursive:true});
  const configData={
    name:DB_NAME,main:join(ROOT,"worker","index.ts"),
    compatibility_date:"2026-09-10",compatibility_flags:["nodejs_compat"],
    assets:{binding:"ASSETS",run_worker_first:true},
    d1_databases:[{binding:"DB",database_name:DB_NAME,
      database_id:randomUUID(),migrations_dir:join(ROOT,"drizzle")}],
    vars:{
      APPLICATION_MANAGEMENT_DEPLOYMENT_CHANNEL:"cloudflare-production",
      APPLICATION_MANAGEMENT_ACCESS_MODE:"standalone",
      APPLICATION_MANAGEMENT_BUILD_REVISION:EXPECTED,
      CONTROL_OWNER_EMAILS:OWNER,CONTROL_PLANE_NETWORK_MODE:"local",
      APPLICATION_MANAGEMENT_INITIAL_ADMIN_PASSWORD:ownerPassword,
      APPLICATION_MANAGEMENT_PRODUCTION_READBACK_SECRET:readbackKey,
      APPLICATION_MANAGEMENT_MFA_ENCRYPTION_KEY:mfaKey
    }
  };
  try{
    // All temporary secret files are in finally scope.
    writeJson(CONFIG,configData);
    writeFileSync(VITE_CONFIG,[
      'import vinext from "vinext";',
      'import {defineConfig} from "vite";',
      'import {cloudflare} from "@cloudflare/vite-plugin";',
      'import {sites} from "../../build/sites-vite-plugin.ts";',
      'export default defineConfig({',
      'server:{host:"127.0.0.1",allowedHosts:["127.0.0.1","localhost"],',
      'watch:{ignored:["**/.wrangler/**"]}},',
      'plugins:[vinext(),sites(),cloudflare({',
      "configPath:"+JSON.stringify(CONFIG)+",",
      "persistState:{path:"+JSON.stringify(STATE)+"},",
      'viteEnvironment:{name:"rsc",childEnvironments:["ssr"]},inspectorPort:false',
      '})]});'
    ].join("\n"),{flag:"wx",mode:0o600});
    mark("MIGRATE_NATIVE_D1");
    exec(process.execPath,[WRANGLER,"d1","migrations","apply",DB_NAME,
      "--local","--config",CONFIG,"--persist-to",STATE]);
    mark("START_PRODUCTION_AUTH_LOCAL_WORKER");
    child=launch(hostPort);
    await ready(child,base,readbackKey,"cloudflare-production");
    const noAuth=await protectedPost(base,"");
    assert.equal(noAuth.status,401,"BLOCKED_MFA_NO_COOKIE_MUTATION");
    mark("LOGIN_OWNER_NATIVE");
    const login=await formPost(base,"/__login",{email:OWNER,password:ownerPassword});
    assert.equal(login.status,303,"BLOCKED_MFA_BOOTSTRAP_LOGIN");
    const cookieRaw=login.headers.get("set-cookie")||"";
    const cookieMatch=cookieRaw.match(/__Host-am_prod_session=[A-Za-z0-9_-]+/);
    assert.ok(cookieMatch,"BLOCKED_MFA_SESSION_COOKIE_MISSING");
    const cookie1=cookieMatch[0];
    const page=await fetch(base+"/__account",{headers:{cookie:cookie1}});
    assert.equal(page.status,200,"BLOCKED_MFA_OWNER_SETTINGS_GET");
    mark("SETUP_AUTHENTICATOR_REAL_HTTP");
    const setup=await formPost(base,"/__account/mfa/setup",{},cookie1);
    assert.equal(setup.status,200,"BLOCKED_MFA_NATIVE_SETUP");
    const html=await setup.text();
    const secret=html.match(/Khóa thiết lập<\/span><strong>([A-Z2-7]{32})<\/strong>/)?.[1];
    assert.ok(secret,"BLOCKED_MFA_SETUP_SECRET_HTML_FORMAT");
    secrets.push(secret);
    const code=otp(secret);
    const wrong=String((Number(code)+1)%1000000).padStart(6,"0");
    const rejected=await formPost(base,"/__account/mfa/verify",{code:wrong},cookie1);
    assert.equal(rejected.status,401,"BLOCKED_MFA_NATIVE_INVALID_CODE");
    const allowed=await formPost(base,"/__account/mfa/verify",{code},cookie1);
    assert.equal(allowed.status,200,"BLOCKED_MFA_NATIVE_VALID_CODE");
    mark("STEPUP_SECOND_SESSION_NATIVE");
    mark("SECOND_SESSION_LOGIN_REQUEST");
    const second=await formPost(base,"/__login",{email:OWNER,password:ownerPassword});
    assert.equal(second.status,303,"BLOCKED_MFA_SECOND_LOGIN");
    mark("SECOND_SESSION_COOKIE_CHECK");
    const cookie2=(second.headers.get("set-cookie")||"").match(
      /__Host-am_prod_session=[A-Za-z0-9_-]+/)?.[0];
    assert.ok(cookie2&&cookie2!==cookie1,"BLOCKED_MFA_SESSION_ISOLATION");
    mark("STEPUP_UNVERIFIED_GATE");
    const denied=await protectedPost(base,cookie2);
    assert.equal(denied.status,403,"BLOCKED_MFA_STEPUP_HTTP_STATUS");
    const deniedJSON=await denied.json().catch(()=>({}));
    assert.equal(deniedJSON.code,"STEP_UP_REQUIRED","BLOCKED_MFA_STEPUP_GATE_MISSING");
    mark("STEPUP_INVALID_CODE");
    // The code from initial enrollment may be outside the 30-second TOTP
    // window by now. Generate a fresh invalid 6-digit code for this request.
    const invalidStepCode=String((Number(otp(secret))+1)%1_000_000).padStart(6,"0");
    const badStep=await formPost(base,"/__account/mfa/step-up",{code:invalidStepCode},cookie2);
    assert.equal(badStep.status,401,"BLOCKED_MFA_INVALID_STEPUP_HTTP");
    mark("STEPUP_INVALID_STILL_DENIED");
    const deniedAgain=await protectedPost(base,cookie2);
    assert.equal((await deniedAgain.json().catch(()=>({})).code),"STEP_UP_REQUIRED",
      "BLOCKED_MFA_INVALID_STEPUP_CHANGED_SESSION");
    mark("STEPUP_VALID_CODE");
    // Always sample the authenticator immediately before the valid step-up;
    // do not reuse the enrollment code after a second PBKDF2 login/HTTP round trips.
    const stepCode=otp(secret);
    const goodStep=await formPost(base,"/__account/mfa/step-up",{code:stepCode},cookie2);
    assert.equal(goodStep.status,200,"BLOCKED_MFA_VALID_STEPUP_HTTP");
    mark("STEPUP_VERIFIED_DOWNSTREAM_GATE");
    const afterStep=await protectedPost(base,cookie2);
    const afterJSON=await afterStep.json().catch(()=>({}));
    assert.notEqual(afterJSON.code,"STEP_UP_REQUIRED",
      "BLOCKED_MFA_VERIFIED_STEPUP_NOT_RECOGNIZED");
    // The downstream API may still reject a missing P-256 proof. That is
    // required and must NOT be reported as successful app mutation.
    assert.notEqual(afterStep.status,200,"BLOCKED_MFA_UNAUTHORIZED_MUTATION_SUCCEEDED");
    mark("STOP_NATIVE_WORKER_INDEPENDENT_D1");
    await stop(child,hostPort);child=null;
    await inspectMfa();
    mark("REOPEN_NATIVE_WITH_MISSING_MFA_KEY");
    // Same disposable D1, but remove encryption key on local-only config.
    // Previously enabled MFA must block a sensitive request, even if a
    // stored step-up timestamp is fresh.
    delete configData.vars.APPLICATION_MANAGEMENT_MFA_ENCRYPTION_KEY;
    writeJson(CONFIG,configData,false);
    child=launch(hostPort);
    await ready(child,base,readbackKey,"cloudflare-production");
    const missingKey=await protectedPost(base,cookie2);
    assert.equal(missingKey.status,403,"BLOCKED_MFA_MISSING_KEY_HTTP_STATUS");
    const missingJSON=await missingKey.json().catch(()=>({}));
    assert.equal(missingJSON.code,"STEP_UP_REQUIRED","BLOCKED_MFA_MISSING_KEY_BYPASS");
    success=true;
    console.log(JSON.stringify({checkpoint:"P0_MFA_NATIVE_WORKER_D1_VERIFIED",
      appManagerSha:EXPECTED,localWorkerChannel:"cloudflare-production",
      target:"127.0.0.1_ONLY",twoSessions:true,
      ownerBootstrap:true,noSessionRejected:true,invalidTotpRejected:true,
      validTotpAccepted:true,unverifiedStepupRejected:true,
      verifiedStepupHonored:true,
      independentNativeD1Readback:true,missingKeyFailClosed:true,
      productionTouched:false,productionAuthRealEnvironment:"NOT_TESTED",
      fullLockParity:false,globalProcessQuiescence:"NOT_PROVEN",
      ci:"PENDING",globalD1:"10/10 BLOCKED"}));
  }finally{
    try{if(child)await stop(child,hostPort);stopped=true}
    catch(e){console.error("BLOCKED_QA_STOP: "+scrub(e?.message||e))}
    try{rmSync(CONFIG,{force:true})}catch(e){
      console.error("BLOCKED_QA_CONFIG_DELETE: "+scrub(e?.message||e))}
    erased=!existsSync(CONFIG);
    console.log("MFA_NATIVE_D1_EVIDENCE_RETAINED="+QA);
    if(!success||!stopped||!erased){
      process.exitCode=1;
      console.error("P0_MFA_NATIVE_QA_NOT_PASSED: "+JSON.stringify({
        phase,verified:success,treeStopped:stopped,secretConfigRemoved:erased
      }));
    }
  }
  assert.ok(success&&stopped&&erased,"BLOCKED_MFA_NATIVE_FINISH");
  console.log(JSON.stringify({result:"P0_MFA_NATIVE_WORKER_D1_PASS",
    sha:EXPECTED,productionTouched:false,ci:"PENDING",
    globalD1:"10/10 BLOCKED"}));
}
main().catch(e=>{
  const msg=String(e?.message||e);
  // Never expose raw HTTP responses, cookie, TOTP secret or full stack.
  const sourceFrame=String(e?.stack||"").match(/p0-mfa-native-worker-d1-qa[.]mjs:(\d+):(\d+)/);
  console.error("P0_MFA_NATIVE_WORKER_D1_NOT_PASSED: "+JSON.stringify({
    phase,code:String(e?.code||e?.name||"UNKNOWN").slice(0,90),
    reason:/^BLOCKED_[A-Z0-9_]+$/.test(msg)?msg:"NON_EXPLICIT_QA_FAILURE",
    qaLine:sourceFrame?Number(sourceFrame[1]):null,
    qaColumn:sourceFrame?Number(sourceFrame[2]):null
  }));
  process.exitCode=1;
});
