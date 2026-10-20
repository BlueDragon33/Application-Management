// Blueprint OS 1.3.0 P0: real App-Manager source -> real PriceReport Worker -> disposable D1.
// The App-Manager catalog is an in-memory fixture. Production, 2FA, UI and global D1
// quiescence are explicitly OUT OF SCOPE. This does not repeat the owner-only pilot.
import assert from "node:assert/strict";
import {spawn,spawnSync} from "node:child_process";
import {randomBytes,randomUUID,webcrypto} from "node:crypto";
import {existsSync,readFileSync,writeFileSync,mkdtempSync,rmSync} from "node:fs";
import {createServer,connect} from "node:net";
import {tmpdir} from "node:os";
import {dirname,join,resolve} from "node:path";
import {fileURLToPath} from "node:url";
import {stripTypeScriptTypes} from "node:module";
import {setTimeout as sleep} from "node:timers/promises";

const APP_SHA="4709e2841f92aee8f4292e857dd1e6118822e9fe";
const PRICE_SHA="2b7f2787d2389596022d3f0cb96e62b66bdffcaa";
const APP=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const PRICE=resolve(process.env.PRICE_REPORT_QA_ROOT||resolve(APP,"..","..","PriceReport_Tunggiabao"));
const CONTROL=join(PRICE,"control-service");
const BIN=join(CONTROL,"node_modules","wrangler","bin","wrangler.js");
const ID="price-report-tunggiabao";
const env={...process.env,CI:"1",WRANGLER_SEND_METRICS:"false",GIT_TERMINAL_PROMPT:"0"};
for(const k of ["CLOUDFLARE_API_TOKEN","CLOUDFLARE_API_KEY","CLOUDFLARE_ACCOUNT_ID","CF_API_TOKEN"])delete env[k];
function git(dir,args){
  const r=spawnSync("git",["-C",dir,...args],{encoding:"utf8",timeout:15000,windowsHide:true,env});
  if(r.error||r.status!==0)throw Error("BLOCKED_GIT_READBACK: "+String(r.stderr||r.error||r.status).slice(0,180));
  return r.stdout.trim();
}
function pin(dir,sha,name){
  assert.ok(existsSync(dir),"BLOCKED_"+name+"_PATH_MISSING: "+dir);
  assert.equal(git(dir,["rev-parse","HEAD"]),sha,"BLOCKED_"+name+"_SHA_MISMATCH");
  assert.equal(git(dir,["status","--porcelain","--untracked-files=no"]),"","BLOCKED_"+name+"_DIRTY");
}
function preflight(){
  pin(APP,APP_SHA,"APPMANAGER");pin(PRICE,PRICE_SHA,"PRICEREPORT");
  assert.ok(existsSync(BIN),"BLOCKED_PINNED_WRANGLER_MISSING: "+BIN);
  assert.equal(JSON.parse(readFileSync(join(CONTROL,"node_modules","wrangler","package.json"),"utf8")).version,
    "4.151.1","BLOCKED_WRANGLER_VERSION");
  for(const p of ["src/index.ts","migrations/0001_device_control.sql","migrations/0002_automation_policy.sql"])
    assert.ok(existsSync(join(CONTROL,p)),"BLOCKED_PRICE_FILE_MISSING: "+p);
}
function managerFactory(variables){
  const source=readFileSync(join(APP,"app","open-contract.server.ts"),"utf8");
  const code=stripTypeScriptTypes(source).replace(/^import .*;$/gm,"").replace(/^export /gm,"");
  const tested=readFileSync(join(APP,"tests","price-report-app-manager-isolated-integration.test.mjs"),"utf8");
  const first=tested.indexOf("function memoryCatalog(){");
  const last=tested.indexOf("function priceReportLoopback(",first);
  assert.ok(first>=0&&last>first,"BLOCKED_APPROVED_TEST_CATALOG_FIXTURE");
  const db=new Function("assert",tested.slice(first,last)+"\nreturn memoryCatalog;")(assert)();
  const make=new Function("getControlDatabase","contractCategoryProfiles","dynamicApplicationConfig",
    "fetch","crypto","process",code+
    "\nreturn {upsertManagedCatalog,probeDynamicManagedApplications,executeUniversalAutomationCommand};");
  return {db,create:()=>make(db.getControlDatabase,{"Báo cáo":{}},x=>({...x}),
    fetch,webcrypto,{env:variables})};
}
function freePort(){
  return new Promise((ok,fail)=>{const s=createServer();s.once("error",fail);
    s.listen(0,"127.0.0.1",()=>{const n=s.address().port;s.close(e=>e?fail(e):ok(n))});});
}
function openPort(port){
  return new Promise(done=>{const s=connect({host:"127.0.0.1",port});
    s.setTimeout(300);s.once("connect",()=>{s.destroy();done(true)});
    for(const e of ["error","timeout"])s.once(e,()=>{s.destroy();done(false)});
  });
}
function wrangler(config,store,args){
  const r=spawnSync(process.execPath,[BIN,...args,"--config",config,"--persist-to",store],
    {cwd:CONTROL,windowsHide:true,encoding:"utf8",timeout:100000,
    maxBuffer:4*1024*1024,env});
  if(r.error||r.status!==0)throw Error("BLOCKED_WRANGLER_"+args[0]+": "+
    String(r.error?.message||r.stderr||r.stdout||r.status).slice(-650));
  return r.stdout;
}
function start(config,store,port,inspector){
  const child=spawn(process.execPath,
    [BIN,"dev","--local","--ip","127.0.0.1","--port",String(port),
      "--inspector-port",String(inspector),"--config",config,"--persist-to",store],
    {cwd:CONTROL,windowsHide:true,shell:false,stdio:["ignore","pipe","pipe"],env});
  child.stdout.on("data",()=>{});child.stderr.on("data",()=>{});
  return child;
}
async function statusReady(origin,secret,child){
  for(let k=0;k<70;k++){
    if(child.exitCode!==null||child.signalCode!==null)throw Error("BLOCKED_WORKER_EXITED");
    try{
      const r=await fetch(origin+"/api/control/status",{
        headers:{authorization:"Bearer "+secret},signal:AbortSignal.timeout(700)});
      if(r.ok){
        const status=await r.json();
        if(status.capabilities?.automationIdempotentCommands===true
          && status.readiness?.mutationAdminApi==="available")return;
      }
    }catch{}
    await sleep(250);
  }
  throw Error("BLOCKED_WORKER_READY_TIMEOUT");
}
async function get(origin,secret){
  const r=await fetch(origin+"/api/control/automation",{
    redirect:"manual",headers:{authorization:"Bearer "+secret},
    signal:AbortSignal.timeout(5000)});
  assert.equal(r.status,200,"PRICE_REAL_D1_INDEPENDENT_GET");
  return (await r.json()).automation;
}
async function stop(child,port){
  if(child&&child.exitCode===null&&child.signalCode===null&&child.pid){
    if(process.platform==="win32"){
      const r=spawnSync("taskkill",["/PID",String(child.pid),"/T","/F"],
        {encoding:"utf8",windowsHide:true,timeout:20000,env});
      if(r.status!==0&&child.exitCode===null)throw Error("BLOCKED_CAPTURES_QA_TREE_NOT_STOPPED");
    }else child.kill("SIGTERM");
  }
  for(let i=0;i<40;i++){if(!await openPort(port))return;await sleep(250)}
  throw Error("BLOCKED_QA_PORT_STILL_LISTENING");
}
function independentSql(config,store,db){
  const out=wrangler(config,store,["d1","execute",db,"--local","--json",
    "--command","SELECT auto_approve_devices,auto_block_pending_devices,pending_block_after_hours,revision FROM kt_automation_policy WHERE id=1"]);
  const i=out.indexOf("[");assert.ok(i>=0,"BLOCKED_CLI_D1_JSON_NOT_FOUND");
  const row=JSON.parse(out.slice(i)).flatMap(x=>x.results||[])[0];
  assert.ok(row,"BLOCKED_CLI_D1_POLICY_MISSING");return row;
}
async function main(){
  preflight();
  const temp=mkdtempSync(join(tmpdir(),"app-price-real-d1-"));
  const config=join(temp,"qa-wrangler.jsonc"),store=join(temp,"sqlite");
  const secret=randomBytes(48).toString("base64url");
  const key=randomBytes(32).toString("base64url");
  const db="price-p0-qa-"+randomBytes(6).toString("hex");
  const port=await freePort(),inspector=await freePort();
  assert.notEqual(port,inspector,"BLOCKED_PORT_COLLISION");
  const origin="http://127.0.0.1:"+port;
  writeFileSync(config,JSON.stringify({
    name:"price-p0-qa-"+randomBytes(5).toString("hex"),
    main:join(CONTROL,"src","index.ts"),
    compatibility_date:"2026-09-22",compatibility_flags:["nodejs_compat"],
    d1_databases:[{binding:"DB",database_name:db,
      database_id:"00000000-0000-0000-0000-000000000004",
      migrations_dir:join(CONTROL,"migrations")}],
    vars:{PRICE_REPORT_CONTROL_SERVICE_SECRET:secret,
      PRICE_REPORT_APP_ORIGIN:"http://127.0.0.1:5173",
      APPLICATION_MANAGEMENT_ORIGIN:"http://127.0.0.1:8788"}
  },null,2),{mode:0o600,flag:"wx"});
  let child=null,clean=false,passed=false;
  try{
    // Real PriceReport migrations on a brand new disposable --persist-to; never --remote.
    wrangler(config,store,["d1","migrations","apply",db,"--local"]);
    child=start(config,store,port,inspector);
    await statusReady(origin,secret,child);
    const managers=managerFactory({...process.env,LOCAL_DEV_AUTH:"1",
      CONTROL_PLANE_NETWORK_MODE:"local",
      MANAGED_APP_CREDENTIAL_ENCRYPTION_KEY:key});
    const owner={role:"owner",email:"p0-qa@example.invalid",deviceId:"0".repeat(64)};
    const api=managers.create();
    await api.upsertManagedCatalog({id:ID,name:"PriceReport P0",category:"Báo cáo",
      origin,contractPath:"/api/control/status",credential:secret},owner);
    const saved=managers.db.rows.get(ID);
    assert.ok(saved?.credential_ciphertext&&saved.credential_iv,"QA_AES_NOT_PERSISTED");
    assert.ok(!JSON.stringify(saved).includes(secret),"QA_SECRET_PLAINTEXT");
    const [pre]=await api.probeDynamicManagedApplications([ID],{automationOnly:true});
    assert.deepEqual(pre.automation,{autoApproveDevices:false,autoBlockPendingDevices:false,
      pendingBlockAfterHours:168});
    const desired={autoApproveDevices:true,autoBlockPendingDevices:true,pendingBlockAfterHours:24};
    const result=await api.executeUniversalAutomationCommand({appId:ID,
      commandId:randomUUID(),expected:pre.automation,desired},owner);
    assert.equal(result.ok,true);
    for(const [k,v] of Object.entries(desired))assert.equal(result.automation[k],v);
    const independent=await get(origin,secret);
    for(const [k,v] of Object.entries(desired))assert.equal(independent[k],v);
    assert.equal(independent.revision,2);
    await stop(child,port);child=null;
    const sql=independentSql(config,store,db);
    assert.equal(sql.auto_approve_devices,1);
    assert.equal(sql.auto_block_pending_devices,1);
    assert.equal(sql.pending_block_after_hours,24);
    assert.equal(sql.revision,2);
    child=start(config,store,port,inspector);
    await statusReady(origin,secret,child);
    const afterRestart=await get(origin,secret);
    for(const [k,v] of Object.entries(desired))assert.equal(afterRestart[k],v);
    assert.equal(afterRestart.revision,2);
    const [reopen]=await managers.create().probeDynamicManagedApplications([ID],{automationOnly:true});
    for(const [k,v] of Object.entries(desired))assert.equal(reopen.automation[k],v);
    passed=true;
  }finally{
    try{await stop(child,port);clean=!await openPort(port)}
    catch(e){console.error("BLOCKED_QA_SHUTDOWN:",String(e));clean=false}
    try{rmSync(config,{force:true})}catch{}
    if(clean&&passed)rmSync(temp,{recursive:true,force:true,maxRetries:4,retryDelay:250});
    else{
      console.error("QA_DISPOSABLE_EVIDENCE_RETAINED: "+temp);
      if(!clean)console.error("BLOCKED_QA_PROCESS_QUIESCENCE");
      process.exitCode=1;
    }
  }
  if(!clean)throw Error("BLOCKED_QA_LISTENER_NOT_CLOSED");
  console.log(JSON.stringify({result:"P0_REAL_PRICE_WORKER_D1_INTEGRATION_PASS",
    appManagerSha:APP_SHA,priceReportSha:PRICE_SHA,appManagerSource:"REAL",
    priceReportWorker:"REAL",priceReportD1:"DISPOSABLE_REAL",
    appManagerCatalog:"IN_MEMORY_FIXTURE",encryptedCredential:true,
    sourceWrite:true,independentHttpGet:true,independentCliD1Read:true,
    restartGet:true,reopenedManager:true,productionTouched:false,
    ci:"PENDING",globalD1:"10/10 BLOCKED"}));
}
main().catch(e=>{console.error("P0_REAL_D1_NOT_PASSED:",e.message||String(e));process.exitCode=1});
