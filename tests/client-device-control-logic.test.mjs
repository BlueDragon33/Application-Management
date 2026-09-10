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

test("operations control plane reads Bauman devices instead of reporting an empty registry", () => {
  const route = source("app/api/operations/route.ts");
  assert.match(route, /loadBauman[\s\S]*\/api\/control\/devices/);
  assert.doesNotMatch(route, /return \{ config, devices: \[\] as ClientDevice\[\], webHref: bridge\.baseUrl, managedWebLaunch: false, hasOperationalData: true \};/);
});

test("Health, RU LIFE and Bauman expose only their real direct device capabilities", () => {
  const route = source("app/api/operations/route.ts");
  const health = actionBlock(route, "health-care", "ru-life");
  const ru = actionBlock(route, "ru-life", "bauman-master-ai");
  assert.match(route, /loadHealth[\s\S]*remove: canManage/);
  assert.match(route, /loadRu[\s\S]*requiredApprovalKeys: \["userName", "userCode"\]/);
  assert.match(route, /loadBauman[\s\S]*const canManage = actor\.role === "owner"/);
  assert.match(health, /bridge\.deviceCommandsTarget/);
  assert.match(health, /operation: operation === "approve" \? "approve" : "block"/);
  assert.match(ru, /USER_BINDING_REQUIRED/);
  assert.match(ru, /commandPath/);
  assert.match(route, /appId === "bauman-master-ai"[\s\S]*action: operation === "approve" \? "approve" : "block"/);
});

test("Health mutations use optimistic concurrency and retry-safe command identity", () => {
  const route = source("app/api/operations/route.ts");
  const health = actionBlock(route, "health-care", "ru-life");
  assert.match(health, /const suppliedExpected = normalizedStatus\(payload\.expectedStatus\)/);
  assert.match(health, /const expectedStatus = suppliedExpected === "unknown" \? liveStatus : suppliedExpected/);
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
  assert.match(ru, /const expectedStatus = suppliedExpected === "unknown" \? liveStatus : suppliedExpected/);
  assert.match(ru, /DEVICE_STATE_CONFLICT/);
  assert.match(ru, /const commandId = suppliedCommandId \|\| crypto\.randomUUID\(\)/);
  assert.match(ru, /bridgeCommandJson\(bridge, commandPath/);
  assert.match(ru, /userName, userCode/);
  assert.match(ru, /commandReplayed: bool\(command\.replayed\)/);
  assert.doesNotMatch(ru, /bridgeJson\(bridge, "\/api\/control\/devices", \{ method: "POST"/);
});

test("device mutations are verified by reading the owning client back", () => {
  const route = source("app/api/operations/route.ts");
  assert.match(route, /async function verifyDeviceStatus/);
  assert.match(route, /async function verifyDeviceRemoved/);
  const verificationCalls = route.match(/await verifyDeviceStatus\(bridge, "\/api\/control\/devices", deviceId, expected\)/g) ?? [];
  assert.ok(verificationCalls.length >= 3, "Health RU and Bauman must all read registry back after mutation");
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
  const baumanStart = route.indexOf('if (appId === "bauman-master-ai")');
  const boiStart = route.indexOf('if (appId !== "boi-ech")', baumanStart);
  const bauman = route.slice(baumanStart, boiStart);
  assert.match(route, /delete-spam-device/);
  assert.match(route, /Chỉ Chủ hệ thống được xóa thiết bị Bơi ếch/);
  assert.match(health, /operation: operation === "approve" \? "approve" : "block"/);
  assert.match(ru, /operation: operation === "approve" \? "approve" : "block"/);
  assert.match(bauman, /action: operation === "approve" \? "approve" : "block"/);
  assert.match(route, /verifiedStatus: "deleted"/);
  assert.match(route, /verifiedStatus: expected/);
});
