import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("cached automation snapshots cannot be labeled LIVE or written", () => {
  const editor = source("app/automatic-device-policies.tsx");
  const dashboard = source("app/management-dashboard-v2.tsx");
  assert.match(editor, /if \(!verified && policy\.verification\.state === "live"\) return "CACHED"/);
  assert.match(editor, /const approveWritable = verified && policy\.mutation\.autoApprove/);
  assert.match(editor, /const blockWritable = verified && policy\.mutation\.autoBlockPending/);
  assert.match(editor, /const canSave = Boolean\(settings\) && verified/);
  assert.match(dashboard, /verified=\{automationSnapshotVerified\}/);
  const save = dashboard.slice(dashboard.indexOf("async function saveAutomation"), dashboard.indexOf("async function manageControlDevice"));
  assert.match(save, /if \(!automationSnapshotVerified\) \{[\s\S]*?return null/);
});

test("freshness is a verified online session with a bounded age", () => {
  const dashboard = source("app/management-dashboard-v2.tsx");
  assert.match(dashboard, /const automationSnapshotVerified = operationsVerified/);
  assert.match(dashboard, /Number\.isFinite\(snapshotAge\) && snapshotAge >= 0 && snapshotAge <= 120_000/);
  assert.match(dashboard, /function openAutomationPolicies\(\)/);
  assert.match(dashboard, /age > 60_000/);
  assert.match(dashboard, /sync=\{syncOperationsNow\}/);
  assert.match(dashboard, /setOperationsVerified\(false\);\s*setSyncError\(/);
});

test("live readback rebases only untouched automation drafts", () => {
  const editor = source("app/automatic-device-policies.tsx");
  assert.match(editor, /const draftEditedRef = useRef\(false\)/);
  assert.match(editor, /useEffect\(\(\) => \{\s*if \(draftEditedRef\.current\) return;\s*setDrafts\(initialDrafts\(apps, settings\)\)/);
  assert.match(editor, /\}, \[apps, settings\]\)/);
  assert.match(editor, /draftEditedRef\.current = true;\s*setDrafts/);
  assert.match(editor, /draftEditedRef\.current = true; setDays/);
  assert.match(editor, /draftEditedRef\.current = true; setLimit/);
  assert.match(editor, /draftEditedRef\.current = false;\s*setDrafts\(initialDrafts\(apps, readback\)\)/);
});
