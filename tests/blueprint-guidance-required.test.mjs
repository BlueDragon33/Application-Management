import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = path => readFileSync(new URL("../"+path,import.meta.url),"utf8");
// Blueprint 1.3.0 functional sanction = FAIL CI + BLOCK release. Never issue a
// punitive user action, fake reviewer decision or automatically publish.
test("Blueprint Hướng dẫn / Next Action is permanently accessible offline and on the quick dock",()=>{
  const local=read("app/offline-ops-panel.tsx");
  const dashboard=read("app/management-dashboard-v2.tsx");
  const quick=read("app/management-quick-actions.tsx");
  assert.match(local,/data-blueprint-required="next-action"/);
  assert.match(local,/Hướng dẫn · Next Action/);
  assert.match(local,/aria-expanded=\{guideOpen\}/);
  assert.match(local,/setGuideOpen/);
  assert.match(local,/Sao chép lệnh tiếp tục/);
  assert.match(dashboard,/data-blueprint-required="guidance"/);
  assert.match(dashboard,/Hướng dẫn · Next Action/);
  assert.match(dashboard,/<OfflineOpsPanel local=\{localRuntime\}/);
  assert.match(quick,/data-blueprint-required="guidance"/);
  assert.match(quick,/Hướng dẫn · Next Action/);
  assert.match(quick,/setGuideOpen/);
  assert.match(quick,/Xem nhật ký & Quality Gates/);
});
test("missing shutdown evidence must not be hidden by guidance or treated as READY",()=>{
  const plan=JSON.parse(read("control/local-ops-blocked-adapter-plan.json"));
  assert.equal(plan.readyCount,0);
  assert.equal(plan.fullStackAutoRestartAllowed,false);
  assert.ok(plan.units.every(u=>u.ready===false&&u.approved===false&&u.permitAutoRestart===false));
  const supervisor=read("scripts/run-all.mjs");
  assert.match(supervisor,/unsupportedFullStack\(\)/);
  const panel=read("app/offline-ops-panel.tsx");
  assert.match(panel,/restartControl\?\.status === "blocked"/);
  assert.match(panel,/Chưa có bằng chứng drain D1 đầy đủ/);
});

test("guidance regression is enforced by Windows + Linux offline CI (not a UI-only promise)",()=>{
  const workflow=read(".github/workflows/local-offline-smoke-ci.yml");
  assert.match(workflow,/tests\/blueprint-guidance-required\.test\.mjs/);
  assert.match(workflow,/windows-helper-and-d1/);
  assert.match(workflow,/isolated-local-cold-start/);
});
