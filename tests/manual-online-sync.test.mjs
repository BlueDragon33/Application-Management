import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = fs.readFileSync(new URL("../app/management-dashboard-v2.tsx", import.meta.url), "utf8");

test("manual sync buttons force an online refresh even in standalone mode", () => {
  assert.match(source, /async function syncOperationsNow\(\) \{\s*setOperationsVerified\(false\);\s*return refreshOperations\(false, true\);\s*\}/s);
  assert.match(source, /syncOperations=\{syncOperationsNow\}/);
  assert.match(source, /onClick=\{\(\) => void syncOperationsNow\(\)\}/);
  assert.match(source, /onClick=\{\(\) => void syncOperations\(\)\}/);
});

test("background focus refresh remains local-first in standalone mode", () => {
  assert.match(source, /const onFocus = \(\) => void refreshOperations\(true\)/);
  assert.doesNotMatch(source, /const onFocus = \(\) => void refreshOperations\(true, true\)/);
});

test("verified online state is independent from the standalone access gate", () => {
  assert.match(source, /const offline = !operationsVerified;/);
  assert.doesNotMatch(source, /const offline = !approvalGateEnabled \|\| !operationsVerified;/);
  assert.match(source, /if \(approvalGateEnabled\) return true;/);
});
