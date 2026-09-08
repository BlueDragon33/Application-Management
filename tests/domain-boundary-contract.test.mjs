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

test("system domain has a dedicated control API without learning bridge dependencies", async () => {
  const client = await source("../app/system-control/system-control-client.tsx");
  const api = await source("../app/api/system/control/route.ts");

  assert.match(client, /\/api\/system\/control/);
  assert.doesNotMatch(client, /\/api\/dashboard/);
  assert.match(api, /verifyControlProof/);
  assert.match(api, /manage-control-device/);
  assert.match(api, /OWNER_DEVICE_PROTECTED/);
  assert.doesNotMatch(api, /issueBoiBrowserBridge/);
  assert.doesNotMatch(api, /boi-ech/);
});

test("medical administration stays on medicine APIs and shared control-device proof", async () => {
  const medical = await source("../app/medical-control/medical-control-client.tsx");
  const medicine = await source("../app/medicine-control/medicine-control-client.tsx");

  assert.match(medical, /signedControlPost/);
  assert.match(medical, /\/api\/medicine\/control/);
  assert.match(medical, /\/api\/apps\/hoa-nhap-nga\/control/);
  assert.match(medicine, /signedControlPost/);
  assert.match(medicine, /\/api\/medicine\/control/);
  assert.doesNotMatch(medicine, /indexedDB\.open/);
  assert.doesNotMatch(medicine, /crypto\.subtle\.generateKey/);
  assert.match(medicine, /QUẢN TRỊ ỨNG DỤNG · Y tế/);
});

test("Hòa nhập Nga user runtime is not a route or PWA inside Site Quản trị", async () => {
  const medical = await source("../app/medical-control/medical-control-client.tsx");
  const serviceWorker = await source("../public/sw.js");
  const worker = await source("../worker/index.ts");

  assert.equal(await missing("../app/ru-medcheck/page.tsx"), true);
  assert.equal(await missing("../public/ru-medcheck.webmanifest"), true);
  assert.match(medical, /integrationRussiaSiteUrl/);
  assert.match(medical, /Site người dùng hoạt động riêng|Hòa nhập Nga là Site độc lập/);
  assert.match(medical, /không có màn hình đăng nhập (?:trực tiếp|riêng)/);
  assert.doesNotMatch(serviceWorker, /ru-medcheck|hoa-nhap-nga-webapp/);
  assert.doesNotMatch(worker, /SITE_SURFACE|integration-russia|\/ru-medcheck/);
});

test("learning domain exposes learning functions while system navigation is separated", async () => {
  const page = await source("../app/learning-control/page.tsx");
  const client = await source("../app/control-center.tsx");

  assert.match(page, /ControlCenter/);
  assert.match(page, /href="\/system-control"/);
  assert.match(page, /href="\/"/);
  assert.match(client, /tab === "payments"/);
  assert.match(client, /tab === "content"/);
  assert.match(client, /tab === "ai"/);
  assert.doesNotMatch(client, /tab === "approvals"|tab === "audit"/);
  assert.doesNotMatch(client, /dashboard\.applications|application-list/);
  assert.doesNotMatch(page, /medicine-control|ru-medcheck/);
});

test("shared control-device client keeps one signed proof contract for Site Quản trị", async () => {
  const shared = await source("../app/control-device.client.ts");

  assert.match(shared, /learning-control:\$\{access\.deviceId\}:\$\{challenge\.challenge\}/);
  assert.match(shared, /ECDSA/);
  assert.match(shared, /P-256/);
  assert.match(shared, /signedControlPost/);
  assert.match(shared, /\/api\/device/);
});

test("cross-domain admin navigation remains compatible with the HTTP preview", async () => {
  const paths = [
    "../app/admin-hub.tsx",
    "../app/learning-control/page.tsx",
    "../app/medical-control/medical-control-client.tsx",
    "../app/medicine-control/medicine-control-client.tsx",
    "../app/system-control/system-control-client.tsx",
  ];
  const sources = await Promise.all(paths.map(source));

  for (const contents of sources) {
    assert.doesNotMatch(contents, /from "next\/link"/);
    assert.match(contents, /<a(?:\s|>)/);
  }
});