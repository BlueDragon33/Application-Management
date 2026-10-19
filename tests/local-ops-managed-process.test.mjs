import assert from "node:assert/strict";
import test from "node:test";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { setTimeout as delay } from "node:timers/promises";
import { managedRuntimePlan, childOwnershipEvidence } from "../scripts/local-ops-managed-process.mjs";
import { treeDescendants, verifyGone, captureWindowsTree, verifyWindowsTreeGone } from "../scripts/local-ops-windows-process-tree.mjs";

test("managed npx.cmd Vite/Wrangler bypasses cmd.exe only with local verified Node binary", async t => {
  const root=mkdtempSync(join(tmpdir(),"am-npx-direct-"));
  t.after(()=>rmSync(root,{recursive:true,force:true}));
  for(const tool of ["vite","wrangler"]) {
    const rel=tool==="vite"?"vite/bin/vite.js":"wrangler/bin/wrangler.js";
    const target=join(root,"node_modules",...rel.split("/"));
    mkdirSync(join(target,".."),{recursive:true});
    writeFileSync(target,"console.log('local fixture only');\n");
    const plan=managedRuntimePlan({command:"npx.cmd",args:[tool,"--host","127.0.0.1"],cwd:root,managed:true,platform:"win32"});
    assert.equal(plan.verifiedDirectChild,true);
    assert.equal(plan.command,process.execPath);
    assert.equal(plan.args[0],target);
    assert.equal(plan.mode,"local-bin-direct");
    const child=spawn(plan.command,plan.args,{cwd:root,windowsHide:true,stdio:"ignore"});
    assert.equal(childOwnershipEvidence(plan,child).directChild,true);
    const [exitCode] = await once(child, "exit");
    assert.equal(exitCode,0, "fixture binary actually completed before cleanup");
    // No shell, no npm install, no remote package fetch.
  }
  const old=managedRuntimePlan({command:"npx.cmd",args:["vite"],cwd:root,managed:false,platform:"win32"});
  assert.equal(old.verifiedDirectChild,false);
  const pinned=managedRuntimePlan({command:"npx.cmd",args:["--yes","wrangler@4.136.3","dev"],cwd:root,managed:true,platform:"win32"});
  assert.equal(pinned.verifiedDirectChild,false);
  assert.match(pinned.blocker,/UNSUPPORTED/);
  assert.throws(()=>managedRuntimePlan({command:"npx.cmd",args:["wrangler"],cwd:join(root,"not-present"),managed:true,platform:"win32"}));
});

test("process genealogy captures transitive descendants, refuses cycles and survivor PID",()=>{
  const rows=[{pid:120,ppid:1},{pid:122,ppid:120},{pid:126,ppid:122},{pid:199,ppid:1}];
  assert.deepEqual(treeDescendants(120,[{pid:0,ppid:0},...rows]),[120,122,126]);
  assert.deepEqual(verifyGone([120,122,126],[{pid:199,ppid:1}]),{stopped:true,survivingPids:[]});
  assert.deepEqual(verifyGone([120,122,126],[{pid:126,ppid:1}]),{stopped:false,survivingPids:[126]});
  assert.throws(()=>treeDescendants(120,[...rows,rows[0]]),/INVALID/);
  assert.throws(()=>treeDescendants(100,rows),/NOT_RUNNING/);
});

test("Windows runner: inspect actual child PID and require its disappearance without taskkill",{
  skip:process.platform!=="win32"}, async()=>{
  const child=spawn(process.execPath,["-e","setTimeout(()=>process.exit(0),60000)"],{stdio:"ignore",windowsHide:true});
  try {
    const snapshot=await captureWindowsTree(child.pid);
    assert.equal(snapshot.verified,true);
    assert.ok(snapshot.pids.includes(child.pid));
    if(child.exitCode===null&&child.signalCode===null) {
      const exited=once(child,"exit"); child.kill(); await exited;
    }
    const result=await verifyWindowsTreeGone(snapshot);
    assert.equal(result.stopped,true,JSON.stringify(result));
  }finally{if(child.exitCode===null&&child.signalCode===null)child.kill();}
});
