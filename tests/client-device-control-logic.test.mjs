import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

function source(path) {
  return fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

function actionBlock(route, appId, nextAppId) {
  const start = route.indexOf(`if (appId === "${appId}")`);
  const end = route.indexOf(`if (appId === "${nextAppId}")`, start);
  assert.ok(start >= 0 && end > start, `${appId} action block must be detectable`);
  return route.slice(start, end);
}

function baumanActionBlock(route) {
  const start = route.indexOf('if (appId === "bauman-master-ai")');
  const end = route.indexOf('if (appId !== "boi-ech")', start);
  assert.ok(start >= 0 && end > start, "Bauman action block must be detectable");
  return route.slice(start, end);
}

test("operations control plane reads Bauman devices only after the live registry capability is ready", () => {
  const route = source("app/api/operations/route.ts");
  const loaderStart = route.indexOf("async function loadBauman");
  const loaderEnd = route.indexOf("async function loadGrowUp", loaderStart);
  const loader = route.slice(loaderStart, loaderEnd);
  assert.match(loader, /\/api\/control\/status/);
  assert.match(loader, /endpoints\.devices/);
  assert.match(loader, /capabilities\.deviceRegistry/);
  assert.match(loader, /devicesPath !== "\/api\/control\/devices"/);
  assert.match(loader, /Bauman device registry chưa sẵn sàng/);
  assert.match(loader, /await bridgeReadJson\(bridge, devicesPath\)/);
  assert.match(loader, /function retryableReadError|bridgeReadJson/);
  assert.doesNotMatch(loader, /devices: \[\]/);
});

test("Health, RU LIFE and Bauman expose only their real direct device capabilities", () => {
  const route = source("app/api/operations/route.ts");
  const health = actionBlock(route, "health-care", "ru-life");
  const ru = actionBlock(route, "ru-life", "bauman-master-ai");
  const bauman = baumanActionBlock(route);
  assert.match(route, /loadHealth[\s\S]*remove: canManage/);
  assert.match(route, /loadRu[\s\S]*requiredApprovalKeys: \["userName", "userCode"\]/);
  assert.match(route, /loadBauman[\s\S]*deviceIdempotentCommands[\s\S]*optimisticConcurrency/);
  assert.match(health, /bridge\.deviceCommandsTarget/);
  assert.match(ru, /USER_BINDING_REQUIRED/);
  assert.match(bauman, /BAUMAN_DEVICE_COMMAND_CONTRACT_NOT_LIVE/);
});

test("Health mutations use optimistic concurrency and retry-safe command identity", () => {
  const route = source("app/api/operations/route.ts");
  const health = actionBlock(route, "health-care", "ru-life");
  assert.match(health, /const suppliedExpected = normalizedStatus\(payload\.expectedStatus\)/);
  assert.match(health, /if \(suppliedExpected === "unknown"\)[\s\S]{0,180}INVALID_EXPECTED_STATUS/);
  assert.match(health, /const expectedStatus = suppliedExpected;/);
  assert.match(health, /DEVICE_STATE_CONFLICT/);
  assert.match(health, /const commandId = suppliedCommandId \|\| crypto\.randomUUID\(\)/);
  assert.match(health, /bridgeCommandJson\(bridge, bridge\.deviceCommandsTarget/);
  assert.match(health, /commandReplayed: bool\(command\.replayed\)/);
});

test("RU LIFE mutations require the live idempotent contract and use optimistic concurrency", () => {
  const route = source("app/api/operations/route.ts");
  const ru = actionBlock(route, "ru-life", "bauman-master-ai");
  assert.match(ru, /\/api\/control\/status/);
  assert.match(ru, /deviceIdempotentCommands/);
  assert.match(ru, /optimisticConcurrency/);
  assert.match(ru, /RU_DEVICE_COMMAND_CONTRACT_NOT_LIVE/);
  assert.match(ru, /const suppliedExpected = normalizedStatus\(payload\.expectedStatus\)/);
  assert.match(ru, /const commandId = suppliedCommandId \|\| crypto\.randomUUID\(\)/);
  assert.match(ru, /bridgeCommandJson\(bridge, commandPath/);
  assert.match(ru, /userName, userCode/);
  assert.match(ru, /commandReplayed: bool\(command\.replayed\)/);
  assert.doesNotMatch(ru, /bridgeJson\(bridge, "\/api\/control\/devices", \{ method: "POST"/);
});

test("Bauman mutations require the live v4 command contract and are replay-safe", () => {
  const route = source("app/api/operations/route.ts");
  const bauman = baumanActionBlock(route);
  assert.match(bauman, /\/api\/control\/status/);
  assert.match(bauman, /devicesPath !== "\/api\/control\/devices"/);
  assert.match(bauman, /commandPath !== "\/api\/control\/device-commands"/);
  assert.match(bauman, /capabilities\.deviceApproval/);
  assert.match(bauman, /capabilities\.deviceIdempotentCommands/);
  assert.match(bauman, /capabilities\.optimisticConcurrency/);
  assert.match(bauman, /const suppliedExpected = normalizedStatus\(payload\.expectedStatus\)/);
  assert.match(bauman, /if \(suppliedExpected === "unknown"\)[\s\S]{0,180}INVALID_EXPECTED_STATUS/);
  assert.match(bauman, /const expectedStatus = suppliedExpected;/);
  assert.match(bauman, /DEVICE_STATE_CONFLICT/);
  assert.match(bauman, /const commandId = suppliedCommandId \|\| crypto\.randomUUID\(\)/);
  assert.match(bauman, /bridgeCommandJson\(bridge, commandPath/);
  assert.match(bauman, /operation: operation === "approve" \? "approve" : "block"/);
  assert.match(bauman, /commandReplayed: bool\(command\.replayed\)/);
  assert.doesNotMatch(bauman, /bridgeJson\(bridge, "\/api\/control\/devices", \{ method: "POST"/);
});

test("device mutations are verified by reading the owning client back", () => {
  const route = source("app/api/operations/route.ts");
  assert.match(route, /async function verifyDeviceStatus/);
  assert.match(route, /async function verifyDeviceRemoved/);
  assert.match(actionBlock(route, "health-care", "ru-life"), /await verifyDeviceStatus\(bridge, "\/api\/control\/devices", deviceId, expected\)/);
  assert.match(actionBlock(route, "ru-life", "bauman-master-ai"), /await verifyDeviceStatus\(bridge, "\/api\/control\/devices", deviceId, expected\)/);
  assert.match(baumanActionBlock(route), /await verifyDeviceStatus\(bridge, devicesPath, deviceId, expected\)/);
  assert.match(route, /await verifyDeviceRemoved\(bridge, "\/api\/control\/overview\?activityDays=0", deviceId\)/);
});

test("bootstrap remains read-only and automation is only changed by its explicit action", () => {
  const route = source("app/api/operations/route.ts");
  const bootstrapStart = route.indexOf("async function buildBootstrap");
  const postStart = route.indexOf("export async function POST");
  const bootstrap = route.slice(bootstrapStart, postStart);
  assert.doesNotMatch(bootstrap, /method:\s*"POST"/);
  assert.doesNotMatch(bootstrap, /manage-client-device|grant-free|delete-spam-device|update-automation/);
  assert.match(route, /action === "set-auto-approval"/);
});

test("Boi delete and other-client block semantics stay separate at the backend", () => {
  const route = source("app/api/operations/route.ts");
  const health = actionBlock(route, "health-care", "ru-life");
  const ru = actionBlock(route, "ru-life", "bauman-master-ai");
  const bauman = baumanActionBlock(route);
  assert.match(route, /delete-spam-device/);
  assert.match(route, /Chỉ Chủ hệ thống được xóa thiết bị Bơi ếch/);
  assert.match(health, /operation: operation === "approve" \? "approve" : "block"/);
  assert.match(ru, /operation: operation === "approve" \? "approve" : "block"/);
  assert.match(bauman, /operation: operation === "approve" \? "approve" : "block"/);
  assert.match(route, /verifiedStatus: "deleted"/);
  assert.match(route, /verifiedStatus: expected/);
});

test("Bauman bridge metadata no longer claims read-only once capability-gated v4 exists", () => {
  const bridge = source("app/bauman.server.ts");
  assert.match(bridge, /mode: "capability-gated"/);
  assert.doesNotMatch(bridge, /mode: "read-only"/);
});


test("GrowUP missing registry rows reconcile as stale snapshots instead of user-facing 404 errors", () => {
  const route = source("app/api/operations/route.ts");
  const grow = actionBlock(route, "growup-mychildren", "price-report-tunggiabao");
  assert.match(grow, /STALE_DEVICE_REMOVED/);
  assert.match(grow, /snapshot Trung tâm cần được đồng bộ lại/);
  assert.match(grow, /removedDeviceId: deviceId/);
  assert.doesNotMatch(grow, /Thiết bị GrowUP không còn trong registry GU-\.", code: "DEVICE_NOT_FOUND"/);
});
