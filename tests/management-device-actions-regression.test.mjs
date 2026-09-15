import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

function source(path) {
  return fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

const dashboard = source("app/management-dashboard-v2.tsx");
const operations = source("app/api/operations/route.ts");

test("dismissed notifications no longer keep pending devices in the visible approval queue", () => {
  assert.match(dashboard, /const visibleWorkItemIds = useMemo/);
  assert.match(dashboard, /const notificationDevices = useMemo/);
  assert.match(dashboard, /const notificationCount = notificationDevices\.length \+ distinctWorkItems\.length/);
  assert.match(dashboard, /const queueDevices = filteredDevices\.filter\(\(device\) => visibleWorkItemIds\.has/);
  assert.match(dashboard, /Dữ liệu và yêu cầu thiết bị gốc vẫn được giữ nguyên trong mục Thiết bị/);
  assert.doesNotMatch(dashboard, /const notificationCount = pendingDevices\.length \+ distinctWorkItems\.length/);
});

test("RU LIFE device commands require optimistic concurrency and verify readback", () => {
  const start = operations.indexOf('if (appId === "ru-life")');
  const end = operations.indexOf('if (appId === "bauman-master-ai")', start);
  assert.ok(start >= 0 && end > start, "RU LIFE action block missing");
  const block = operations.slice(start, end);

  assert.match(block, /deviceIdempotentCommands/);
  assert.match(block, /optimisticConcurrency/);
  assert.match(block, /const expectedStatus = suppliedExpected === "unknown" \? liveStatus : suppliedExpected/);
  assert.match(block, /bridgeCommandJson\([^\n]+expectedStatus/);
  assert.match(block, /DEVICE_COMMAND_READBACK_MISMATCH/);
  assert.match(block, /verifyDeviceStatus\(bridge, "\/api\/control\/devices", deviceId, expected\)/);
});

test("Bauman device commands reject stale registries and verify readback", () => {
  const start = operations.indexOf('if (appId === "bauman-master-ai")');
  const end = operations.indexOf('if (appId !== "boi-ech")', start);
  assert.ok(start >= 0 && end > start, "Bauman action block missing");
  const block = operations.slice(start, end);

  assert.match(block, /BAUMAN_REGISTRY_INSTANCE_MISMATCH/);
  assert.match(block, /BAUMAN_REGISTRY_DEVICE_STALE/);
  assert.match(block, /deviceIdempotentCommands/);
  assert.match(block, /optimisticConcurrency/);
  assert.match(block, /const expectedStatus = suppliedExpected === "unknown" \? liveStatus : suppliedExpected/);
  assert.match(block, /bridgeCommandJson\([^\n]+expectedStatus/);
  assert.match(block, /DEVICE_COMMAND_READBACK_MISMATCH/);
  assert.match(block, /verifyDeviceStatus\(bridge, devicesPath, deviceId, expected\)/);
});
