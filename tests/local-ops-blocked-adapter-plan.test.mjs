import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { REQUIRED_SHUTDOWN_UNITS } from "../scripts/local-ops-shutdown-contract.mjs";
const plan=JSON.parse(readFileSync(new URL("../control/local-ops-blocked-adapter-plan.json",import.meta.url)));
const matrix=JSON.parse(readFileSync(new URL("../control/local-ops-shutdown-evidence.json",import.meta.url)));
test("10 blocked adapters exactly match the source-audited matrix with no phantom readiness",()=>{
  assert.equal(plan.fullStackAutoRestartAllowed,false);
  assert.equal(plan.readyCount,0);
  const blocked=matrix.units.filter(x=>x.assessment==="BLOCKED");
  assert.equal(blocked.length,10);
  assert.equal(plan.units.length,10);
  assert.deepEqual(plan.units.map(x=>x.id).sort(),blocked.map(x=>x.id).sort());
  for(const row of plan.units){
    const match=blocked.find(x=>x.id===row.id);
    assert.equal(row.repository,match.repository);
    assert.equal(row.sourceMainAtAudit,match.repoMainAtAudit);
    assert.equal(row.ready,false);
    assert.equal(row.approved,false);
    assert.equal(row.permitAutoRestart,false);
    assert.equal(row.implementation.actualAppWindowsShutdown,"NOT_TESTED");
    assert.match(row.blocker,/NO_VERIFIED/);
    assert.ok(row.requirements.some(x=>/committed/.test(x)));
  }
  assert.equal(REQUIRED_SHUTDOWN_UNITS.length,13);
  assert.equal(plan.workPackages.length,5);
  assert.deepEqual(plan.workPackages.map(x=>x.wave),[1,2,3,4,5]);
});
test("actual run-all remains fully blocked even after direct spawn/HTTP verifier libraries exist",()=>{
  const core=readFileSync(new URL("../scripts/run-all.mjs",import.meta.url),"utf8");
  assert.match(core,/unsupportedFullStack\(\)/);
  const inner=readFileSync(new URL("../scripts/run-local-system.mjs",import.meta.url),"utf8");
  assert.match(inner,/unsupportedFullStack\(\)/);
  assert.match(core,/managedRuntimePlan/);
  assert.match(inner,/managedRuntimePlan/);
  const verifier=readFileSync(new URL("../scripts/local-ops-runtime-drain-preflight.mjs",import.meta.url),"utf8");
  assert.match(verifier,/autoRestartAllowed:false/);
});

test("BAUMAN-CONTROL and PRICE-CONTROL linked drafts are only partial per-isolate evidence, never full shutdown approval",()=>{
  const linked = new Map([
    ["BAUMAN-CONTROL",{pr:366,sha:"2d39f866ed63761200bca2a9d224e6524308cb7c"}],
    ["PRICE-CONTROL",{pr:133,sha:"0567cdce46598b4dcf46dbd9bc6c78b9d585e59d"}],
  ]);
  for (const [id,ref] of linked) {
    const row=plan.units.find(x=>x.id===id);
    assert.ok(row);
    assert.equal(row.sourceDraft.pr,ref.pr);
    assert.equal(row.sourceDraft.head,ref.sha);
    assert.equal(row.sourceDraft.testEvidence.windowsFixture,"PASS");
    assert.equal(row.sourceDraft.testEvidence.ubuntuFixture,"PASS");
    assert.equal(row.sourceDraft.globalMultiIsolateDrained,false);
    assert.equal(row.sourceDraft.wranglerChildExitObserved,false);
    assert.equal(row.sourceDraft.realApplicationDrainAccepted,false);
    assert.equal(row.implementation.actualAppWindowsShutdown,"NOT_TESTED");
    assert.match(row.implementation.runtimeDrainProbe,/503_FAIL_CLOSED/);
    assert.equal(row.ready,false);
    assert.equal(row.approved,false);
    assert.equal(row.permitAutoRestart,false);
    assert.equal(row.sourceDraft.testEvidence.actualSourceWorker.windows,"PASS");
    assert.equal(row.sourceDraft.testEvidence.actualSourceWorker.ubuntu,"PASS");
    assert.match(row.sourceDraft.testEvidence.actualSourceWorker.scope,/HTTP_503_PRESTOP_ONLY/);
    assert.equal(row.sourceDraft.testEvidence.actualSourceWorker.d1InFlightShutdown,"NOT_PROVEN");
    assert.equal(row.sourceDraft.testEvidence.actualSourceWorker.windowsGracefulExit,"NOT_PROVEN");
    assert.equal(row.implementation.actualAppWindowsShutdown,"NOT_TESTED");
    if(id==="PRICE-CONTROL")
      assert.match(row.implementation.lockedWranglerCompatibility,/DRAFT_LOCKED_4_151_1/);
  }
});

test("managed ingress guard is Draft-only evidence, never an OS unbypassable or shutdown-ready claim",()=>{
  for(const id of ["BAUMAN-CONTROL","PRICE-CONTROL"]){
    const unit=plan.units.find(x=>x.id===id);
    const proof=unit.sourceDraft.testEvidence.managedIngressGuard;
    assert.equal(proof.directWithoutProof,"HTTP_403_TESTED");
    assert.equal(proof.verifiedUnbypassableOSBoundary,false);
    assert.equal(proof.actualManagedRunAllWiring,false);
    assert.equal(proof.d1GlobalDrain,false);
    assert.equal(proof.authenticatedGracefulExit,false);
    assert.equal(unit.ready,false);
    assert.equal(unit.permitAutoRestart,false);
  }
  const price=plan.units.find(x=>x.id==="PRICE-CONTROL");
  assert.match(price.implementation.npmGeneratedLockfile,/94_PACKAGE_GRAPH/);
});
