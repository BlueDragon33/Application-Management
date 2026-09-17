import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

function source(path) {
  return fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("management entry uses one persistent v2 shell", () => {
  const entry = source("app/management-entry.tsx");
  assert.match(entry, /ManagementDashboardV2/);
  assert.doesNotMatch(entry, /ManagementModernOverview/);
});

test("overview matches the approved panel order", () => {
  const ui = source("app/management-dashboard-v2.tsx");
  assert.match(ui, /title="Hộp việc ưu tiên"/);
  assert.match(ui, /title="Cảnh báo nhanh"/);
  assert.match(ui, /Thao tác nhanh/);
  assert.match(ui, /title="Ứng dụng đang quản lý"/);
  assert.match(ui, /title="Thiết bị mới theo ứng dụng"/);
});

test("application table uses separate Website and Quản Trị columns with short actions", () => {
  const ui = source("app/management-dashboard-v2.tsx");
  assert.match(ui, /<span>Website<\/span><span>Quản Trị<\/span>/);
  assert.match(ui, /hasWeb \? "Đến" : "Chờ"/);
  assert.match(ui, />Vào<\/Link>/);
});

test("desktop overview aligns the left split with quick actions and bottom panels", () => {
  const css = source("app/management-dashboard-v2.css");
  assert.match(css, /\.amv2-priority-panel\s*\{\s*grid-column:\s*1;\s*grid-row:\s*1 \/ span 2;/);
  assert.match(css, /\.amv2-quick-panel\s*\{\s*grid-column:\s*2;\s*grid-row:\s*2;/);
  assert.match(css, /\.amv2-apps-panel\s*\{\s*grid-column:\s*1;\s*grid-row:\s*3;/);
  assert.match(css, /\.amv2-devices-panel\s*\{\s*grid-column:\s*2;\s*grid-row:\s*3;/);
});

test("tab navigation uses history state instead of full page assignment", () => {
  const ui = source("app/management-dashboard-v2.tsx");
  assert.match(ui, /window\.history\.pushState/);
  assert.doesNotMatch(ui, /window\.location\.assign\(nextUrl/);
});
