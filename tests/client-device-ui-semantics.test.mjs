import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const dashboard = fs.readFileSync("app/management-dashboard-v2.tsx", "utf8");

test("client device actions distinguish Boi deletion from non-destructive blocking", () => {
  assert.match(dashboard, /const destructive = device\.appId === "boi-ech"/);
  assert.match(dashboard, /Xóa vĩnh viễn thiết bị/);
  assert.match(dashboard, /Khóa thiết bị/);
  assert.match(dashboard, /device\.appId === "boi-ech" \? "Xóa" : "Khóa"/);
});

test("client actions use verified API mutation then read-only refresh", () => {
  const start = dashboard.indexOf("async function manageDevice");
  const end = dashboard.indexOf("async function launchWeb", start);
  assert.ok(start >= 0 && end > start);
  const block = dashboard.slice(start, end);
  assert.match(block, /await operationsAction/);
  assert.match(block, /expectedStatus: device\.status/);
  assert.match(block, /await refreshOperations\(true\)/);
  assert.doesNotMatch(block, /setOperations\(\(current\)/);
});

test("device view keeps direct app administration separate from registry mutation", () => {
  assert.match(dashboard, /function DevicesView/);
  assert.match(dashboard, /<Link href=\{device\.href\}>Quản trị<\/Link>/);
  assert.match(dashboard, /device\.canApprove/);
  assert.match(dashboard, /device\.canRemove/);
});

test("full device tab uses the complete filtered device set while overview stays compact", () => {
  assert.match(dashboard, /const filteredDevices = devices\.filter/);
  assert.match(dashboard, /<DevicesView devices=\{filteredDevices\}/);
  assert.match(dashboard, /pendingDevices\.slice\(0, 4\)\.map/);
});

test("returning to the center triggers a read-only operations resync", () => {
  assert.match(dashboard, /window\.addEventListener\("focus", onFocus\)/);
  assert.match(dashboard, /const onFocus = \(\) => void refreshOperations\(true\)/);
});

test("automatic approval uses only server-advertised supported client ids", () => {
  assert.match(dashboard, /new Set\(current\.autoApproveSupportedAppIds\)/);
  assert.match(dashboard, /selection\.appIds\.some\(\(id\) => !supported\.has\(id\) && !current\.autoApproveAppIds\.includes\(id\)\)/);
  assert.match(dashboard, /targetAppIds: current\.autoApproveSupportedAppIds/);
  assert.match(dashboard, /action: "set-auto-approval", appIds: selection\.appIds/);
  assert.match(dashboard, /<AutomaticDevicePolicies/);
});

test("clear-all notifications only dismisses central work items and preserves client source data", () => {
  assert.match(dashboard, /const ids = workItems\.map\(\(item\) => item\.id\)/);
  assert.match(dashboard, /action: "dismiss-notifications", workItemIds: ids/);
  assert.match(dashboard, /Dữ liệu nghiệp vụ gốc không bị xóa/);
  assert.match(dashboard, /dữ liệu gốc được giữ nguyên/);
});
