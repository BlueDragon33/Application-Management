// Blueprint OS 1.3.0 P0 Universal Contract E2E: actual App-Manager Vinext Worker
// and native D1 -> actual PriceReport Worker and independent native D1.
// Never run previous pilot scripts. This is a new integrated two-owner journey.
// Preview-secret + P-256 here do NOT constitute Production SSO, 2FA, or release.
import assert from "node:assert/strict";
import {spawn,spawnSync} from "node:child_process";
import {randomBytes,randomUUID,webcrypto} from "node:crypto";
import {existsSync,mkdirSync,writeFileSync,rmSync,readFileSync,readdirSync,statSync,lstatSync} from "node:fs";
import {DatabaseSync} from "node:sqlite";
import {dirname,join,resolve,relative,sep} from "node:path";
import {fileURLToPath} from "node:url";
import {createServer,connect} from "node:net";
import {setTimeout as sleep} from "node:timers/promises";

const APP=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const PRICE=resolve(process.env.PRICE_REPORT_E2E_QA_ROOT||"");
const CONTROL=join(PRICE,"control-service");
const PRICE_DEPS=resolve(process.env.PRICE_REPORT_E2E_QA_DEPS_ROOT||CONTROL);
const APP_SHA=process.env.APP_MANAGER_E2E_QA_HEAD||"";
const PRICE_SHA="2b7f2787d2389596022d3f0cb96e62b66bdffcaa";
const APP_ID="price-report-tunggiabao";
const OWNER="p0-native-e2e@example.invalid";
const QA=join(APP,".wrangler","p0-universal-native-e2e-"+randomBytes(8).toString("hex"));
const APP_STATE=join(QA,"app-state"),PRICE_STATE=join(QA,"price-state");
const APP_CONFIG=join(QA,"app-wrangler.jsonc"),PRICE_CONFIG=join(QA,"price-wrangler.jsonc");
const VITE_CONFIG=join(QA,"vite-e2e.mjs");
const VITE=join(APP,"node_modules","vite","bin","vite.js");
const APP_WRANGLER=join(APP,"node_modules","wrangler","bin","wrangler.js");
const PRICE_WRANGLER=join(PRICE_DEPS,"node_modules","wrangler","bin","wrangler.js");
const VERIFIED_WORKERD=join(PRICE_DEPS,"node_modules","@cloudflare","workerd-windows-64","bin","workerd.exe");
const APP_DB="app-e2e-"+randomBytes(5).toString("hex");
const PRICE_DB="price-e2e-"+randomBytes(5).toString("hex");
const env={...process.env,CI:"1",WRANGLER_SEND_METRICS:"false",
  CLOUDFLARE_SEND_METRICS:"false",GIT_TERMINAL_PROMPT:"0"};
const secrets=[];
for(const k of Object.keys(env))
  if(/(?:^|_)(?:API_KEY|API_TOKEN|SECRET|PASSWORD|PRIVATE_KEY|ACCESS_TOKEN)$|^(?:CLOUDFLARE|GOOGLE|NEON|VERCEL)_/i.test(k)
    || k==="NODE_OPTIONS"||k==="MINIFLARE_WORKERD_PATH")delete env[k];
