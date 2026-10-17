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
    ["BAUMAN-CONTROL",{pr:366,sha:"0afe07e7e0f1d8cfd0dec66e887a3545f4e27947"}],
    ["PRICE-CONTROL",{pr:133,sha:"d6e910e6c0c7b0cdb1a395381f2be0d65eb7ca3d"}],
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

test("real source Worker private-file credential + gateway QA is not global OS/D1 shutdown authority",()=>{
  const ci={"BAUMAN-CONTROL":39005447548,"PRICE-CONTROL":39005464711};
  for(const id of ["BAUMAN-CONTROL","PRICE-CONTROL"]){
    const unit=plan.units.find(x=>x.id===id);
    const proof=unit.sourceDraft.testEvidence.privateFileManagedGateway;
    assert.equal(proof.ciRun,ci[id]);
    assert.equal(proof.windows,"PASS");
    assert.equal(proof.ubuntu,"PASS");
    assert.equal(proof.secretInArgv,false);
    assert.equal(proof.privateWindowsDaclApplied,true);
    assert.equal(proof.directWithoutProof403,true);
    assert.equal(proof.proxyWithProof200,true);
    assert.equal(proof.shutdownPreflight503,true);
    assert.equal(proof.osSameUserIsolationProven,false);
    assert.equal(proof.productionManagedPortWired,false);
    assert.equal(proof.globalD1DrainProven,false);
    assert.equal(proof.gracefulWindowsExitProven,false);
    assert.equal(unit.implementation.actualAppWindowsShutdown,"NOT_TESTED");
    assert.equal(unit.permitAutoRestart,false);
  }
});

test("real GitHub PR review readback and isolate ledger NEVER grant managed admission",()=>{
  const currentMain={
    "BAUMAN-CONTROL":"cec06d57df9d3224239213a6f08c4e184a2121cb",
    "PRICE-CONTROL":"9e8df71f2839989b067af79ef22c389f541664e5"
  };
  for(const id of ["BAUMAN-CONTROL","PRICE-CONTROL"]){
    const unit=plan.units.find(x=>x.id===id);
    const check=unit.sourceDraft.reviewVerification;
    assert.equal(check.reviewCount,0);
    assert.equal(check.isDraft,true);
    assert.equal(check.merged,false);
    assert.equal(check.actualPullRequestHead,unit.sourceDraft.head);
    assert.equal(check.currentRemoteMainSha,currentMain[id]);
    assert.equal(check.independentReviewApproved,false);
    assert.equal(check.authorizedSourceAdmission,false);
    assert.match(unit.implementation.multiIsolateLedger,/NOT_CLOUDFLARE_INVENTORY/);
    assert.match(unit.implementation.processBoundAck,/REAL_NODE_IPC_GATEWAY_QA_PID_NONCE_SHA_NEGATIVE_TEST_NOT_WRANGLER/);
    assert.equal(unit.ready,false);
    assert.equal(unit.approved,false);
    assert.equal(unit.permitAutoRestart,false);
  }
});

test("live remote review observation and tamper-poisoned ledger remain non-authorizing",()=>{
  const bauman=plan.units.find(x=>x.id==="BAUMAN-CONTROL");
  const price=plan.units.find(x=>x.id==="PRICE-CONTROL");
  assert.equal(bauman.sourceDraft.reviewVerification.currentRemoteMainSha,"cec06d57df9d3224239213a6f08c4e184a2121cb");
  assert.equal(bauman.sourceDraft.reviewVerification.pullRequestBehindRemoteMainBy,27);
  assert.equal(price.sourceDraft.reviewVerification.pullRequestBehindRemoteMainBy,0);
  for(const unit of [bauman,price]){
    assert.equal(unit.sourceDraft.reviewVerification.reviewCount,0);
    assert.equal(unit.sourceDraft.reviewVerification.independentReviewApproved,false);
    assert.equal(unit.sourceDraft.reviewVerification.authorizedSourceAdmission,false);
    assert.equal(unit.permitAutoRestart,false);
    assert.match(unit.implementation.multiIsolateLedger,/TAINT_ON_INVALID_RECEIPT/);
  }
});
