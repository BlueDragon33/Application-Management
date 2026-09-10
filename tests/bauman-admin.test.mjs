import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

function source(path) {
  return fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("Bauman route is a dedicated management hub rather than the generic placeholder", () => {
  const route = source("app/apps/bauman-master-ai/page.tsx");
  const admin = source("app/apps/bauman-master-ai/bauman-admin.tsx");
  assert.match(route, /BaumanAdmin/);
  assert.doesNotMatch(route, /ApplicationWorkspace/);
  assert.match(admin, /Quản trị Bauman Hub/);
  assert.match(admin, /Đây là khu quản trị, không phải site học Bauman/);
  assert.doesNotMatch(admin, /<iframe/i);
});

test("Bauman management surface reads the real operations snapshot and exposes BM device administration", () => {
  const admin = source("app/apps/bauman-master-ai/bauman-admin.tsx");
  assert.match(admin, /connectOperationsDashboard/);
  assert.match(admin, /operations\?\.summaries\.find/);
  assert.match(admin, /operations\?\.devices\.filter/);
  assert.match(admin, /BAUMAN_APP_ID = "bauman-master-ai"/);
  assert.match(admin, /Thiết bị & truy cập/);
  assert.match(admin, /BM DEVICE REGISTRY/);
  assert.match(admin, /deviceStatusLabel/);
  assert.doesNotMatch(admin, /Chưa có backend quản trị Bauman/);
});

test("Bauman device mutations are owner-only idempotent compare-and-set commands with readback refresh", () => {
  const admin = source("app/apps/bauman-master-ai/bauman-admin.tsx");
  const operations = source("app/api/operations/route.ts");

  assert.match(admin, /access\.role !== "owner"/);
  assert.match(admin, /action: "manage-client-device"/);
  assert.match(admin, /commandId: crypto\.randomUUID\(\)/);
  assert.match(admin, /expectedStatus: device\.status/);
  assert.match(admin, /await connectOperationsDashboard\(\)/);
  assert.match(admin, /Registry và audit sẽ được giữ lại/);
  assert.match(admin, /các phiên Bauman hiện tại sẽ bị thu hồi/);

  assert.match(operations, /appId === "bauman-master-ai"/);
  assert.match(operations, /actor\.role !== "owner"/);
  assert.match(operations, /deviceIdempotentCommands/);
  assert.match(operations, /optimisticConcurrency/);
  assert.match(operations, /DEVICE_STATE_CONFLICT/);
  assert.match(operations, /DEVICE_COMMAND_READBACK_MISMATCH/);
  assert.match(operations, /await verifyDeviceStatus\(bridge, devicesPath, deviceId, expected\)/);
  assert.match(operations, /operation: operation === "approve" \? "approve" : "block"/);
});

test("Bauman keeps Math and subject modules under the level-1 hub", () => {
  const registry = source("app/application-registry.ts");
  const admin = source("app/apps/bauman-master-ai/bauman-admin.tsx");
  assert.match(registry, /BlueDragon33\/Math_Bauman/);
  assert.match(registry, /subjects\/programming/);
  assert.match(registry, /subjects\/ai/);
  assert.match(registry, /subjects\/signal/);
  assert.match(registry, /subjects\/systems/);
  assert.match(registry, /subjects\/foundation/);
  assert.match(registry, /subjects\/research/);
  assert.match(registry, /subjects\/russian/);
  assert.match(admin, /LEVEL 2 · SUB-CLIENTS/);
  assert.match(admin, /Một client cha → nhiều sub-client/);
});

test("Bauman readiness distinguishes implemented source from production-live capability", () => {
  const admin = source("app/apps/bauman-master-ai/bauman-admin.tsx");
  for (const label of ["Device registry BM-", "P-256 device gateway", "Duyệt / Khóa thiết bị", "Audit API", "Content review API"]) {
    assert.match(admin, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.match(admin, /type ReadinessState = "available" \| "implemented" \| "missing"/);
  assert.match(admin, /chưa suy diễn production từ CI/);
  assert.match(admin, /Không đánh dấu production hoàn tất chỉ vì GitHub CI xanh/);
});

test("Bauman device admin styles cover status, action and responsive layouts", () => {
  const css = source("app/apps/bauman-master-ai/bauman-admin.module.css");
  for (const token of [".deviceAdminSummary", ".deviceAdminList", ".deviceAdminIdentity", ".deviceAdminActions", ".deviceAdminEmpty"]) {
    assert.ok(css.includes(token), `missing style ${token}`);
  }
  assert.match(css, /data-status="pending"/);
  assert.match(css, /data-status="approved"/);
  assert.match(css, /data-status="blocked"/);
  assert.match(css, /@media \(max-width: 760px\)/);
});
