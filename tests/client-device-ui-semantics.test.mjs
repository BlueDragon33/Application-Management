import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const dashboard = fs.readFileSync("app/management-dashboard-v2.tsx", "utf8");

test("device removal distinguishes destructive Boi deletion from non-destructive client block", () => {
  assert.match(dashboard, /device\.appId === "boi-ech"/);
  assert.match(dashboard, /Xóa vĩnh viễn thiết bị/);
  assert.match(dashboard, /Khóa thiết bị/);
});

test("device actions refresh authoritative client state and never optimistic-delete rows", () => {
  const start = dashboard.indexOf("async function manageDevice");
  const end = dashboard.indexOf("async function launchWeb", start);
  assert.ok(start >= 0 && end > start);
  const block = dashboard.slice(start, end);
  assert.match(block, /await operationsAction/);
  assert.match(block, /await refreshOperations\(true\)/);
  assert.doesNotMatch(block, /devices\.filter\(|setOperations\(\(current\)/);
});

test("current dashboard filters the complete in-memory device snapshot before rendering", () => {
  assert.match(dashboard, /const filteredDevices = devices\.filter/);
  assert.match(dashboard, /appFilter !== "all"/);
  assert.match(dashboard, /searchValue/);
  assert.match(dashboard, /device\.deviceCode/);
  assert.match(dashboard, /device\.userLabel/);
});

test("returning to the dashboard triggers read-only resync", () => {
  assert.match(dashboard, /window\.addEventListener\("focus", onFocus\)/);
  assert.match(dashboard, /const onFocus = \(\) => void refreshOperations\(true\)/);
});

test("management actions remain capability-backed through the operations API", () => {
  const route = fs.readFileSync("app/api/operations/route.ts", "utf8");
  assert.match(route, /AUTO_APPROVE_SUPPORTED_APP_IDS/);
  assert.match(route, /set-auto-approval/);
  assert.match(route, /set-auto-block-pending/);
  assert.match(route, /AUTO_BLOCK_CONTRACT/);
});
