// Blueprint OS 1.3.0: passive Windows local QA, no PowerShell required.
// Never reads DB contents, starts/stops services, fetches, merges, or invokes HTTP.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const DEFAULT_WORKSPACE = "E:\\BaumanWeb";
const SHA = /^[0-9a-f]{40}(?:[0-9a-f]{24})?$/i;
const PORTS = Array.from({length:12},(_,i)=>3000+i);
const emptyPort = port => ({
  port, listener:"UNVERIFIED", addresses:[], pids:[],
  processNames:["NOT_COLLECTED"], http:"SKIPPED_PASSIVE_ONLY", httpStatus:null,
});
export function parseListeningPorts(netstatText) {
  const result = new Map(PORTS.map(x=>[x,[]]));
  // Parse ONLY TCP listening local endpoint and owner PID; remote endpoint,
  // user/process command line and other open connections are never serialized.
  for (const line of String(netstatText).split(/\r?\n/)) {
    const match = /^\s*TCP\s+(\S+)\s+\S+\s+(\S+)\s+(\d+)\s*$/i.exec(line);
    if (!match || !/^LISTENING$/i.test(match[2])) continue;
    const endpoint=match[1];
    const last=endpoint.lastIndexOf(":");
    if(last<1)continue;
    const port=Number(endpoint.slice(last+1));
    if(!result.has(port))continue;
    const address=endpoint.slice(0,last);
    const pid=Number(match[3]);
    if(!Number.isSafeInteger(pid)||pid<0)continue;
    result.get(port).push({address,pid});
  }
  return result;
}
export function portObservation(port, parsed, status="OK") {
  const out=emptyPort(port);
  if(status!=="OK"){out.listener="TCP_OBSERVATION_UNAVAILABLE";return out;}
  const rows=parsed.get(port)||[];
  if(!rows.length){out.listener="STOPPED";return out;}
  out.addresses=[...new Set(rows.map(x=>x.address))].sort();
  out.pids=[...new Set(rows.map(x=>x.pid))].sort((a,b)=>a-b);
  const loopback=x=>x==="127.0.0.1"||x==="[::1]"||x==="::1";
  out.listener=out.addresses.every(loopback)
    ? out.pids.length===1?"LOOPBACK_LISTENER":"MULTIPLE_OWNERS"
    : "NON_LOOPBACK_BIND";
  return out;
}
function gitRead(cwd,args) {
  return execFileSync("git",["-c","core.fsmonitor=false","-c","core.untrackedCache=false","-C",cwd,...args],{
    encoding:"utf8",timeout:8000,windowsHide:true,stdio:["ignore","pipe","ignore"],
    env:{...process.env,GIT_OPTIONAL_LOCKS:"0",GIT_TERMINAL_PROMPT:"0",GCM_INTERACTIVE:"never"}
  }).trim();
}
export function gitObservation(directory) {
  const result={state:"UNVERIFIED",branch:null,sha:null,clean:null};
  if(!existsSync(directory)){result.state="MISSING_DIRECTORY";return result;}
  try{
    const branch=gitRead(directory,["symbolic-ref","--quiet","--short","HEAD"]);
    if(!branch){result.state="DETACHED_OR_NON_BRANCH";return result;}
    result.branch=branch;
    const sha=gitRead(directory,["rev-parse","HEAD"]);
    if(!SHA.test(sha)){result.state="INVALID_SHA";return result;}
    result.sha=sha.toLowerCase();
    const tracked=gitRead(directory,["status","--porcelain","--untracked-files=no"]);
    result.clean=tracked.length===0;
    result.state=branch!=="main"?"NOT_MAIN":result.clean?"MAIN_TRACKED_CLEAN":"TRACKED_DIRTY";
  }catch{
    result.state="GIT_NOT_AVAILABLE_OR_INVALID_REPO";
  }
  return result;
}
function reportWorkspace(root) {
  const workspace=resolve(root);
  const manager=join(workspace,"Application-Management");
  let manifest="MISSING_OR_INVALID",apps=[];
  if(basename(workspace).toLowerCase()==="baumanweb"){
    try{
      const x=JSON.parse(readFileSync(join(manager,"control","local-ops-apps.json"),"utf8"));
      if(x.agentPort===3011 && Array.isArray(x.apps) && x.apps.length>=7) {
        manifest="LOADED";apps=x.apps;
      }else manifest="INVALID_CATALOG";
    }catch{manifest="MISSING_OR_INVALID";}
  }else manifest="WORKSPACE_NAME_BLOCKED";
  return {workspace,manager,manifest,apps};
}
export function collectObservations({workspaceRoot=DEFAULT_WORKSPACE,
  portMap=null,netstatState=null}={}) {
  const {workspace,manager,manifest,apps}=reportWorkspace(workspaceRoot);
  let state=netstatState||"OK",ports=portMap;
  if(!ports){
    try{
      if(process.platform!=="win32")throw Error("WINDOWS_REQUIRED");
      const stdout=execFileSync("netstat",["-ano","-p","TCP"],{
        encoding:"utf8",windowsHide:true,timeout:8000,
        stdio:["ignore","pipe","ignore"],maxBuffer:5*1024*1024
      });
      ports=parseListeningPorts(stdout);
    }catch{state="UNAVAILABLE";ports=parseListeningPorts("");}
  }
  const observed=[];
  for(const app of apps) {
    const id=String(app.id||""), dir=String(app.directory||"");
    if(!/^[a-z0-9-]+$/.test(id)||!/^[a-zA-Z0-9_-]+$/.test(dir)){
      observed.push({id:"INVALID_MANIFEST_ENTRY",capability:"BLOCKED",git:null,runtime:null});
      continue;
    }
    const git=gitObservation(join(workspace,dir));
    if(app.port===null){
      observed.push({id,capability:"NON_WEB",git,runtime:null});continue;
    }
    const port=Number(app.port);
    if(!Number.isSafeInteger(port)||port<3001||port>3010){
      observed.push({id,capability:"INVALID_PORT",git,runtime:null});continue;
    }
    observed.push({id,capability:"WEB",git,runtime:portObservation(port,ports,state)});
  }
  return {
    protocol:"BLUEPRINT_WINDOWS_NODE_PASSIVE_QA_V1",
    observedUtc:new Date().toISOString(),
    shaIsGitSourceOnly:true, responseBodyCaptured:false,secretsCaptured:false,
    activeHttpProbeEnabled:false,usesPowershell:false,
    manifest,manager:{git:gitObservation(manager),http:portObservation(3000,ports,state)},
    localAgent:portObservation(3011,ports,state),apps:observed,
    d1Shutdown:"BLOCKED_NOT_TESTED",review:"NOT_VERIFIED",
    mergeAuthorization:"NOT_GRANTED",ownerAcceptance:"UNVERIFIED",
    verdict:"BLOCKED_NEEDS_HUMAN_REVIEW"
  };
}
export function writeReport(report,dir=join(tmpdir(),"BaumanWeb-ReadOnly-QA")) {
  mkdirSync(dir,{recursive:true});
  writeFileSync(join(dir,"latest.json"),JSON.stringify(report,null,2)+"\n","utf8");
  const eligible=report.apps.filter(x=>x.capability==="WEB");
  const listeners=eligible.filter(x=>x.runtime?.listener==="LOOPBACK_LISTENER").length;
  const lines=[
    "BLUEPRINT OS 1.3.0 - WINDOWS PASSIVE QA",
    "Verdict: BLOCKED_NEEDS_HUMAN_REVIEW (not product acceptance)",
    "Manager Git SHA: "+(report.manager.git.sha||"UNVERIFIED"),
    "Manager branch / state: "+(report.manager.git.branch||"?")+" / "+report.manager.git.state,
    "Manager port 3000: "+report.manager.http.listener,
    "Local helper port 3011: "+report.localAgent.listener,
    "Loopback listening web apps: "+listeners+"/"+eligible.length,
    "HTTP: SKIPPED_PASSIVE_ONLY (no HTTP request sent)",
    "D1: BLOCKED_NOT_TESTED; no approval, merge or publish.",
    "Share latest.json for source SHA / port / PID diagnostics."
  ];
  writeFileSync(join(dir,"latest.txt"),lines.join("\r\n")+"\r\n","utf8");
  return dir;
}
export function runCli(args=process.argv.slice(2)) {
  let root=DEFAULT_WORKSPACE, dir=join(tmpdir(),"BaumanWeb-ReadOnly-QA");
  for(let i=0;i<args.length;i++){
    if(args[i]==="--workspace" && args[i+1])root=args[++i];
    else if(args[i]==="--report-dir" && args[i+1])dir=args[++i];
    else throw Error("INVALID_QA_OPTION");
  }
  const result=collectObservations({workspaceRoot:root});
  writeReport(result,dir);
  console.log("PASSIVE_QA_COLLECTED; D1_BLOCKED_NOT_TESTED; NOT_ACCEPTED");
  return result;
}
if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{runCli();}
  catch(error){
    const reportDir=join(tmpdir(),"BaumanWeb-ReadOnly-QA");
    try{
      mkdirSync(reportDir,{recursive:true});
      const code=error?.message==="INVALID_QA_OPTION"?"INVALID_QA_OPTION":"QA_COLLECTOR_FAILED";
      writeFileSync(join(reportDir,"diagnostic.txt"),code+"\n","utf8");
    }catch{}
    process.exitCode=2;
  }
}
