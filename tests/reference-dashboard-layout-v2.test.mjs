import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

function source(path) {
  return fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("overview restores the published full application registry", () => {
  const ui = source("app/management-modern-overview.tsx");
  assert.match(ui, /const primaryApps = applicationRegistry/);
  assert.match(ui, /Bảng điều phối quản trị ứng dụng/);
});

test("published overview keeps alerts and the original panel family", () => {
  const ui = source("app/management-modern-overview.tsx");
  assert.match(ui, /modernAlertsPanel/);
  assert.match(ui, /modernQuickPanel/);
  assert.match(ui, /modernWorkPanel/);
  assert.match(ui, /modernDevicePanel/);
  assert.match(ui, /modernAppsPanel/);
});

test("experimental multi-theme bridge is not mounted", () => {
  const page = source("app/page.tsx");
  const layout = source("app/layout.tsx");
  assert.doesNotMatch(page, /management-theme-bridge\.css/);
  assert.doesNotMatch(layout, /application-management:theme:v1/);
});

test("requested bottom pager strip is removed", () => {
  const css = source("app/management-latest-layout.css");
  const ui = source("app/management-modern-overview.tsx");
  assert.match(css, /\.modernAppsPager\s*\{[\s\S]*?display:\s*none\s*!important/);
  assert.doesNotMatch(ui, /tối đa 3 ứng dụng mỗi lượt/);
});
