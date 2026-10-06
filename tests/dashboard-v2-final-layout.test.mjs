import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

function source(path) {
  return fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("page mounts the final dashboard style after base/reference styles", () => {
  const page = source("app/page.tsx");
  const base = page.indexOf('management-dashboard-v2.css');
  const ref = page.indexOf('management-dashboard-v2-reference.css');
  const views = page.indexOf('management-dashboard-v2-views.css');
  const final = page.indexOf('management-dashboard-v2-final.css');
  const compact = page.indexOf('management-dashboard-v2-compact-tables.css');
  const typography = page.indexOf('management-dashboard-v2-typography.css');
  assert.ok(base >= 0 && ref > base && views > ref && final > views && compact > final && typography > compact);
});

test("overview forces Applications above Priority and overrides older important rules", () => {
  const css = source("app/management-dashboard-v2-final.css");
  assert.match(css, /\.amv2-apps-panel\s*\{[\s\S]*?grid-column:\s*1\s*!important;[\s\S]*?grid-row:\s*1\s*\/\s*span\s*2\s*!important;/);
  assert.match(css, /\.amv2-priority-panel\s*\{[\s\S]*?grid-column:\s*1\s*!important;[\s\S]*?grid-row:\s*3\s*!important;/);
  assert.match(css, /\.amv2-alert-panel\s*\{[\s\S]*?grid-column:\s*2\s*!important;[\s\S]*?grid-row:\s*1\s*!important;/);
  assert.match(css, /\.amv2-quick-panel\s*\{[\s\S]*?grid-column:\s*2\s*!important;[\s\S]*?grid-row:\s*2\s*!important;/);
  assert.match(css, /\.amv2-devices-panel\s*\{[\s\S]*?grid-column:\s*2\s*!important;[\s\S]*?grid-row:\s*3\s*!important;/);
});

test("quick actions reserve all nine slots and keep Giao diện visible", () => {
  const layoutCss = source("app/management-dashboard-v2-final.css");
  const typographyCss = source("app/management-dashboard-v2-typography.css");
  const ui = source("app/management-dashboard-v2.tsx");
  assert.match(layoutCss, /\.amv2-quick-grid\s*\{[\s\S]*?grid-template-rows:\s*repeat\(3,/);
  assert.match(typographyCss, /\.amv2-quick-grid\s*>\s*button:nth-child\(8\)[\s\S]*?visibility:\s*visible\s*!important/);
  assert.match(ui, /<span>Giao diện<\/span>/);
});

test("dashboard typography uses a Vietnamese-safe system font stack", () => {
  const css = source("app/management-dashboard-v2-typography.css");
  assert.match(css, /Segoe UI/);
  assert.match(css, /Noto Sans/);
  assert.match(css, /\.amv2-page-head h1[\s\S]*font-family:[\s\S]*Segoe UI/);
});

test("application actions remain separate Website and Quản Trị columns", () => {
  const ui = source("app/management-dashboard-v2.tsx");
  assert.match(ui, /<span>Website<\/span><span>Quản Trị<\/span>/);
  assert.match(ui, /className="amv2-web-action"/);
  assert.match(ui, /webActionLabel\(summary, hasWeb, webBusy === app\.id\)/);
  assert.match(ui, /className="amv2-manage-action"/);
  assert.match(ui, />Quản trị<\/Link>/);
  assert.doesNotMatch(ui, /hasWeb \? "Đến" : "Chờ"/);
});

test("whole dashboard stays in one desktop viewport and tab changes do not animate whole pages", () => {
  const css = source("app/management-dashboard-v2-final.css");
  assert.match(css, /\.amv2-shell\s*\{[\s\S]*?height:\s*100dvh;/);
  assert.match(css, /\.amv2-overview-grid\s*\{[\s\S]*?height:\s*100%\s*!important;[\s\S]*?overflow:\s*hidden\s*!important;/);
  assert.match(css, /\.amv2-stage,[\s\S]*animation:\s*none\s*!important/);
});


test("minimal reference styling mounts after launcher styles and keeps flat status surfaces", () => {
  const page = source("app/page.tsx");
  const launcher = page.indexOf('management-app-launcher.css');
  const minimal = page.indexOf('management-dashboard-minimal-reference.css');
  const css = source("app/management-dashboard-minimal-reference.css");
  assert.ok(launcher >= 0 && minimal > launcher);
  assert.match(css, /\.amv2-panel,[\s\S]*?background:\s*#101716\s*!important/);
  assert.match(css, /\.amv2-metrics > button,[\s\S]*?background:\s*#131b19\s*!important/);
  assert.match(css, /\.amv2-metrics > button\[data-tone="teal"\],[\s\S]*?background:\s*#131b19\s*!important/);
  assert.match(css, /grid-template-columns:\s*repeat\(4, minmax\(0, 1fr\)\)\s*!important/);
  assert.match(css, /grid-template-columns:\s*268px minmax\(0, 1fr\)\s*!important/);
  assert.doesNotMatch(css, /radial-gradient|linear-gradient/);
});


test("pass 3 removes duplicate device title and keeps Giao diện visually neutral", () => {
  const css = source("app/management-dashboard-minimal-reference.css");
  assert.match(css, /\.amv2-devices-panel \.amv2-panel-title h2::after\s*\{[\s\S]*?content:\s*none\s*!important/);
  assert.match(css, /\.amv2-quick-grid > button:nth-child\(8\)\s*\{[\s\S]*?background:\s*#141d1b\s*!important/);
  assert.match(css, /\.amv2-brand strong\s*\{[\s\S]*?font-size:\s*14px\s*!important/);
});
