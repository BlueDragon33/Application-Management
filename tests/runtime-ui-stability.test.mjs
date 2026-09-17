import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = fs.readFileSync(new URL("../app/runtime-ui-fixes.tsx", import.meta.url), "utf8");

test("runtime UI fixes do not attach a broad subtree MutationObserver", () => {
  assert.doesNotMatch(source, /new MutationObserver/);
  assert.doesNotMatch(source, /observer\.observe\(document\.body/);
});

test("runtime UI fixes remain lightweight and scheduled", () => {
  assert.match(source, /function applyLightweightFixes/);
  assert.match(source, /window\.setTimeout/);
  assert.match(source, /window\.addEventListener\("click"/);
});
