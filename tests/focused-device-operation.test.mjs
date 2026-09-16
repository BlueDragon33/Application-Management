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

test("focused Boi remove is a verified permanent registry deletion", () => {
  const route = source("app/api/focused-device-operation/route.ts");
  assert.match(route, /delete-spam-device/);
  assert.match(route, /confirmDeviceCode: deviceCode/);
  assert.match(route, /rowByDeviceId\(after, deviceId\)/);
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

test("operations client focuses dashboard data on Boi and Bauman and supplies expectedStatus", () => {
  const client = source("app/admin-device-client.ts");
  assert.match(client, /focusedOperationsAppIds = new Set\(\["boi-ech", "bauman-master-ai"\]\)/);
  assert.match(client, /function focusOperationsBootstrap/);
  assert.match(client, /bootstrap\.summaries\.filter/);
  assert.match(client, /bootstrap\.devices\.filter/);
  assert.match(client, /bootstrap\.workItems\.filter/);
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

test("runtime compact UI removes version/header clutter and provides font step controls", () => {
  const ui = source("app/runtime-ui-fixes.tsx");
  assert.match(ui, /PAGE_HEADER_TITLES/);
  assert.match(ui, /Cuộn để xem thêm/);
  assert.match(ui, /data-font-minus/);
  assert.match(ui, /data-font-plus/);
  assert.match(ui, /migrateFontOneStepDown/);
});
