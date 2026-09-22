import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

function source(path) {
  return fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("focused endpoint accepts live Boi/Bauman registry ids instead of assuming 64-hex ids", () => {
  const route = source("app/api/focused-device-operation/route.ts");
  assert.match(route, /function validDeviceId\(value: string\)/);
  assert.match(route, /value\.length >= 1 && value\.length <= 256/);
  assert.doesNotMatch(route, /\^\[a-f0-9\]\{64\}\$/);
  assert.match(route, /appId === "boi-ech"/);
  assert.match(route, /appId === "bauman-master-ai"/);
});

test("focused endpoint reconciles stale registry ids by stable deviceCode", () => {
  const route = source("app/api/focused-device-operation/route.ts");
  assert.match(route, /function rowByDeviceCode/);
  assert.match(route, /function resolveLiveDevice/);
  assert.match(route, /rowByDeviceId\(data, deviceId\)/);
  assert.match(route, /rowByDeviceCode\(data, deviceCode\)/);
  assert.match(route, /deviceId: liveDeviceId/);
  assert.match(route, /reboundFromDeviceId/);
});

test("Bauman approval retries live registry and safely reconciles a unique pending replacement", () => {
  const route = source("app/api/focused-device-operation/route.ts");
  assert.match(route, /function resolveBaumanPendingFallback/);
  assert.match(route, /normalizedStatus\(item\.status\) === "pending"/);
  assert.match(route, /candidates\.length !== 1/);
  assert.match(route, /await new Promise\(\(resolve\) => setTimeout\(resolve, 180\)\)/);
  assert.match(route, /single-pending-reconcile/);
});

test("a truly stale Bauman row becomes a soft resync instead of a hard registry error", () => {
  const route = source("app/api/focused-device-operation/route.ts");
  assert.match(route, /code: "STALE_DEVICE_REMOVED"/);
  assert.match(route, /Thiết bị Bauman cũ đã rời registry/);
  assert.doesNotMatch(route, /Thiết bị Bauman không còn trong registry/);
});

test("focused Boi remove is a verified permanent registry deletion", () => {
  const route = source("app/api/focused-device-operation/route.ts");
  assert.match(route, /delete-spam-device/);
  assert.match(route, /confirmDeviceCode: deviceCode/);
  assert.match(route, /rowByDeviceId\(after, liveDeviceId\)/);
  assert.match(route, /verifiedStatus: "deleted"/);
});

test("focused Bauman remove is a capability-gated idempotent block with readback", () => {
  const route = source("app/api/focused-device-operation/route.ts");
  assert.match(route, /deviceRegistry/);
  assert.match(route, /deviceApproval/);
  assert.match(route, /deviceIdempotentCommands/);
  assert.match(route, /optimisticConcurrency/);
  assert.match(route, /commandId/);
  assert.match(route, /operation: operation === "approve" \? "approve" : "block"/);
  assert.match(route, /normalizedStatus\(updated\.status\) !== expectedResult/);
});


test("operations client reserves the hardened endpoint for reconciled Boi, Bauman and PriceReport mutations", () => {
  const client = source("app/admin-device-client.ts");
  assert.match(client, /reconciledDeviceActionAppIds = new Set\(\["boi-ech", "bauman-master-ai", "price-report-tunggiabao"\]\)/);
  assert.doesNotMatch(client, /focusOperationsBootstrap/);
  assert.match(client, /expectedStatus: snapshot\.status/);
  assert.match(client, /"\/api\/focused-device-operation"/);
});


test("dashboard v2 preserves Boi permanent deletion versus non-destructive client blocking", () => {
  const ui = source("app/management-dashboard-v2.tsx");
  assert.match(ui, /const destructive = device\.appId === "boi-ech"/);
  assert.match(ui, /Xóa vĩnh viễn thiết bị/);
  assert.match(ui, /Khóa thiết bị/);
  assert.match(ui, /expectedStatus: device\.status/);
});


test("runtime helper no longer filters applications or rewrites management layout", () => {
  const ui = source("app/runtime-ui-fixes.tsx");
  assert.doesNotMatch(ui, /ACTIVE_APPS|filterInactiveApplications|repairApplicationColumns|data-font-minus|data-font-plus/);
  assert.match(ui, /removeUnwantedFooterStrips/);
  assert.match(ui, /modernAppsPager/);
  assert.match(ui, /Cuộn để xem thêm/);
});

test("focused PriceReport mutations require live KT capabilities and verified readback", () => {
  const route = source("app/api/focused-device-operation/route.ts");
  assert.match(route, /handlePriceReport/);
  assert.match(route, /issuePriceReportBrowserBridge/);
  assert.match(route, /capabilities\.deviceRegistry/);
  assert.match(route, /capabilities\.deviceApproval/);
  assert.match(route, /capabilities\.deviceIdempotentCommands/);
  assert.match(route, /capabilities\.optimisticConcurrency/);
  assert.match(route, /capabilities\.p256ChallengeProof/);
  assert.match(route, /capabilities\.revocableDeviceSessions/);
  assert.match(route, /operation: operation === "approve" \? "approve" : "block"/);
  assert.match(route, /commandId/);
  assert.match(route, /KT registry chưa xác nhận trạng thái/);
  assert.match(route, /appId === "price-report-tunggiabao"/);
});
