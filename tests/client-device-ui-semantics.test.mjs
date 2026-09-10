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
  const end = hub.indexOf("async function saveAutoApproval");
  const block = hub.slice(start, end);
  assert.match(block, /await operationsAction/);
  assert.match(block, /await refreshOperations\(\)/);
  assert.doesNotMatch(block, /current\.devices\.filter|setOperations\(\(current\)/);
});

test("device table falls back to app administration when direct action is unavailable", () => {
  assert.match(hub, /Vào quản trị app/);
  assert.match(hub, /needsAppAdmin/);
});

test("bulk removal follows visible device filters and uses verified device actions", () => {
  assert.match(hub, /filterClientDevices/);
  assert.match(hub, /removeVisibleClientDevices/);
  assert.match(hub, /Loại bỏ tất cả/);
  assert.match(hub, /filterClientDevices\(operations\?\.devices \?\? \[\], appFilter, deviceFilter, timeFilter, search\)\.slice\(0, 24\)/);
});

test("returning from app administration triggers read-only resync", () => {
  assert.match(hub, /visibilitychange/);
  assert.match(hub, /window\.addEventListener\("focus"/);
  assert.match(hub, /read-only registry resync/);
});

test("automatic removal is shown per app but is not faked without a client contract", () => {
  assert.match(hub, /Tự động loại bỏ theo ứng dụng/);
  assert.match(hub, /Chưa có contract tự động/);
  assert.match(hub, /disabled checked=\{false\} readOnly/);
});
