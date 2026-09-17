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

test("desktop overview uses the compact two-column composition", () => {
  const css = source("app/management-latest-layout.css");
  assert.match(css, /\.modernAppsPanel\s*\{[\s\S]*?grid-column:\s*1;[\s\S]*?grid-row:\s*1;/);
  assert.match(css, /\.modernQuickPanel\s*\{[\s\S]*?grid-column:\s*2;[\s\S]*?grid-row:\s*1;/);
  assert.match(css, /\.modernWorkPanel\s*\{[\s\S]*?grid-column:\s*1;[\s\S]*?grid-row:\s*2;/);
  assert.match(css, /\.modernDevicePanel\s*\{[\s\S]*?grid-column:\s*2;[\s\S]*?grid-row:\s*2;/);
});

test("overview removes the large page header, quick-alert panel and app pager", () => {
  const dashboard = source("app/management-modern-overview.tsx");
  assert.doesNotMatch(dashboard, /className="modernPageHeader"/);
  assert.doesNotMatch(dashboard, /className="modernPanel modernAlertsPanel"/);
  assert.doesNotMatch(dashboard, /modernAppsPager/);
  assert.doesNotMatch(dashboard, /tối đa 3 ứng dụng mỗi lượt/);
});

test("application table has separate management and website columns", () => {
  const dashboard = source("app/management-modern-overview.tsx");
  const css = source("app/management-latest-layout.css");
  assert.match(dashboard, /<span>Quản trị<\/span><span>Website<\/span>/);
  assert.match(dashboard, /className="modernManageAction"/);
  assert.match(dashboard, /className="modernWebAction"/);
  assert.match(css, /grid-template-columns:[^;]*minmax\(112px, \.82fr\)[^;]*minmax\(112px, \.82fr\)/);
});

test("long tables stay scrollable inside panels and cells cannot bleed across columns", () => {
  const css = source("app/management-latest-layout.css");
  assert.match(css, /\.modernAppsTable\s*\{[\s\S]*?max-height:\s*194px;[\s\S]*?overflow:\s*auto;/);
  assert.match(css, /\.modernWorkTable\s*\{[\s\S]*?overflow:\s*auto;/);
  assert.match(css, /\.modernDeviceTable\s*\{[\s\S]*?overflow:\s*auto;/);
  assert.match(css, /text-overflow:\s*ellipsis/);
  assert.match(css, /white-space:\s*nowrap/);
});

test("quick actions remain compact and do not duplicate a refresh action", () => {
  const dashboard = source("app/management-modern-overview.tsx");
  assert.doesNotMatch(dashboard, /Làm mới trạng thái/);
  assert.match(dashboard, /Đồng bộ dữ liệu/);
  assert.match(dashboard, /Duyệt thiết bị/);
});
