import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const client = fs.readFileSync("app/admin-device-client.ts", "utf8");
const dashboard = fs.readFileSync("app/management-dashboard-v2.tsx", "utf8");

test("control-plane browser requests fail closed instead of hanging forever", () => {
  assert.ok(client.includes("const ADMIN_API_TIMEOUT_MS = 15_000"));
  assert.ok(client.includes("new AbortController()"));
  assert.ok(client.includes("controller.abort()"));
  assert.ok(client.includes("CONTROL_REQUEST_TIMEOUT"));
  assert.ok(client.includes("signal: controller.signal"));
  assert.ok(client.includes("window.clearTimeout(timer)"));
});

test("client bridge browser requests use the same bounded response policy", () => {
  const occurrences = client.match(/const controller = new AbortController\(\)/g) ?? [];
  assert.ok(occurrences.length >= 2);
  assert.ok(client.includes("Ứng dụng phản hồi quá"));
  assert.ok(client.includes("ADMIN_API_TIMEOUT_MS / 1000"));
});

test("dashboard gate exposes retry after initialization failure", () => {
  assert.ok(dashboard.includes("Đang xác minh thiết bị quản trị…"));
  assert.ok(dashboard.includes("<button onClick={retry}>Kiểm tra lại</button>"));
  assert.ok(dashboard.includes("setError(caught instanceof Error ? caught.message"));
  assert.ok(dashboard.includes("setBusy(false)"));
});
