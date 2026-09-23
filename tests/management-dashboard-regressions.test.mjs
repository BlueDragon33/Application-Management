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

test("tablet and phone dashboards honor the requested device aspect contracts", () => {
  const page = source("app/page.tsx");
  const aspects = source("app/management-dashboard-device-aspects.css");
  const mobile = source("app/management-dashboard-mobile-overrides.css");
  assert.match(page, /management-dashboard-device-aspects\.css/);
  assert.match(aspects, /min-width:\s*761px[\s\S]*max-width:\s*1120px/);
  assert.match(aspects, /--qt-tablet-inline-size:[\s\S]*\*\s*1\.5/);
  assert.match(aspects, /max-width:\s*760px[\s\S]*orientation:\s*portrait/);
  assert.match(aspects, /--qt-phone-inline-size:[\s\S]*\*\s*0\.4615385/);
  assert.match(aspects, /queueTable[\s\S]*deviceTable[\s\S]*userTable[\s\S]*overflow:\s*auto/);
  assert.match(aspects, /tableHead[\s\S]*queueHead[\s\S]*position:\s*sticky/);
  assert.match(mobile, /button:nth-child\(n\+6\)[\s\S]*display:\s*grid/);
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
