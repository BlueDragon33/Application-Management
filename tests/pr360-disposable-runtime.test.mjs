import assert from "node:assert/strict";
import test from "node:test";
import {readFileSync,mkdtempSync,rmSync} from "node:fs";
import {join} from "node:path";
import {tmpdir} from "node:os";
import {boundary,dockerArgumentAudit,selectVerifiedCandidate,runDisposable} from "../scripts/pr360-disposable-runtime-qa.mjs";
test("isolation arguments reject host port mapping, privilege, network and env-file",()=>{
  const safe=["run","--rm","--pull","never","--network","none","--cap-drop","ALL",
    "--security-opt","no-new-privileges","-e","OFFLINE_NETWORK_ISOLATED=1"];
  assert.equal(dockerArgumentAudit(safe),true);
  for(const more of [["-p","3000:3188"],["--privileged"],["--network=host"],
    ["--publish","3000"],["--env-file",".env"],["--device","/dev/sda"]]){
    assert.equal(dockerArgumentAudit([...safe,...more]),false);
  }
});
test("multiple eligible TEMP clones choose the newest verified clone without deleting siblings",()=>{
  const older={root:"older-temp-copy",label:"Blueprint-PR360-Candidate-older",createdAt:123};
  const newer={root:"newer-temp-copy",label:"Blueprint-PR360-Candidate-newer",createdAt:456};
  assert.equal(selectVerifiedCandidate([newer,older]),newer.root);
  assert.equal(selectVerifiedCandidate([older,newer]),newer.root);
  assert.equal(selectVerifiedCandidate([older]),older.root);
  assert.equal(selectVerifiedCandidate([
    {root:"b",label:"Blueprint-PR360-Candidate-b",createdAt:456},
    {root:"a",label:"Blueprint-PR360-Candidate-a",createdAt:456},
  ]),"a");
  assert.throws(()=>selectVerifiedCandidate([]),/EVIDENCED_CANDIDATE_CLONE_NOT_FOUND/);
});
test("path isolation rejects OS temp root and sibling prefix traversal",()=>{
  assert.equal(boundary(join(tmpdir(),"qa"),join(tmpdir(),"qa","candidate")),true);
  assert.equal(boundary(join(tmpdir(),"qa"),join(tmpdir(),"qa-other")),false);
});
test("Windows runtime QA fails before trying npm or Docker on an unrecognized platform",async()=>{
  const dir=mkdtempSync(join(tmpdir(),"pr360-disposable-test-"));
  let called=false;
  try{
    if(process.platform!=="win32"){
      const result=await runDisposable({reportDir:dir,
        findCandidate:()=>{called=true;throw Error("TEST_MUST_NOT_REACH");}});
      assert.equal(result.verdict,"BLOCKED");
      assert.equal(result.blocker,"WINDOWS_OPERATOR_REQUIRED");
      assert.equal(called,false);
    }
    const module=readFileSync(new URL("../scripts/pr360-disposable-runtime-qa.mjs",import.meta.url),"utf8");
    assert.match(module,/NPM_CONFIG_OFFLINE:"true"/);
    assert.match(module,/--ignore-scripts/);
    assert.match(module,/--network","none"/);
    assert.match(module,/--pull","never"/);
    assert.match(module,/state.sha===EVIDENCED_SHA && state.branch==="HEAD" && state.clean/);
    assert.match(module,/lstatSync\(gitPath\)/);
    assert.match(module,/LOCAL_NETWORK_NONE_COLD_START_PASS/);
    assert.doesNotMatch(module,/docker pull|taskkill|Stop-Process|git reset|git checkout|git merge|ExecutionPolicy Bypass/);
    assert.match(module,/BLOCKED_NOT_TESTED/);
  } finally{rmSync(dir,{recursive:true,force:true});}
});
