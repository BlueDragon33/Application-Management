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

test("Application Management issues a short-lived opaque RU bridge ticket without a shared production secret", () => {
  const server = source("app/ru-life.server.ts");
  const route = source("app/api/apps/hoa-nhap-nga/bridge/route.ts");
  const introspect = source("app/api/apps/hoa-nhap-nga/bridge/introspect/route.ts");
  const client = source("app/admin-device-client.ts");
  assert.match(server, /DEFAULT_RU_LIFE_BASE_URL/);
  assert.match(server, /RU_LIFE_BASE_URL/);
  assert.match(server, /BRIDGE_PREFIX = "v1\.rulb_"/);
  assert.match(server, /BRIDGE_TTL_MS = 5 \* 60 \* 1000/);
  assert.match(server, /ru_life_bridge_tickets/);
  assert.doesNotMatch(server, /RU_LIFE_CONTROL_SERVICE_SECRET/);
  assert.match(route, /verifyControlProof/);
  assert.match(route, /issueRuLifeBrowserBridge/);
  assert.match(introspect, /introspectRuLifeBridgeToken/);
  assert.match(client, /connectRuLifeAdmin/);
  assert.match(client, /\/api\/apps\/hoa-nhap-nga\/bridge/);
  assert.doesNotMatch(client, /ruLifeAdminAction|\/api\/apps\/hoa-nhap-nga\/admin/);
});

test("central runtime owns only ephemeral bridge tickets, never HN registry or user sessions", () => {
  const server = source("app/ru-life.server.ts");
  assert.equal(exists("app/ru-life-device.server.ts"), false);
  assert.equal(exists("app/api/apps/hoa-nhap-nga/device/route.ts"), false);
  assert.equal(exists("app/api/apps/hoa-nhap-nga/session/route.ts"), false);
  assert.equal(exists("app/api/apps/hoa-nhap-nga/admin/route.ts"), false);
  assert.equal(exists("app/api/apps/hoa-nhap-nga/bridge/route.ts"), true);
  assert.equal(exists("app/api/apps/hoa-nhap-nga/bridge/introspect/route.ts"), true);
  assert.doesNotMatch(server, /ru_life_devices|ru_life_sessions/);
  assert.match(server, /DELETE FROM ru_life_bridge_tickets WHERE expires_at <=/);
});

test("legacy RU migration remains non-runtime history while live HN state stays in RU_LIFE", () => {
  const migration = source("drizzle/0002_ru_life_device_gateway.sql");
  assert.match(migration, /CREATE TABLE `ru_life_devices`/);
  assert.match(migration, /CREATE TABLE `ru_life_sessions`/);
  assert.doesNotMatch(source("app/ru-life.server.ts"), /ru_life_devices|ru_life_sessions/);
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
