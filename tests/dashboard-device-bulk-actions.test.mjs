import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

function source(path) {
  return fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("bulk device handling is bounded to actionable pending non-Boi devices", () => {
  const ui = source("app/management-dashboard-v2.tsx");
  assert.match(ui, /visibleDevices\.filter\(\(device\) => device\.status === "pending" && device\.canRemove && device\.appId !== "boi-ech"\)\.slice\(0, 24\)/);
  assert.match(ui, /bulkTargets = devices\.filter\(\(device\) => device\.status === "pending" && device\.canRemove && device\.appId !== "boi-ech"\)\.slice\(0, 24\)/);
  assert.match(ui, /boiTargets = visibleDevices\.filter\(\(device\) => device\.status === "pending" && device\.canRemove && device\.appId === "boi-ech"\)/);
});

test("bulk mutations preserve per-client concurrency snapshots and resync after execution", () => {
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

test("Boi permanent deletion is excluded from bulk operations", () => {
  const ui = source("app/management-dashboard-v2.tsx");
  const start = ui.indexOf("async function bulkRemovePendingDevices");
  const end = ui.indexOf("async function launchWeb", start);
  const block = ui.slice(start, end);
  assert.match(block, /device\.appId !== "boi-ech"/);
  assert.match(block, /Bơi ếch không cho xóa hàng loạt/);
  assert.doesNotMatch(block, /Xóa vĩnh viễn thiết bị/);
});

test("device bulk toolbar is explicit and responsive", () => {
  const ui = source("app/management-dashboard-v2.tsx");
  const css = source("app/management-dashboard-v2.css");
  assert.match(ui, /Hàng đợi kiểm duyệt/);
  assert.match(ui, /Từ chối & khóa/);
  assert.doesNotMatch(ui, /Khóa \/ loại chờ duyệt/);
  assert.match(css, /\.amv2-device-bulk-toolbar/);
  assert.match(css, /@media \(max-width: 700px\)[\s\S]*\.amv2-device-bulk-toolbar \{ align-items: stretch; flex-direction: column; \}/);
});
