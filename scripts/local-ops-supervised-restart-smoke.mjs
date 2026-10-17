// A real Node child+Git+port supervisor fixture. It does NOT represent the user's
// full BaumanWeb stack, and cannot establish per-app HTTP source attestation.
import assert from "node:assert/strict";
import { spawn, execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync, copyFileSync } from "node:fs";
import { createServer } from "node:http";
import { join, resolve, dirname } from "node:path";
import { tmpdir } from "node:os";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";

const SOURCE = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(readFileSync(join(SOURCE, "control/local-ops-apps.json"), "utf8"));
const target = "http://127.0.0.1:3011";
const origin = "http://127.0.0.1:3000";
const requiredApps = manifest.apps.filter(a => Number.isInteger(a.port));
function git(cwd,...args) {
  return execFileSync("git",args,{cwd,windowsHide:true,encoding:"utf8",timeout:20000}).trim();
}
function initialRepo(root) {
  mkdirSync(root,{recursive:true});
  git(root,"init","-b","main");
  git(root,"config","user.name","QA Local");
  git(root,"config","user.email","offline@example.test");
  writeFileSync(join(root,"tracked.txt"),"source 1\n");
  git(root,"add",".");
  git(root,"commit","-m","initial");
}
function stop(child) {
  if (child && child.exitCode===null && child.signalCode===null) child.kill();
}
async function until(label,check,deadlineMs=35000) {
  const deadline=Date.now()+deadlineMs;
  let last;
  while(Date.now()<deadline) {
    try { const result=await check(); if(result) return result; }
    catch(e) {last=e;}
    await delay(250);
  }
  throw new Error(label+" timeout: "+(last?.message||"unknown"));
}
async function helperCall(path,token,method="GET") {
  const r=await fetch(target+path,{method,headers:{origin,authorization:"Bearer "+token},signal:AbortSignal.timeout(5000)});
  return {status:r.status,data:await r.json()};
}
const fakeRunAll=`
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { resolve,join } from "node:path";
import { readSourceSnapshot } from "./local-ops-source-identity.mjs";
import { SHUTDOWN_PROTOCOL, REQUIRED_SHUTDOWN_UNITS, unsupportedFullStack } from "./local-ops-shutdown-contract.mjs";
import { existsSync } from "node:fs";
const root=resolve(process.cwd(),"..");
const apps=JSON.parse(readFileSync(join(process.cwd(),"control/local-ops-apps.json"),"utf8")).apps;
const servers=[];
for(const app of apps.filter(item=>item.port)){
  const server=createServer((req,res)=>{res.writeHead(200,{"content-type":"text/plain"});res.end("fixture:"+app.id);});
  await new Promise((ok,fail)=>{server.once("error",fail);server.listen(app.port,"127.0.0.1",ok);});
  servers.push(server);
}
const control=createServer((req,res)=>{res.writeHead(200);res.end("fake central");});
await new Promise((ok,fail)=>{control.once("error",fail);control.listen(3000,"127.0.0.1",ok);});
servers.push(control);
const sources=await readSourceSnapshot(root,apps);
process.send?.({type:"local-ops-stack-ready",protocol:"local-ops-source/v1",
  nonce:process.env.LOCAL_OPS_BOOT_NONCE,sources});
// A CONTROLLED TEST FIXTURE: simulated drain acknowledgements, NEVER a claim
// about production Vite/Wrangler/SQLite flushing.
process.on("message", async m => {
  if(m?.protocol!==SHUTDOWN_PROTOCOL || m.nonce!==process.env.LOCAL_OPS_BOOT_NONCE) return;
  const base={nonce:m.nonce,requestId:m.requestId,protocol:SHUTDOWN_PROTOCOL};
  const allowed=existsSync(join(process.cwd(),"graceful.fixture-allowed"));
  if(m.type==="local-ops-shutdown-preflight"){
    if(!allowed) return process.send?.({type:"local-ops-shutdown-preflight-result",...base,...unsupportedFullStack()});
    const units=REQUIRED_SHUTDOWN_UNITS.map(id=>({id,supported:true,d1Drained:true,ownedProcess:true,gracefulExitSupported:true}));
    return process.send?.({type:"local-ops-shutdown-preflight-result",...base,supported:true,units});
  }
  if(m.type==="local-ops-shutdown-commit" && allowed){
    const units=REQUIRED_SHUTDOWN_UNITS.map(id=>({id,supported:true,d1Drained:true,ownedProcess:true,gracefulExitSupported:true}));
    await Promise.all(servers.map(server=>new Promise(ok=>server.close(ok))));
    process.send?.({type:"local-ops-shutdown-complete",...base,supported:true,units,shutdownCompleted:true},
      ()=>setImmediate(()=>process.exit(0)));
  }
});
process.on("SIGTERM",()=>{for(const s of servers)s.close();});
`;
const temp=mkdtempSync(join(tmpdir(),"am-supervised-"));
const workspace=join(temp,"BaumanWeb");
const central=join(workspace,"Application-Management");
let helper=null,lastStackPid=null;
try {
  for(const directory of ["Application-Management",...requiredApps.map(a=>a.directory)]) initialRepo(join(workspace,directory));
  mkdirSync(join(central,"scripts"),{recursive:true});
  mkdirSync(join(central,"control"),{recursive:true});
  writeFileSync(join(central,"package.json"),'{"type":"module"}\n');
  for(const name of ["local-ops-daemon.mjs","local-ops-source-identity.mjs","local-ops-shutdown-contract.mjs","local-ops-windows-process-tree.mjs","local-ops-managed-startup-policy.mjs"])
    copyFileSync(join(SOURCE,"scripts",name),join(central,"scripts",name));
  copyFileSync(join(SOURCE,"control/local-ops-apps.json"),join(central,"control/local-ops-apps.json"));
  // This detached temporary supervisor fixture deliberately replaces ONLY
  // its private copy of the source-admission module. Product modules are never
  // modified; synthetic supervisor ACK exercises request coordination, not
  // actual permission to run unreviewed source apps.
  writeFileSync(join(central,"scripts","local-ops-managed-startup-policy.mjs"),
    'export function assertManagedControlAdmission({managed}={}) { if(managed!==true) throw Error("QA_FIXTURE_MANAGED_REQUIRED"); return {mode:"SYNTHETIC_QA_FIXTURE_ONLY"}; }\\n');

  writeFileSync(join(central,"scripts","run-all.mjs"),fakeRunAll);
  // Recommit source after placing the controlled fixture files.
  git(central,"add",".");git(central,"commit","-m","mock bootstrap");
  helper=spawn(process.execPath,[join(central,"scripts","local-ops-daemon.mjs")],{
    cwd:central,stdio:["ignore","pipe","pipe"],windowsHide:true});
  const logs=[];
  for(const stream of [helper.stdout,helper.stderr]) stream.on("data",b=>logs.push(String(b)));
  const session=await until("helper session",async()=>{
    const r=await fetch(target+"/session",{headers:{origin},signal:AbortSignal.timeout(800)});
    if(r.ok)return r.json();
  },12000);
  const started=await helperCall("/start",session.token,"POST");
  assert.equal(started.status,202,JSON.stringify(started.data));
  const good=await until("IPC boot and Git readback",async()=>{
    const r=await helperCall("/status",session.token);
    if(r.data.runtime==="blocked"||r.data.runtime==="error")throw Error(r.data.error);
    return r.data.runtime==="running"&&r.data.sourceVerified ? r.data:null;
  });
  assert.equal(Object.keys(good.sourceSnapshot).length,requiredApps.length+1);
  assert.ok(requiredApps.every(app=>good.apps.find(x=>x.id===app.id)?.ready));
  assert.match(good.runtimeEvidence,/process-bound Git SHA/);
  lastStackPid=good.runtimePid;
  assert.ok(Number.isInteger(lastStackPid));
  // A tracked source commit change must invalidate the old ready state.
  const changed=join(workspace,requiredApps[0].directory);
  writeFileSync(join(changed,"tracked.txt"),"source 2\n");
  const dirtySource=(await helperCall("/status",session.token)).data;
  assert.equal(dirtySource.restartRequired,true,"uncommitted tracked source must block SHA readiness");
  assert.equal(dirtySource.sourceVerified,false,"HEAD alone cannot verify dirty source");
  git(changed,"add",".");git(changed,"commit","-m","after launch");
  const drift=(await helperCall("/status",session.token)).data;
  assert.equal(drift.restartRequired,true);
  assert.equal(drift.sourceVerified,false);
  assert.equal(drift.apps.find(x=>x.id===requiredApps[0].id).ready,false);
  const blocked=await helperCall("/restart",session.token,"POST");
  assert.equal(blocked.status,409,"no kill/restart while owned child is alive");
  assert.equal(blocked.data.error.startsWith("MANUAL_SAFE_STOP_REQUIRED"),true);
  assert.equal((await helperCall("/status",session.token)).data.runtimePid,lastStackPid);
  // Real run-all does not advertise any service drain: preflight must block
  // without touching the old child. The fixture starts in the same blocked mode.
  const denied=await helperCall("/restart-auto",session.token,"POST");
  assert.equal(denied.status,202);
  const rejected=await until("blocked unsafe restart",async()=>{
    const r=(await helperCall("/status",session.token)).data;
    return r.restartControl?.status==="blocked"?r:null;
  });
  assert.match(rejected.restartControl.reason,/GRACEFUL_DRAIN_UNVERIFIED/);
  assert.equal(rejected.runtimePid,lastStackPid,"blocked drain must not kill old child");
  // Fixture ONLY: simulate the complete 13-unit D1-drain and graceful-exit ACKs.
  writeFileSync(join(central,"graceful.fixture-allowed"),"QA synthetic drain\n");
  const accepted=await helperCall("/restart-auto",session.token,"POST");
  assert.equal(accepted.status,202);
  const newState=await until("verified restarted stack",async()=>{
    const r=(await helperCall("/status",session.token)).data;
    if(r.restartControl?.status==="blocked")throw Error(r.restartControl.reason);
    return r.runtime==="running"&&r.sourceVerified&&r.runtimePid!==lastStackPid?r:null;
  },45000);
  assert.equal(newState.restartControl?.status,"finished");
  assert.notEqual(newState.runtimePid,lastStackPid);
  assert.equal(newState.sourceSnapshot[requiredApps[0].id],git(changed,"rev-parse","HEAD"));
  assert.equal(newState.restartRequired,false);
  lastStackPid=newState.runtimePid;
  console.log(JSON.stringify({result:"SUPERVISED_RESTART_FIXTURE_PASS",
    scope:"mock child+ports+real Git repos, NOT live BaumanWeb apps",
    oldProcessBlocked:true,drainPreflightBlockedWithoutKill:true,fixtureSyntheticDrainAccepted:true,
    shaDriftDetected:true,postRestartHeadVerified:true,
    realApplicationHTTPIdentity:"UNVERIFIED",userD1:"UNTOUCHED"}));
} finally {
  try { if(lastStackPid)process.kill(lastStackPid); } catch{}
  stop(helper);
  await delay(1200);
  rmSync(temp,{recursive:true,force:true,maxRetries:4,retryDelay:300});
}
