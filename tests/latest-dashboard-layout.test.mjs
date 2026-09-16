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

test("applications are paged three at a time with up/down controls", () => {
  const dashboard = source("app/management-modern-overview.tsx");
  assert.match(dashboard, /const APP_WINDOW_SIZE = 3/);
  assert.match(dashboard, /const visibleApps = primaryApps\.slice\(safeAppOffset, safeAppOffset \+ APP_WINDOW_SIZE\)/);
  assert.match(dashboard, /Ứng dụng trước/);
  assert.match(dashboard, /Ứng dụng tiếp theo/);
  assert.match(dashboard, /tối đa 3 ứng dụng mỗi lượt/);
});

test("long queues stay scrollable inside their panels", () => {
  const css = source("app/management-latest-layout.css");
  assert.match(css, /\.modernAppsTable\s*\{[\s\S]*?max-height:\s*155px;[\s\S]*?overflow-y:\s*auto;/);
  assert.match(css, /\.modernWorkTable\s*\{[\s\S]*?overflow:\s*auto;/);
  assert.match(css, /\.modernDeviceTable\s*\{[\s\S]*?overflow:\s*auto;/);
});

test("duplicate quick refresh action is removed from the dashboard", () => {
  const dashboard = source("app/management-modern-overview.tsx");
  assert.doesNotMatch(dashboard, /Làm mới trạng thái/);
  assert.match(dashboard, /Đồng bộ tất cả/);
  assert.match(dashboard, /Xem nhật ký/);
});
