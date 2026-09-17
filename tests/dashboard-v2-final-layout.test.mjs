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
  assert.ok(base >= 0 && ref > base && views > ref && final > views);
});

test("overview keeps Applications above Priority and right rail in final order", () => {
  const css = source("app/management-dashboard-v2-final.css");
  assert.match(css, /\.amv2-apps-panel\s*\{[\s\S]*?grid-column:\s*1;[\s\S]*?grid-row:\s*1\s*\/\s*span\s*2;/);
  assert.match(css, /\.amv2-priority-panel\s*\{[\s\S]*?grid-column:\s*1;[\s\S]*?grid-row:\s*3;/);
  assert.match(css, /\.amv2-alert-panel\s*\{[\s\S]*?grid-column:\s*2;[\s\S]*?grid-row:\s*1;/);
  assert.match(css, /\.amv2-quick-panel\s*\{[\s\S]*?grid-column:\s*2;[\s\S]*?grid-row:\s*2;/);
  assert.match(css, /\.amv2-devices-panel\s*\{[\s\S]*?grid-column:\s*2;[\s\S]*?grid-row:\s*3;/);
});

test("quick actions reserve all nine slots and keep Giao diện visible", () => {
  const css = source("app/management-dashboard-v2-final.css");
  const ui = source("app/management-dashboard-v2.tsx");
  assert.match(css, /\.amv2-quick-grid\s*\{[\s\S]*?grid-template-rows:\s*repeat\(3,/);
  assert.match(css, /\.amv2-quick-grid\s*>\s*button:nth-child\(8\)[\s\S]*?visibility:\s*visible\s*!important/);
  assert.match(ui, /<span>Giao diện<\/span>/);
});

test("application actions remain separate Website and Quản Trị columns", () => {
  const ui = source("app/management-dashboard-v2.tsx");
  assert.match(ui, /<span>Website<\/span><span>Quản Trị<\/span>/);
  assert.match(ui, /className="amv2-web-action"/);
  assert.match(ui, />Đến</);
  assert.match(ui, /className="amv2-manage-action"/);
  assert.match(ui, />Vào</);
});

test("whole dashboard stays in one desktop viewport and tab changes do not animate whole pages", () => {
  const css = source("app/management-dashboard-v2-final.css");
  assert.match(css, /\.amv2-shell\s*\{[\s\S]*?height:\s*100dvh;/);
  assert.match(css, /\.amv2-overview-grid\s*\{[\s\S]*?height:\s*100%;[\s\S]*?overflow:\s*hidden;/);
  assert.match(css, /\.amv2-stage,[\s\S]*animation:\s*none\s*!important/);
});