function redact(s){
  let txt=String(s||"");
  for(const v of secrets)if(v)txt=txt.replaceAll(v,"[QA_SECRET_REDACTED]");
  txt=txt.replace(/Bearer\s+\S+/gi,"Bearer [REDACTED]")
    .replace(/[A-Za-z0-9_-]{42,}/g,"[REDACTED_OPAQUE]");
  return txt.slice(-1250);
}
function exec(bin,args,cwd=APP){
  const r=spawnSync(bin,args,{cwd,env,encoding:"utf8",windowsHide:true,
    timeout:125000,maxBuffer:4*1024*1024});
  if(r.error||r.status!==0)throw Error("BLOCKED_PROCESS_"+String(args.slice(0,3).join("_"))+
    ": "+redact(r.error?.message||r.stderr||r.stdout||r.status));
  return r.stdout;
}
function git(dir,...parts){return exec("git",["-C",dir,...parts]) .trim()}
function blob(dir,path,expected){
  assert.equal(git(dir,"rev-parse","HEAD:"+path),expected,"BLOCKED_SOURCE_DRIFT: "+path);
}
function version(root,name,expected){
  const path=join(root,"node_modules",...name.split("/"),"package.json");
  assert.ok(existsSync(path),"BLOCKED_DEPENDENCY_MISSING: "+name);
  assert.equal(JSON.parse(readFileSync(path,"utf8")).version,expected,"BLOCKED_DEPENDENCY_LOCK: "+name);
}
function preflight(){
  assert.equal(process.platform,"win32","BLOCKED_WINDOWS_QA_REQUIRED");
  assert.ok(/^[a-z]:\\BaumanWeb\\_qa\\AppManager-P0-native-/i.test(APP),
    "BLOCKED_NON_QA_APP_ROOT");
  assert.ok(/^[a-z]:\\BaumanWeb\\_qa\\price-/i.test(PRICE),
    "BLOCKED_NON_QA_PRICE_ROOT");
  assert.match(APP_SHA,/^[a-f0-9]{40}$/,"BLOCKED_APP_SHA_REQUIRED");
  assert.equal(git(APP,"rev-parse","HEAD"),APP_SHA,"BLOCKED_APP_HEAD");
  assert.equal(git(APP,"branch","--show-current"),"","BLOCKED_APP_MUST_BE_DETACHED");
  assert.equal(git(APP,"status","--porcelain","--untracked-files=no"),"","BLOCKED_APP_DIRTY");
  assert.equal(git(PRICE,"rev-parse","HEAD"),PRICE_SHA,"BLOCKED_PRICE_HEAD");
  assert.equal(git(PRICE,"branch","--show-current"),"","BLOCKED_PRICE_MUST_BE_DETACHED");
  assert.equal(git(PRICE,"status","--porcelain","--untracked-files=no"),"","BLOCKED_PRICE_DIRTY");
  blob(APP,"app/open-contract.server.ts","342f744ae90ec37e379dce9f6b647e454a3ceccd");
  blob(APP,"app/api/managed-apps/route.ts","e8089df2ef208c66918b3547612ba92c8b8e1057");
  blob(APP,"app/api/operations-auto-approval/route.ts","ec6bcaab9c6a60dd69591df4830e97017e8b7485");
  blob(APP,"app/operations-settings.server.ts","5d3a7865b157262d1e92dd26210bac696a4bb435");
  blob(APP,"app/application-registry.ts","1a72ab309db0fca3b11cbd45e5a5b099a3a4e9dd");
  blob(APP,"worker/index.ts","cd7af7e929238ae47e960308bdff82fdf80a9517");
  blob(PRICE,"control-service/src/index.ts","828f1e1f5f7783b5b18e98b3c9d74bc439d6c120");
  blob(PRICE,"control-service/src/automation-store.ts","2c044c9b28466a06d80ec3d5b149ecb03f3eb7a2");
  blob(PRICE,"control-service/migrations/0002_automation_policy.sql",
    "c4761db2a0481e355e612434299fec63233f48e8");
  for(const p of [".env",".dev.vars",".env.local",".dev.vars.local"]){
    assert.ok(!existsSync(join(APP,p))&&!existsSync(join(CONTROL,p)),
      "BLOCKED_UNEXPECTED_QA_ENV: "+p);
  }
  version(APP,"vite","8.0.13");
  version(APP,"wrangler","4.92.0");
  version(APP,"@cloudflare/vite-plugin","1.37.1");
  version(PRICE_DEPS,"wrangler","4.151.1");
  version(PRICE_DEPS,"workerd","1.20261012.1");
  version(PRICE_DEPS,"@cloudflare/workerd-windows-64","1.20261012.1");
  assert.ok(existsSync(VERIFIED_WORKERD)&&existsSync(VITE)&&existsSync(PRICE_WRANGLER),
    "BLOCKED_OFFLINE_BINARIES_MISSING");
  const workerBinary=spawnSync(VERIFIED_WORKERD,["--version"],{
    cwd:CONTROL,env,encoding:"utf8",windowsHide:true,timeout:12000
  });
  assert.equal(workerBinary.status,0,"BLOCKED_WORKERD_BINARY_EXIT");
  assert.ok((String(workerBinary.stdout||"")+"\n"+String(workerBinary.stderr||""))
    .includes("2026-10-12"),"BLOCKED_WORKERD_UNSUPPORTED_DATE");
  const sqlite=new DatabaseSync(":memory:");
  try{assert.equal(sqlite.prepare("SELECT 1 AS x").get().x,1)}
  finally{sqlite.close()}
  assert.ok(!existsSync(QA),"BLOCKED_QA_NAMESPACE_COLLISION");
}
async function port(){
  return new Promise((yes,no)=>{const srv=createServer();
    srv.once("error",no);srv.listen(0,"127.0.0.1",()=>{
      const p=srv.address().port;srv.close(err=>err?no(err):yes(p));
    });
  });
}
async function connects(p){
  return new Promise(done=>{const s=connect({host:"127.0.0.1",port:p});
    let finished=false;const finish=v=>{if(finished)return;finished=true;s.destroy();done(v)};
    s.setTimeout(250);s.once("connect",()=>finish(true));
    s.once("error",()=>finish(false));s.once("timeout",()=>finish(false));
  });
}
const logs=new WeakMap();
function launch(bin,args,cwd,override={}){
  const child=spawn(process.execPath,[bin,...args],{
    cwd,env:{...env,...override},shell:false,windowsHide:true,
    stdio:["ignore","pipe","pipe"]});
  const l={text:""};logs.set(child,l);
  for(const st of [child.stdout,child.stderr])
    st.on("data",b=>{l.text=(l.text+String(b)).slice(-12000)});
  child.on("error",e=>{l.text=(l.text+"\n"+e.message).slice(-12000)});
  return child;
}
async function stop(child,p,label){
  if(!child)return;
  if(child.exitCode===null&&child.signalCode===null&&child.pid){
    const r=spawnSync("taskkill",["/PID",String(child.pid),"/T","/F"],
      {env,windowsHide:true,timeout:26000,encoding:"utf8"});
    if(r.status!==0&&child.exitCode===null)
      throw Error("BLOCKED_"+label+"_CAPTURED_PROCESS_STOP");
  }
  for(let i=0;i<90;i++){
    if(!await connects(p)){
      for(let n=0;n<85&&child.exitCode===null&&child.signalCode===null;n++)await sleep(100);
      assert.ok(child.exitCode!==null||child.signalCode!==null,"BLOCKED_"+label+"_ROOT_PID_ALIVE");
      return;
    }
    await sleep(180);
  }
  throw Error("BLOCKED_"+label+"_LISTENER_STILL_ACTIVE");
}
function workerError(child){
  return "EXIT="+child.exitCode+" "+redact(logs.get(child)?.text);
}
async function waitReady(child,url,verify,label,headers={}){
  for(let i=0;i<115;i++){
    if(child.exitCode!==null||child.signalCode!==null)
      throw Error("BLOCKED_"+label+"_WORKER_EXIT: "+workerError(child));
    try{
      const r=await fetch(url,{headers,signal:AbortSignal.timeout(1100)});
      const data=await r.json().catch(()=>({}));
      if(r.ok&&verify(data))return;
    }catch{}
    await sleep(270);
  }
  throw Error("BLOCKED_"+label+"_READY: "+workerError(child));
}
function config(file,content){writeFileSync(file,JSON.stringify(content,null,2),{flag:"wx",mode:0o600})}
function priceCLI(parts){
  return exec(process.execPath,[PRICE_WRANGLER,"d1",...parts,"--local",
    "--config",PRICE_CONFIG,"--persist-to",PRICE_STATE],CONTROL);
}
function appCLI(parts){
  return exec(process.execPath,[APP_WRANGLER,"d1",...parts,"--local",
    "--config",APP_CONFIG,"--persist-to",APP_STATE]);
}
function physicalDatabases(dir){
  const files=[];
  function walk(p,depth=0){
    assert.ok(depth<=9,"BLOCKED_SQLITE_DEPTH");
    if(!existsSync(p))return;
    const entries=readdirSync(p,{withFileTypes:true});
    assert.ok(entries.length<=300,"BLOCKED_SQLITE_WIDTH");
    for(const e of entries){
      assert.ok(!e.isSymbolicLink(),"BLOCKED_SQLITE_SYMLINK");
      const q=join(p,e.name);
      if(e.isDirectory())walk(q,depth+1);
      else if(e.isFile()&&/\.(?:sqlite|sqlite3|db)$/i.test(e.name))files.push(q);
    }
  }
  walk(dir);
  assert.ok(files.length>0&&files.length<=80,"BLOCKED_PHYSICAL_SQLITE_FILE_CENSUS");
  return files;
}
// The previous retained receipt proves both D1/WAL files are readable later,
// but physical readback immediately after forced Windows shutdown saw IOERR.
// Bounded retries observe only transient SQLite IOERR/BUSY on read-only files;
// permanent errors and missing tables stay BLOCKED. No SQL mutation occurs.
const transientReadEvents=[];
function isTransientSqliteReadFailure(error){
  const code=String(error?.code||"");
  const message=String(error?.message||"");
  return /^SQLITE_(?:IOERR|BUSY|LOCKED)(?:_|$)/.test(code)
    || (/disk I[/]O error|database is locked|database is busy/i.test(message)
      && (!code||/^SQLITE_(?:IOERR|BUSY|LOCKED)/.test(code)));
}
async function inspect(dir,table,query,args=[]){
  const area=dir===APP_STATE?"APP_D1":"PRICE_D1";
  const matches=[];
  for(const file of physicalDatabases(dir)){
    let result=null;
    for(let attempt=1;attempt<=7;attempt++){
      let db,step="OPEN_READONLY",error=null,observed=null;
      try{
        db=new DatabaseSync(file,{readOnly:true});
        step="CHECK_SQLITE_MASTER";
        const exists=db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(table);
        if(exists){
          step="READ_"+table;
          observed={present:true,rows:db.prepare(query).all(...args)};
        }else observed={present:false};
      }catch(e){error=e}
      finally{
        if(db){
          try{db.close()}
          catch(e){if(!error)error=e}
        }
      }
      if(!error){result=observed;break}
      const code=String(error?.code||"UNKNOWN").slice(0,100);
      const temporary=isTransientSqliteReadFailure(error);
      console.error("E2E_SQLITE_READ_ATTEMPT: "+JSON.stringify({
        area,table,file:relative(dir,file),step,attempt,
        code,message:String(error?.message||error).slice(0,160),
        transient:temporary,retryAllowed:temporary&&attempt<7
      }));
      if(!temporary||attempt===7)
        throw Error("BLOCKED_PHYSICAL_SQLITE_READ: "+area+"/"+table+"/"+step);
      transientReadEvents.push({area,table,step,attempt,code});
      // Measured retry: only after a real transient SQLite error, bounded.
      // This is not evidence of global process quiescence.
      await sleep(Math.min(100*attempt,500));
    }
    if(result?.present)matches.push(result.rows);
  }
  assert.equal(matches.length,1,"BLOCKED_SQLITE_TABLE_OWNER_AMBIGUOUS_"+table);
  console.log("E2E_D1_TABLE_READBACK: "+JSON.stringify({
    area,table,rowCount:matches[0].length,
    transientObserved:transientReadEvents.some(e=>e.area===area&&e.table===table)
  }));
  return matches[0];
}
async function api(url,secret,path,payload){
  const res=await fetch(url+path,{method:"POST",redirect:"manual",
    headers:{"content-type":"application/json",authorization:"Bearer "+secret},
    body:JSON.stringify(payload),signal:AbortSignal.timeout(20000)});
  return {status:res.status,data:await res.json().catch(()=>({}))};
}
function requireOk(result,phase){
  if(result.status!==200||result.data?.ok===false){
    const code=String(result.data?.code||"NO_CODE").slice(0,90);
    const error=redact(String(result.data?.error||"").slice(0,350));
    throw Error("BLOCKED_"+phase+" HTTP="+result.status+" CODE="+code+" ERROR="+error);
  }
  return result.data;
}
async function sourceGet(origin,secret){
  const r=await fetch(origin+"/api/control/automation",{redirect:"manual",
    headers:{authorization:"Bearer "+secret},signal:AbortSignal.timeout(12000)});
  assert.equal(r.status,200,"BLOCKED_SOURCE_INDEPENDENT_HTTP_GET");
  return (await r.json()).automation;
}
async function sourcePost(origin,secret,payload,role="owner"){
  const r=await fetch(origin+"/api/control/automation",{method:"POST",redirect:"manual",
    headers:{"content-type":"application/json",authorization:"Bearer "+secret,
      "x-control-actor":OWNER,"x-control-role":role,
      "x-control-device":"e2e-device-verified"},
    body:JSON.stringify(payload),signal:AbortSignal.timeout(12000)});
  return {status:r.status,data:await r.json().catch(()=>({}))};
}
async function register(origin,secret,key){
  const jwk=await webcrypto.subtle.exportKey("jwk",key.publicKey);
  const result=requireOk(await api(origin,secret,"/api/device",
    {action:"register",publicKey:jwk}),"QA_OWNER_REGISTER");
  assert.equal(result.device?.role,"owner","BLOCKED_QA_OWNER_NOT_GRANTED");
  assert.equal(result.device?.status,"approved","BLOCKED_QA_OWNER_NOT_APPROVED");
  return result.device.deviceId;
}
async function proof(origin,secret,deviceId,key){
  const challenge=requireOk(await api(origin,secret,"/api/device",
    {action:"challenge",deviceId}),"QA_OWNER_CHALLENGE");
  const msg=new TextEncoder().encode("learning-control:"+deviceId+":"+challenge.challenge);
  const raw=await webcrypto.subtle.sign({name:"ECDSA",hash:"SHA-256"},key.privateKey,msg);
  return {proofDeviceId:deviceId,challenge:challenge.challenge,
    signature:Buffer.from(raw).toString("base64url")};
}
async function owned(origin,secret,deviceId,key,path,action,body={}){
  return api(origin,secret,path,{action,...body,...await proof(origin,secret,deviceId,key)});
}
async function main(){
  preflight();
  const appSecret=randomBytes(48).toString("base64url");
  const controlSecret=randomBytes(48).toString("base64url");
  const aesKey=randomBytes(32).toString("base64url");
  secrets.push(appSecret,controlSecret,aesKey);
  const appPort=await port(),pricePort=await port(),inspector=await port();
  assert.equal(new Set([appPort,pricePort,inspector]).size,3,"BLOCKED_QA_PORT_COLLISION");
  const appOrigin="http://127.0.0.1:"+appPort;
  const priceOrigin="http://127.0.0.1:"+pricePort;
  mkdirSync(QA,{recursive:true});
  let app=null,price=null,passed=false,appStopped=false,priceStopped=false,erased=false;
  try{
  // Creation of temporary secret-bearing QA configs is inside finally scope:
  // even a partial write failure must remove any config created so far.
  config(PRICE_CONFIG,{
    name:"price-universal-e2e-"+randomBytes(5).toString("hex"),
    main:join(CONTROL,"src","index.ts"),
    compatibility_date:"2026-09-22",compatibility_flags:["nodejs_compat"],
    d1_databases:[{binding:"DB",database_name:PRICE_DB,
      database_id:"00000000-0000-0000-0000-000000000004",
      migrations_dir:join(CONTROL,"migrations")}],
    vars:{PRICE_REPORT_CONTROL_SERVICE_SECRET:controlSecret,
      PRICE_REPORT_APP_ORIGIN:"http://127.0.0.1:5173",
      APPLICATION_MANAGEMENT_ORIGIN:appOrigin}
  });
  config(APP_CONFIG,{
    name:"app-universal-e2e-"+randomBytes(5).toString("hex"),
    main:join(APP,"worker","index.ts"),
    compatibility_date:"2026-09-10",compatibility_flags:["nodejs_compat"],
    assets:{binding:"ASSETS",run_worker_first:true},
    d1_databases:[{binding:"DB",database_name:APP_DB,
      database_id:randomUUID(),migrations_dir:join(APP,"drizzle")}],
    vars:{
      APPLICATION_MANAGEMENT_DEPLOYMENT_CHANNEL:"cloudflare-preview",
      APPLICATION_MANAGEMENT_ACCESS_MODE:"standalone",
      APPLICATION_MANAGEMENT_BUILD_REVISION:APP_SHA,
      APPLICATION_MANAGEMENT_PREVIEW_ACCESS_SECRET:appSecret,
      MANAGED_APP_CREDENTIAL_ENCRYPTION_KEY:aesKey,
      CONTROL_OWNER_EMAILS:OWNER,CONTROL_PLANE_NETWORK_MODE:"local"
    }
  });
  writeFileSync(VITE_CONFIG,[
    'import vinext from "vinext";','import {defineConfig} from "vite";',
    'import {cloudflare} from "@cloudflare/vite-plugin";',
    'import {sites} from "../../build/sites-vite-plugin.ts";',
    'export default defineConfig({',
    'server:{host:"127.0.0.1",allowedHosts:["127.0.0.1","localhost"],',
    'watch:{ignored:["**/.wrangler/**"]}},',
    'plugins:[vinext(),sites(),cloudflare({',
    "configPath:"+JSON.stringify(APP_CONFIG)+",",
    "persistState:{path:"+JSON.stringify(APP_STATE)+"},",
    'viteEnvironment:{name:"rsc",childEnvironments:["ssr"]},inspectorPort:false',
    '})]});'
  ].join("\n"),{flag:"wx",mode:0o600});
    console.log("E2E_PHASE=PRICE_MIGRATIONS");
    priceCLI(["migrations","apply",PRICE_DB]);
    console.log("E2E_PHASE=APP_MIGRATIONS");
    appCLI(["migrations","apply",APP_DB]);
    console.log("E2E_PHASE=START_PRICE_WORKER");
    price=launch(PRICE_WRANGLER,["dev","--local","--ip","127.0.0.1",
      "--port",String(pricePort),"--inspector-port",String(inspector),
      "--config",PRICE_CONFIG,"--persist-to",PRICE_STATE],CONTROL);
    await waitReady(price,priceOrigin+"/health",d=>d.databaseReady===true,
      "PRICE");
    console.log("E2E_PHASE=START_APP_NATIVE_WORKER");
    app=launch(VITE,["--config",VITE_CONFIG,"--host","127.0.0.1",
      "--port",String(appPort),"--strictPort"],APP,
      {MINIFLARE_WORKERD_PATH:VERIFIED_WORKERD});
    await waitReady(app,appOrigin+"/__deployment",d=>d.databaseReady===true,
      "APP",{authorization:"Bearer "+appSecret});
    const key=await webcrypto.subtle.generateKey({name:"ECDSA",namedCurve:"P-256"},
      true,["sign","verify"]);
    const deviceId=await register(appOrigin,appSecret,key);
    const bad=await api(appOrigin,appSecret,"/api/managed-apps",
      {action:"list",proofDeviceId:deviceId});
    assert.notEqual(bad.status,200,"BLOCKED_NO_SIGNATURE_ACCEPTED");
    const guest=await sourcePost(priceOrigin,controlSecret,{
      commandId:randomUUID(),operation:"set-device-automation",
      expected:{autoApproveDevices:false},desired:{autoApproveDevices:true}
    },"viewer");
    assert.equal(guest.status,403,"BLOCKED_SOURCE_NON_OWNER_WRITE_ACCEPTED");
    const initial=await sourceGet(priceOrigin,controlSecret);
    assert.deepEqual({autoApprove:initial.autoApproveDevices,
      autoBlock:initial.autoBlockPendingDevices,hours:initial.pendingBlockAfterHours},
      {autoApprove:false,autoBlock:false,hours:168},
      "BLOCKED_PRICE_POLICY_NOT_INITIAL_STATE");
    console.log("E2E_PHASE=REAL_API_CATALOG_UPSERT");
    const item={id:APP_ID,name:"PriceReport native E2E",shortName:"Price E2E",
      category:"Kế toán",origin:priceOrigin,contractPath:"/api/application-management/contract",
      credential:controlSecret};
    const saved=requireOk(await owned(appOrigin,appSecret,deviceId,key,
      "/api/managed-apps","upsert",item),"APP_NATIVE_CATALOG_UPSERT");
    assert.equal(saved.id,APP_ID,"BLOCKED_SAVED_ID");
    const list=requireOk(await owned(appOrigin,appSecret,deviceId,key,
      "/api/managed-apps","list"),"APP_NATIVE_CATALOG_LIST");
    const registered=list.apps?.find(x=>x.id===APP_ID);
    assert.equal(registered?.credentialConfigured,true,"BLOCKED_CREDENTIAL_NOT_CONFIGURED");
    assert.equal(registered?.category,"Kế toán","BLOCKED_CATALOG_CATEGORY");
    assert.ok(!JSON.stringify(list).includes(controlSecret),"BLOCKED_APP_SECRET_LEAKED");
    const probe=requireOk(await owned(appOrigin,appSecret,deviceId,key,
      "/api/managed-apps","probe",{id:APP_ID}),"REAL_PRICE_CONTRACT_PROBE");
    assert.equal(probe.probe?.contractConnected,true,"BLOCKED_UNIVERSAL_MANIFEST_NOT_CONNECTED");
    assert.equal(probe.probe?.remoteAdminReady,true,"BLOCKED_PRICE_REMOTE_ADMIN_NOT_READY");
    console.log("E2E_PHASE=APP_UNIVERSAL_AUTOMATION_WRITE");
    const write=await owned(appOrigin,appSecret,deviceId,key,
      "/api/operations-auto-approval","set-auto-approval",
      {targetAppIds:[APP_ID],appIds:[APP_ID]});
    requireOk(write,"APP_UNIVERSAL_AUTO_APPROVAL_WRITE");
    const applied=await sourceGet(priceOrigin,controlSecret);
    assert.equal(applied.autoApproveDevices,true,"BLOCKED_PRICE_SOURCE_WRITE_MISSING");
    assert.equal(applied.revision,2,"BLOCKED_PRICE_CAS_REVISION_NOT_TWO");
    console.log("E2E_PHASE=PRICE_CAS_AND_IDEMPOTENT_SOURCE");
    // The central change ledger's commandId is recovered from PriceReport's
    // canonical D1 after stopping both Worker trees; do not forge an ID.
    await stop(app,appPort,"APP");app=null;appStopped=true;
    await stop(price,pricePort,"PRICE");price=null;priceStopped=true;
    const catalog=await inspect(APP_STATE,"managed_app_catalog",
      "SELECT id,category,created_by,credential_ciphertext,credential_iv FROM managed_app_catalog WHERE id=?",[APP_ID]);
    assert.equal(catalog.length,1,"BLOCKED_NATIVE_APP_D1_CATALOG_ABSENT");
    assert.equal(catalog[0].category,"Kế toán");
    assert.equal(catalog[0].created_by,OWNER);
    assert.ok(catalog[0].credential_ciphertext&&catalog[0].credential_iv,
      "BLOCKED_NATIVE_APP_D1_AES_NOT_PERSISTED");
    assert.ok(!JSON.stringify(catalog).includes(controlSecret),"BLOCKED_CATALOG_PLAINTEXT_SECRET");
    const commands=await inspect(PRICE_STATE,"kt_automation_commands",
      "SELECT command_id,state,actor FROM kt_automation_commands");
    assert.equal(commands.length,1,"BLOCKED_PRICE_COMMAND_COUNT_NOT_ONE");
    assert.equal(commands[0].state,"completed","BLOCKED_PRICE_COMMAND_NOT_COMPLETED");
    assert.equal(commands[0].actor,OWNER,"BLOCKED_PRICE_ACTOR_NOT_OWNER");
    const cmdId=commands[0].command_id;
    const appLedger=await inspect(APP_STATE,"automation_policy_changes",
      "SELECT change_id,app_id,state,requested_by FROM automation_policy_changes");
    assert.equal(appLedger.length,1,"BLOCKED_APP_CHANGE_LEDGER_COUNT");
    assert.equal(appLedger[0].change_id,cmdId,"BLOCKED_NOT_THE_APP_MANAGER_COMMAND");
    assert.equal(appLedger[0].app_id,APP_ID,"BLOCKED_LEDGER_TARGET_MISMATCH");
    assert.equal(appLedger[0].requested_by,OWNER,"BLOCKED_LEDGER_OWNER_MISMATCH");
    assert.equal(appLedger[0].state,"applied","BLOCKED_APP_LEDGER_UNRESOLVED");
    const sqlPolicy=await inspect(PRICE_STATE,"kt_automation_policy",
      "SELECT auto_approve_devices,auto_block_pending_devices,pending_block_after_hours,revision FROM kt_automation_policy WHERE id=1");
    assert.equal(sqlPolicy.length,1,"BLOCKED_PRICE_PHYSICAL_POLICY_MISSING");
    assert.equal(sqlPolicy[0].auto_approve_devices,1);
    assert.equal(sqlPolicy[0].revision,2);
    console.log("E2E_PHASE=REOPEN_BOTH_WORKERS");
    price=launch(PRICE_WRANGLER,["dev","--local","--ip","127.0.0.1",
      "--port",String(pricePort),"--inspector-port",String(inspector),
      "--config",PRICE_CONFIG,"--persist-to",PRICE_STATE],CONTROL);
    await waitReady(price,priceOrigin+"/health",d=>d.databaseReady===true,
      "PRICE_REOPEN");
    app=launch(VITE,["--config",VITE_CONFIG,"--host","127.0.0.1",
      "--port",String(appPort),"--strictPort"],APP,
      {MINIFLARE_WORKERD_PATH:VERIFIED_WORKERD});
    await waitReady(app,appOrigin+"/__deployment",d=>d.databaseReady===true,
      "APP_REOPEN",{authorization:"Bearer "+appSecret});
    const reopened=await owned(appOrigin,appSecret,deviceId,key,
      "/api/managed-apps","probe",{id:APP_ID});
    assert.equal(reopened.status,200,"BLOCKED_APP_REOPEN_PROBE");
    assert.equal(reopened.data.probe?.contractConnected,true,
      "BLOCKED_APP_REOPEN_CONTRACT");
    const reopenedSource=await sourceGet(priceOrigin,controlSecret);
    assert.equal(reopenedSource.autoApproveDevices,true,"BLOCKED_SOURCE_REOPEN_STATE");
    assert.equal(reopenedSource.revision,2,"BLOCKED_SOURCE_REOPEN_REVISION");
    const replay=await sourcePost(priceOrigin,controlSecret,{
      commandId:cmdId,operation:"set-device-automation",
      expected:{autoApproveDevices:false},desired:{autoApproveDevices:true}});
    assert.equal(replay.status,200,"BLOCKED_PRICE_COMMAND_REPLAY_HTTP");
    assert.equal(replay.data.replayed,true,"BLOCKED_PRICE_COMMAND_NOT_IDEMPOTENT");
    const stale=await sourcePost(priceOrigin,controlSecret,{
      commandId:randomUUID(),operation:"set-device-automation",
      expected:{autoApproveDevices:false},desired:{autoApproveDevices:false}});
    assert.equal(stale.status,409,"BLOCKED_STALE_CAS_NOT_REJECTED");
    assert.equal((await sourceGet(priceOrigin,controlSecret)).revision,2,
      "BLOCKED_CAS_OR_REPLAY_CHANGED_SOURCE");
    passed=true;
    console.log(JSON.stringify({checkpoint:"P0_TWO_NATIVE_WORKERS_D1_E2E_VERIFIED",
      appManagerSha:APP_SHA,priceReportSha:PRICE_SHA,
      appWorker:"REAL_VINEXT",priceWorker:"REAL_WRANGLER",
      appD1:"NATIVE_LOCAL",priceD1:"NATIVE_LOCAL",
      actor:"QA_OWNER_P256",unauthorizedRejected:true,
      sourceViewerMutationRejected:true,
      catalogNotInMemory:true,encryptedCredential:true,
      centralAutomationWrite:true,sourceCasReject:true,sourceReplay:true,
      physicalD1Independent:true,dualWorkerRestartGet:true,
      qaWorkerdOverride:true,fullLockParity:false,
      productionAuth:"NOT_TESTED",twoFactor:"NOT_TESTED",
      globalQuiescence:"BLOCKED",productionTouched:false,
      transientSqliteReadAttempts:transientReadEvents.length}));
  }finally{
    try {if(app)await stop(app,appPort,"APP");appStopped=true}
    catch(e){console.error("BLOCKED_APP_SHUTDOWN: "+redact(e.message))}
    try {if(price)await stop(price,pricePort,"PRICE");priceStopped=true}
    catch(e){console.error("BLOCKED_PRICE_SHUTDOWN: "+redact(e.message))}
    for(const c of [APP_CONFIG,PRICE_CONFIG]){
      try{rmSync(c,{force:true})}
      catch(e){console.error("BLOCKED_QA_CONFIG_ERASURE: "+redact(e.message))}
    }
    erased=!existsSync(APP_CONFIG)&&!existsSync(PRICE_CONFIG);
    console.log("E2E_DISPOSABLE_D1_EVIDENCE_RETAINED="+QA);
    if(!appStopped||!priceStopped||!erased||!passed){
      console.error("P0_E2E_NOT_PASSED: "+
        JSON.stringify({appStopped,priceStopped,qaConfigErased:erased,verified:passed}));
      process.exitCode=1;
    }
  }
  assert.ok(passed&&appStopped&&priceStopped&&erased,"BLOCKED_E2E_FINISH");
  console.log(JSON.stringify({result:"P0_UNIVERSAL_CONTRACT_NATIVE_E2E_PASS",
    appManagerSha:APP_SHA,priceReportSha:PRICE_SHA,
    integration:"REAL_TWO_WORKER_NATIVE_D1",
    appManagerCatalog:"PERSISTENT_NATIVE_D1",
    writer:"APP_MANAGER_REAL_OPERATIONS_API",independentSource:true,
    productionTouched:false,ci:"PENDING",globalD1:"10/10 BLOCKED",
    fullLockParity:false,postWorkerWranglerCliReadback:"NOT_TESTED",
    globalProcessQuiescence:"NOT_PROVEN",
    transientSqliteReadAttempts:transientReadEvents.length}));
}
// Forensic-only mode for an already retained disposable QA D1. It deliberately
// avoids app/price preflight, Worker startup, credential loading, migrations and
// database recovery. It is NOT a test retry or an E2E completion receipt.
function inspectRetainedEvidence(){
  const value=process.env.APP_MANAGER_E2E_RETAINED_ROOT||"";
  assert.ok(value,"BLOCKED_RETAINED_ROOT_REQUIRED");
  const retained=resolve(value);
  const parent=join(APP,".wrangler");
  const rel=relative(parent,retained);
  assert.ok(/^p0-universal-native-e2e-[0-9a-f]{16}$/i.test(rel)&&
    !rel.includes(sep),"BLOCKED_NOT_AN_ISOLATED_QA_RECEIPT_ROOT");
  assert.ok(existsSync(retained)&&lstatSync(retained).isDirectory()&&
    !lstatSync(retained).isSymbolicLink(),"BLOCKED_E2E_RECEIPT_ROOT_MISSING");
  const report=[];
  for(const [area,subdir,tables] of [
    ["APP_D1","app-state",["managed_app_catalog","automation_policy_changes"]],
    ["PRICE_D1","price-state",["kt_automation_commands","kt_automation_policy"]],
  ]){
    const root=join(retained,subdir);
    const files=physicalDatabases(root);
    for(const file of files){
      const relpath=relative(root,file);
      const metadata={area,file:relpath,size:statSync(file).size,
        walExists:existsSync(file+"-wal"),
        walBytes:existsSync(file+"-wal")?statSync(file+"-wal").size:0,
        shmExists:existsSync(file+"-shm"),
        shmBytes:existsSync(file+"-shm")?statSync(file+"-shm").size:0};
      let db,step="OPEN_READONLY";
      try{
        db=new DatabaseSync(file,{readOnly:true});
        step="READ_SCHEMA";
        const known=db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all()
          .map(x=>x.name).filter(x=>tables.includes(x));
        metadata.tables=known;
        for(const table of known){
          step="COUNT_"+table;
          metadata[table+"_count"]=Number(db.prepare("SELECT COUNT(*) AS n FROM "+table).get().n);
        }
        metadata.result="READONLY_OK";
      }catch(e){
        metadata.result="READONLY_BLOCKED";
        metadata.step=step;
        metadata.code=String(e?.code||"UNKNOWN").slice(0,100);
        metadata.message=String(e?.message||e).slice(0,180);
      }finally{
        if(db){
          try{db.close()}
          catch(e){
            metadata.result="READONLY_CLOSE_BLOCKED";
            metadata.step="CLOSE_READONLY";
            metadata.closeCode=String(e?.code||"UNKNOWN").slice(0,100);
            metadata.closeMessage=String(e?.message||e).slice(0,180);
          }
        }
      }
      report.push(metadata);
    }
  }
  for(const record of report)console.log("E2E_FORENSIC_FILE: "+JSON.stringify(record));
  const expectedTables=["managed_app_catalog","automation_policy_changes",
    "kt_automation_commands","kt_automation_policy"];
  const allTables=new Set(report.flatMap(r=>r.tables||[]));
  const blocked=report.filter(r=>r.result!=="READONLY_OK");
  const missing=expectedTables.filter(t=>!allTables.has(t));
  const summary={mode:"READ_ONLY_DIAGNOSTIC_NOT_E2E",
    fileCount:report.length,blockedFiles:blocked.length,
    blockedStages:blocked.map(r=>r.area+"/"+r.file+"/"+r.step),
    missingTables:missing,sqlWriteStatementsIssued:false};
  console.log("E2E_FORENSIC_SUMMARY: "+JSON.stringify(summary));
  if(blocked.length||missing.length)
    throw Error("BLOCKED_RETAINED_D1_FORENSIC_READ_ONLY_INCOMPLETE");
  console.log("E2E_FORENSIC_READONLY_INSPECTION_COMPLETE_NOT_E2E_PASS");
}
if(process.argv[2]==="--inspect-retained"){
  try{inspectRetainedEvidence()}
  catch(e){
    console.error("P0_E2E_FORENSIC_NOT_PASSED: "+redact(e.message||e));
    process.exitCode=1;
  }
}else if(process.argv.length===2){
  main().catch(e=>{
    console.error("P0_UNIVERSAL_CONTRACT_NATIVE_E2E_NOT_PASSED: "+redact(e.message||e));
    process.exitCode=1;
  });
}else{
  console.error("BLOCKED_UNKNOWN_QA_MODE");
  process.exitCode=1;
}
