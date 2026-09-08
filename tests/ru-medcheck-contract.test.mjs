import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

async function source(path) {
  return readFile(new URL(path, import.meta.url), "utf8");
}

async function missing(path) {
  try {
    await access(new URL(path, import.meta.url));
    return false;
  } catch {
    return true;
  }
}

test("medicine administration stays behind the signed central control device", async () => {
  const control = await source("../app/api/medicine/control/route.ts");
  const client = await source("../app/medicine-control/medicine-control-client.tsx");
  const shared = await source("../app/control-device.client.ts");

  assert.match(control, /verifyControlProof/);
  assert.match(control, /requireRole\(actor\.role, \["reviewer", "publisher", "owner"\]\)/);
  assert.match(control, /requireRole\(actor\.role, \["publisher", "owner"\]\)/);
  assert.match(client, /signedControlPost/);
  assert.match(client, /\/api\/medicine\/control/);
  assert.doesNotMatch(client, /indexedDB\.open/);
  assert.match(shared, /learning-control:\$\{access\.deviceId\}:\$\{challenge\.challenge\}/);
});

test("Hòa nhập Nga user surface and user APIs are absent from the admin repository", async () => {
  const worker = await source("../worker/index.ts");
  const serviceWorker = await source("../public/sw.js");

  assert.equal(await missing("../app/ru-medcheck/page.tsx"), true);
  assert.equal(await missing("../app/ru-medcheck/ru-medcheck-client.tsx"), true);
  assert.equal(await missing("../public/ru-medcheck.webmanifest"), true);
  assert.equal(await missing("../app/medicine-access.server.ts"), true);
  assert.equal(await missing("../app/medicine-bridge.server.ts"), true);
  assert.equal(await missing("../app/api/auth/bridge/route.ts"), true);
  assert.equal(await missing("../app/api/medicine/access/route.ts"), true);
  assert.equal(await missing("../app/api/medicine/rules/route.ts"), true);
  assert.equal(await missing("../app/api/medicine/reviews/route.ts"), true);
  assert.equal(await missing("../app/api/medicine/reviews/[id]/route.ts"), true);
  assert.doesNotMatch(worker, /SITE_SURFACE|integration-russia|\/ru-medcheck|api\/auth\/bridge/);
  assert.doesNotMatch(serviceWorker, /ru-medcheck|hoa-nhap-nga-webapp/);
});

test("Hòa nhập Nga has a separate device registry from Site Quản trị devices", async () => {
  const managed = await source("../app/managed-app-device.server.ts");
  const migration = await source("../drizzle/0003_managed_app_devices.sql");
  const schema = await source("../db/schema.ts");

  assert.match(managed, /managed_app_devices/);
  assert.match(managed, /managed_app_challenges/);
  assert.match(managed, /ManagedAppId = "hoa-nhap-nga"/);
  assert.match(managed, /"pending" \| "approved" \| "blocked"/);
  assert.match(managed, /const prefix = appId === "hoa-nhap-nga" \? "HN" : "APP"/);
  assert.match(managed, /`\$\{prefix\}-\$\{deviceId\.slice\(0, 4\)\}/);
  assert.match(migration, /CREATE TABLE `managed_app_devices`/);
  assert.match(migration, /PRIMARY KEY\(`app_id`, `device_id`\)/);
  assert.match(schema, /managedAppDevices/);
  assert.doesNotMatch(managed, /INSERT INTO control_devices/);
});

test("device identity uses P-256 proof while browser metadata is classification only", async () => {
  const managed = await source("../app/managed-app-device.server.ts");

  assert.match(managed, /crv !== "P-256"/);
  assert.match(managed, /crypto\.subtle\.digest\("SHA-256"/);
  assert.match(managed, /crypto\.subtle\.verify/);
  assert.match(managed, /managed-app:\$\{appId\}:\$\{deviceId\}:\$\{challenge\}/);
  assert.match(managed, /deviceClass/);
  assert.match(managed, /osName/);
  assert.match(managed, /browserName/);
  assert.match(managed, /modelHint/);
  assert.match(managed, /screen/);
});

test("only approved Hòa nhập Nga devices can obtain a short-lived device token", async () => {
  const managed = await source("../app/managed-app-device.server.ts");
  const gateway = await source("../app/api/apps/hoa-nhap-nga/device/route.ts");

  assert.match(managed, /row\.status !== "approved"/);
  assert.match(managed, /DEVICE_PENDING/);
  assert.match(managed, /DEVICE_BLOCKED/);
  assert.match(managed, /aud: "hoa-nhap-nga-device"/);
  assert.match(managed, /Date\.now\(\) \+ 15 \* 60 \* 1000/);
  assert.match(gateway, /action === "register"/);
  assert.match(gateway, /action === "challenge"/);
  assert.match(gateway, /action === "authorize"/);
  assert.match(gateway, /MEDICINE_APP_BASE_URL/);
  assert.match(gateway, /access-control-allow-origin/);
});

test("Site Quản trị can approve, revoke, block and label Hòa nhập Nga devices", async () => {
  const route = await source("../app/api/apps/hoa-nhap-nga/control/route.ts");
  const client = await source("../app/medical-control/medical-control-client.tsx");

  assert.match(route, /verifyControlProof/);
  assert.match(route, /\["publisher", "owner"\]/);
  assert.match(route, /"approve", "block", "pending", "label"/);
  assert.match(client, /\/api\/apps\/hoa-nhap-nga\/control/);
  assert.match(client, /Cấp quyền/);
  assert.match(client, /Thu hồi tạm/);
  assert.match(client, /Khóa/);
  assert.match(client, /Đặt tên/);
  assert.match(client, /deviceClassLabel/);
  assert.match(client, /integrationRussiaSiteUrl/);
  assert.doesNotMatch(client, /issue-access|Cấp quyền & mở Web App/);
});

test("rule publication still validates central Russian source identifiers", async () => {
  const control = await source("../app/api/medicine/control/route.ts");
  const server = await source("../app/medicine.server.ts");

  assert.match(control, /validSourceIds/);
  assert.match(control, /INVALID_RULE_SOURCE/);
  assert.match(server, /RU-61FZ-50/);
  assert.match(server, /RU-681-IV/);
  assert.match(server, /RU-681-II/);
  assert.match(server, /RU-681-III/);
  assert.match(server, /RU-459N/);
  assert.match(server, /RU-964/);
});