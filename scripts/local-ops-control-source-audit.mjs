// Git-controlled source readback, NOT a reviewer or production approval.
// Always run with fixed Git arguments; fail closed on missing/dirty/wrong branch.
import { execFile } from "node:child_process";
import { realpathSync } from "node:fs";
import { resolve, sep } from "node:path";
import { promisify } from "node:util";
const execute=promisify(execFile);
const SHA=/^[0-9a-f]{40}$/i;
const TARGETS=Object.freeze([
  {id:"BAUMAN-CONTROL",directory:"Bauman-master-ai-system"},
  {id:"PRICE-CONTROL",directory:"PriceReport_Tunggiabao"},
]);
async function git(root,args) {
  const {stdout}=await execute("git",args,{cwd:root,timeout:10000,windowsHide:true,
    env:{...process.env,GIT_TERMINAL_PROMPT:"0",GCM_INTERACTIVE:"never"}});
  return stdout.trim();
}
export async function auditManagedControlGitSources({appsRoot,expectedMainHeads}={}) {
  if(typeof appsRoot!=="string"||!appsRoot.trim()||!expectedMainHeads||
     typeof expectedMainHeads!=="object"||Array.isArray(expectedMainHeads))
    throw Error("MANAGED_GIT_ADMISSION_INPUT_INVALID");
  const workspace=realpathSync(resolve(appsRoot));
  const facts=[];
  for(const {id,directory} of TARGETS){
    const expected=expectedMainHeads[id];
    if(!SHA.test(expected??""))throw Error("MANAGED_SOURCE_EXPECTED_SHA_MISSING: "+id);
    let root;
    try {root=realpathSync(resolve(workspace,directory));} catch {
      throw Error("MANAGED_SOURCE_WORKTREE_NOT_FOUND: "+id);
    }
    if(!root.startsWith(workspace+sep))throw Error("MANAGED_SOURCE_WORKTREE_OUTSIDE_ROOT: "+id);
    if(await git(root,["rev-parse","--show-prefix"])!=="")
      throw Error("MANAGED_SOURCE_NOT_GIT_ROOT: "+id);
    const branch=await git(root,["symbolic-ref","--quiet","--short","HEAD"]);
    if(branch!=="main")throw Error("MANAGED_SOURCE_BRANCH_NOT_MAIN: "+id);
    const dirty=await git(root,["status","--porcelain","--untracked-files=no"]);
    if(dirty)throw Error("MANAGED_SOURCE_TRACKED_FILES_DIRTY: "+id);
    const current=await git(root,["rev-parse","HEAD"]);
    if(!SHA.test(current)||current.toLowerCase()!==expected.toLowerCase())
      throw Error("MANAGED_SOURCE_MAIN_SHA_MISMATCH: "+id);
    // The working tree SHA is necessary but NEVER an external review receipt.
    facts.push({id,sha:current.toLowerCase(),branch:"main",trackedClean:true,
      localGitVerified:true,independentReviewVerified:false,
      sourceWorkerRunningAttested:false,permitStart:false});
  }
  return {facts,allLocalGitVerified:facts.length===TARGETS.length,
    approved:false,permitStart:false,productionShutdownApproved:false};
}
