import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

function source(path) {
  return fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

const dashboard = source("app/management-dashboard-v2.tsx");
const css = source("app/management-dashboard-v2.css");

test("bulk pending-device action is explicitly destructive instead of ambiguous", () => {
  assert.match(dashboard, /Khóa \/ loại chờ duyệt/);
  assert.match(dashboard, /aria-label="Khóa hoặc loại toàn bộ thiết bị chờ duyệt đang hiển thị"/);
  assert.doesNotMatch(dashboard, /Xử lý tất cả chờ duyệt/);
});

test("notification badge counts dismissible work items and opens the matching alerts view", () => {
  assert.match(dashboard, /const notificationCount = workItems\.length/);
  assert.match(dashboard, /className="amv2-bell"[\s\S]*switchView\("alerts"\)/);
  assert.match(dashboard, /Mở Cảnh báo/);
});

test("intentional local-first and metadata-only states are not counted as unfinished remote contracts", () => {
  assert.match(dashboard, /function intentionalNonRemoteMode/);
  assert.match(dashboard, /summary\.managementMode === "local-first"/);
  assert.match(dashboard, /summary\.managementMode === "metadata-only"/);
  assert.match(dashboard, /if \(intentionalNonRemoteMode\(summary\)\) return false/);
});

test("alerts view suppresses healthy and intentional non-remote applications", () => {
  assert.match(dashboard, /const appAlerts = apps\.filter/);
  assert.match(dashboard, /connectionFor\(app, summary\) !== "connected"/);
  assert.match(dashboard, /Không có cảnh báo cần xử lý/);
  assert.match(dashboard, /local-first hoặc metadata-only đã xác minh không bị tính là lỗi kết nối/);
});

test("production account copy does not masquerade as ChatGPT Sites authentication", () => {
  assert.match(dashboard, /Production dùng tài khoản Application Management riêng/);
  assert.match(dashboard, /Tài khoản Production/);
  assert.match(dashboard, /authMode === "cloudflare-production"/);
});

test("audit is rendered as a readable management report with localized core actions", () => {
  for (const label of [
    "Cấp quyền thiết bị quản trị",
    "Khóa thiết bị quản trị",
    "Thu hồi tài khoản quản trị",
    "Xóa tài khoản quản trị",
  ]) assert.match(dashboard, new RegExp(label));
  assert.match(dashboard, /NHẬT KÝ QUẢN TRỊ/);
  assert.match(dashboard, /100 sự kiện gần nhất/);
  assert.match(css, /\.amv2-audit-report-head/);
});
