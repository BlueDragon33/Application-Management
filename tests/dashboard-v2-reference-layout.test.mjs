import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

function source(path) {
  return fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("dashboard v2 keeps the approved one-screen overview composition", () => {
  const css = source("app/management-dashboard-v2-reference.css");
  assert.match(css, /\.amv2-stage\[data-view="overview"\][\s\S]*grid-template-rows:\s*106px minmax\(0, 1fr\)/);
  assert.match(css, /\.amv2-overview-grid[\s\S]*grid-template-rows:\s*136px 182px minmax\(214px, 1fr\)/);
  assert.match(css, /\.amv2-priority-panel[\s\S]*grid-row:\s*1 \/ span 2/);
  assert.match(css, /\.amv2-apps-panel[\s\S]*grid-row:\s*3/);
  assert.match(css, /\.amv2-devices-panel[\s\S]*grid-row:\s*3/);
});

test("managed application table exposes Website then Quản Trị actions", () => {
  const ui = source("app/management-dashboard-v2.tsx");
  assert.match(ui, /<span>Website<\/span><span>Quản Trị<\/span>/);
  assert.match(ui, /hasWeb \? "Đến" : "Chờ"/);
  assert.match(ui, />Vào<\/Link>/);
});

test("approved layout contains no decorative pager/footer strips", () => {
  const css = source("app/management-dashboard-v2-reference.css");
  assert.match(css, /\.amv2-apps-panel footer/);
  assert.match(css, /display:\s*none !important/);
});

test("tab views stay in the persistent dashboard v2 shell", () => {
  const entry = source("app/management-entry.tsx");
  const ui = source("app/management-dashboard-v2.tsx");
  assert.match(entry, /<ManagementDashboardV2 user=\\{user\\} authMode=\\{authMode\\} \\/>/);
  assert.match(ui, /window\.history\.pushState/);
  assert.doesNotMatch(ui, /window\.location\.assign\(nextUrl\)/);
});
