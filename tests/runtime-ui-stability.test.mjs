import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = fs.readFileSync(new URL("../app/runtime-ui-fixes.tsx", import.meta.url), "utf8");

test("runtime UI cleanup does not attach a broad subtree MutationObserver", () => {
  assert.doesNotMatch(source, /new MutationObserver/);
  assert.doesNotMatch(source, /observer\.observe\(document\.body/);
});

test("runtime cleanup only targets the explicitly rejected footer strips", () => {
  assert.match(source, /removeUnwantedFooterStrips/);
  assert.match(source, /Cuộn để xem thêm/);
  assert.match(source, /modernAppsPager/);
  assert.doesNotMatch(source, /filterInactiveApplications/);
  assert.doesNotMatch(source, /compactDashboardGrid/);
  assert.doesNotMatch(source, /migrateFontOneStepDown/);
});

test("footer cleanup uses bounded timers rather than continuous DOM watching", () => {
  assert.match(source, /window\.setTimeout/);
  assert.doesNotMatch(source, /window\.addEventListener\("click"/);
});
