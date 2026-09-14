import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const dashboard = fs.readFileSync("app/management-dashboard-v2.tsx", "utf8");
const controls = fs.readFileSync("app/management-controls.tsx", "utf8");

test("client device table distinguishes destructive Boi deletion from reversible client blocking", () => {
  assert.match(dashboard, /device\.appId === "boi-ech"/);
  assert.match(dashboard, /Xóa vĩnh viễn thiết bị/);
  assert.match(dashboard, /Khóa thiết bị/);
  assert.match(dashboard, /device\.appId === "boi-ech" \? "Loại bỏ" : "Khóa"/);
});

test("client actions are verified before UI refresh and never optimistic-delete rows", () => {
  const start = dashboard.indexOf("async function manageClientDevice");
  const end = dashboard.indexOf("async function dismissNotifications", start);
  assert.ok(start >= 0 && end > start);
  const block = dashboard.slice(start, end);
  assert.match(block, /await operationsAction/);
  assert.match(block, /clearCachedOperations\(\)/);
  assert.match(block, /await refreshOperations\(\)/);
  assert.match(block, /expectedStatus: device\.status/);
  assert.match(block, /registryInstanceId: device\.registryInstanceId/);
  assert.doesNotMatch(block, /current\.devices\.filter|setOperations\(\(current\)/);
});

test("device table falls back to the owning app administration when no direct action exists", () => {
  assert.match(dashboard, /<Link href=\{device\.href\}>Quản trị<\/Link>/);
  assert.match(dashboard, /!device\.canApprove && !device\.canRemove \? <Link href=\{device\.href\}>Xử lý<\/Link>/);
});

test("clearing notifications never removes source devices", () => {
  const start = dashboard.indexOf("async function dismissNotifications");
  const end = dashboard.indexOf("async function saveAutomation", start);
  assert.ok(start >= 0 && end > start);
  const block = dashboard.slice(start, end);
  assert.match(block, /action: "dismiss-notifications"/);
  assert.match(block, /workItemIds: ids/);
  assert.match(block, /Dữ liệu và yêu cầu thiết bị gốc vẫn được giữ nguyên trong mục Thiết bị/);
  assert.doesNotMatch(block, /manage-client-device|current\.devices\.filter/);
});

test("notification queue follows visible work items while the Devices view keeps the full registry", () => {
  assert.match(dashboard, /const visibleWorkItemIds = useMemo/);
  assert.match(dashboard, /const notificationDevices = useMemo/);
  assert.match(dashboard, /const notificationCount = notificationDevices\.length \+ distinctWorkItems\.length/);
  assert.match(dashboard, /const queueDevices = filteredDevices\.filter\(\(device\) => visibleWorkItemIds\.has/);
  assert.match(dashboard, /DeviceTable devices=\{filteredDevices\}/);
});

test("returning from app administration triggers read-only resync", () => {
  assert.match(dashboard, /visibilitychange/);
  assert.match(dashboard, /window\.addEventListener\("focus"/);
  assert.match(dashboard, /void refreshOperations\(\)/);
});

test("automatic rejection or blocking is shown only for clients advertising a safe contract", () => {
  assert.match(controls, /autoRejectSupportedAppIds/);
  assert.match(controls, /autoBlockPendingSupportedAppIds/);
  assert.match(controls, /Không tự động xóa vĩnh viễn thiết bị/);
  assert.match(controls, /Sau 24 giờ/);
  assert.match(controls, /Sau 7 ngày/);
  assert.match(controls, /Sau 30 ngày/);
  assert.match(controls, /set-auto-block-pending/);
});
