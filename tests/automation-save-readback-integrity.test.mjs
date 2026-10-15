import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = (path) => fs.readFileSync(new URL("../" + path, import.meta.url), "utf8");

test("cancelled and partially failed saves cannot clear an uncommitted draft", () => {
  const dashboard = source("app/management-dashboard-v2.tsx");
  const start = dashboard.indexOf("async function saveAutomation");
  const end = dashboard.indexOf("async function manageControlDevice", start);
  const block = dashboard.slice(start, end);
  assert.ok(start > 0 && end > start);
  assert.match(block, /if \(!window\.confirm\(confirmation\)\) return null/);
  assert.match(block, /return failedFields\.length \? null : mergedSettings/);
  assert.doesNotMatch(block, /window\.setTimeout\(\(\) => void refreshOperations\(true, true\), 1_200\)/);
  assert.match(block, /const failedFields: string\[\] = \[\]/);
});

test("modal retains unsaved values and exposes a real failure state", () => {
  const editor = source("app/automatic-device-policies.tsx");
  const start = editor.indexOf("async function submit()");
  const end = editor.indexOf("return <div className={styles.scrim}", start);
  const block = editor.slice(start, end);
  assert.ok(start > 0 && end > start);
  assert.match(block, /if \(!readback\) \{\s*setSaveError\(/);
  assert.ok(block.indexOf("if (!readback)") < block.indexOf("draftEditedRef.current = false"));
  assert.match(block, /catch \(error\) \{\s*setSaveError\(/);
  assert.match(editor, /const \[saveError, setSaveError\] = useState\(""\)/);
  assert.match(editor, /role="alert" className=\{styles\.warning\}/);
});

test("in-flight stale Operations bootstrap cannot overwrite a verified targeted Save", () => {
  const dashboard = source("app/management-dashboard-v2.tsx");
  assert.match(dashboard, /const automationMutationRevisionRef = useRef\(0\)/);
  assert.match(dashboard, /startedAtMutationRevision === automationMutationRevisionRef\.current && !automationSaveLockRef\.current/);
  assert.match(dashboard, /automationSaveLockRef\.current = true;\s*automationMutationRevisionRef\.current \+= 1/);
});
