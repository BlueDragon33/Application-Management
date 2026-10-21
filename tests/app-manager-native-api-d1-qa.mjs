// Blueprint OS 1.3.0 — P0 App-Manager native Worker API + D1 local QA.
// Isolated QA only, using actual Vinext App Router /api/device + /api/managed-apps.
// Rejects localhost signature bypass: all HTTP requests use 127.0.0.1.
// Makes genuine ECDSA P-256 device proofs through the API (never injected owner).
// Must NOT be conflated with Production auth/2FA, UI, or global D1 quiescence.
// No previously passed pilot is rerun. Not an in-memory DB/CLI SQL bridge.
import assert from "node:assert/strict";
import {spawn,spawnSync} from "node:child_process";
import {randomBytes,randomUUID,webcrypto} from "node:crypto";
import {existsSync,readFileSync,writeFileSync,mkdirSync,rmSync} from "node:fs";
import {createServer,connect} from "node:net";
import {join,resolve,dirname} from "node:path";
import {fileURLToPath} from "node:url";
import {setTimeout as delay} from "node:timers/promises";

const QA_ROOT=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const EXPECTED_HEAD=process.env.APP_MANAGER_NATIVE_D1_QA_HEAD??"";
const VITE=join(QA_ROOT,"node_modules","vite","bin","vite.js");
const WRANGLER=join(QA_ROOT,"node_modules","wrangler","bin","wrangler.js");
const QA_DIR=join(QA_ROOT,".wrangler","p0-native-api-qa");
// Do not touch the Vite/Wrangler default .wrangler/state; it may contain prior QA evidence.
const STATE=join(QA_DIR,"persist");
const CONFIG=join(QA_DIR,"wrangler.qa.jsonc");
const QA_VITE_CONFIG=join(QA_DIR,"vite.qa.mjs");
const DB_NAME="app-native-p0-"+randomBytes(6).toString("hex");
const APP_ID="price-report-tunggiabao";
const OWNER="p0-native-qa@example.invalid";
const cliEnv={...process.env,CI:"1",WRANGLER_SEND_METRICS:"false",
  GIT_TERMINAL_PROMPT:"0",npm_config_update_notifier:"false",
  CLOUDFLARE_SEND_METRICS:"false"};
