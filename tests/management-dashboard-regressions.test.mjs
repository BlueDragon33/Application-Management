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
