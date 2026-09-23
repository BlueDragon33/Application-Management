import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

function source(path) {
  return fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

const operations = source("app/api/operations/route.ts");

test("central operations loads GrowUP privacy-safe device registry", () => {
  assert.match(operations, /issueGrowUpBrowserBridge/);
  assert.match(operations, /async function loadGrowUp\(actor: ControlDeviceState\)/);
  assert.match(operations, /bridgeJson\(bridge, "\/api\/control\/devices"\)/);
  assert.match(operations, /typeKey: "deviceClass"/);
  assert.match(operations, /userKeys: \["label", "appVersion"\]/);
  assert.match(operations, /registryInstanceId: bridge\.registryInstanceId/);
  assert.match(operations, /dữ liệu trẻ em\/sức khỏe vẫn ở phía GrowUP/);
});

test("central operations can approve or block GrowUP with concurrency and readback", () => {
  assert.match(operations, /if \(appId === "growup-mychildren"\)/);
  assert.match(operations, /GROWUP_REGISTRY_INSTANCE_MISMATCH/);
  assert.match(operations, /Snapshot GrowUP đã thay đổi/);
  assert.match(operations, /crypto\.randomUUID\(\)/);
  assert.match(operations, /bridgeCommandJson\(bridge, bridge\.deviceCommandsTarget/);
  assert.match(operations, /verifyDeviceStatus\(bridge, "\/api\/control\/devices", deviceId, expected\)/);
});

test("user-facing Bauman contract error has no release version label", () => {
  assert.doesNotMatch(operations, /device control v\d+/i);
  assert.match(operations, /Contract điều khiển thiết bị Bauman chưa sẵn sàng/);
});
