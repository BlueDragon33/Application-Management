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

test("a truly stale Bauman row becomes a soft resync instead of a hard registry error", () => {
  const route = source("app/api/focused-device-operation/route.ts");
  assert.match(route, /code: "STALE_DEVICE_REMOVED"/);
  assert.match(route, /Thiết bị Bauman đã rời registry/);
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

test("operations client focuses device commands through the dedicated endpoint", () => {
  const client = source("app/admin-device-client.ts");
  assert.match(client, /focusedOperationsAppIds = new Set\(\["boi-ech", "bauman-master-ai"\]\)/);
  assert.match(client, /function focusOperationsBootstrap/);
  assert.match(client, /expectedStatus: snapshot\.status/);
  assert.match(client, /"\/api\/focused-device-operation"/);
});

test("runtime bulk remove respects filters and preserves Boi delete versus Bauman block wording", () => {
  const ui = source("app/runtime-ui-fixes.tsx");
  assert.match(ui, /function currentDeviceFilters/);
  assert.match(ui, /function targetDevices/);
  assert.match(ui, /device\.status === "pending"/);
  assert.match(ui, /filters\.deviceType/);
  assert.match(ui, /inTimeRange\(device, filters\.timeRange\)/);
  assert.match(ui, /expectedStatus: device\.status/);
  assert.match(ui, /Bơi ếch: xóa vĩnh viễn/);
  assert.match(ui, /Bauman Hub: khóa/);
});

test("runtime UI no longer filters published applications but keeps compact chrome and font controls", () => {
  const ui = source("app/runtime-ui-fixes.tsx");
  assert.doesNotMatch(ui, /limitAppChoices/);
  assert.doesNotMatch(ui, /UNSUPPORTED_APP_LABELS/);
  assert.match(ui, /Cuộn để xem thêm/);
  assert.match(ui, /data-font-minus/);
  assert.match(ui, /data-font-plus/);
  assert.match(ui, /migrateFontOneStepDown/);
});
