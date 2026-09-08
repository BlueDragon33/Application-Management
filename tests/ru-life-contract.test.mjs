import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

function source(path) {
  return fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("RU LIFE has a real admin workspace instead of the generic placeholder", () => {
  const route = source("app/apps/ru-life/page.tsx");
  const admin = source("app/apps/ru-life/ru-life-admin.tsx");
  assert.match(route, /RuLifeAdmin/);
  assert.doesNotMatch(route, /ApplicationWorkspace/);
  assert.match(admin, /Thiết bị & quyền Hòa nhập Nga/);
  assert.match(admin, /Phiên truy cập Hòa nhập Nga/);
  assert.match(admin, /Audit ứng dụng Hòa nhập Nga/);
});

test("RU LIFE device namespace and P-256 challenge are isolated from other applications", () => {
  const server = source("app/ru-life-device.server.ts");
  assert.match(server, /`HN-\$\{deviceId\.slice/);
  assert.match(server, /managed-app:hoa-nhap-nga:\$\{deviceId\}:\$\{challenge\}/);
  assert.match(server, /namedCurve: "P-256"/);
  assert.match(server, /RU_LIFE_CONTROL_SERVICE_SECRET/);
  assert.match(server, /iss: "application-management"/);
  assert.match(server, /aud: "hoa-nhap-nga-device"/);
  assert.match(server, /editEnabled:/);
  assert.doesNotMatch(server, /MEDICINE_SERVICE_SECRET|HEALTH_CONTROL_SERVICE_SECRET|`QT-|`BE-|`SK-/);
});

test("RU LIFE gateway only exposes register challenge and authorize and keeps session introspection separate", () => {
  const gateway = source("app/api/apps/hoa-nhap-nga/device/route.ts");
  const session = source("app/api/apps/hoa-nhap-nga/session/route.ts");
  assert.match(gateway, /action === "register"/);
  assert.match(gateway, /action === "challenge"/);
  assert.match(gateway, /action === "authorize"/);
  assert.match(gateway, /RU_LIFE_ORIGIN/);
  assert.match(session, /verifyRuLifeAccessToken/);
  assert.match(session, /editEnabled/);
});

test("RU LIFE admin operations remain behind the signed central admin device", () => {
  const adminRoute = source("app/api/apps/hoa-nhap-nga/admin/route.ts");
  const client = source("app/admin-device-client.ts");
  assert.match(adminRoute, /verifyControlProof/);
  assert.match(adminRoute, /manageRuLifeDevice/);
  assert.match(adminRoute, /revokeRuLifeSession/);
  assert.match(client, /connectRuLifeAdmin/);
  assert.match(client, /ruLifeAdminAction/);
  assert.match(client, /\/api\/apps\/hoa-nhap-nga\/admin/);
});

test("RU LIFE has app-scoped tables instead of sharing QT Boi or Health registries", () => {
  const migration = source("drizzle/0002_ru_life_device_gateway.sql");
  assert.match(migration, /CREATE TABLE `ru_life_devices`/);
  assert.match(migration, /CREATE TABLE `ru_life_challenges`/);
  assert.match(migration, /CREATE TABLE `ru_life_sessions`/);
  assert.match(migration, /CREATE TABLE `ru_life_audit_log`/);
  assert.doesNotMatch(migration, /control_devices|site_access_devices|learning_devices/);
});

test("RU LIFE approval requires a bound user and keeps access separate from edit permission", () => {
  const server = source("app/ru-life-device.server.ts");
  const admin = source("app/apps/ru-life/ru-life-admin.tsx");
  assert.match(server, /USER_BINDING_REQUIRED/);
  assert.match(server, /user_name/);
  assert.match(server, /user_code/);
  assert.match(server, /enable-edit/);
  assert.match(server, /disable-edit/);
  assert.match(admin, /Họ tên/);
  assert.match(admin, /Mã người dùng/);
  assert.match(admin, /Gắn & cấp quyền/);
});
