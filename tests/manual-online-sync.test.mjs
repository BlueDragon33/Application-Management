import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = fs.readFileSync(new URL("../app/management-dashboard-v2.tsx", import.meta.url), "utf8");

test("manual sync buttons force an online refresh even in standalone mode", () => {
  const matches = source.match(/onClick=\{\(\) => void refreshOperations\(false, true\)\}/g) ?? [];
  assert.equal(matches.length, 2, "both manual sync controls must force online verification");
});

test("background focus refresh remains local-first in standalone mode", () => {
  assert.match(source, /const onFocus = \(\) => void refreshOperations\(true\)/);
  assert.doesNotMatch(source, /const onFocus = \(\) => void refreshOperations\(true, true\)/);
});
