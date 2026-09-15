import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

function source(path) {
  return fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("reference dashboard keeps all nine management sections reachable on mobile", () => {
  const page = source("app/page.tsx");
  const mobile = source("app/management-dashboard-mobile-overrides.css");
  assert.match(page, /management-dashboard-mobile-overrides\.css/);
  assert.match(mobile, /Điều hướng quản trị/);
  assert.match(mobile, /button:nth-child\(n\+6\)[\s\S]*display:\s*grid/);
  assert.match(mobile, /overflow-x:\s*auto/);
  assert.match(mobile, /span:nth-child\(2\)[\s\S]*display:\s*block/);
});

test("desktop dashboard is constrained to a centered 16:9 laptop frame", () => {
  const page = source("app/page.tsx");
  const laptop = source("app/management-dashboard-16x9.css");
  assert.match(page, /management-dashboard-16x9\.css/);
  assert.match(laptop, /min-aspect-ratio:\s*16\s*\/\s*10/);
  assert.match(laptop, /--qt-dashboard-inline-size:[\s\S]*1\.7777778[\s\S]*1240px/);
  assert.match(laptop, /height:\s*100svh/);
  assert.match(laptop, /overflow-x:\s*hidden/);
  assert.match(laptop, /grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(laptop, /max-height:\s*158px/);
  assert.match(laptop, /scrollbar-gutter:\s*stable/);
});

test("central queue does not double count device-derived work items", () => {
  const dashboard = source("app/management-dashboard.tsx");
  assert.match(dashboard, /deviceWorkItemIds/);
  assert.match(dashboard, /distinctWorkItems/);
  assert.match(dashboard, /attentionDevices\.length \+ distinctWorkItems\.length/);
});

test("application cards show sync state instead of a fake toggle", () => {
  const dashboard = source("app/management-dashboard.tsx");
  assert.match(dashboard, /<SyncBadge connection=\{connection\}/);
  assert.doesNotMatch(dashboard, /className=\{styles\.connectionSwitch\}/);
});

test("central admin UI exposes the full owner device lifecycle already supported by api center", () => {
  const dashboard = source("app/management-dashboard.tsx");
  assert.match(dashboard, /"deactivate-member"/);
  assert.match(dashboard, /"delete-member"/);
  assert.match(dashboard, /Kiểm duyệt viên/);
  assert.match(dashboard, /Người xuất bản/);
  assert.match(dashboard, /Thu hồi tài khoản/);
  assert.match(dashboard, /Xóa tài khoản/);
});
