import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

function source(path) {
  return fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("overview only exposes the two active applications", () => {
  const ui = source("app/management-modern-overview.tsx");
  assert.match(ui, /new Set\(\["boi-ech", "bauman-master-ai"\]\)/);
  assert.match(ui, /applicationRegistry\.filter\(\(app\) => PRIMARY_APP_IDS\.has\(app\.id\)\)/);
});

test("account menu owns the persistent appearance selector", () => {
  const ui = source("app/management-modern-overview.tsx");
  const layout = source("app/layout.tsx");
  assert.match(ui, /modernThemePicker/);
  assert.match(ui, /Xanh lục chuẩn/);
  assert.match(ui, /Ngọc lục/);
  assert.match(ui, /Xanh đêm/);
  assert.match(ui, /Than chì/);
  assert.match(ui, /application-management:theme:v1/);
  assert.match(layout, /application-management:theme:v1/);
});

test("desktop layout follows the approved reference composition", () => {
  const css = source("app/management-latest-layout.css");
  assert.match(css, /grid-template-columns:\s*278px minmax\(0,1fr\)/);
  assert.match(css, /grid-template-columns:\s*minmax\(0,1\.08fr\) minmax\(520px,\.92fr\)/);
  assert.match(css, /\.modernQuickGrid[\s\S]*grid-template-columns:\s*repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(css, /\.modernMetrics > button[\s\S]*min-height:\s*100px/);
  assert.match(css, /\.modernAppsRow[\s\S]*min-height:\s*58px/);
});

test("legacy views receive the same stored theme family", () => {
  const page = source("app/page.tsx");
  const bridge = source("app/management-theme-bridge.css");
  assert.match(page, /management-theme-bridge\.css/);
  assert.match(bridge, /html\[data-management-theme="midnight"\]/);
  assert.match(bridge, /html\[data-management-theme="graphite"\]/);
});
