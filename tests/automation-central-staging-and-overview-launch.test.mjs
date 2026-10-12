import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

test("central automation ledger stages before client mutation and records actual readback", () => {
  const migration = read("drizzle/0015_automation_policy_changes.sql");
  const ledger = read("app/automation-policy-changes.server.ts");
  const approvals = read("app/api/operations-auto-approval/route.ts");
  const operations = read("app/api/operations/route.ts");

  assert.match(migration, /CREATE TABLE IF NOT EXISTS automation_policy_changes/);
  assert.match(migration, /state TEXT NOT NULL DEFAULT 'pending'/);
  assert.match(ledger, /INSERT INTO automation_policy_changes/);
  assert.match(ledger, /UPDATE automation_policy_changes SET state =/);
  assert.match(ledger, /AND state = 'pending'/);
  const approvalStart = approvals.indexOf("const changeId = await stageAutomationChange");
  const writeStart = approvals.indexOf("await setBoi(", approvalStart);
  assert.ok(approvalStart > 0 && writeStart > approvalStart);
  assert.match(approvals, /resolveAutomationChange\(change\.changeId, matches \? "applied" : "failed"/);
  const blockStart = operations.indexOf('if (action === "set-auto-block-pending")');
  const blockEnd = operations.indexOf('if (action === "manage-client-device")', blockStart);
  const block = operations.slice(blockStart, blockEnd);
  assert.match(block, /stageAutomationChange\(/);
  assert.match(block, /resolveAutomationChange\(changeId, matched \? "applied" : "failed"/);
  assert.ok(block.indexOf("stageAutomationChange(") < block.indexOf("executeUniversalAutomationCommand("));
});

test("unverified policy inputs never masquerade as constants or overwrite live configuration", () => {
  const modal = read("app/automatic-device-policies.tsx");
  const route = read("app/api/operations-auto-approval/route.ts");
  assert.doesNotMatch(modal, /\?\? 60|\?\? 20/);
  assert.match(modal, /<option value=\{0\}>Chưa xác minh<\/option>/);
  assert.match(modal, /const boiLimitsValid = !boiChanged/);
  assert.doesNotMatch(route, /freeAccessDaysByApp\?\.\["boi-ech"\] \?\? 60/);
  assert.doesNotMatch(route, /freeDeviceLimitByApp\?\.\["boi-ech"\] \?\? 20/);
  assert.match(route, /targets\.includes\("boi-ech"\)/);
});

test("overview icon buttons open their own web while heading remains the app-tab link", () => {
  const ui = read("app/management-dashboard-v2.tsx");
  const start = ui.indexOf('className="amv2-panel amv2-apps-panel amv2-overview-apps-launcher"');
  const end = ui.indexOf('className="amv2-panel amv2-devices-panel"', start);
  const block = ui.slice(start, end);
  assert.ok(start > 0 && end > start);
  assert.doesNotMatch(block, /role="button"|aria-label="Mở tab Ứng dụng"/);
  assert.match(block, /<button type="button" onClick=\{\(\) => switchView\("applications"\)\}>Xem tất cả/);
  assert.match(block, /className="amv2-overview-app-tile"/);
  assert.match(block, /aria-label=\{`Mở web \$\{item\.name\}`\}/);
  assert.match(block, /void launchWeb\(item\.id\)/);
  assert.match(block, /window\.location\.assign\(item\.href\)/);
  assert.match(block, /disabled=\{!item\.canOpen \|\| webBusy === item\.id\}/);
});
