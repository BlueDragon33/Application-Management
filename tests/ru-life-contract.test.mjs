import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

function source(path) {
  return fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

function exists(path) {
  return fs.existsSync(new URL(`../${path}`, import.meta.url));
}

test("RU LIFE keeps a real admin workspace while reading state from RU control APIs", () => {
  const route = source("app/apps/ru-life/page.tsx");
  const admin = source("app/apps/ru-life/ru-life-admin.tsx");
  assert.match(route, /RuLifeAdmin/);
  assert.doesNotMatch(route, /ApplicationWorkspace/);
  assert.match(admin, /\/api\/control\/devices/);
  assert.match(admin, /\/api\/control\/sessions/);
  assert.match(admin, /\/api\/control\/audit/);
  assert.match(admin, /HN- và session ledger thuộc RU_LIFE/);
  assert.match(admin, /upstreamJson/);
});

test("Application Management issues only a short-lived RU bridge ticket", () => {
  const server = source("app/ru-life.server.ts");
  const route = source("app/api/apps/hoa-nhap-nga/bridge/route.ts");
  const client = source("app/admin-device-client.ts");
  assert.match(server, /RU_LIFE_BASE_URL/);
  assert.match(server, /RU_LIFE_CONTROL_SERVICE_SECRET/);
  assert.match(server, /TOKEN_ISSUER = "application-management"/);
  assert.match(server, /TOKEN_AUDIENCE = "ru-life-control"/);
  assert.match(server, /TOKEN_APP = "hoa-nhap-nga"/);
  assert.match(server, /5 \* 60 \* 1000/);
  assert.match(route, /verifyControlProof/);
  assert.match(route, /issueRuLifeBrowserBridge/);
  assert.match(client, /connectRuLifeAdmin/);
  assert.match(client, /\/api\/apps\/hoa-nhap-nga\/bridge/);
  assert.doesNotMatch(client, /ruLifeAdminAction|\/api\/apps\/hoa-nhap-nga\/admin/);
});

test("central runtime no longer owns HN registration session or admin state", () => {
  assert.equal(exists("app/ru-life-device.server.ts"), false);
  assert.equal(exists("app/api/apps/hoa-nhap-nga/device/route.ts"), false);
  assert.equal(exists("app/api/apps/hoa-nhap-nga/session/route.ts"), false);
  assert.equal(exists("app/api/apps/hoa-nhap-nga/admin/route.ts"), false);
  assert.equal(exists("app/api/apps/hoa-nhap-nga/bridge/route.ts"), true);
});

test("legacy RU migration is retained only as non-runtime history until production data is verified", () => {
  const migration = source("drizzle/0002_ru_life_device_gateway.sql");
  assert.match(migration, /CREATE TABLE `ru_life_devices`/);
  assert.match(migration, /CREATE TABLE `ru_life_sessions`/);
  assert.doesNotMatch(source("app/ru-life.server.ts"), /ru_life_devices|ru_life_sessions|getControlDatabase/);
  assert.doesNotMatch(source("app/api/apps/hoa-nhap-nga/bridge/route.ts"), /ru_life_devices|ru_life_sessions/);
});

test("RU admin keeps user binding and access versus edit controls without persisting them centrally", () => {
  const admin = source("app/apps/ru-life/ru-life-admin.tsx");
  assert.match(admin, /Họ tên/);
  assert.match(admin, /Mã người dùng/);
  assert.match(admin, /Gắn & cấp quyền/);
  assert.match(admin, /enable-edit/);
  assert.match(admin, /disable-edit/);
  assert.match(admin, /signed Control API/);
});
