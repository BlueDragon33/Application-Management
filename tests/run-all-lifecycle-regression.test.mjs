import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(resolve("scripts/run-all.mjs"), "utf8");

test("run:all fails closed when any addon runtime exits unexpectedly", () => {
  assert.match(source, /const addonNames = new Map\(/);
  assert.match(source, /if \(!closing\) \{/);
  assert.match(source, /dừng ngoài dự kiến/);
  assert.doesNotMatch(source, /!closing && code !== 0/);
  assert.match(source, /\[growUpControl, "GrowUP Control"\]/);
  assert.match(source, /\[priceControl, "PriceReport Control"\]/);
  assert.match(source, /\[priceRuntime, "PriceReport Runtime"\]/);
});


test("run:all rejects malformed static runtime URLs instead of crashing", () => {
  assert.match(source, /try \{\s*raw = decodeURIComponent/);
  assert.match(source, /catch \{\s*return null;\s*\}/);
});
