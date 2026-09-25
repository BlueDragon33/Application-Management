import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const profiles = fs.readFileSync("app/contract-category-profiles.ts", "utf8");
const contract = fs.readFileSync("app/open-contract.server.ts", "utf8");
const reader = fs.readFileSync("app/automation-policy-read.server.ts", "utf8");
const approval = fs.readFileSync("app/api/operations-auto-approval/route.ts", "utf8");
const operations = fs.readFileSync("app/api/operations/route.ts", "utf8");
const modal = fs.readFileSync("app/automatic-device-policies.tsx", "utf8");
const dashboard = fs.readFileSync("app/management-dashboard-v2.tsx", "utf8");

test("Universal Contract starter exposes optional automation contract without enabling it", () => {
  assert.ok(profiles.includes('"deviceAutoApproval"'));
  assert.ok(profiles.includes('"deviceAutoBlockPending"'));
  assert.ok(profiles.includes('automation: "/api/control/automation"'));
  assert.ok(contract.includes("automation?: string"));
  assert.ok(contract.includes("deviceAutoApproval"));
  assert.ok(contract.includes("deviceAutoBlockPending"));
});

test("dynamic automation is read Universal-first and only then falls back to legacy adapters", () => {
  assert.ok(reader.includes("await readUniversalAutomationState(appId)"));
  const universalIndex = reader.indexOf("await readUniversalAutomationState(appId)");
  const boiIndex = reader.indexOf('if (appId === "boi-ech")', universalIndex);
  assert.ok(universalIndex >= 0 && boiIndex > universalIndex);
  assert.ok(contract.includes("export async function readUniversalAutomationState"));
});

test("dynamic auto approval writes through Universal Contract with readback", () => {
  assert.ok(approval.includes("probeDynamicManagedApplications"));
  assert.ok(approval.includes("setUniversalAutomationPolicy"));
  assert.ok(approval.includes("dynamicAutomationIds"));
  assert.ok(approval.includes("dynamic.manifest.capabilities.deviceAutoApproval === true"));
  assert.ok(contract.includes("Universal automation chưa xác nhận autoApproveDevices sau cập nhật."));
});

test("dynamic auto-block writes through Universal Contract before Health legacy fallback", () => {
  assert.ok(operations.includes("setUniversalAutomationPolicy"));
  assert.ok(operations.includes("dynamic.manifest.capabilities.deviceAutoBlockPending === true"));
  const universalIndex = operations.indexOf("await setUniversalAutomationPolicy(appId, actor");
  const healthIndex = operations.indexOf('if (appId !== "health-care")', universalIndex);
  assert.ok(universalIndex >= 0 && healthIndex > universalIndex);
});

test("automation modal renders active dynamic apps rather than static registry", () => {
  assert.equal(modal.includes('import { applicationRegistry }'), false);
  assert.ok(modal.includes("apps.map((app) =>"));
  assert.ok(dashboard.includes("apps={activeApps}"));
});
