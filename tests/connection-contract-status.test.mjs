import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const operations = fs.readFileSync(new URL("../app/api/operations/route.ts", import.meta.url), "utf8");
const dashboard = fs.readFileSync(new URL("../app/management-dashboard-v2.tsx", import.meta.url), "utf8");
const client = fs.readFileSync(new URL("../app/admin-device-client.ts", import.meta.url), "utf8");

test("live connectivity and Universal Contract readiness are independent dimensions", () => {
  assert.match(client, /controlChannel\?: "universal" \| "legacy-adapter" \| "contract-observe" \| "none"/);
  assert.match(client, /contractReadiness\?: "ready" \| "partial" \| "pending" \| "not-enrolled"/);
  assert.match(operations, /"legacy-adapter"/);
  assert.match(operations, /"contract-observe"/);
  assert.match(dashboard, /Đang kết nối · chờ contract/);
  assert.match(dashboard, /Kết nối qua adapter/);
  assert.match(dashboard, /Đã nối contract · hạn chế/);
});

test("Boi connection faults are classified instead of all appearing as offline", () => {
  for (const code of [
    "BOI_ECH_CONTROL_AUTH_MISMATCH",
    "BOI_ECH_CONTROL_API_MISSING",
    "BOI_ECH_CONTROL_UNAVAILABLE",
  ]) assert.match(operations, new RegExp(code));

  assert.match(dashboard, /Sai khóa kết nối/);
  assert.match(dashboard, /Thiếu Control API/);
  assert.match(dashboard, /Mất kết nối Control/);
  assert.match(operations, /configurationIssue \? "warning" : "unavailable"/);
});

test("read-only control probes retry transient upstream failures once", () => {
  assert.match(operations, /function retryableReadError/);
  assert.match(operations, /async function bridgeReadJson/);
  assert.match(operations, /HTTP_\(\?:408\|425\|429\|500\|502\|503\|504\)/);
  assert.match(operations, /await new Promise\(\(resolve\) => setTimeout\(resolve, 160\)\)/);
});

test("dashboard contract counter follows live operation snapshots before static registry metadata", () => {
  assert.match(dashboard, /summaryMap\.get\(app\.id\)\?\.contractReadiness/);
  assert.match(dashboard, /return live \? live !== "ready" : app\.contractState !== "connected"/);
});
