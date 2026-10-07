import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("canonical device screen uses the merged app inventory and separates applied state from drafts", () => {
  const entry = source("app/management-entry.tsx");
  const dashboard = source("app/management-dashboard-v2.tsx");
  const editor = source("app/automatic-device-policies.tsx");
  const css = source("app/automatic-device-policies.module.css");
  assert.match(entry, /ManagementDashboardV2/);
  assert.match(dashboard, /<AutomaticDevicePolicies apps=\{activeApps\}/);
  assert.match(editor, /apps\.map/);
  assert.doesNotMatch(editor, /applicationRegistry/);
  assert.match(editor, /settings\?\.automationPolicies/);
  assert.match(editor, /type AutomationAppDraft/);
  assert.match(editor, /const \[drafts, setDrafts\]/);
  assert.match(editor, /function updateDraft/);
  assert.match(editor, /Đang áp dụng/);
  assert.match(editor, /verification\.state/);
  assert.match(editor, /LAST KNOWN/);
  assert.doesNotMatch(editor, /type="radio"/);
  assert.match(css, /\.policyGrid/);
  assert.match(css, /\.applied/);
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
  assert.match(editor, /Luồng trả phí vẫn phải xác minh thanh toán/);
  assert.doesNotMatch(editor, /proof_submitted.*paid_verified/);
});

test("one save verifies each changed policy field independently with one confirmation", () => {
  const dashboard = source("app/management-dashboard-v2.tsx");
  const endpoint = source("app/api/operations-auto-approval/route.ts");
  const editor = source("app/automatic-device-policies.tsx");
  const start = dashboard.indexOf("async function saveAutomation");
  const end = dashboard.indexOf("async function manageControlDevice", start);
  const block = dashboard.slice(start, end);
  assert.match(block, /current\.automationPolicies/);
  assert.match(block, /field: "autoApprove"/);
  assert.match(block, /field: "autoBlockPending"/);
  assert.match(block, /targetAppIds: \[appId\]/);
  assert.match(block, /Promise\.allSettled/);
  assert.match(block, /synced\.settings\.automationPolicies/);
  assert.match(block, /policy\?\.verification\.state === "live"/);
  assert.match(block, /failedFields/);
  assert.equal((block.match(/window\.confirm/g) ?? []).length, 1);
  assert.match(endpoint, /CANDIDATE_APP_IDS\.filter\(\(id\) => targets\.includes\(id\)\)/);
  assert.match(editor, /Lưu thay đổi/);
  assert.match(editor, /bản nháp/);
});

test("quick web menu exposes only actual client runtime URLs", () => {
  const dashboard = source("app/management-dashboard-v2.tsx");
  assert.match(dashboard, /function webAccessAvailable/);
  assert.match(dashboard, /if \(summary\?\.webAccessPolicy === "deny"\) return false/);
  assert.match(dashboard, /return Boolean\(summary\?\.webHref \|\| app\.publicUrl \|\| \(localRuntime && app\.localUrl\)\)/);
  assert.match(dashboard, /app\?\.publicUrl \?\? \(localRuntime \? app\?\.localUrl : undefined\)/);
  assert.match(dashboard, /disabled=\{!hasWeb \|\| webBusy === app\.id\}/);
  assert.match(dashboard, /hasWeb \? "Mở ↗" : webActionLabel\(summary, false\)/);
  assert.match(dashboard, /function webActionLabel/);
  assert.match(dashboard, /return "Chỉ cục bộ"/);
  assert.match(dashboard, /return "Chưa có web"/);
  assert.doesNotMatch(dashboard, /hasWeb \? "Mở ↗" : "Chờ"/);
});
