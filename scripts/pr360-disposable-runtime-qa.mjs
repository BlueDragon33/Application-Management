// Blueprint OS PR360 guarded disposable UI/DB smoke.
// The ONLY executable app is a confirmed temp checkout in a --network none Docker
// container. No host ports, app-manager helper, real user repo or real D1 touched.
import {execFileSync} from "node:child_process";
import {existsSync,readdirSync,realpathSync,statSync,mkdirSync,readFileSync,writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {basename,dirname,join,resolve,sep} from "node:path";
import {fileURLToPath} from "node:url";

export const EVIDENCED_SHA="98bb7d9b7f7263dce89fb6a18d3232065c963b48";
export const OWNER_MAIN_SHA="93906a7fff0f3925139ab63dc01312e8d18caf17";
export const IMAGE="node:22-bookworm-slim";
function run(file,args,options={}){
  return execFileSync(file,args,{encoding:"utf8",windowsHide:true,stdio:["ignore","pipe","ignore"],
    timeout:options.timeout||12000,maxBuffer:1024*1024,
    cwd:options.cwd,env:options.env||process.env}).trim();
}
export function boundary(root,path) {
  const base=resolve(root),target=resolve(path);
  return target!==base && target.startsWith(base+sep);
}
export function dockerArgumentAudit(args) {
  const has=(...words)=>words.every(w=>args.includes(w));
  return has("--network","none","--rm","--cap-drop","ALL","--security-opt","no-new-privileges")
    && !args.includes("-p") && !args.includes("--publish")
    && !args.includes("--privileged") && !args.includes("--network=host")
    && !args.includes("--env-file") && !args.includes("--device")
    && args.includes("OFFLINE_NETWORK_ISOLATED=1");
}
function shaAndBranch(dir){
  const sha=run("git",["-C",dir,"rev-parse","HEAD"]);
  const branch=run("git",["-C",dir,"rev-parse","--abbrev-ref","HEAD"]);
  const clean=!run("git",["-C",dir,"status","--porcelain","--untracked-files=no"]);
  return {sha,branch,clean};
}
export function locateEvidenceClone(temp=tmpdir()){
  const abs=realpathSync(temp);
  const matches=[];
  for(const entry of readdirSync(abs,{withFileTypes:true})){
    if(!entry.isDirectory()||!entry.name.startsWith("Blueprint-PR360-Candidate-"))continue;
    const sub=join(abs,entry.name,"Application-Management");
    if(!existsSync(sub))continue;
    let root;
    try{
      root=realpathSync(sub);
      if(!boundary(abs,root)||basename(root)!=="Application-Management"
        ||!statSync(join(root,".git")).isDirectory())continue;
      const state=shaAndBranch(root);
      if(state.sha===EVIDENCED_SHA && state.branch==="HEAD" && state.clean)
        matches.push(root);
    }catch{/* unknown temp clone: ignore; never mutate */}
  }
  if(matches.length!==1)throw Error(matches.length?"CANDIDATE_CLONE_AMBIGUOUS":"EVIDENCED_CANDIDATE_CLONE_NOT_FOUND");
  return matches[0];
}
function ownerMainCheck(){
  const root="E:\\BaumanWeb\\Application-Management";
  const st=shaAndBranch(root);
  if(st.sha!==OWNER_MAIN_SHA||st.branch!=="main"||!st.clean)throw Error("OWNER_MAIN_CHANGED_OR_DIRTY");
  return st;
}
function mustImageAlreadyExist(){
  try{
    const imageId=run("docker",["image","inspect","--format","{{.Id}}",IMAGE],{timeout:15000});
    const serverOS=run("docker",["info","--format","{{.OSType}}"],{timeout:15000});
    if(serverOS!=="linux")throw Error("DOCKER_LINUX_CONTAINER_REQUIRED");
    if(!imageId.startsWith("sha256:"))throw Error("DOCKER_IMAGE_ID_UNVERIFIED");
    return imageId;
  }catch(error){
    if(/^DOCKER_/.test(error.message||""))throw error;
    throw Error("DOCKER_OFFLINE_IMAGE_OR_DAEMON_UNAVAILABLE");
  }
}
function dependencyCheck(dir){
  if(!existsSync(join(dir,"node_modules","vite","bin","vite.js"))){
    try{
      run("npm",["ci","--offline","--ignore-scripts","--no-audit","--no-fund"],{
        cwd:dir,timeout:150000,env:{...process.env,NPM_CONFIG_OFFLINE:"true",NPM_CONFIG_AUDIT:"false",
          NPM_CONFIG_FUND:"false",NPM_CONFIG_IGNORE_SCRIPTS:"true"}});
    }catch{throw Error("NPM_OFFLINE_CACHE_INCOMPLETE");}
  }
  if(!existsSync(join(dir,"node_modules","vite","bin","vite.js")))
    throw Error("ISOLATED_VITE_DEPENDENCIES_MISSING");
}
function ensureNoCredentials(dir){
  for(const path of [".dev.vars",".env",".env.local",".env.production",".env.development"]){
    if(existsSync(join(dir,path)))throw Error("CANDIDATE_ENV_FILE_PRESENT");
  }
}
export async function runDisposable({
  reportDir=join(tmpdir(),"BaumanWeb-PR360-Runtime-QA"),
  findCandidate=locateEvidenceClone,
  imageCheck=mustImageAlreadyExist,
  dependencyPrep=dependencyCheck,
  dockerExec=run,
  mainCheck=ownerMainCheck
}={}){
  const report={
    protocol:"BLUEPRINT_PR360_DISPOSABLE_NETWORK_NONE_QA_V1",
    observedUtc:new Date().toISOString(),candidateSha:EVIDENCED_SHA,
    candidateSource:"UNVERIFIED",ownerMain:"UNVERIFIED",
    dockerNetwork:"NOT_STARTED",dockerImage:"UNVERIFIED",
    dependencyInstall:"NOT_ATTEMPTED",runtime:"NOT_STARTED",
    tempD1:"UNVERIFIED",realD1Shutdown:"BLOCKED_NOT_TESTED",
    apps7:"UNVERIFIED",userUX:"UNVERIFIED",
    review:"NOT_VERIFIED",mergeAuthorization:"NOT_GRANTED",
    verdict:"BLOCKED",blocker:null,
  };
  mkdirSync(reportDir,{recursive:true});
  let candidate=null,owner=null;
  try{
    if(process.platform!=="win32")throw Error("WINDOWS_OPERATOR_REQUIRED");
    owner=mainCheck();report.ownerMain=owner.sha;
    candidate=findCandidate();
    const checked=shaAndBranch(candidate);
    if(checked.sha!==EVIDENCED_SHA||checked.branch!=="HEAD"||!checked.clean)
      throw Error("CANDIDATE_SOURCE_DRIFT");
    ensureNoCredentials(candidate);
    report.candidateSource="DETACHED_EXACT_SHA_CLEAN";
    report.dockerImage=imageCheck();
    report.dependencyInstall="OFFLINE_ONLY";
    dependencyPrep(candidate);
    ensureNoCredentials(candidate);
    if(!shaAndBranch(candidate).clean)throw Error("CANDIDATE_TRACKED_FILES_CHANGED");
    const args=[
      "run","--rm","--network","none","--memory","3g","--cpus","2",
      "--pids-limit","128","--security-opt","no-new-privileges",
      "--cap-drop","ALL","--user","1000:1000",
      "-v",candidate+":/workspace","-w","/workspace",
      "-e","OFFLINE_NETWORK_ISOLATED=1","-e","CI=1",
      IMAGE,"node","scripts/local-isolated-network-none-smoke.mjs"
    ];
    if(!dockerArgumentAudit(args))throw Error("DOCKER_ISOLATION_ARGUMENTS_INVALID");
    report.dockerNetwork="NONE";
    const result=dockerExec("docker",args,{timeout:200000});
    if(!result.includes("LOCAL_NETWORK_NONE_COLD_START_PASS"))throw Error("ISOLATED_SMOKE_MISSING_PASS_MARKER");
    report.runtime="ISOLATED_HTML_SHELL_PASS";
    report.tempD1="NOT_SEPARATELY_ATTESTED";
    report.verdict="ISOLATED_UI_SHELL_PASS_REAL_D1_BLOCKED";
    report.blocker="OWNER_REAL_D1_SHUTDOWN_AND_UI_UX_REVIEW_NOT_VERIFIED";
  }catch(error){
    const msg=String(error?.message||"").slice(0,200);
    report.blocker=/^[A-Z0-9_]+$/.test(msg)?msg:"ISOLATED_QA_EXECUTION_FAILED";
  }finally{
    try{
      const after=mainCheck();
      if(owner&&after.sha!==owner.sha){report.verdict="BLOCKED";report.blocker="OWNER_MAIN_CHANGED";}
      if(candidate){
        const check=shaAndBranch(candidate);
        if(check.sha!==EVIDENCED_SHA||check.branch!=="HEAD"||!check.clean){
          report.verdict="BLOCKED";report.blocker="CANDIDATE_SOURCE_CHANGED_AFTER_QA";
        }
      }
    }catch{report.verdict="BLOCKED";report.blocker="FINAL_SOURCE_READBACK_BLOCKED";}
    // Do not log the OS temp root path, user profile, Docker output or secrets.
    writeFileSync(join(reportDir,"latest.json"),JSON.stringify(report,null,2)+"\n");
    writeFileSync(join(reportDir,"latest.txt"),[
      "Blueprint PR360 isolated network-none UI smoke",
      "verdict="+report.verdict,"candidate="+report.candidateSha,
      "host ports never published; no real D1 used",
      "realD1Shutdown="+report.realD1Shutdown,
      "blocker="+report.blocker
    ].join("\r\n")+"\r\n");
  }
  return report;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const r=await runDisposable();
  console.log(r.verdict+": "+r.blocker);
  if(r.verdict!=="ISOLATED_UI_SHELL_PASS_REAL_D1_BLOCKED")process.exitCode=2;
}
