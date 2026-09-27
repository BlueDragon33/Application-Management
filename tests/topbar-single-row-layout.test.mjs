import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

function source(path) {
  return fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

const base = source("app/management-dashboard-v2.css");
const reference = source("app/management-dashboard-v2-reference.css");

test("desktop topbar reserves one explicit column for all six controls", () => {
  assert.match(base, /grid-template-areas:\s*"search filter access bell online account"/);
  assert.match(base, /grid-template-columns:\s*minmax\(180px,1fr\)[\s\S]{0,180}minmax\(190px,210px\)/);
  for (const area of ["search", "filter", "access", "bell", "online", "account"]) {
    assert.match(base, new RegExp(`grid-area:\\s*${area}`));
  }
});

test("reference desktop override cannot regress the topbar back to five columns", () => {
  assert.match(reference, /grid-template-areas:\s*"search filter access bell online account"\s*!important/);
  assert.match(reference, /grid-template-columns:[^;]*minmax\(190px, 210px\)[^;]*!important/);
  assert.doesNotMatch(reference, /minmax\(360px, 1fr\) 180px 44px 184px minmax\(205px, \.52fr\)/);
});

test("tablet and mobile topbars keep account access on the first row", () => {
  assert.match(base, /grid-template-areas:\s*"search filter access bell account"/);
  assert.match(base, /grid-template-areas:\s*"search access bell account"/);
  assert.match(base, /\.amv2-online \{ display: none; \}/);
});
