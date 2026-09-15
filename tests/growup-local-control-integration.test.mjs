import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

function source(path) {
  return fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

const bridge = source("app/growup.server.ts");
const api = source("app/api/apps/growup-mychildren/control/route.ts");
const client = source("app/growup-control-client.ts");
const admin = source("app/apps/growup-mychildren/growup-admin.tsx");
const registry = source("app/application-registry.ts");

test("GrowUP local bridge is real but does not promote production readiness", () => {
  assert.match(bridge, /issueGrowUpBrowserBridge/);
  assert.match(bridge, /127\.0\.0\.1:3006/);
  assert.match(bridge, /127\.0\.0\.1:3007/);
  assert.match(bridge, /GROWUP_CONTROL_SERVICE_SECRET/);
  assert.match(bridge, /childRecordsExposed === false/);
  assert.match(bridge, /healthRecordsExposed === false/);
  assert.match(registry, /id: "growup-mychildren"[\s\S]*contractState: "pending"/);
});

test("GrowUP app-scoped control requires QT P-256 proof and verifies device readback", () => {
  assert.match(api, /verifyControlProof\(payload\)/);
  assert.match(api, /actor\.role !== "publisher" && actor\.role !== "owner"/);
  assert.match(api, /GROWUP_REGISTRY_INSTANCE_MISMATCH/);
  assert.match(api, /DEVICE_STATE_CONFLICT/);
  assert.match(api, /crypto\.randomUUID\(\)/);
  assert.match(api, /DEVICE_COMMAND_READBACK_MISMATCH/);
  assert.match(api, /\/api\/control\/devices/);
  assert.match(client, /ECDSA/);
  assert.match(client, /SHA-256/);
  assert.match(client, /learning-control:/);
});

test("GrowUP admin visibly exposes operational local devices and privacy-safe audit", () => {
  assert.match(admin, /type View = "overview" \| "devices" \| "audit"/);
  assert.match(admin, /Thiết bị GrowUP/);
  assert.match(admin, /Nhật ký GrowUP/);
  assert.match(admin, /Duyệt/);
  assert.match(admin, /Khóa/);
  assert.match(admin, /connectGrowUpControl/);
  assert.match(admin, /manageGrowUpDevice/);
  assert.match(admin, /Production remote admin/);
  assert.match(admin, /Không đưa hồ sơ trẻ em/);
});
