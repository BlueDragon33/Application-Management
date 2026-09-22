import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

function source(path) {
  return fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("root uses dashboard v2 directly without a legacy runtime DOM mutation layer", () => {
  const layout = source("app/layout.tsx");
  const page = source("app/page.tsx");
  assert.doesNotMatch(layout, /RuntimeUiFixes/);
  assert.match(page, /ManagementEntry/);
  assert.match(page, /management-dashboard-v2-final\.css/);
});

test("desktop overview restores the published control-room panel order", () => {
  const css = source("app/management-latest-layout.css");
  assert.match(css, /\.modernAppsPanel\s*\{[\s\S]*?grid-column:\s*1;[\s\S]*?grid-row:\s*1;/);
  assert.match(css, /\.modernWorkPanel\s*\{[\s\S]*?grid-column:\s*1;[\s\S]*?grid-row:\s*2\s*\/\s*span\s*2;/);
  assert.match(css, /\.modernAlertsPanel\s*\{[\s\S]*?grid-column:\s*2;[\s\S]*?grid-row:\s*1;/);
  assert.match(css, /\.modernQuickPanel\s*\{[\s\S]*?grid-column:\s*2;[\s\S]*?grid-row:\s*2;/);
  assert.match(css, /\.modernDevicePanel\s*\{[\s\S]*?grid-column:\s*2;[\s\S]*?grid-row:\s*3;/);
});

test("published header and quick-alert panel remain present", () => {
  const dashboard = source("app/management-modern-overview.tsx");
  assert.match(dashboard, /className="modernPageHeader"/);
  assert.match(dashboard, /className="modernPanel modernAlertsPanel"/);
});

test("bottom helper and pager boxes are absent", () => {
  const dashboard = source("app/management-modern-overview.tsx");
  const runtime = source("app/runtime-ui-fixes.tsx");
  assert.doesNotMatch(dashboard, /tối đa 3 ứng dụng mỗi lượt/);
  assert.match(runtime, /Cuộn để xem thêm/);
  assert.match(runtime, /modernAppsPager/);
});

test("long tables stay scrollable inside the published panels", () => {
  const css = source("app/management-latest-layout.css");
  assert.match(css, /\.modernAppsTable\s*\{[\s\S]*?overflow-y:\s*auto/);
  assert.match(css, /\.modernWorkTable\s*\{[\s\S]*?overflow:\s*auto/);
  assert.match(css, /\.modernDeviceTable\s*\{[\s\S]*?overflow:\s*auto/);
});

test("quick actions do not duplicate refresh", () => {
  const dashboard = source("app/management-modern-overview.tsx");
  assert.doesNotMatch(dashboard, /Làm mới trạng thái/);
  assert.match(dashboard, /Đồng bộ dữ liệu/);
  assert.match(dashboard, /Duyệt thiết bị/);
});
