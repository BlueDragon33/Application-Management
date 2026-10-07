import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const dashboard = fs.readFileSync("app/management-dashboard-v2.tsx", "utf8");

test("device review tab is explicitly named and only receives pending devices", () => {
  assert.match(dashboard, /label: "Kiểm duyệt thiết bị"/);
  assert.match(dashboard, /title: "Kiểm duyệt thiết bị"/);
  assert.match(dashboard, /const filteredPendingDevices = filteredDevices\.filter\(\(device\) => device\.status === "pending"\)/);
  assert.match(dashboard, /<DevicesView devices=\{filteredPendingDevices\}/);
  assert.match(dashboard, /pendingDevices\.slice\(0, 4\)\.map/);
});

test("client device mutation is guarded by pending state and advertised capability", () => {
  const start = dashboard.indexOf("async function manageDevice");
  const end = dashboard.indexOf("async function bulkRemovePendingDevices", start);
  assert.ok(start >= 0 && end > start);
  const block = dashboard.slice(start, end);
  assert.match(block, /device\.status !== "pending"/);
  assert.match(block, /operation === "approve" && !device\.canApprove/);
  assert.match(block, /operation === "remove" && !device\.canRemove/);
  assert.match(block, /Không gửi lệnh lên client/);
});

test("Boi permanent deletion requires two-step confirmation with exact device code", () => {
  const start = dashboard.indexOf("async function manageDevice");
  const end = dashboard.indexOf("async function bulkRemovePendingDevices", start);
  const block = dashboard.slice(start, end);
  assert.match(block, /Xóa vĩnh viễn thiết bị/);
  assert.match(block, /window\.prompt\(\`Nhập chính xác mã thiết bị để xác nhận xóa vĩnh viễn/);
  assert.match(block, /confirmation\?\.trim\(\)\.toUpperCase\(\) !== device\.deviceCode\.trim\(\)\.toUpperCase\(\)/);
  assert.match(block, /Từ chối và khóa thiết bị/);
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

test("device view keeps direct app administration separate from review mutation", () => {
  const start = dashboard.indexOf("function DevicesView");
  const end = dashboard.indexOf("function AlertsView", start);
  const block = dashboard.slice(start, end);
  assert.match(block, /<Link href=\{device\.href\}>Quản trị<\/Link>/);
  assert.match(block, /device\.canApprove/);
  assert.match(block, /device\.canRemove/);
  assert.match(block, /Bơi ếch là xóa vĩnh viễn nên không được xử lý hàng loạt/);
});

test("non-pending environment cases in work queue route to app administration instead of dead mutation buttons", () => {
  const start = dashboard.indexOf("function ApprovalView");
  const end = dashboard.indexOf("function ApplicationsView", start);
  const block = dashboard.slice(start, end);
  assert.match(block, /const pending = device\.status === "pending"/);
  assert.match(block, /pending && device\.canApprove/);
  assert.match(block, /pending && device\.canRemove/);
  assert.match(block, /!pending \? <Link href=\{device\.href\}>Quản trị<\/Link>/);
});

test("state conflicts and stale registries force a read-only resync", () => {
  const start = dashboard.indexOf("async function manageDevice");
  const end = dashboard.indexOf("async function bulkRemovePendingDevices", start);
  const block = dashboard.slice(start, end);
  assert.match(block, /GROWUP_REGISTRY_INSTANCE_MISMATCH/);
  assert.match(block, /DEVICE_STATE_CONFLICT/);
  assert.match(block, /DEVICE_NOT_FOUND/);
  assert.match(block, /await refreshOperations\(true\)/);
});

test("returning to the center triggers a read-only operations resync", () => {
  assert.match(dashboard, /window\.addEventListener\("focus", onFocus\)/);
  assert.match(dashboard, /const onFocus = \(\) => void refreshOperations\(true\)/);
});

test("automatic approval is limited to writable per-app snapshots and verified by live readback", () => {
  assert.match(dashboard, /current\.automationPolicies/);
  assert.match(dashboard, /policy\.mutation\.autoApprove/);
  assert.match(dashboard, /targetAppIds: \[appId\]/);
  assert.match(dashboard, /field: "autoApprove"/);
  assert.match(dashboard, /mergedSettings\.automationPolicies/);
  assert.match(dashboard, /policy\?\.verification\.state === "live"/);
  assert.match(dashboard, /<AutomaticDevicePolicies apps=\{activeApps\}/);
});

test("clear-all notifications only dismisses central work items and preserves client source data", () => {
  assert.match(dashboard, /const ids = workItems\.map\(\(item\) => item\.id\)/);
  assert.match(dashboard, /action: "dismiss-notifications", workItemIds: ids/);
  assert.match(dashboard, /Dữ liệu nghiệp vụ gốc không bị xóa/);
  assert.match(dashboard, /dữ liệu gốc được giữ nguyên/);
});

test("dashboard notices remain in the inline board until manually dismissed", () => {
  assert.doesNotMatch(dashboard, /window\.setTimeout\(\(\) => setNotice\(""\), 5_500\)/);
  assert.match(dashboard, /aria-label="Đóng thông báo"/);
  assert.match(dashboard, /role="status"/);
  assert.match(dashboard, /aria-live="polite"/);
});
