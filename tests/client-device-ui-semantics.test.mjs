import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const hub = fs.readFileSync("app/application-hub.tsx", "utf8");

test("client device table distinguishes block from destructive Boi deletion", () => {
  assert.match(hub, /clientRemoveLabel/);
  assert.match(hub, /device\.appId === "boi-ech" \? "Xóa vĩnh viễn" : "Khóa"/);
  assert.match(hub, /Bản ghi thiết bị vẫn được giữ để audit/);
});

test("client actions are verified before UI refresh and never optimistic-delete rows", () => {
  const start = hub.indexOf("async function manageClientDevice");
  const end = hub.indexOf("async function removeVisibleClientDevices", start);
  assert.ok(start >= 0 && end > start);
  const block = hub.slice(start, end);
  assert.match(block, /await operationsAction/);
  assert.match(block, /await refreshOperations\(\)/);
  assert.doesNotMatch(block, /current\.devices\.filter|setOperations\(\(current\)/);
});

test("device table falls back to app administration when direct action is unavailable", () => {
  assert.match(hub, /Vào quản trị app/);
  assert.match(hub, /needsAppAdmin/);
});

test("bulk removal follows the complete active filter set, not only 24 rendered rows", () => {
  const start = hub.indexOf("async function removeVisibleClientDevices");
  const end = hub.indexOf("async function saveAutomation", start);
  assert.ok(start >= 0 && end > start);
  const bulk = hub.slice(start, end);
  assert.match(bulk, /const matched = filterClientDevices\(operations\?\.devices \?\? \[\], appFilter, deviceFilter, timeFilter, search\);/);
  assert.match(bulk, /const targets = matched\.filter\(\(device\) => device\.canRemove\);/);
  assert.doesNotMatch(bulk, /filterClientDevices\([^;]+\)\.slice\(0,\s*24\)/s);
  assert.match(bulk, /Bảng chỉ hiển thị 24 dòng đầu nhưng thao tác sẽ áp dụng toàn bộ/);
});

test("table rendering may stay capped while bulk count uses the full filtered set", () => {
  assert.match(hub, /const filteredClientDevices = filterClientDevices\(devices, appFilter, deviceFilter, timeFilter, search\);/);
  assert.match(hub, /bulkRemovableCount = filteredClientDevices\.filter\(\(device\) => device\.canRemove\)\.length/);
  assert.match(hub, /visible\.slice\(0, limit\)\.map/);
});

test("returning from app administration triggers read-only resync", () => {
  assert.match(hub, /visibilitychange/);
  assert.match(hub, /window\.addEventListener\("focus"/);
  assert.match(hub, /read-only registry resync/);
});

test("automatic removal is enabled only for clients advertising a safe auto-block contract", () => {
  assert.match(hub, /Tự động loại bỏ theo ứng dụng/);
  assert.match(hub, /autoBlockPendingSupportedAppIds/);
  assert.match(hub, /Khóa thiết bị pending quá hạn, giữ registry và audit/);
  assert.match(hub, /Sau 24 giờ/);
  assert.match(hub, /Sau 7 ngày/);
  assert.match(hub, /Sau 30 ngày/);
  assert.match(hub, /Không tự động xóa vĩnh viễn thiết bị/);
});
