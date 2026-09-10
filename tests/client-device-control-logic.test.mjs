import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

function source(path) {
  return fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("operations control plane reads Bauman devices instead of reporting an empty registry", () => {
  const route = source("app/api/operations/route.ts");
  assert.match(route, /loadBauman[\s\S]*\/api\/control\/devices/);
  assert.doesNotMatch(route, /return \{ config, devices: \[\] as ClientDevice\[\], webHref: bridge\.baseUrl, managedWebLaunch: false, hasOperationalData: true \};/);
});

test("Health, RU LIFE and Bauman expose only their real direct device capabilities", () => {
  const route = source("app/api/operations/route.ts");
  assert.match(route, /loadHealth[\s\S]*remove: canManage/);
  assert.match(route, /loadRu[\s\S]*requiredApprovalKeys: \["userName", "userCode"\]/);
  assert.match(route, /loadBauman[\s\S]*const canManage = actor\.role === "owner"/);
  assert.match(route, /appId === "health-care"[\s\S]*bridge\.deviceCommandsTarget[\s\S]*operation: operation === "approve" \? "approve" : "block"/);
  assert.match(route, /appId === "ru-life"[\s\S]*USER_BINDING_REQUIRED/);
  assert.match(route, /appId === "bauman-master-ai"[\s\S]*action: operation === "approve" \? "approve" : "block"/);
});

test("Health mutations use optimistic concurrency and retry-safe command identity", () => {
  const route = source("app/api/operations/route.ts");
  assert.match(route, /const suppliedExpected = normalizedStatus\(payload\.expectedStatus\)/);
  assert.match(route, /const expectedStatus = suppliedExpected === "unknown" \? liveStatus : suppliedExpected/);
  assert.match(route, /DEVICE_STATE_CONFLICT/);
  assert.match(route, /const commandId = suppliedCommandId \|\| crypto\.randomUUID\(\)/);
  assert.match(route, /bridgeCommandJson\(bridge, bridge\.deviceCommandsTarget/);
  assert.match(route, /commandReplayed: bool\(command\.replayed\)/);
});

test("device mutations are verified by reading the owning client back", () => {
  const route = source("app/api/operations/route.ts");
  assert.match(route, /async function verifyDeviceStatus/);
  assert.match(route, /async function verifyDeviceRemoved/);
  assert.match(route, /await verifyDeviceStatus\(bridge, "\/api\/control\/devices", deviceId, expected\)/);
  assert.match(route, /await verifyDeviceStatus\(bridge, "\/api\/control\/devices", deviceId, "approved"\)/);
  assert.match(route, /await verifyDeviceStatus\(bridge, "\/api\/control\/devices", deviceId, "blocked"\)/);
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
  assert.match(route, /delete-spam-device/);
  assert.match(route, /Chỉ Chủ hệ thống được xóa thiết bị Bơi ếch/);
  assert.match(route, /operation: "block"/);
  assert.match(route, /verifiedStatus: "deleted"/);
  assert.match(route, /verifiedStatus: "blocked"/);
});
