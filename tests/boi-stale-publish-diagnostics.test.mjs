import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

function read(path) {
  return fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("operations preserve Boi stale publish issue codes instead of flattening them into generic connection errors", () => {
  const route = read("app/api/operations/route.ts");
  assert.match(route, /import \{ UpstreamError, issueBoiBrowserBridge \}/);
  assert.match(route, /error instanceof UpstreamError/);
  assert.match(route, /record\(error\.payload\)\.code/);
  assert.match(route, /issueCode\?: string/);
  assert.match(route, /result\.issueCode === "BOI_ECH_STALE_PUBLISH"/);
  assert.match(route, /Bơi ếch đang publish bản cũ/);
  assert.match(route, /Bơi ếch chưa xác minh được runtime identity/);
  assert.match(route, /BOI_ECH_CONTROL_AUTH_MISMATCH/);
  assert.match(route, /BOI_ECH_CONTROL_API_MISSING/);
  assert.match(route, /BOI_ECH_CONTROL_UNAVAILABLE/);
});

test("Boi client admin receives the real stale publish error from dashboard bootstrap", () => {
  const dashboard = read("app/api/dashboard/route.ts");
  assert.match(dashboard, /import \{ UpstreamError, issueBoiBrowserBridge \}/);
  assert.match(dashboard, /error instanceof UpstreamError/);
  assert.match(dashboard, /BOI_ECH_UPSTREAM_ERROR/);
  assert.match(dashboard, /error\.message/);
  assert.match(dashboard, /error\.status/);
});

test("central dashboard labels a rejected stale Boi publish without implying a generic outage", () => {
  const ui = read("app/management-dashboard-v2.tsx");
  const client = read("app/admin-device-client.ts");
  assert.match(client, /issueCode\?: string/);
  assert.match(ui, /BOI_ECH_STALE_PUBLISH/);
  assert.match(ui, /Publish cũ · đã chặn/);
  assert.match(ui, /BOI_ECH_RUNTIME_IDENTITY_UNAVAILABLE/);
  assert.match(ui, /Chưa xác minh runtime/);
  assert.match(ui, /Sai khóa kết nối/);
  assert.match(ui, /Thiếu Control API/);
  assert.match(ui, /Mất kết nối Control/);
  assert.match(ui, /connectionLabel\(state, summary\)/);
});
