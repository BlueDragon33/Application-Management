// Disposable Wrangler API + REAL D1 process-bound stop ACK on Windows/Linux.
// "stop()" is the Wrangler dev API, not a SIGTERM or proof of global isolate drain.
import assert from "node:assert/strict";
import {spawn,execFile} from "node:child_process";
import {randomBytes} from "node:crypto";
import {createServer} from "node:net";
import {mkdtemp,copyFile,writeFile,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {resolve,join,dirname} from "node:path";
import {fileURLToPath} from "node:url";
import {promisify} from "node:util";
import {setTimeout as delay} from "node:timers/promises";
import {captureWindowsTree,verifyWindowsTreeGone} from "./local-ops-windows-process-tree.mjs";
const exec=promisify(execFile);
const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const WRANGLER=join(ROOT,"node_modules/wrangler/bin/wrangler.js");
const DB="temporary-wrangler-api-qa";
const DATABASE_ID="00000000-0000-0000-0000-000000001191";
const dir=await mkdtemp(join(tmpdir(),"am-wrangler-api-stop-"));
const scriptFile=join(dir,"worker.mjs"),configFile=join(dir,"wrangler.json");
const persistDir=join(dir,"local-d1");
const nonce=randomBytes(32).toString("base64url");
const marker=randomBytes(16).toString("hex");
const backgroundMarker=randomBytes(16).toString("hex");
const {stdout:rev}=await exec("git",["rev-parse","HEAD"],{cwd:ROOT,windowsHide:true});
const sha=rev.trim();assert.match(sha,/^[0-9a-f]{40}$/);
let child=null,port=null,tree=null,log="",stopAcknowledged=false;
async function sql(query){
  const {stdout}=await exec(process.execPath,[WRANGLER,"d1","execute",DB,
    "--local","--config",configFile,"--persist-to",persistDir,
    "--command",query,"--json"],{
      cwd:dir,windowsHide:true,timeout:65000,maxBuffer:3*1024*1024,
      env:{...process.env,CI:"1",WRANGLER_SEND_METRICS:"false"}});
  const offset=stdout.indexOf("[");
  if(offset<0)throw Error("WRANGLER_D1_CLI_JSON_MISSING");
  return JSON.parse(stdout.slice(offset)).flatMap(row=>row.results||[]);
}
function ask(type,extra={},maxMs=35000){
  const requestId=randomBytes(10).toString("hex");
  return new Promise((ok,fail)=>{
    const timer=setTimeout(()=>{cleanup();fail(Error("WRANGLER_API_IPC_TIMEOUT_"+type));},maxMs);
    function cleanup(){clearTimeout(timer);child.off("message",onMessage);child.off("exit",onExit);}
    function onExit(){cleanup();fail(Error("WRANGLER_API_CHILD_EXIT_BEFORE_ACK"));}
    function onMessage(m){
      if(m?.requestId!==requestId)return;
      cleanup();
      if(m.processPid!==child.pid||m.sourceSha!==sha||m.bootNonce!==nonce)
        return fail(Error("WRANGLER_API_ACK_PID_SHA_NONCE_INVALID"));
      ok(m);
    }
    child.on("message",onMessage);child.once("exit",onExit);
    if(!child.connected){cleanup();fail(Error("WRANGLER_API_IPC_DISCONNECTED"));return;}
    child.send({type,requestId,processPid:child.pid,sourceSha:sha,bootNonce:nonce,...extra});
  });
}
async function waitExit(){
  if(child.exitCode!==null||child.signalCode!==null)return;
  await Promise.race([
    new Promise((ok,fail)=>{child.once("exit",ok);child.once("error",fail);}),
    delay(16000).then(()=>{throw Error("WRANGLER_API_CHILD_EXIT_TIMEOUT");})
  ]);
}
async function requirePortFreed(p){
  const server=createServer();
  try{await new Promise((ok,fail)=>{server.once("error",fail);server.listen(p,"127.0.0.1",ok);});}
  finally{if(server.listening)await new Promise(ok=>server.close(ok));}
}
try{
  await copyFile(join(ROOT,"tests/fixtures/wrangler-d1-flight-worker.mjs"),scriptFile);
  await writeFile(configFile,JSON.stringify({name:"offline-wrangler-api-stop-qa",
    main:"./worker.mjs",compatibility_date:"2026-05-22",
    d1_databases:[{binding:"DB",database_name:DB,database_id:DATABASE_ID}]}));
  await sql("CREATE TABLE flight_qa (id TEXT PRIMARY KEY, val TEXT NOT NULL)");
  child=spawn(process.execPath,
    [fileURLToPath(new URL("../tests/fixtures/local-ops-wrangler-api-d1-child.mjs",import.meta.url))],
    {cwd:ROOT,stdio:["ignore","pipe","pipe","ipc"],windowsHide:true,
      env:{...process.env,CI:"1",WRANGLER_SEND_METRICS:"false"}});
  for(const stream of [child.stdout,child.stderr])
    stream.on("data",part=>log=(log+String(part)).slice(-4000));
  const boot=await ask("qa-boot",{scriptFile,configFile,persistDir});
  assert.equal(boot.type,"qa-ready");
  assert.equal(boot.realWranglerApi,true);
  assert.equal(boot.allIsolateInventoryVerified,false);
  port=boot.port;assert.ok(Number.isInteger(port)&&port>=1024&&port<=65535);
  if(process.platform==="win32")tree=await captureWindowsTree(child.pid);
  const inFlight=ask("qa-write",{marker});
  let observed=null;
  for(let i=0;i<80;i++){
    observed=await ask("qa-preflight");
    if(observed.active===1)break;
    await delay(10);
  }
  assert.equal(observed.active,1,"real Wrangler API D1 request must be in-flight");
  const refused=await ask("qa-stop");
  assert.equal(refused.type,"qa-denied");
  assert.equal(refused.reason,"D1_ACTIVE_OR_UNVERIFIED");
  for(const forged of [{bootNonce:"wrong"},{sourceSha:"f".repeat(40)},
                        {processPid:child.pid+1}]){
    const reply=await ask("qa-preflight",forged);
    assert.equal(reply.type,"qa-denied");
    assert.equal(reply.reason,"PROCESS_PID_SHA_NONCE_MISMATCH");
  }
  const write=await inFlight;
  assert.equal(write.type,"qa-written");
  assert.equal(write.committed,true);
  const readback=await ask("qa-read");
  assert.equal(readback.type,"qa-readback");
  assert.equal(readback.readback,true);
  const before=await ask("qa-preflight");
  assert.equal(before.active,0);
  assert.equal(before.globalD1QuiescenceVerified,false);
  assert.equal(before.declaredBackgroundD1ReadbackVerified,false);
  const deniedAbsentBackground=await ask("qa-stop");
  assert.equal(deniedAbsentBackground.type,"qa-denied");
  assert.equal(deniedAbsentBackground.reason,"D1_BACKGROUND_UNVERIFIED");
  // Genuine Worker ctx.waitUntil schedules a second D1 write after 1500ms.
  // Only ONE declared fixture task is tracked; no global isolate claims.
  const scheduled=await ask("qa-background-write",{marker:backgroundMarker});
  assert.equal(scheduled.type,"qa-background-accepted");
  assert.equal(scheduled.backgroundCommitVerified,false);
  const bgPending=await ask("qa-preflight");
  assert.equal(bgPending.backgroundPending,true);
  assert.equal(bgPending.declaredBackgroundD1ReadbackVerified,false);
  const deniedBackground=await ask("qa-stop");
  assert.equal(deniedBackground.type,"qa-denied");
  assert.equal(deniedBackground.reason,"D1_BACKGROUND_UNVERIFIED");
  const backgroundReceipt=await ask("qa-background-read",{marker:backgroundMarker},18000);
  assert.equal(backgroundReceipt.type,"qa-background-readback");
  assert.equal(backgroundReceipt.backgroundWriteCommitted,true);
  assert.equal(backgroundReceipt.declaredBackgroundReadbackVerified,true);
  assert.equal(backgroundReceipt.globalD1QuiescenceVerified,false);
  const readyFixture=await ask("qa-preflight");
  assert.equal(readyFixture.backgroundPending,false);
  assert.equal(readyFixture.declaredBackgroundD1ReadbackVerified,true);
  assert.equal(readyFixture.allWaitUntilJobsInstrumented,false);
  assert.equal(readyFixture.allIsolateInventoryVerified,false);
  const stop=await ask("qa-stop");
  assert.equal(stop.type,"qa-stop-ack");
  assert.equal(stop.wranglerApiStopCompleted,true);
  assert.equal(stop.readbackBeforeStop,true);
  assert.equal(stop.declaredBackgroundD1ReadbackBeforeStop,true);
  assert.equal(stop.allWaitUntilJobsInstrumented,false);
  assert.equal(stop.globallyQuiescentD1Verified,false);
  assert.equal(stop.autoRestartApproved,false);
  stopAcknowledged=true;
  await waitExit();
  if(tree)assert.equal((await verifyWindowsTreeGone(tree)).stopped,true);
  await requirePortFreed(port);
  const durable=await sql("SELECT val FROM flight_qa WHERE id='"+marker+"'");
  assert.equal(durable[0]?.val,"COMMITTED");
  // Independent CLI readback AFTER awaited runtime.stop, not only Worker fetch.
  const persistedBackground=await sql("SELECT val FROM flight_qa WHERE id='"+backgroundMarker+"'");
  assert.equal(persistedBackground[0]?.val,"BACKGROUND_COMMITTED");
  console.log(JSON.stringify({result:"WRANGLER_API_D1_PID_NONCE_SHA_ACK_QA_PASS",
    platform:process.platform,processPid:child.pid,sourceSha:sha,
    genuineD1Write:true,d1ReadbackAfterWranglerStop:true,
    apiStopAwaitedBeforeAck:stopAcknowledged,windowsTreeExited:tree?true:"not-windows",
    localPortReleased:true,wrongPidShaNonceRejected:true,
    activeD1RequestStopsDenied:true,backgroundD1StopDeniedUntilReadback:true,
    actualWaitUntilBackgroundWrite:true,backgroundD1ReadbackAfterApiStop:true,
    allWaitUntilJobsInstrumented:false,allWorkerIsolatesEnumerated:false,
    productionWranglerCliGracefulExitVerified:false,
    liveBaumanWebTouched:false,fullStackAutoRestartApproved:false}));
}catch(error){
  console.error("WRANGLER_API_PROCESS_QA_FAIL",String(error),log.slice(-1200));
  throw error;
}finally{
  if(child&&child.exitCode===null&&child.signalCode===null){
    child.kill("SIGTERM"); // FAILURE-ONLY fixture cleanup; never a product shutdown ACK.
    await delay(350);
  }
  await rm(dir,{recursive:true,force:true,maxRetries:5,retryDelay:300});
}
