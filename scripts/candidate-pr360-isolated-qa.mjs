// PR360 candidate source QA. Strictly isolated clone; no app/D1/process mutation.
import {execFileSync} from "node:child_process";
import {existsSync,mkdtempSync,mkdirSync,readFileSync,writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {basename,join,resolve,dirname} from "node:path";
import {fileURLToPath} from "node:url";
const BASE_SHA="93906a7fff0f3925139ab63dc01312e8d18caf17";
const ANCESTOR_SHA="e2f49126abbab90597fafd860595dad580472998";
const PR_REF="refs/pull/360/head";
const REMOTE="https://github.com/BlueDragon33/Application-Management.git";
const SHA=/^[0-9a-f]{40}$/i;
function git(cwd,args,timeout=45000) {
  return execFileSync("git",["-c","core.fsmonitor=false","-c","core.untrackedCache=false",
    ...(cwd?["-C",cwd]:[]),...args],{encoding:"utf8",timeout,windowsHide:true,
    maxBuffer:1024*1024,stdio:["ignore","pipe","ignore"],
    env:{...process.env,GIT_OPTIONAL_LOCKS:"0",GIT_TERMINAL_PROMPT:"0",GCM_INTERACTIVE:"never"}}).trim();
}
export function parsePorts(text) {
  const out=new Map([3000,3011,3188].map(p=>[p,[]]));
  for(const line of String(text).split(/\r?\n/)){
    const m=/^\s*TCP\s+(\S+)\s+\S+\s+LISTENING\s+(\d+)\s*$/i.exec(line);
    if(!m)continue;
    const endpoint=m[1],offset=endpoint.lastIndexOf(":");
    if(offset<1)continue;
    const port=Number(endpoint.slice(offset+1));
    if(out.has(port))out.get(port).push({addr:endpoint.slice(0,offset),pid:Number(m[2])});
  }
  return out;
}
export function portReport(parsed) {
  if(!parsed)return {state:"UNVERIFIED"};
  return {state:"OBSERVED",ports:Object.fromEntries([...parsed.entries()].map(([port,rows])=>
    [port,{listener:rows.length?"LISTENING":"STOPPED",
      pids:[...new Set(rows.map(x=>x.pid))].sort((a,b)=>a-b)}]))};
}
function observedPorts(){
  if(process.platform!=="win32")return null;
  try{return parsePorts(execFileSync("netstat",["-ano","-p","TCP"],{windowsHide:true,
    encoding:"utf8",timeout:7000,stdio:["ignore","pipe","ignore"],maxBuffer:6*1024*1024}));}
  catch{return null;}
}
function mainState(root) {
  if(!existsSync(root))throw Error("OWNER_MAIN_NOT_FOUND");
  const branch=git(root,["symbolic-ref","--quiet","--short","HEAD"]);
  const sha=git(root,["rev-parse","HEAD"]);
  if(!SHA.test(sha))throw Error("INVALID_MAIN_SHA");
  const clean=!git(root,["status","--porcelain","--untracked-files=no"]);
  return {branch,sha,clean};
}
export function auditSources(root, expected) {
  const sha=git(root,["rev-parse","HEAD"]);
  const detached=git(root,["rev-parse","--abbrev-ref","HEAD"])==="HEAD";
  const clean=!git(root,["status","--porcelain","--untracked-files=no"]);
  const expectedFiles=[
    ["control/local-ops-apps.json",'"agentPort": 3011'],
    ["app/management-dashboard-v2.tsx",'useState<OperatingMode>("offline")'],
    ["app/offline-ops-client.ts","await localOpsStartApp(appId)"],
    ["scripts/local-ops-daemon.mjs",'/start-web-all'],
    ["scripts/local-ops-daemon.mjs","pullSkipReason"],
    ["scripts/local-ops-source-identity.mjs","SOURCE_NOT_MAIN"],
    ["START_BAUMANWEB.vbs","--center"]
  ];
  const checks=expectedFiles.map(([path,marker])=>{
    const file=join(root,...path.split("/"));
    return {module:path,status:existsSync(file)&&readFileSync(file,"utf8").includes(marker)
      ?"PRESENT":"MISSING_OR_MISMATCH"};
  });
  return {sha,exactSha:sha===expected,detached,clean,checks,
    complete:sha===expected&&detached&&clean&&checks.every(x=>x.status==="PRESENT")};
}
export async function prepare({workspace="E:\\BaumanWeb",
  reportDir=join(tmpdir(),"BaumanWeb-PR360-Candidate-QA")}={}) {
  const report={protocol:"BLUEPRINT_PR360_ISOLATED_SOURCE_QA_V1",
    observationUtc:new Date().toISOString(),baseShaExpected:BASE_SHA,
    ancestorShaExpected:ANCESTOR_SHA,mainBefore:null,mainAfter:null,
    portBefore:null,portAfter:null,fetch:"NOT_STARTED",candidate:null,
    runtime:"NOT_STARTED",d1Shutdown:"BLOCKED_NOT_TESTED",review:"NOT_VERIFIED",
    ownerAcceptance:"UNVERIFIED",mergeAuthorization:"NOT_GRANTED",
    verdict:"BLOCKED",blocker:null};
  const output=resolve(reportDir),main=join(workspace,"Application-Management");
  mkdirSync(output,{recursive:true});
  try {
    if(basename(resolve(workspace)).toLowerCase()!=="baumanweb")throw Error("NON_CANONICAL_WORKSPACE");
    report.mainBefore=mainState(main);
    if(report.mainBefore.sha!==BASE_SHA||report.mainBefore.branch!=="main"||!report.mainBefore.clean)
      throw Error("MAIN_SOURCE_CHANGED_OR_DIRTY");
    const ports=observedPorts();
    report.portBefore=portReport(ports);
    if(process.platform!=="win32")throw Error("WINDOWS_REQUIRED");
    if(!ports)throw Error("NETSTAT_UNAVAILABLE");
    if(ports.get(3188).length)throw Error("ISOLATED_PORT_3188_BUSY");
    const temp=mkdtempSync(join(tmpdir(),"Blueprint-PR360-Candidate-"));
    const target=join(temp,"Application-Management");
    // Clone from disk with no hardlinks and no worktree metadata changes to main.
    git(null,["clone","--no-local","--no-checkout","--",main,target],60000);
    report.fetch="STARTED_FROM_GITHUB_PR_REF";
    git(target,["-c","protocol.file.allow=never","-c","protocol.ext.allow=never",
      "-c","protocol.ssh.allow=never","-c","protocol.git.allow=never",
      "fetch","--no-tags",REMOTE,PR_REF],90000);
    const sha=git(target,["rev-parse","FETCH_HEAD"]);
    if(!SHA.test(sha))throw Error("FETCHED_SHA_INVALID");
    try{git(target,["merge-base","--is-ancestor",ANCESTOR_SHA,sha]);}
    catch{throw Error("PR_SHA_NOT_DESCENDANT_OF_CHECKPOINT");}
    git(target,["checkout","--detach",sha],30000);
    report.candidate={location:"UNIQUE_OS_TEMP_COPY",...auditSources(target,sha)};
    if(!report.candidate.complete)throw Error("CANDIDATE_SOURCE_AUDIT_FAILED");
    report.fetch="VERIFIED_PR_REF";
    report.verdict="SOURCE_PREPARED_RUNTIME_BLOCKED";
    report.blocker="DISPOSABLE_RUNTIME_AND_D1_NOT_YET_ACCEPTED";
  } catch(error) {
    report.blocker=error instanceof Error&&/^[A-Z0-9_]+$/.test(error.message)
      ?error.message:"GIT_FETCH_OR_PREPARATION_FAILED";
  } finally {
    try {
      if(existsSync(main))report.mainAfter=mainState(main);
      report.portAfter=portReport(observedPorts());
      if(report.mainBefore&&JSON.stringify(report.mainBefore)!==JSON.stringify(report.mainAfter)){
        report.verdict="BLOCKED";report.blocker="MAIN_STATE_CHANGED_DURING_QA";
      }
      if(report.portBefore?.state==="OBSERVED"&&report.portAfter?.state==="OBSERVED"&&
        JSON.stringify(report.portBefore)!==JSON.stringify(report.portAfter)){
        report.verdict="BLOCKED";report.blocker="PORT_STATES_CHANGED_DURING_QA";
      }
    }catch{report.verdict="BLOCKED";report.blocker="FINAL_READBACK_UNAVAILABLE";}
    writeFileSync(join(output,"latest.json"),JSON.stringify(report,null,2)+"\n");
    writeFileSync(join(output,"latest.txt"),[
      "Blueprint OS PR360 isolated candidate SOURCE QA",
      "verdict="+report.verdict,"sha="+(report.candidate?.sha||"UNVERIFIED"),
      "runtime=NOT_STARTED; d1=BLOCKED_NOT_TESTED; merge=NOT_GRANTED",
      "blocker="+report.blocker
    ].join("\r\n")+"\r\n");
  }
  return report;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const report=await prepare();
  console.log(report.verdict+"; "+report.blocker);
  if(report.verdict!=="SOURCE_PREPARED_RUNTIME_BLOCKED")process.exitCode=2;
}
