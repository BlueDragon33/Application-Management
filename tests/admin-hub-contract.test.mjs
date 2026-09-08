import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(path) {
  return readFile(new URL(path, import.meta.url), "utf8");
}

test("root is the cross-site QUẢN TRỊ ỨNG DỤNG hub", async () => {
  const page = await source("../app/page.tsx");
  const hub = await source("../app/admin-hub.tsx");
  const login = await source("../app/login/page.tsx");
  const layout = await source("../app/layout.tsx");
  const manifest = await source("../public/manifest.webmanifest");

  assert.match(page, /AdminHub/);
  assert.doesNotMatch(page, /ControlCenter/);
  assert.match(hub, /QUẢN TRỊ ỨNG DỤNG/);
  assert.match(hub, /BAUMAN MASTER HUB/);
  assert.match(hub, /BƠI ẾCH AI/);
  assert.match(hub, /SỨC KHỎE TRẺ/);
  assert.match(hub, /HÒA NHẬP NGA/);
  assert.match(hub, /Tài khoản ChatGPT đang dùng/);
  assert.match(login, /Quản trị ứng dụng/);
  assert.match(login, /liên kết Gmail/);
  assert.match(layout, /QUẢN TRỊ ỨNG DỤNG/);
  assert.match(manifest, /"name": "QUẢN TRỊ ỨNG DỤNG"/);
  assert.match(manifest, /"short_name": "QUẢN TRỊ ỨNG DỤNG"/);
  assert.match(layout, /suppressHydrationWarning/);
});

test("registered applications have independent management and Web App entry points", async () => {
  const hub = await source("../app/admin-hub.tsx");
  const registry = await source("../app/bauman-registry.ts");
  const baumanPage = await source("../app/bauman-control/page.tsx");
  const baumanClient = await source("../app/bauman-control/bauman-control-client.tsx");
  const siteLinks = await source("../app/site-links.ts");
  const learningPage = await source("../app/learning-control/page.tsx");
  const medicalPage = await source("../app/medical-control/page.tsx");
  const systemPage = await source("../app/system-control/page.tsx");

  assert.match(hub, /manageHref: "\/learning-control"/);
  assert.match(hub, /manageHref: "\/medical-control"/);
  assert.match(hub, /manageHref: "\/bauman-control"/);
  assert.match(registry, /https:\/\/bauman-sub-web-app\.dinhnam3391\.chatgpt\.site/);
  assert.match(baumanPage, /requireChatGPTUser\("\/bauman-control"\)/);
  assert.match(baumanClient, /Quản trị Hub/);
  assert.match(baumanClient, /BAUMAN_SUBJECTS\.map/);
  assert.match(baumanClient, /Quản trị Hệ thống/);
  assert.match(hub, /https:\/\/boi-ech\.boiech-ai\.workers\.dev/);
  assert.match(hub, /https:\/\/suc-khoe-tre\.boiech-ai\.workers\.dev\/suc-khoe-tre/);
  assert.match(hub, /id: "hoa-nhap-nga"/);
  assert.match(siteLinks, /https:\/\/hoa-nhap-nga\.dinhnam3391\.chatgpt\.site/);
  assert.match(hub, /webHref: integrationRussiaSiteUrl/);

  assert.match(learningPage, /ControlCenter/);
  assert.match(learningPage, /requireChatGPTUser\("\/learning-control"\)/);
  assert.match(medicalPage, /requireChatGPTUser\("\/medical-control"\)/);
  assert.match(systemPage, /requireChatGPTUser\("\/system-control"\)/);
});

test("Hòa nhập Nga opens as a separate site and access is managed by HN device", async () => {
  const hub = await source("../app/admin-hub.tsx");
  const medical = await source("../app/medical-control/medical-control-client.tsx");
  const gateway = await source("../app/api/apps/hoa-nhap-nga/device/route.ts");
  const control = await source("../app/api/apps/hoa-nhap-nga/control/route.ts");
  const registry = await source("../app/managed-app-device.server.ts");

  assert.match(hub, /webHref: integrationRussiaSiteUrl/);
  assert.match(hub, /Quản lý thiết bị Hòa nhập Nga/);
  assert.match(hub, /Site đó tự kiểm tra quyền thiết bị của nó/);
  assert.doesNotMatch(hub, /Cấp quyền Web App/);
  assert.match(medical, /\/api\/apps\/hoa-nhap-nga\/control/);
  assert.match(medical, /Cấp quyền/);
  assert.match(medical, /Thu hồi tạm/);
  assert.match(medical, /Đặt tên/);
  assert.match(gateway, /registerManagedAppDevice/);
  assert.match(gateway, /createManagedAppChallenge/);
  assert.match(gateway, /authorizeManagedAppDevice/);
  assert.match(control, /verifyControlProof/);
  assert.match(registry, /managed_app_devices/);
  assert.match(registry, /deviceCodeFor/);
  assert.match(registry, /const prefix = appId === "hoa-nhap-nga" \? "HN" : "APP"/);
  assert.match(registry, /`\$\{prefix\}-\$\{deviceId\.slice\(0, 4\)\}/);
});

test("central medical API converts an upstream HTML failure into a JSON error", async () => {
  const api = await source("../app/api/medicine/control/route.ts");
  const device = await source("../app/control-device.client.ts");

  assert.match(api, /MEDICINE_UPSTREAM_UNAVAILABLE/);
  assert.match(api, /MEDICINE_UPSTREAM_INVALID_RESPONSE/);
  assert.match(api, /JSON\.parse\(responseText\)/);
  assert.match(device, /response\.redirected/);
  assert.match(device, /Phản hồi API Trung tâm quản trị không hợp lệ/);
});

test("hub keeps a data-driven application expansion boundary", async () => {
  const hub = await source("../app/admin-hub.tsx");

  assert.match(hub, /type ManagedApplication/);
  assert.match(hub, /const applications: ManagedApplication\[\]/);
  assert.match(hub, /applications\.map/);
  assert.match(hub, /Quản trị Bauman/);
  assert.match(hub, /Hòa nhập Nga chạy ở Site riêng/);
  assert.match(hub, /Sức khỏe trẻ dùng Worker và D1 riêng/);
  assert.match(hub, /Một Trung tâm, nhiều Site độc lập/);
});