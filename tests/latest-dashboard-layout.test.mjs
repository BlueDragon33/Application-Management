import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

function source(path) {
  return fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("latest runtime refinements stay mounted in the root layout", () => {
  const layout = source("app/layout.tsx");
  assert.match(layout, /import RuntimeUiFixes from "\.\/runtime-ui-fixes"/);
  assert.match(layout, /<RuntimeUiFixes\s*\/>/);
});

test("desktop control room keeps the accepted panel order", () => {
  const css = source("app/management-latest-layout.css");
  assert.match(css, /\.modernAppsPanel\s*\{[\s\S]*?grid-column:\s*1;[\s\S]*?grid-row:\s*1;/);
  assert.match(css, /\.modernWorkPanel\s*\{[\s\S]*?grid-column:\s*1;[\s\S]*?grid-row:\s*2\s*\/\s*span\s*2;/);
  assert.match(css, /\.modernAlertsPanel\s*\{[\s\S]*?grid-column:\s*2;[\s\S]*?grid-row:\s*1;/);
  assert.match(css, /\.modernQuickPanel\s*\{[\s\S]*?grid-column:\s*2;[\s\S]*?grid-row:\s*2;/);
  assert.match(css, /\.modernDevicePanel\s*\{[\s\S]*?grid-column:\s*2;[\s\S]*?grid-row:\s*3;/);
});

test("applications and long queues scroll inside their panels", () => {
  const css = source("app/management-latest-layout.css");
  assert.match(css, /\.modernAppsTable\s*\{[\s\S]*?max-height:\s*155px;[\s\S]*?overflow-y:\s*auto;/);
  assert.match(css, /\.modernWorkTable\s*\{[\s\S]*?overflow:\s*auto;/);
  assert.match(css, /\.modernDeviceTable\s*\{[\s\S]*?overflow:\s*auto;/);
});

test("duplicate quick refresh action is not shown on desktop", () => {
  const css = source("app/management-latest-layout.css");
  assert.match(css, /\.modernQuickGrid\s*>\s*button:nth-child\(8\)\s*\{[\s\S]*?display:\s*none;/);
});
