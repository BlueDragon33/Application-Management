import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

function source(path) {
  return fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("current dashboard restores device-local font-size controls without reviving the old hub", () => {
  const ui = source("app/management-dashboard-v2.tsx");
  assert.match(ui, /type FontScale = "compact" \| "standard" \| "large" \| "xlarge"/);
  assert.match(ui, /application-management:font-scale:v1/);
  assert.match(ui, /useState<FontScale>\("compact"\)/);
  assert.match(ui, /window\.localStorage\.getItem\(fontScaleStorageKey\)/);
  assert.match(ui, /window\.localStorage\.setItem\(fontScaleStorageKey, next\)/);
  assert.match(ui, /data-font-scale=\{fontScale\}/);
  assert.match(ui, /Giao diện trên thiết bị này/);
  assert.match(ui, /Mức hiện tại · nhiều nội dung/);
  assert.doesNotMatch(ui, /AppearanceDialog/);
});

test("font scaling changes typography only and leaves dashboard geometry intact", () => {
  const css = source("app/management-dashboard-v2-typography.css");
  assert.match(css, /data-font-scale="compact"/);
  assert.match(css, /data-font-scale="standard"/);
  assert.match(css, /data-font-scale="large"/);
  assert.match(css, /data-font-scale="xlarge"/);
  assert.match(css, /--amv2-body-user/);
  assert.match(css, /--amv2-page-title-user/);
  const scaleBlock = css.slice(css.indexOf("/* User-selected content scale."));
  assert.doesNotMatch(scaleBlock, /^\s*(?:width|height|grid-template(?:-columns|-rows)?|transform|zoom)\s*:/m);
});

test("appearance controls remain compact and responsive inside Settings", () => {
  const css = source("app/management-dashboard-v2.css");
  assert.match(css, /\.amv2-appearance-settings/);
  assert.match(css, /\.amv2-font-scale-options/);
  assert.match(css, /grid-template-columns: repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(css, /button\[data-active="true"\]/);
  assert.match(css, /@media \(max-width: 700px\)[\s\S]*\.amv2-font-scale-options \{ grid-template-columns: 1fr; \}/);
});
