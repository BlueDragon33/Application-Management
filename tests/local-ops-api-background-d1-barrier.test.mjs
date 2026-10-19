import assert from 'node:assert/strict';
import test from 'node:test';
import {createApiBackgroundD1Barrier} from '../scripts/local-ops-api-background-d1-barrier.mjs';
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
