import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(path) {
  return readFile(new URL(path, import.meta.url), "utf8");
}

test("HN device profiles are stored separately from security identity", async () => {
  const profile = await source("../app/managed-app-device-profile.server.ts");
  const migration = await source("../drizzle/0004_managed_app_device_profiles.sql");
  const schema = await source("../db/schema.ts");

  assert.match(profile, /managed_app_device_profiles/);
  assert.match(profile, /personName/);
  assert.match(profile, /personCode/);
  assert.match(profile, /groupName/);
  assert.match(profile, /purpose/);
  assert.match(profile, /adminNote/);
  assert.doesNotMatch(profile, /public_key_jwk|UPDATE managed_app_devices SET device_id/);
  assert.match(migration, /CREATE TABLE `managed_app_device_profiles`/);
  assert.match(migration, /PRIMARY KEY\(`app_id`, `device_id`\)/);
  assert.match(schema, /managedAppDeviceProfiles/);
});

test("only publishing roles can change HN user profiles", async () => {
  const route = await source("../app/api/apps/hoa-nhap-nga/control/route.ts");
  const profile = await source("../app/managed-app-device-profile.server.ts");

  assert.match(route, /action === "profile"/);
  assert.match(route, /requireGrantRole\(actor\.role\)/);
  assert.match(route, /updateManagedAppDeviceProfile/);
  assert.match(profile, /ControlAccessError/);
  assert.match(profile, /managed_app_device\.profile_updated/);
});

test("HN approval requires a fully identified user profile", async () => {
  const route = await source("../app/api/apps/hoa-nhap-nga/control/route.ts");

  assert.match(route, /function profileComplete/);
  assert.match(route, /personName\?\.trim\(\)/);
  assert.match(route, /personCode\?\.trim\(\)/);
  assert.match(route, /DEVICE_PROFILE_REQUIRED/);
  assert.match(route, /if \(action === "approve"\) await requireIdentifiedDevices\(body\.deviceId\)/);
  assert.match(route, /if \(operation === "approve"\) await requireIdentifiedDevices\(body\.deviceIds\)/);
  assert.match(route, /requireIdentifiedUserBeforeApprove: true/);
});

test("device management displays, searches and exports assigned user data", async () => {
  const client = await source("../app/medical-control/medical-control-client.tsx");

  assert.match(client, /HỒ SƠ NGƯỜI SỬ DỤNG/);
  assert.match(client, /Lưu hồ sơ người dùng/);
  assert.match(client, /Chưa gắn người dùng/);
  assert.match(client, /personName/);
  assert.match(client, /personCode/);
  assert.match(client, /groupName/);
  assert.match(client, /Mục đích sử dụng/);
  assert.match(client, /Ghi chú quản trị/);
  assert.match(client, /device\.profile\?\.personName/);
  assert.match(client, /Mã người dùng/);
  assert.match(client, /Nhóm\/đơn vị/);
});

test("background refresh uses a stable ref and keeps quiet failures separate", async () => {
  const client = await source("../app/medical-control/medical-control-client.tsx");

  assert.match(client, /refreshRef\.current = refresh/);
  assert.match(client, /refreshRef\.current\(\{ quiet: true \}\)/);
  assert.match(client, /options\.quiet && initialized\.current/);
  assert.doesNotMatch(client, /options\.quiet && data/);
});