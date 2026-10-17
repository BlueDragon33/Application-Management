// Actual temporary Wrangler/Miniflare + D1 HTTP test (NOT production shutdown).
// Safe: own repo-installed Wrangler, random isolated ports, disposable SQLite.
import assert from "node:assert/strict";
import { spawn, execFile } from "node:child_process";
import { randomBytes } from "node:crypto";
import { createServer } from "node:net";
import { copyFile, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join, resolve, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { setTimeout as sleep } from "node:timers/promises";
import { createWranglerIngress } from "./local-ops-wrangler-ingress.mjs";
import { captureWindowsTree, verifyWindowsTreeGone } from "./local-ops-windows-process-tree.mjs";

const exec = promisify(execFile);
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const WRANGLER = join(ROOT, "node_modules/wrangler/bin/wrangler.js");
const DB = "temporary-wrangler-drain-db";
async function freePort() {
  const server = createServer();
  await new Promise((ok, fail) => server.once("error", fail).listen(0,"127.0.0.1",ok));
  const port = server.address().port;
  await new Promise(ok=>server.close(ok));
  return port;
}
async function sql(cwd, config, storage, query) {
  const args = [WRANGLER,"d1","execute",DB,"--local","--config",config,
    "--persist-to",storage,"--command",query,"--json"];
  const { stdout } = await exec(process.execPath,args,{
    cwd,timeout:70000,maxBuffer:3*1024*1024,windowsHide:true,
    env:{...process.env,CI:"1",WRANGLER_SEND_METRICS:"false"}});
  const bracket=stdout.indexOf("[");
  if (bracket<0) throw Error("WRANGLER_D1_JSON_MISSING: "+stdout.slice(-400));
  return JSON.parse(stdout.slice(bracket));
}
async function waitFor(url, child, lines) {
  for(let i=0;i<150;i++) {
    if(child.exitCode!==null||child.signalCode!==null)
      throw Error("WRANGLER_EXITED_BEFORE_READY: "+lines.slice(-1200));
    try {
      const result=await fetch(url,{signal:AbortSignal.timeout(1000)});
      if(result.ok && (await result.json()).fixture===true)return;
    } catch {}
    await sleep(300);
  }
  throw Error("WRANGLER_START_TIMEOUT: "+lines.slice(-1700));
}
async function waitExit(child, ms=16000) {
  if(child.exitCode!==null||child.signalCode!==null)return;
  await new Promise((ok,fail)=>{
    const timer=setTimeout(()=>{child.off("exit",exited);fail(Error("WRANGLER_FIXTURE_EXIT_TIMEOUT"));},ms);
    const exited=()=>{clearTimeout(timer);ok();};
    child.once("exit",exited);
  });
}
const temp=await mkdtemp(join(tmpdir(),"am-real-wrangler-drain-"));
const config=join(temp,"wrangler.fixture.json");
const store=join(temp,"local-state");
const id=randomBytes(16).toString("hex");
const backend=await freePort();
let child, ingress, snap, log="";
try {
  await copyFile(join(ROOT,"tests/fixtures/wrangler-d1-flight-worker.mjs"),
    join(temp,"worker.mjs"));
  await writeFile(config,JSON.stringify({
    name:"offline-drain-fixture",main:"./worker.mjs",compatibility_date:"2026-05-22",
    d1_databases:[{binding:"DB",database_name:DB,
      database_id:"00000000-0000-0000-0000-000000001190"}]}));
  await sql(temp,config,store,"CREATE TABLE flight_qa (id TEXT PRIMARY KEY, val TEXT NOT NULL)");
  child=spawn(process.execPath,[WRANGLER,"dev","--local","--config",config,
    "--ip","127.0.0.1","--port",String(backend),"--persist-to",store],{
      cwd:temp,stdio:["ignore","pipe","pipe"],windowsHide:true,
      env:{...process.env,CI:"1",WRANGLER_SEND_METRICS:"false",NO_COLOR:"1"}});
  child.stdout.on("data",d=>{log=(log+String(d)).slice(-12000)});
  child.stderr.on("data",d=>{log=(log+String(d)).slice(-12000)});
  await waitFor("http://127.0.0.1:"+backend+"/health",child,log);
  ingress=createWranglerIngress({upstreamPort:backend});
  const port=await ingress.listen();
  const start=fetch("http://127.0.0.1:"+port+"/write?id="+id,
    {method:"POST",signal:AbortSignal.timeout(13000)});
  for(let i=0;i<100&&ingress.status().pending!==1;i++)await sleep(20);
  assert.equal(ingress.status().pending,1,
    "real Wrangler D1 mutating HTTP request must be observable through proxy");
  const pendingDrain=ingress.drainIngress({timeoutMs:13000});
  assert.equal(ingress.status().safeToStopWrangler,false);
  const r=await start;
  assert.equal(r.status,200);
  assert.equal((await r.json()).committed,true);
  const drain=await pendingDrain;
  assert.equal(drain.ingressClosed,true);
  assert.equal(drain.admittedRequestsCompleted,true);
  assert.equal(drain.safeToStopWrangler,false);
  // This is a verified D1 readback via real Wrangler Worker, not a shutdown ACK.
  const check=await fetch("http://127.0.0.1:"+backend+"/read?id="+id);
  assert.equal((await check.json()).val,"COMMITTED");
  const preExit={ realWranglerRunning:child.exitCode===null&&child.signalCode===null,
    d1WorkerRequestCommitted:true,ingressDrained:true,
    upstreamBypassStillPossible:true,globalQuiescenceVerified:false,
    authorizedToStopUserRuntime:false };
  assert.equal(preExit.realWranglerRunning,true);
  if(process.platform==="win32")snap=await captureWindowsTree(child.pid);
  // Fixture-only teardown: killing Wrangler is NOT graceful production shutdown.
  child.kill("SIGTERM");
  await waitExit(child);
  // A freed parent alone is not full process tree proof on Windows.
  const windowsResult=snap?await verifyWindowsTreeGone(snap):null;
  const persisted=await sql(temp,config,store,
    "SELECT val FROM flight_qa WHERE id='"+id+"'");
  assert.equal(persisted.flatMap(x=>x.results||[])[0]?.val,"COMMITTED");
  assert.equal(windowsResult?.stopped ?? true,true,
    "all captured Windows Wrangler fixture descendants must have exited");
  console.log(JSON.stringify({result:"REAL_WRANGLER_D1_HTTP_INGRESS_FIXTURE_PASS",
    platform:process.platform,actualD1Write:true,readbackAfterFixtureProcessExit:true,
    capturedWindowsTreeGone:windowsResult?.stopped??"not-windows",
    stopMethod:"fixture-only SIGTERM; NOT approved graceful shutdown",
    preExit,productionShutdownAck:false,allIsolatesDrained:false,
    userStorageTouched:false,fullStackAutoRestartApproved:false}));
} catch(error) {
  console.error("WRANGLER_FIXTURE_FAILURE",String(error),log.slice(-2500));
  throw error;
} finally {
  if(ingress) await ingress.close().catch(()=>{});
  if(child&&child.exitCode===null&&child.signalCode===null) {
    child.kill("SIGTERM");
    await waitExit(child,8000).catch(()=>{});
  }
  await rm(temp,{recursive:true,force:true,maxRetries:5,retryDelay:500});
}
