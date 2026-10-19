import assert from "node:assert/strict";
import test from "node:test";
import {readFileSync,mkdtempSync,mkdirSync,rmSync,writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {execFileSync} from "node:child_process";
import {parsePorts,portReport,auditSources,prepare} from "../scripts/candidate-pr360-isolated-qa.mjs";
test("candidate QA detects separate 3188 conflict without touching user ports",()=>{
  const map=parsePorts(" TCP 127.0.0.1:3000 0.0.0.0:0 LISTENING 1234\n TCP 0.0.0.0:3188 0.0.0.0:0 LISTENING 7777\n TCP 127.0.0.1:3011 127.0.0.1:40000 ESTABLISHED 55");
  const p=portReport(map);
  assert.deepEqual(p.ports[3188].pids,[7777]);
  assert.equal(p.ports[3011].listener,"STOPPED");
});
test("missing main stops candidate before Git fetch or runtime launch",async()=>{
  const tmp=mkdtempSync(join(tmpdir(),"qa-cand-"));
  try {
    const root=join(tmp,"BaumanWeb");
    const r=await prepare({workspace:root,reportDir:join(tmp,"report")});
    assert.equal(r.verdict,"BLOCKED");
    assert.equal(r.blocker,"OWNER_MAIN_NOT_FOUND");
    assert.equal(r.runtime,"NOT_STARTED");
    assert.equal(r.d1Shutdown,"BLOCKED_NOT_TESTED");
  } finally{rmSync(tmp,{recursive:true,force:true});}
});
test("temporary Git candidate requires exact detached SHA and source gates",()=>{
  const tmp=mkdtempSync(join(tmpdir(),"pr360-src-audit-")),root=join(tmp,"candidate");
  try{
    mkdirSync(root);
    execFileSync("git",["init",root],{stdio:"ignore"});
    execFileSync("git",["-C",root,"config","user.email","qa@example.test"]);
    execFileSync("git",["-C",root,"config","user.name","QA"]);
    writeFileSync(join(root,"README"),"fixture");
    execFileSync("git",["-C",root,"add","README"]);
    execFileSync("git",["-C",root,"commit","-m","qa"],{stdio:"ignore"});
    const sha=execFileSync("git",["-C",root,"rev-parse","HEAD"],{encoding:"utf8"}).trim();
    const r=auditSources(root,sha);
    assert.equal(r.exactSha,true);assert.equal(r.complete,false);
    assert.equal(r.detached,false);
  }finally{rmSync(tmp,{recursive:true,force:true});}
});
test("candidate VBS uses Node not PowerShell or privilege escalation",()=>{
 const wrapper=readFileSync(new URL("../QA_PR360_CANDIDATE.vbs",import.meta.url),"utf8");
 assert.match(wrapper,/node\.exe/);
 assert.doesNotMatch(wrapper,/powershell\.exe|runas|ExecutionPolicy|taskkill/i);
});
