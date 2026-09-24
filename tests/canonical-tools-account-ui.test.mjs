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
  assert.match(dashboard, /tools\.map\(\(tool\) => <ToolRow/);
  assert.match(dashboard, /Tool · \{tool\.name\}/);
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

test("all client automation cards use a consistent explicit approval mode", () => {
  assert.match(automation, /Duyệt thủ công/);
  assert.match(automation, /Tự động duyệt/);
  assert.match(automation, /name=\{\x60auto-mode-\$\{app\.id\}\x60\}/);
  assert.match(automation, /className=\{styles\.modeChoice\}/);
  assert.match(automation, /className=\{styles\.secondaryRule\}/);
  assert.match(automation, /hoursByApp/);
  assert.match(automation, /Object\.fromEntries/);
  assert.doesNotMatch(automation, /pendingBlockAfterHoursByApp: \{ "health-care": hours \}/);
});
