import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { loadEvidence, validateEvidence, summary } from "../scripts/local-ops-shutdown-evidence.mjs";
import { REQUIRED_SHUTDOWN_UNITS, unsupportedFullStack } from "../scripts/local-ops-shutdown-contract.mjs";

const matrix=loadEvidence();
test("the 13-unit audit reconciles exact shutdown gate without claiming approval",()=>{
  const ids=matrix.units.map(x=>x.id);
  assert.equal(ids.length,13);
  assert.deepEqual([...ids].sort(),[...REQUIRED_SHUTDOWN_UNITS].sort());
  const result=summary(matrix);
  assert.equal(result.total,13);
  assert.equal(result.blocked,10);
  assert.equal(result.candidateOnly,3);
  assert.equal(result.trulyReady,0);
  assert.equal(result.fullStackAutoRestartReady,false);
  assert.equal(unsupportedFullStack().supported,false);
  for(const unit of matrix.units){
    assert.equal(unit.autoRestartApproved,false);
    assert.equal(unit.actualDrainAttested,false);
    assert.equal(unit.actualExitAttested,false);
    assert.match(unit.windowsEvidence,/^Windows (?:real runtime|full stack) NOT_TESTED$/);
    assert.match(unit.repository,/^BlueDragon33\//);
  }
});
test("tampering with one drain ACK, missing unit, duplicated unit or publication flag fails validation",()=>{
  const clone=()=>structuredClone(matrix);
  let a=clone(); a.units[0].actualDrainAttested=true;
  assert.throws(()=>validateEvidence(a),/FAKE_APPROVAL/);
  a=clone();a.units.pop();
  assert.throws(()=>validateEvidence(a),/SCHEMA_INVALID/);
  a=clone();a.units[12].id=a.units[0].id;
  assert.throws(()=>validateEvidence(a),/DUPLICATE/);
  a=clone();a.publicationAuthority=true;
  assert.throws(()=>validateEvidence(a),/SCHEMA_INVALID/);
  a=clone();a.units[3].sourcePath="../../outside";
  assert.throws(()=>validateEvidence(a),/SOURCE_INVALID/);
});
test("CLI checks read-only and never turns a missing Windows workspace into READY",t=>{
  const temp=mkdtempSync(join(tmpdir(),"am-shutdown-evidence-"));
  t.after(()=>rmSync(temp,{recursive:true,force:true}));
  const proc=spawnSync(process.execPath,["scripts/local-ops-shutdown-evidence.mjs","--workspace",temp],
    {cwd:new URL("..",import.meta.url),windowsHide:true,encoding:"utf8",timeout:12000});
  assert.equal(proc.status,0,proc.stderr);
  const report=JSON.parse(proc.stdout);
  assert.equal(report.fullStackAutoRestartReady,false);
  assert.ok(report.units.every(x=>x.state==="SOURCE_NOT_PRESENT"&&x.ready===false));
});
