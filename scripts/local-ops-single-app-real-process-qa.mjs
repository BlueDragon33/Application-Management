#!/usr/bin/env node
// A real Node child + Git SHA + HTTP port test in disposable BaumanWeb
// storage. Managed Wrangler, D1 and all user app repos remain untouched.
import assert from "node:assert/strict";
import { spawn, execFileSync } from "node:child_process";
import { createServer } from "node:net";
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve, dirname, join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";

const SOURCE=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const temp=mkdtempSync(join(tmpdir(),"am-single-web-"));
const workspace=join(temp,"BaumanWeb");
const manager=join(workspace,"Application-Management");
const boi=join(workspace,"BOIECH_AI");
const appDir=join(boi,"boi-ech");
const ROOT_PORT=3011, APP_PORT=3004, ORIGIN="http://127.0.0.1:3000";
let helper=null, appPid=null;
let diagnostics="";
function git(cwd,...args){
  return execFileSync("git",args,{cwd,encoding:"utf8",windowsHide:true,timeout:12000}).trim();
}
function init(cwd){
  git(cwd,"init","-b","main");
  git(cwd,"config","user.name","Temporary QA");
  git(cwd,"config","user.email","single-web@example.test");
  git(cwd,"add",".");
  git(cwd,"commit","-m","isolated fixture");
}
async function vacant(port){
  return await new Promise(resolveVacant=>{
    const sock=createServer();
    sock.once("error",()=>resolveVacant(false));
    sock.listen(port,"127.0.0.1",()=>sock.close(()=>resolveVacant(true)));
  });
}
async function until(label,fn,ms=12000){
  const end=Date.now()+ms;
  let last;
  while(Date.now()<end){
    try{const value=await fn();if(value)return value;}catch(error){last=error;}
    await delay(170);
  }
  throw Error(label+" timed out: "+(last?.message||"unknown"));
}
async function api(path,token,method="GET"){
  const response=await fetch("http://127.0.0.1:"+ROOT_PORT+path,{
    method,headers:{origin:ORIGIN,authorization:"Bearer "+token},
    signal:AbortSignal.timeout(1800),
  });
  return {status:response.status,body:await response.json()};
}
async function terminate(pid){
  if(!pid)return;
  try{process.kill(pid,"SIGTERM");}catch{}
}
try{
  assert.equal(await vacant(ROOT_PORT),true,"QA helper port must be unoccupied");
  assert.equal(await vacant(APP_PORT),true,"QA client port must be unoccupied");
  mkdirSync(join(manager,"scripts"),{recursive:true});
  mkdirSync(join(manager,"control"),{recursive:true});
  mkdirSync(join(appDir,"node_modules","vite","bin"),{recursive:true});
  for(const script of [
    "local-ops-daemon.mjs","local-ops-source-identity.mjs",
    "local-ops-managed-startup-policy.mjs","local-ops-web-launcher.mjs",
    "local-ops-shutdown-contract.mjs","local-ops-windows-process-tree.mjs",
  ])cpSync(join(SOURCE,"scripts",script),join(manager,"scripts",script));
  cpSync(join(SOURCE,"control","local-ops-apps.json"),join(manager,"control","local-ops-apps.json"));
  writeFileSync(join(manager,"package.json"),'{"type":"module"}\n');
  writeFileSync(join(manager,".gitignore"),".local-ops-*.log\n");
  writeFileSync(join(boi,"README.md"),"QA standalone frontend only\n");
  writeFileSync(join(boi,".gitignore"),"node_modules/\n");
  writeFileSync(join(appDir,"node_modules","vite","bin","vite.js"),"const {createServer}=require(\"node:http\");\nconst i=process.argv.indexOf(\"--port\");\nif(i<0||process.argv[i+1]!==\"3004\")process.exit(2);\nconst server=createServer((req,res)=>{\n  res.writeHead(200,{\"content-type\":\"text/plain\"});res.end(\"OFFLINE_FRONTEND_FIXTURE_3004\");\n});\nserver.listen(3004,\"127.0.0.1\");\nprocess.on(\"SIGTERM\",()=>server.close(()=>process.exit(0)));\n");
  init(manager);init(boi);
  const expectedSha=git(boi,"rev-parse","HEAD");
  helper=spawn(process.execPath,[join(manager,"scripts","local-ops-daemon.mjs")],{
    cwd:manager,windowsHide:true,stdio:["ignore","pipe","pipe"]
  });
  for(const stream of [helper.stdout,helper.stderr])
    stream.on("data",d=>diagnostics=(diagnostics+String(d)).slice(-4500));
  const session=await until("helper session",async()=>{
    if(helper.exitCode!==null)throw Error("helper exited: "+diagnostics);
    const r=await fetch("http://127.0.0.1:"+ROOT_PORT+"/session",{
      headers:{origin:ORIGIN},signal:AbortSignal.timeout(600)});
    return r.ok ? r.json() : null;
  });
  const before=(await api("/status",session.token)).body;
  assert.equal(before.apps.find(x=>x.id==="boi-ech").ready,false);
  assert.equal((await api("/start-app/pc-manager",session.token,"POST")).status,404);
  const started=await api("/start-app/boi-ech",session.token,"POST");
  assert.equal(started.status,202,JSON.stringify(started.body));
  const ready=await until("single offline child SHA and port",async()=>{
    const r=(await api("/status",session.token)).body;
    const item=r.apps.find(x=>x.id==="boi-ech");
    if(item?.error)throw Error(item.error);
    return item?.ready?r:null;
  });
  const item=ready.apps.find(x=>x.id==="boi-ech");
  appPid=item.pid;
  assert.ok(Number.isInteger(appPid)&&appPid>0);
  assert.equal(item.port,APP_PORT);
  assert.equal(item.sourceSha,expectedSha);
  assert.equal(item.phase,"running");
  assert.equal(ready.runtime,"stopped","managed stack must never start");
  assert.equal(ready.sourceVerified,false,"no fake global control approval");
  assert.equal(ready.apps.filter(x=>x.pid).length,1,"only requested child runs");
  const hit=await fetch("http://127.0.0.1:3004/");
  assert.equal(await hit.text(),"OFFLINE_FRONTEND_FIXTURE_3004");
  assert.equal((await api("/start-app/boi-ech",session.token,"POST")).status,409);
  // Source tampering invalidates readiness even though HTTP remains 200.
  writeFileSync(join(boi,"README.md"),"source changed without restart\n");
  const drift=(await api("/status",session.token)).body;
  assert.equal(drift.restartRequired,true);
  assert.equal(drift.apps.find(x=>x.id==="boi-ech").ready,false);
  console.log(JSON.stringify({result:"ONE_APP_LOCAL_PID_PORT_SHA_QA_PASS",
    platform:process.platform,scope:"temporary Node HTTP fixture ONLY",
    selected:"boi-ech",port:3004,onlySelectedChild:true,
    sourceSha:expectedSha,shaDriftRevokesReadiness:true,
    managedControl:"NEVER_STARTED",realOwnerWindows:"NOT_TESTED",productAcceptance:false}));
}finally{
  await terminate(appPid);
  if(helper)await terminate(helper.pid);
  await delay(850);
  rmSync(temp,{recursive:true,force:true,maxRetries:5,retryDelay:250});
}
