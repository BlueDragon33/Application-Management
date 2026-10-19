import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("automation editor resets controls from verified readback and stays open after save", () => {
  const editor = source("app/automatic-device-policies.tsx");
  const dashboard = source("app/management-dashboard-v2.tsx");
  const start = dashboard.indexOf("async function saveAutomation");
  const end = dashboard.indexOf("async function manageControlDevice", start);
  const saveBlock = dashboard.slice(start, end);

  assert.match(editor, /const readback = await save/);
  assert.match(editor, /const rebased = initialDrafts\(apps, readback\)/);
  assert.match(editor, /setDrafts\(rebased\)/);
  assert.match(editor, /stillPending\.length > 0/);
  assert.match(editor, /setDays\(boiPending && saved \? saved\.days/);
  assert.match(editor, /setLimit\(boiPending && saved \? saved\.limit/);
  assert.match(editor, /hasChanges/);
  assert.match(editor, /Cấu hình đang khớp trạng thái đã đọc/);
  assert.match(dashboard, /save=\{saveAutomation\}/);
  assert.doesNotMatch(saveBlock, /setAutoPolicyOpen\(false\)/);
  assert.match(saveBlock, /return mergedSettings;/);
});

test("unsupported automation controls describe unsupported state instead of fake manual defaults", () => {
  const editor = source("app/automatic-device-policies.tsx");
  assert.match(editor, /approvalValue = draft\.autoApprove \? "auto" : "manual"/);
  assert.match(editor, /blockValue = draft\.autoBlock \? "block" : "keep"/);
  assert.match(editor, /Chỉ lưu bản nháp; client chưa cho phép ghi LIVE/);
  assert.match(editor, /disabled=\{!canSave\}/);
  assert.match(editor, /timeValue = draft\.autoBlock \? draft\.pendingBlockAfterHours : 0/);
  assert.match(editor, /<option value=\{0\}>/);
});

test("policy layout is responsive and does not force the old narrow left rail plus three rigid cards", () => {
  const css = source("app/automatic-device-policies.module.css");
  assert.match(css, /width: min\(1120px, 100%\)/);
  assert.match(css, /\.app \{ display: grid; gap:/);
  assert.doesNotMatch(css, /\.app \{[^}]*grid-template-columns: minmax\(140px, \.7fr\)/s);
  assert.match(css, /grid-template-columns: minmax\(190px, 1fr\) minmax\(190px, 1fr\) minmax\(150px, \.72fr\)/);
  assert.match(css, /@media \(max-width: 900px\)/);
  assert.match(css, /@media \(max-width: 620px\)/);
});

test("a weaker generic Universal snapshot cannot downgrade a verified specialized live automation adapter", () => {
  const settings = source("app/operations-settings.server.ts");
  assert.match(settings, /existingLive\?\.verification\.state === "live"/);
  assert.match(settings, /existingLive\.mutation\.autoApprove \|\| dynamicApproveWritable/);
  assert.match(settings, /existingLive\.mutation\.autoBlockPending \|\| dynamicBlockWritable/);
  assert.match(settings, /Never downgrade a live writable field/);
  assert.match(settings, /addsDynamicCapability/);
});