for(const key of Object.keys(cliEnv)){
  if(/(?:^|_)(?:API_KEY|API_TOKEN|SECRET|PASSWORD|PRIVATE_KEY|ACCESS_TOKEN)$|^(?:NEON|VERCEL|GOOGLE|CLOUDFLARE)_/i.test(key)
    || key==="CLOUDFLARE_ENV" || key==="NODE_OPTIONS")delete cliEnv[key];
}
function exec(cmd,args,extra={}){
  const r=spawnSync(cmd,args,{cwd:QA_ROOT,env:cliEnv,encoding:"utf8",windowsHide:true,
    timeout:130000,maxBuffer:4*1024*1024,...extra});
  if(r.error||r.status!==0)throw Error("BLOCKED_PROCESS_"+String(args[0])+": "+
    String(r.error?.message||r.stderr||r.stdout||r.status).slice(-600));
  return r.stdout.trim();
}
function git(...args){return exec("git",["-C",QA_ROOT,...args])}
function exactSource(path,hash){
  assert.equal(git("rev-parse","HEAD:"+path),hash,"BLOCKED_SOURCE_BLOB_MISMATCH: "+path);
}
function preflight(){
  assert.equal(process.platform,"win32","BLOCKED_WINDOWS_QA_ONLY");
  assert.match(QA_ROOT,/^[a-z]:\\BaumanWeb\\_qa\\AppManager-P0-native-/i,
    "BLOCKED_WORKTREE_NOT_UNDER_ISOLATED_QA");
  assert.match(EXPECTED_HEAD,/^[a-f0-9]{40}$/,"BLOCKED_EXACT_SHA_REQUIRED");
  assert.equal(git("rev-parse","HEAD"),EXPECTED_HEAD,"BLOCKED_HEAD_MISMATCH");
  assert.equal(git("branch","--show-current"),"","BLOCKED_QA_NOT_DETACHED");
  assert.equal(git("status","--porcelain","--untracked-files=no"),"","BLOCKED_QA_DIRTY_TRACKED_FILES");
  exactSource("worker/index.ts","cd7af7e929238ae47e960308bdff82fdf80a9517");
  exactSource("worker/preview-access.ts","333b09468c5ddcef7b88c9e5d32a0bc18639c231");
  exactSource("app/control-device.server.ts","21848f7f98466bd57d5238f91a4ab90a9885dbdf");
  exactSource("app/api/managed-apps/route.ts","e8089df2ef208c66918b3547612ba92c8b8e1057");
  exactSource("drizzle/0005_managed_app_catalog.sql","d66ccf0399223dde36b8cbcdc8d1c7750f8d15a3");
  assert.ok(existsSync(VITE)&&existsSync(WRANGLER),
    "BLOCKED_QA_NODE_MODULES_MISSING: Only offline npm ci in this detached QA worktree is permitted");
  // Never inherit user/Production credential dotenv files into disposable Worker.
  for(const p of [".dev.vars",".env",".env.local",".dev.vars.local"])
    assert.equal(existsSync(join(QA_ROOT,p)),false,
      "BLOCKED_UNEXPECTED_QA_ENV_FILE: "+p);
  const pkg=JSON.parse(readFileSync(join(QA_ROOT,"node_modules","wrangler","package.json"),"utf8"));
  const vite=JSON.parse(readFileSync(join(QA_ROOT,"node_modules","vite","package.json"),"utf8"));
  assert.equal(pkg.version,"4.92.0","BLOCKED_NATIVE_WRANGLER_LOCK_MISMATCH");
  assert.equal(vite.version,"8.0.13","BLOCKED_NATIVE_VITE_LOCK_MISMATCH");
  assert.ok(!existsSync(QA_DIR),
    "BLOCKED_QA_PRIVATE_NAMESPACE_ALREADY_EXISTS: retain earlier QA state");
  assert.ok(existsSync(join(QA_ROOT,"build","sites-vite-plugin.ts")),
    "BLOCKED_REQUIRED_SITES_VITE_PLUGIN_MISSING");
}
function freePort(){
  return new Promise((ok,fail)=>{
    const srv=createServer();srv.once("error",fail);
    srv.listen(0,"127.0.0.1",()=>{
      const port=srv.address().port;srv.close(e=>e?fail(e):ok(port));
    });
  });
}
function openPort(port){return new Promise(done=>{
  const sock=connect({host:"127.0.0.1",port});let once=false;
  const finish=ok=>{if(once)return;once=true;sock.destroy();done(ok)};
  sock.setTimeout(250);sock.once("connect",()=>finish(true));
  sock.once("error",()=>finish(false));sock.once("timeout",()=>finish(false));
})}
function argsD1(parts){
  return [WRANGLER,"d1",...parts,"--local","--config",CONFIG,"--persist-to",STATE];
}
function sqlRead(){
  const out=exec(process.execPath,argsD1(["execute",DB_NAME,"--command",
    "SELECT id,name,category,origin,contract_path,created_by,credential_ciphertext,credential_iv FROM managed_app_catalog WHERE id='price-report-tunggiabao'","--json"]));
  const at=out.indexOf("[");
  assert.ok(at>=0,"BLOCKED_D1_CLI_JSON_MISSING");
  const data=JSON.parse(out.slice(at));
  const row=data.flatMap(x=>x.results||[])[0];
  assert.ok(row?.credential_ciphertext&&row?.credential_iv,"BLOCKED_REAL_D1_ROW_MISSING");
  return row;
}
function launch(port){
  const env={...cliEnv,CLOUDFLARE_VITE_WRANGLER_CONFIG_PATH:CONFIG,
    // Force local-only resolution for contract-origin validation. This never
    // enables the localhost signature-bypass because requests use 127.0.0.1.
    CONTROL_PLANE_NETWORK_MODE:"local",
    WRANGLER_SEND_METRICS:"false"};
  const child=spawn(process.execPath,[VITE,"--config",QA_VITE_CONFIG,
    "--host","127.0.0.1","--port",String(port),"--strictPort"],{
    cwd:QA_ROOT,env,windowsHide:true,shell:false,stdio:["ignore","pipe","pipe"]
  });
  const logs=[];
  for(const stream of [child.stdout,child.stderr])
    stream.on("data",v=>{logs.push(String(v).slice(-1400));if(logs.length>12)logs.shift()});
  child.on("error",e=>{logs.push(String(e.message||e))});
  return child;
}
async function stop(child,port){
  if(child&&child.exitCode===null&&child.signalCode===null&&child.pid){
    // Kill only the captured QA Vite PID and its descendants. Never global node/taskkill.
    const r=spawnSync("taskkill",["/PID",String(child.pid),"/T","/F"],
      {windowsHide:true,timeout:25000,encoding:"utf8",env:cliEnv});
    if(r.status!==0&&child.exitCode===null)
      throw Error("BLOCKED_CAPTURED_QA_TREE_STOP_FAILED");
  }
  for(let i=0;i<70;i++){
    if(!await openPort(port)){
      if(child){
        for(let j=0;j<80&&child.exitCode===null&&child.signalCode===null;j++)await delay(100);
        if(child.exitCode===null&&child.signalCode===null)
          throw Error("BLOCKED_QA_VITE_ROOT_STILL_RUNNING");
      }
      return;
    }
    await delay(220);
  }
  throw Error("BLOCKED_QA_LISTENER_STILL_OPEN");
}
async function request(origin,secret,path,body){
  const r=await fetch(origin+path,{method:"POST",redirect:"manual",
    headers:{"content-type":"application/json",authorization:"Bearer "+secret},
    body:JSON.stringify(body),signal:AbortSignal.timeout(30000)});
  const data=await r.json().catch(()=>({}));
  return {status:r.status,data};
}
async function ready(origin,secret,child){
  for(let i=0;i<100;i++){
    if(child.exitCode!==null||child.signalCode!==null)throw Error("BLOCKED_VITE_WORKER_EXITED");
    try{
      const r=await fetch(origin+"/__deployment",{redirect:"manual",
        headers:{authorization:"Bearer "+secret},signal:AbortSignal.timeout(1500)});
      if(r.status===200){
        const json=await r.json();
        assert.equal(json.channel,"cloudflare-preview","BLOCKED_WRONG_APP_WORKER_CHANNEL");
        if(json.databaseReady===true) return;
      }
    }catch(e){if(String(e).includes("BLOCKED_WRONG"))throw e}
    await delay(250);
  }
  throw Error("BLOCKED_APP_WORKER_OR_NATIVE_D1_NOT_READY");
}
function base64url(bytes){return Buffer.from(bytes).toString("base64url")}
async function register(origin,secret,key){
  const publicKey=await webcrypto.subtle.exportKey("jwk",key.publicKey);
  const r=await request(origin,secret,"/api/device",{action:"register",publicKey});
  assert.equal(r.status,200,"BLOCKED_QA_DEVICE_REGISTER_FAILED");
  assert.equal(r.data.device?.status,"approved","BLOCKED_QA_DEVICE_NOT_APPROVED");
  assert.equal(r.data.device?.role,"owner","BLOCKED_QA_DEVICE_OWNER_NOT_GROUNDED");
  assert.match(r.data.device.deviceId,/^[a-f0-9]{64}$/);
  return r.data.device.deviceId;
}
async function signedProof(origin,secret,deviceId,key){
  const challenge=await request(origin,secret,"/api/device",{action:"challenge",deviceId});
  assert.equal(challenge.status,200,"BLOCKED_QA_CHALLENGE_MISSING");
  assert.match(challenge.data.challenge,/^[A-Za-z0-9_-]{40,100}$/);
  const message=new TextEncoder().encode(
    "learning-control:"+deviceId+":"+challenge.data.challenge);
  const signature=await webcrypto.subtle.sign({name:"ECDSA",hash:"SHA-256"},
    key.privateKey,message);
  return {proofDeviceId:deviceId,challenge:challenge.data.challenge,
    signature:base64url(new Uint8Array(signature))};
}
async function command(origin,secret,deviceId,key,action,extra={}){
  const proof=await signedProof(origin,secret,deviceId,key);
  return request(origin,secret,"/api/managed-apps",{action,...extra,...proof});
}
async function unauthorizedChecks(origin,secret,deviceId,key){
  const noBearer=await fetch(origin+"/api/managed-apps",{method:"POST",redirect:"manual",
    headers:{"content-type":"application/json",
      "oai-authenticated-user-email":OWNER,
      "oai-authenticated-user-id":"spoof-owner"},
    body:JSON.stringify({action:"list"}),signal:AbortSignal.timeout(15000)});
  assert.equal(noBearer.status,401,"BLOCKED_PREVIEW_ACCESS_NOT_ENFORCED");
  const noProof=await request(origin,secret,"/api/managed-apps",{action:"list"});
  assert.notEqual(noProof.status,200,"BLOCKED_MISSING_DEVICE_PROOF_ACCEPTED");
  const proof=await signedProof(origin,secret,deviceId,key);
  const wrongSig=base64url(randomBytes(64));
  const bad=await request(origin,secret,"/api/managed-apps",
    {action:"list",...proof,signature:wrongSig});
  assert.equal(bad.status,403,"BLOCKED_INVALID_P256_SIGNATURE_ACCEPTED");
  assert.equal(bad.data.code,"DEVICE_MISMATCH","BLOCKED_P256_SIGNATURE_CHECK_UNPROVEN");
}
async function main(){
  preflight(); // Must happen BEFORE touching QA disk or starting network services.
  const secret=randomBytes(48).toString("base64url");
  const master=randomBytes(32).toString("base64url");
  mkdirSync(QA_DIR,{recursive:true});
  // Only the QA Vite configuration can override persistState. The real
  // application Vite config is not modified, and the plugin suite remains
  // Vinext + sites + Cloudflare as in the app's source vite.config.ts.
  const viteQaSource=[
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
    'viteEnvironment:{name:"rsc",childEnvironments:["ssr"]},',
    'inspectorPort:false',
    '})]',
    '});'
  ].join("\n");
  writeFileSync(QA_VITE_CONFIG,viteQaSource,{mode:0o600,flag:"wx"});
  assert.ok(!existsSync(STATE),"BLOCKED_NONEMPTY_NEW_PRIVATE_D1_NAMESPACE");
  // Temporary credentials are disposable QA-only. This file is never committed.
  writeFileSync(CONFIG,JSON.stringify({
    name:DB_NAME,
    main:join(QA_ROOT,"worker","index.ts"),
    compatibility_date:"2026-09-10",
    compatibility_flags:["nodejs_compat"],
    assets:{binding:"ASSETS",run_worker_first:true},
    d1_databases:[{binding:"DB",database_name:DB_NAME,
      database_id:randomUUID(),migrations_dir:join(QA_ROOT,"drizzle")}],
    vars:{
      APPLICATION_MANAGEMENT_DEPLOYMENT_CHANNEL:"cloudflare-preview",
      APPLICATION_MANAGEMENT_ACCESS_MODE:"standalone",
      APPLICATION_MANAGEMENT_BUILD_REVISION:EXPECTED_HEAD,
      CONTROL_OWNER_EMAILS:OWNER,
      CONTROL_PLANE_NETWORK_MODE:"local",
      APPLICATION_MANAGEMENT_PREVIEW_ACCESS_SECRET:secret,
      MANAGED_APP_CREDENTIAL_ENCRYPTION_KEY:master,
    }
  },null,2),{mode:0o600,flag:"wx"});
  let child=null,port=0,passed=false,safeStop=false,configErased=false;
  try{
    exec(process.execPath,argsD1(["migrations","apply",DB_NAME]));
    const rowPre=exec(process.execPath,argsD1(["execute",DB_NAME,
      "--command","SELECT count(*) AS n FROM managed_app_catalog","--json"]));
    assert.ok(rowPre.includes('"n"'),"BLOCKED_QA_D1_PREMIGRATION_CHECK");
    port=await freePort();
    const origin="http://127.0.0.1:"+port;
    child=launch(port);
    await ready(origin,secret,child);
    const key=await webcrypto.subtle.generateKey({name:"ECDSA",namedCurve:"P-256"},
      true,["sign","verify"]);
    const deviceId=await register(origin,secret,key);
    await unauthorizedChecks(origin,secret,deviceId,key);
    const item={id:APP_ID,name:"PriceReport P0 Native API",
      shortName:"PriceReport QA",category:"Báo cáo",
      origin:"http://127.0.0.1:1",contractPath:"/api/control/status",
      credential:randomBytes(48).toString("base64url")};
    const first=await command(origin,secret,deviceId,key,"upsert",item);
    assert.equal(first.status,200,"BLOCKED_NATIVE_API_UPSERT_FAILED");
    assert.equal(first.data.ok,true,"BLOCKED_NATIVE_API_UPSERT_NOT_OK");
    const list=await command(origin,secret,deviceId,key,"list");
    assert.equal(list.status,200,"BLOCKED_NATIVE_API_OWNER_GET_FAILED");
    const entry=list.data.apps?.find(x=>x.id===APP_ID);
    assert.equal(entry?.name,item.name,"BLOCKED_NATIVE_API_GET_ROW_MISSING");
    assert.equal(entry?.credentialConfigured,true,"BLOCKED_NATIVE_API_CREDENTIAL_MISSING");
    assert.ok(!JSON.stringify(list.data).includes(item.credential),"BLOCKED_API_PLAINTEXT_EXPOSED");
    const before=sqlRead();
    assert.equal(before.created_by,OWNER);
    assert.ok(!JSON.stringify(before).includes(item.credential),"BLOCKED_D1_CREDENTIAL_PLAINTEXT");
    const encryptedHash=Buffer.from(before.credential_ciphertext+"."+before.credential_iv)
      .toString("base64url");
    const updatedName="PriceReport P0 Native API Reopen";
    const updated=await command(origin,secret,deviceId,key,"upsert",
      {...item,name:updatedName,credential:""});
    assert.equal(updated.status,200,"BLOCKED_NATIVE_API_UPDATE_FAILED");
    const persisted=sqlRead();
    assert.equal(persisted.name,updatedName,"BLOCKED_NATIVE_D1_READBACK_STALE");
    assert.equal(Buffer.from(persisted.credential_ciphertext+"."+persisted.credential_iv)
      .toString("base64url"),encryptedHash,"BLOCKED_BLANK_CREDENTIAL_REWRITTEN");
    await stop(child,port);
    child=null;
    assert.equal(await openPort(port),false,"BLOCKED_PORT_AFTER_STOP");
    child=launch(port); // Assign before readiness so finally always captures the PID.
    await ready(origin,secret,child);
    const reopened=await command(origin,secret,deviceId,key,"list");
    assert.equal(reopened.status,200,"BLOCKED_NATIVE_API_REOPEN_GET_FAILED");
    const final=reopened.data.apps?.find(x=>x.id===APP_ID);
    assert.equal(final?.name,updatedName,"BLOCKED_NATIVE_RESTART_CATALOG_NOT_PERSISTED");
    assert.equal(final?.credentialConfigured,true,"BLOCKED_NATIVE_RESTART_CREDENTIAL_MISSING");
    const row=sqlRead();
    assert.equal(row.name,updatedName,"BLOCKED_INDEPENDENT_D1_AFTER_RESTART");
    assert.equal(Buffer.from(row.credential_ciphertext+"."+row.credential_iv)
      .toString("base64url"),encryptedHash,"BLOCKED_D1_AES_CIPHER_CHANGED_AFTER_RESTART");
    passed=true;
    console.log(JSON.stringify({checkpoint:"APP_NATIVE_WORKER_API_D1_READBACK_VERIFIED",
      appManagerSha:EXPECTED_HEAD,api:"/api/managed-apps",
      httpWorker:"ACTUAL_VINEXT_APP_ROUTER",d1:"NATIVE_CLOUDFLARE_BINDING",
      p256DeviceSignature:true,previewSecretGate:true,
      nativeWrite:true,independentD1CliRead:true,workerRestartGet:true,
      plaintextCredentialExposure:false,productionTouched:false,
      nativeProductionAuth:"NOT_TESTED",mfa:"NOT_TESTED",
      globalD1Quiescence:"BLOCKED"}));
  }finally{
    try{if(child&&port)await stop(child,port);safeStop=port?!(await openPort(port)):true}
    catch(e){console.error("BLOCKED_QA_WORKER_SHUTDOWN:",e.message||String(e))}
    try{rmSync(CONFIG,{force:true});configErased=!existsSync(CONFIG)}
    catch(e){console.error("BLOCKED_QA_SECRET_CONFIG_ERASURE:",e.message||String(e))}
    console.log("QA_NATIVE_D1_STATE_RETAINED_FOR_SEPARATE_CENSUS: "+STATE);
    console.log("QA_DEFAULT_WRANGLER_STATE_UNTOUCHED_BY_DESIGN: "+join(QA_ROOT,".wrangler","state"));
    if(!safeStop||!configErased||!passed){
      if(!safeStop)console.error("BLOCKED_CAPTURED_QA_PROCESS_NOT_EXITED");
      if(!configErased)console.error("BLOCKED_QA_SECRET_CONFIG_REMAINS");
      process.exitCode=1;
    }
  }
  assert.ok(safeStop&&configErased&&passed,"BLOCKED_NATIVE_QA_CLEANUP_OR_VERIFICATION");
  console.log(JSON.stringify({result:"P0_APP_MANAGER_NATIVE_API_D1_PASS",
    sha:EXPECTED_HEAD,ownerProof:"P256_VERIFIED",unauthorized:"REJECTED",
    savedAndReopened:true,independentCliReadback:true,
    productionTouched:false,ci:"PENDING",globalD1:"10/10 BLOCKED",
    globalProcessQuiescence:"NOT_PROVEN"}));
}
main().catch(e=>{
  console.error("P0_NATIVE_WORKER_API_D1_NOT_PASSED:",e.message||String(e));
  process.exitCode=1;
});
