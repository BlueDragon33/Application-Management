import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

function source(path) {
  return fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("dashboard v2 keeps every management view reachable on narrow screens", () => {
  const page = source("app/page.tsx");
  const dashboard = source("app/management-dashboard-v2.tsx");
  const css = source("app/management-dashboard-v2.css");
  assert.match(page, /management-dashboard-v2\.css/);
  for (const label of ["Tổng quan", "Hộp việc", "Ứng dụng", "Thiết bị mới", "Cảnh báo", "Nhật ký", "Cấu hình"]) {
    assert.match(dashboard, new RegExp(label));
  }
  assert.match(css, /@media \(max-width: 700px\)/);
  assert.match(css, /\.amv2-sidebar nav[\s\S]*overflow-x:\s*auto/);
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
