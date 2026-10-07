import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("Boi automation save trusts the write response first and waits for independent GET convergence", () => {
  const route = source("app/api/operations-auto-approval/route.ts");
  assert.match(route, /const updated = await bridgeJson\(bridge, "\/api\/control\/overview"/);
  assert.match(route, /boiAutomationMatches\(updated, enabled, defaultAccessDays, defaultDeviceLimit\)/);
  assert.match(route, /const delays = \[0, 120, 280, 600, 1_000\]/);
  assert.match(route, /\/api\/control\/overview\?activityDays=0/);
  assert.match(route, /readback chưa hội tụ/);
});

test("dashboard does not accept the first stale bootstrap after a policy mutation", () => {
  const dashboard = source("app/management-dashboard-v2.tsx");
  const start = dashboard.indexOf("async function saveAutomation");
  const end = dashboard.indexOf("async function manageControlDevice", start);
  const block = dashboard.slice(start, end);
  assert.match(block, /function taskMatchesReadback/);
  assert.match(block, /for \(const delay of \[180, 360, 720\]\)/);
  assert.match(block, /tasks\.every\(\(task\) => taskMatchesReadback/);
  assert.match(block, /synced = await refreshOperations\(true\)/);
});

test("Boi free policy readback compares both days and device limit", () => {
  const dashboard = source("app/management-dashboard-v2.tsx");
  const route = source("app/api/operations-auto-approval/route.ts");
  assert.match(dashboard, /policy\?\.current\.freeAccessDays === selection\.defaultAccessDays/);
  assert.match(dashboard, /policy\?\.current\.freeDeviceLimit === selection\.defaultDeviceLimit/);
  assert.match(route, /Number\(state\.defaultAccessDays\) === defaultAccessDays/);
  assert.match(route, /Number\(state\.defaultDeviceLimit\) === defaultDeviceLimit/);
});


test("explicit automation save bypasses passive Standalone cache but still uses server-side admin authorization", () => {
  const dashboard = source("app/management-dashboard-v2.tsx");
  const start = dashboard.indexOf("async function saveAutomation");
  const end = dashboard.indexOf("async function manageControlDevice", start);
  const block = dashboard.slice(start, end);
  assert.match(dashboard, /async function refreshOperations\(silent = false, forceOnline = false\)/);
  assert.match(dashboard, /if \(!approvalGateEnabled && !forceOnline\)/);
  assert.match(block, /const liveBefore = await refreshOperations\(true, true\)/);
  assert.doesNotMatch(block, /requireManagedAccess\("Lưu quy tắc tự động"\)/);
  assert.match(block, /refreshOperations\(true, true\)/);
  assert.match(dashboard, /connectOperationsDashboard\(\)/);
});


test("all specialized automation adapters use the same independent readback convergence rule", () => {
  const route = source("app/api/operations-auto-approval/route.ts");
  assert.match(route, /waitForBridgeAutomationReadback/);
  assert.match(route, /Sức khỏe Y tế/);
  assert.match(route, /Bauman/);
  assert.match(route, /Hòa nhập Nga/);
  assert.match(route, /AUTOMATION_READBACK_DELAYS = \[0, 120, 280, 600, 1_000\]/);
  assert.match(route, /await waitForBridgeAutomationReadback\(bridge, "\/api\/control\/automation"/);
});
