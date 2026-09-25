import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

function source(path) {
  return fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("bulk device handling is limited to actionable pending devices and a bounded batch", () => {
  const ui = source("app/management-dashboard-v2.tsx");
  assert.match(ui, /visibleDevices\.filter\(\(device\) => device\.status === "pending" && device\.canRemove\)\.slice\(0, 24\)/);
  assert.match(ui, /bulkTargets = devices\.filter\(\(device\) => device\.status === "pending" && device\.canRemove\)\.slice\(0, 24\)/);
  assert.doesNotMatch(ui, /devices\.filter\(\(device\) => device\.canRemove\)(?!\.filter)/);
});

test("bulk mutations preserve per-client semantics and concurrency snapshots", () => {
  const ui = source("app/management-dashboard-v2.tsx");
  const start = ui.indexOf("async function bulkRemovePendingDevices");
  const end = ui.indexOf("async function launchWeb", start);
  assert.ok(start >= 0 && end > start);
  const block = ui.slice(start, end);
  assert.match(block, /action: "manage-client-device"/);
  assert.match(block, /operation: "remove"/);
  assert.match(block, /expectedStatus: device\.status/);
  assert.match(block, /registryInstanceId: device\.registryInstanceId \?\? undefined/);
  assert.match(block, /await refreshOperations\(true\)/);
  assert.doesNotMatch(block, /setOperations\(/);
});

test("bulk Boi deletion is explicitly destructive and requires a second confirmation", () => {
  const ui = source("app/management-dashboard-v2.tsx");
  assert.match(ui, /device\.appId === "boi-ech"/);
  assert.match(ui, /XÓA VĨNH VIỄN/);
  assert.match(ui, /Xác nhận lần cuối: xóa vĩnh viễn/);
  assert.match(ui, /Bơi ếch xóa vĩnh viễn và luôn cần xác nhận hai lần/);
});

test("device bulk toolbar is present and responsive", () => {
  const ui = source("app/management-dashboard-v2.tsx");
  const css = source("app/management-dashboard-v2.css");
  assert.match(ui, /Khóa \/ loại chờ duyệt/);
  assert.doesNotMatch(ui, /Xử lý tất cả chờ duyệt/);
  assert.match(css, /\.amv2-device-bulk-toolbar/);
  assert.match(css, /@media \(max-width: 700px\)[\s\S]*\.amv2-device-bulk-toolbar \{ align-items: stretch; flex-direction: column; \}/);
});
