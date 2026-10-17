import assert from "node:assert/strict";
import test from "node:test";
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {execFileSync} from "node:child_process";
import {auditManagedControlGitSources} from "../scripts/local-ops-control-source-audit.mjs";
import {assertManagedControlAdmission} from "../scripts/local-ops-managed-startup-policy.mjs";
const ids=[["BAUMAN-CONTROL","Bauman-master-ai-system"],["PRICE-CONTROL","PriceReport_Tunggiabao"]];
function git(dir,...args){return execFileSync("git",args,{cwd:dir,encoding:"utf8",windowsHide:true,
 env:{...process.env,GIT_TERMINAL_PROMPT:"0",GIT_AUTHOR_NAME:"Fixture",GIT_AUTHOR_EMAIL:"qa@example.invalid",GIT_COMMITTER_NAME:"Fixture",GIT_COMMITTER_EMAIL:"qa@example.invalid"}}).trim();}
test("real Git main clean exact-SHA is authentic local provenance but NEVER permission",async t=>{
 const root=mkdtempSync(join(tmpdir(),"am-git-authority-"));
 t.after(()=>rmSync(root,{force:true,recursive:true,maxRetries:6,retryDelay:200}));
 const expected={};
 for(const [id,dir] of ids){
   const repo=join(root,dir);mkdirSync(repo);git(repo,"init","--quiet","-b","main");
   writeFileSync(join(repo,"guarded-worker.txt"),"checked source\n");
   git(repo,"add",".");git(repo,"commit","--quiet","-m","QA checked snapshot");
   expected[id]=git(repo,"rev-parse","HEAD");
 }
 const facts=await auditManagedControlGitSources({appsRoot:root,expectedMainHeads:expected});
 assert.equal(facts.allLocalGitVerified,true);
 assert.deepEqual(facts.facts.map(x=>x.id),ids.map(x=>x[0]));
 assert.equal(facts.approved,false);assert.equal(facts.permitStart,false);
 assert.ok(facts.facts.every(x=>x.localGitVerified&&!x.independentReviewVerified&&!x.permitStart));
 const bauman=join(root,"Bauman-master-ai-system");
 writeFileSync(join(bauman,"guarded-worker.txt"),"tamper\n");
 await assert.rejects(auditManagedControlGitSources({appsRoot:root,expectedMainHeads:expected}),/TRACKED_FILES_DIRTY/);
 git(bauman,"checkout","--quiet","--","guarded-worker.txt");
 await assert.rejects(auditManagedControlGitSources({appsRoot:root,expectedMainHeads:{...expected,
   "BAUMAN-CONTROL":"0".repeat(40)}}),/MAIN_SHA_MISMATCH/);
 git(bauman,"checkout","--quiet","-b","unreviewed-draft");
 await assert.rejects(auditManagedControlGitSources({appsRoot:root,expectedMainHeads:expected}),/BRANCH_NOT_MAIN/);
});
test("unreviewed on-disk Worker markers cannot be promoted by caller-asserted permission",t=>{
 const root=mkdtempSync(join(tmpdir(),"am-untrusted-authority-"));
 t.after(()=>rmSync(root,{force:true,recursive:true}));
 for(const [,dir] of ids){
   const folder=join(root,dir,"control-service","src");mkdirSync(folder,{recursive:true});
   const name=dir.startsWith("Bauman")?"automation-contract.ts":"index.ts";
   writeFileSync(join(folder,name),"verifyManagedIngress(request, incomingEnv\nlocalD1Observer.blockedPreflight()");
 }
 assert.throws(()=>assertManagedControlAdmission({managed:true,appsRoot:root,
   authority:{reviewed:true,exactSourceSHAReadback:true,safeRuntimeAdmission:true}}),
   /CALLER_SUPPLIED_AUTHORITY_REJECTED/);
 assert.throws(()=>assertManagedControlAdmission({managed:true,appsRoot:root}),/REVIEW_AND_SHA_BLOCKED/);
});
