import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const dashboard = fs.readFileSync("app/management-dashboard-v2.tsx", "utf8");
const automation = fs.readFileSync("app/automatic-device-policies.tsx", "utf8");

test("canonical Applications view exposes Secret Generator as a Tool", () => {
  assert.match(dashboard, /id: "tool-secret-generator"/);
  assert.match(dashboard, /href: "\/tools\/secret-generator"/);
  assert.match(dashboard, /category: "Tool"/);
  assert.match(dashboard, /function ToolRow/);
  assert.match(dashboard, /const toolItems = tools\.map/);
  assert.match(dashboard, /kind: "tool" as const/);
  assert.match(dashboard, /return \[\.\.\.appItems, \.\.\.toolItems\]/);
  assert.match(dashboard, /Ứng dụng & Tool/);
});

test("settings is account-owned navigation, not a left sidebar tab", () => {
  const navStart = dashboard.indexOf("const navItems");
  const navEnd = dashboard.indexOf("const viewTitles", navStart);
  const navBlock = dashboard.slice(navStart, navEnd);
  assert.doesNotMatch(navBlock, /view: "settings"/);
  assert.match(dashboard, />Tài khoản & bảo mật<\/button>/);
  assert.match(dashboard, />Cấu hình<\/button>/);
  assert.match(dashboard, /switchView\("settings"\)/);
});

test("account security explains upstream ChatGPT credential management without storing credentials", () => {
  assert.match(dashboard, /function AccountSecurityDialog/);
  assert.match(dashboard, /Email đăng nhập/);
  assert.match(dashboard, /Mật khẩu \/ phương thức đăng nhập/);
  assert.match(dashboard, /Số điện thoại/);
  assert.match(dashboard, /không lưu mật khẩu, email đăng nhập hoặc số điện thoại/);
  assert.match(dashboard, /href="https:\/\/chatgpt\.com\/"/);
});

test("all client automation cards use stable applied-state and isolated draft controls", () => {
  assert.match(automation, /Duyệt thủ công/);
  assert.match(automation, /Tự động duyệt/);
  assert.match(automation, /Đang áp dụng/);
  assert.match(automation, /settings\?\.automationPolicies/);
  assert.match(automation, /apps\.map/);
  assert.match(automation, /className=\{styles\.policyGrid\}/);
  assert.match(automation, /disabled=\{busy \|\| !approveWritable\}/);
  assert.match(automation, /disabled=\{busy \|\| !blockWritable\}/);
  assert.match(automation, /Object\.fromEntries/);
  assert.doesNotMatch(automation, /type="radio"/);
});
