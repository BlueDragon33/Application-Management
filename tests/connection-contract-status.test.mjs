import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const operations = fs.readFileSync(new URL("../app/api/operations/route.ts", import.meta.url), "utf8");
const dashboard = fs.readFileSync(new URL("../app/management-dashboard-v2.tsx", import.meta.url), "utf8");
const client = fs.readFileSync(new URL("../app/admin-device-client.ts", import.meta.url), "utf8");
const catalog = fs.readFileSync(new URL("../app/tools/managed-apps/page.tsx", import.meta.url), "utf8");

test("live connectivity and Universal Contract readiness are independent dimensions", () => {
  assert.match(client, /controlChannel\?: "universal" \| "legacy-adapter" \| "contract-observe" \| "none"/);
  assert.match(client, /contractReadiness\?: "ready" \| "partial" \| "pending" \| "not-enrolled"/);
  assert.match(client, /contractConnected\?: boolean/);
  assert.match(operations, /contractConnected: boolean/);
  assert.match(operations, /snapshot\.contractConnected/);
  assert.match(operations, /dynamic\?\.contractConnected \?\? false/);
  assert.match(operations, /"legacy-adapter"/);
  assert.match(operations, /"contract-observe"/);
  assert.match(dashboard, /Đang kết nối · chờ contract/);
  assert.match(dashboard, /Kết nối qua adapter/);
  assert.match(dashboard, /Contract live · chưa có quản trị/);
  assert.match(dashboard, /Chưa kết nối runtime/);
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
  assert.match(operations, /remoteAdminReady: true/);
  assert.match(operations, /loadBoi/);
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


test("catalog status language distinguishes connected observe-only from real disconnects", () => {
  assert.match(catalog, /Sẵn sàng quản trị/);
  assert.match(catalog, /Đã nối contract · chỉ quan sát/);
  assert.match(catalog, /Chờ contract/);
  assert.match(catalog, /Không khả dụng/);
  assert.match(catalog, /chưa bắt tay được Universal Contract/);
  assert.equal(catalog.includes("${warning} warning"), false);
});

test("repository metadata never counts as live runtime connectivity", () => {
  assert.match(operations, /REPOSITORY_METADATA_ONLY/);
  assert.match(operations, /Chỉ có metadata repository · chưa kết nối runtime/);
});


test("application table renders runtime, contract and admin readiness as separate axes", () => {
  assert.match(dashboard, /function StatusCell/);
  assert.match(dashboard, /Runtime \{axes\.runtime\.label\}/);
  assert.match(dashboard, /Contract \{axes\.contract\.label\}/);
  assert.match(dashboard, /Quản trị \{axes\.admin\.label\}/);
  assert.match(dashboard, /summary\?\.contractConnected === true/);
  assert.match(dashboard, /summary\?\.remoteAdminReady === true/);
  assert.match(dashboard, /REPOSITORY_METADATA_ONLY/);
});


test("application classification column uses the short category instead of long scope prose", () => {
  assert.match(dashboard, /function appGroup\(app: ApplicationConfig\) \{\s*return app\.category;\s*\}/);
  assert.doesNotMatch(dashboard, /function appGroup[\s\S]{0,180}return app\.scope/);
});


test("unknown device metrics remain unknown instead of being rendered as zero", () => {
  assert.match(dashboard, /function operationalCounts/);
  assert.match(dashboard, /if \(summary\) return \{ pending: summary\.pendingCount, online: summary\.onlineCount \}/);
  assert.match(dashboard, /function countText\(value: number \| null\)/);
  assert.match(dashboard, /return value === null \? "—" : value/);
  assert.doesNotMatch(dashboard, /summary\?\.onlineCount \?\? 0/);
  assert.doesNotMatch(dashboard, /summary\?\.pendingCount \?\?/);
});
