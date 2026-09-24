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

test("Application Management issues signed RU tickets in production and retains local opaque introspection", () => {
  const server = source("app/ru-life.server.ts");
  const resolver = source("app/client-origin.server.ts");
  const route = source("app/api/apps/hoa-nhap-nga/bridge/route.ts");
  const introspect = source("app/api/apps/hoa-nhap-nga/bridge/introspect/route.ts");
  const client = source("app/admin-device-client.ts");
  assert.match(server, /resolveClientOrigin\("ru-life"\)/);
  assert.match(resolver, /productionEnv: "RU_LIFE_BASE_URL"/);
  assert.match(resolver, /localEnv: "RU_LIFE_LOCAL_BASE_URL"/);
  assert.match(resolver, /localDefault: "http:\/\/127\.0\.0\.1:3002"/);
  assert.match(server, /BRIDGE_PREFIX = "v1\.rulb_"/);
  assert.match(server, /BRIDGE_TTL_MS = 5 \* 60 \* 1000/);
  assert.match(server, /ru_life_bridge_tickets/);
  assert.match(server, /RU_LIFE_CONTROL_SERVICE_SECRET/);
  assert.match(server, /signRuLifeBrowserTicket/);
  assert.match(server, /origin.source === "production"/);
  assert.doesNotMatch(server, /DEFAULT_RU_LIFE_BASE_URL|dinhnam3391\.chatgpt\.site/);
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

test("RU admin can open the independent RU_LIFE site without inheriting QT access", () => {
  const registry = source("app/application-registry.ts");
  const page = source("app/apps/ru-life/page.tsx");
  const admin = source("app/apps/ru-life/ru-life-admin.tsx");
  assert.match(registry, /publicUrl\?: string/);
  assert.match(registry, /publicUrl: "https:\/\/hoa-nhap-nga\.dinhnam3391\.chatgpt\.site"/);
  assert.match(page, /getApplicationConfig\("ru-life"\)/);
  assert.match(page, /publicUrl=\{publicUrl\}/);
  assert.match(admin, /href=\{publicUrl\}/);
  assert.match(admin, /target="_blank"/);
  assert.match(admin, /Mở site RU_LIFE độc lập/);
  assert.doesNotMatch(page, /accessToken|bridge\.token|authorization/);
});

test("RU admin premium UI exposes operational hierarchy without changing ownership boundaries", () => {
  const admin = source("app/apps/ru-life/ru-life-admin.tsx");
  const css = source("app/apps/ru-life/ru-life-admin.module.css");
  assert.match(admin, /Thiết bị & quyền Hòa nhập Nga/);
  assert.match(admin, /Tổng HN/);
  assert.match(admin, /Chờ duyệt/);
  assert.match(admin, /Đã cấp quyền/);
  assert.match(admin, /Đã khóa/);
  assert.match(admin, /Danh sách thiết bị/);
  assert.match(admin, /Ctrl K/);
  assert.match(admin, /Phân loại tự động/);
  assert.match(css, /data-tone="blue"|\[data-tone="blue"\]/);
  assert.match(css, /\.approveButton/);
  assert.match(css, /\.devicePanel/);
  assert.match(css, /@media\(max-width:680px\)/);
});
