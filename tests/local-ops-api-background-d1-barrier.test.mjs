import assert from 'node:assert/strict';
import test from 'node:test';
import {createApiBackgroundD1Barrier} from '../scripts/local-ops-api-background-d1-barrier.mjs';
import {readFileSync} from 'node:fs';
const marker='ab'.repeat(16), other='cd'.repeat(16);
test('cannot stop before any background work has been verified',()=>{
  const b=createApiBackgroundD1Barrier();
  assert.equal(b.status().fixtureStopMayProceed,false);
  assert.equal(b.status().globalD1QuiescenceVerified,false);
  assert.equal(b.status().allWaitUntilJobsInstrumented,false);
});
test('admitted background task blocks stop until D1 readback',()=>{
  const b=createApiBackgroundD1Barrier();
  assert.equal(b.start(marker),true);
  assert.equal(b.status().backgroundPending,true);
  assert.equal(b.status().fixtureStopMayProceed,false);
  assert.equal(b.complete(marker,'BACKGROUND_COMMITTED'),true);
  assert.equal(b.status().fixtureStopMayProceed,true);
  assert.equal(b.status().globalD1QuiescenceVerified,false);
  assert.equal(b.status().autoRestartAllowed,false);
});
test('HTTP accepted/PENDING does not verify background commit',()=>{
  const b=createApiBackgroundD1Barrier();
  b.start(marker);
  assert.equal(b.status().declaredBackgroundD1ReadbackVerified,false);
});
test('wrong marker or wrong readback permanently taints attempt',()=>{
  for(const [badId,badValue] of [
    [other,'BACKGROUND_COMMITTED'],[marker,'PENDING'],[marker,null]]){
    const b=createApiBackgroundD1Barrier();b.start(marker);
    assert.equal(b.complete(badId,badValue),false);
    assert.equal(b.complete(marker,'BACKGROUND_COMMITTED'),false);
    assert.equal(b.status().tainted,true);
    assert.equal(b.status().fixtureStopMayProceed,false);
  }
});
test('empty, invalid, duplicate marker fails closed',()=>{
  for(const bad of ['', 'xyz', 'a'.repeat(31)]){
    const b=createApiBackgroundD1Barrier();
    assert.equal(b.start(bad),false);
    assert.equal(b.status().fixtureStopMayProceed,false);
  }
  const b=createApiBackgroundD1Barrier();
  assert.equal(b.start(marker),true);
  assert.equal(b.start(other),false);
  assert.equal(b.status().fixtureStopMayProceed,false);
});
test('no signed global isolate or production shutdown claim',()=>{
  const b=createApiBackgroundD1Barrier();
  b.start(marker);b.complete(marker,'BACKGROUND_COMMITTED');
  const v=b.status();
  assert.equal(v.allWorkerIsolatesEnumerated,false);
  assert.equal(v.allWaitUntilJobsInstrumented,false);
  assert.equal(v.productionStopAuthorized,false);
});

test('QA source binds worker waitUntil background state to real API stop and post-stop CLI readback',()=>{
  const worker=readFileSync(new URL('./fixtures/wrangler-d1-flight-worker.mjs',import.meta.url),'utf8');
  const child=readFileSync(new URL('./fixtures/local-ops-wrangler-api-d1-child.mjs',import.meta.url),'utf8');
  const parent=readFileSync(new URL('../scripts/local-ops-wrangler-api-process-bound-qa.mjs',import.meta.url),'utf8');
  assert.match(worker,/ctx\.waitUntil\s*\(/);
  assert.match(worker,/BACKGROUND_COMMITTED/);
  assert.match(child,/background\.status\(\)\.fixtureStopMayProceed/);
  assert.match(child,/D1_BACKGROUND_UNVERIFIED/);
  assert.match(child,/await runtime\.stop\(\)/);
  assert.match(parent,/assert\.equal\(deniedBackground\.reason,"D1_BACKGROUND_UNVERIFIED"\)/);
  assert.ok(parent.includes('assert.equal(beforeRelease.state,"PENDING"'));
  assert.match(parent,/qa-background-release/);
  assert.match(worker,/background-release/);
  assert.match(parent,/persistedBackground=await sql/);
  assert.match(parent,/assert\.equal\(persistedBackground\[0\]\?\.val,"BACKGROUND_COMMITTED"\)/);
  assert.match(parent,/allWaitUntilJobsInstrumented:false/);
  assert.match(parent,/allWorkerIsolatesEnumerated:false/);
  assert.match(parent,/lateTree=await captureWindowsTree/);
  assert.match(parent,/verifyWindowsTreeGone\(lateTree\)/);
  assert.match(parent,/WRANGLER_API_QA_STORAGE_PRESERVED_UNVERIFIED_EXIT/);
  assert.match(parent,/if\(safeToRemove\)/);
});
