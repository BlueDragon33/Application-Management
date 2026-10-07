import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("policy modal acquires a synchronous first-click lock before awaiting Save", () => {
  const editor = source("app/automatic-device-policies.tsx");
  assert.match(editor, /const submitLockRef = useRef\(false\)/);
  assert.match(editor, /const \[submitting, setSubmitting\] = useState\(false\)/);
  assert.match(editor, /if \(!canSave \|\| submitLockRef\.current\) return/);
  assert.match(editor, /submitLockRef\.current = true;\s*setSubmitting\(true\);/);
  assert.match(editor, /finally \{\s*submitLockRef\.current = false;\s*setSubmitting\(false\);/s);
  assert.match(editor, /const locked = busy \|\| submitting/);
  assert.match(editor, /disabled=\{locked\}/);
  assert.match(editor, /disabled=\{locked \|\| !approveWritable\}/);
  assert.match(editor, /locked \? "Đang lưu…" : "Lưu thay đổi"/);
});

test("dashboard has a second mutex that prevents duplicate automation transactions", () => {
  const dashboard = source("app/management-dashboard-v2.tsx");
  const start = dashboard.indexOf("async function saveAutomation");
  const end = dashboard.indexOf("async function manageControlDevice", start);
  const block = dashboard.slice(start, end);

  assert.match(dashboard, /const automationSaveLockRef = useRef\(false\)/);
  assert.match(block, /if \(automationSaveLockRef\.current\) return null/);
  assert.match(block, /automationSaveLockRef\.current = true/);
  assert.match(block, /setActionBusy\("auto-policy"\)/);
  assert.ok(
    block.indexOf('setActionBusy("auto-policy")') < block.indexOf("await refreshOperations"),
    "busy state must start before the first await",
  );
  assert.match(block, /finally \{\s*automationSaveLockRef\.current = false;\s*setActionBusy\(""\);/s);
});

test("canceling confirmation also releases both save locks", () => {
  const dashboard = source("app/management-dashboard-v2.tsx");
  const start = dashboard.indexOf("async function saveAutomation");
  const end = dashboard.indexOf("async function manageControlDevice", start);
  const block = dashboard.slice(start, end);
  assert.match(block, /try \{/);
  assert.match(block, /if \(!window\.confirm\(confirmation\)\) return/);
  assert.match(block, /finally \{/);
});
