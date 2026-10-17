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
