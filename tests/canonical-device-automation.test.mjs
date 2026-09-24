import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("canonical device screen opens a per-client automation editor", () => {
  const entry = source("app/management-entry.tsx");
  const dashboard = source("app/management-dashboard-v2.tsx");
  const editor = source("app/automatic-device-policies.tsx");
  assert.match(entry, /ManagementDashboardV2/);
  assert.match(dashboard, /<AutomaticDevicePolicies/);
  assert.match(dashboard, /Tự động/);
  assert.match(editor, /applicationRegistry\.map/);
  assert.match(editor, /autoApproveSupportedAppIds/);
  assert.match(editor, /autoBlockPendingSupportedAppIds/);
  assert.match(editor, /Chờ contract/);
});

test("automation changes use client readback and never grant paid access from payment proof alone", () => {
  const dashboard = source("app/management-dashboard-v2.tsx");
  const endpoint = source("app/api/operations-auto-approval/route.ts");
  const editor = source("app/automatic-device-policies.tsx");
  assert.match(dashboard, /set-auto-approval/);
  assert.match(dashboard, /set-auto-block-pending/);
  assert.match(dashboard, /refreshOperations\(true\)/);
  assert.match(endpoint, /setBoi\(actor, desired/);
  assert.match(endpoint, /defaultAccessDays/);
  assert.match(endpoint, /defaultDeviceLimit/);
  assert.match(editor, /Chỉ mở trả phí sau khi xác minh thanh toán/);
  assert.doesNotMatch(editor, /proof_submitted.*paid_verified/);
});

test("a disconnected client keeps its policy while connected clients can save independently", () => {
  const dashboard = source("app/management-dashboard-v2.tsx");
  const endpoint = source("app/api/operations-auto-approval/route.ts");
  const editor = source("app/automatic-device-policies.tsx");
  assert.match(dashboard, /targetAppIds: current\.autoApproveSupportedAppIds/);
  assert.match(endpoint, /CANDIDATE_APP_IDS\.filter\(\(id\) => targets\.includes\(id\)\)/);
  assert.match(editor, /Quy tắc của ứng dụng chưa trả lời được giữ nguyên/);
  assert.doesNotMatch(editor, /!unavailableEnabled/);
});
