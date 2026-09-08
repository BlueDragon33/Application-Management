import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(path) {
  return readFile(new URL(path, import.meta.url), "utf8");
}

test("Application Management chooses the final RU_LIFE device class from multiple signals", async () => {
  const gateway = await source("../app/api/apps/hoa-nhap-nga/device/route.ts");

  assert.match(gateway, /function classifyDevice/);
  assert.match(gateway, /sec-ch-ua-mobile/);
  assert.match(gateway, /sec-ch-ua-platform/);
  assert.match(gateway, /touchPoints/);
  assert.match(gateway, /coarsePointer/);
  assert.match(gateway, /shortestScreenSide/);
  assert.match(gateway, /deviceClass: "computer"/);
  assert.match(gateway, /deviceClass: "phone"/);
  assert.match(gateway, /deviceClass: "tablet"/);
  assert.match(gateway, /server:ipad/);
  assert.match(gateway, /server:android-mobile/);
  assert.match(gateway, /server:android-tablet/);
  assert.match(gateway, /server:desktop-platform/);
  assert.match(gateway, /deviceClass: classification\.deviceClass/);
});

test("client-declared deviceClass is treated as a signal and overwritten before registry storage", async () => {
  const gateway = await source("../app/api/apps/hoa-nhap-nga/device/route.ts");
  const managed = await source("../app/managed-app-device.server.ts");

  assert.match(gateway, /verifiedProfile\(request, body\.profile\)/);
  assert.match(gateway, /Application Management chooses the final class/);
  assert.match(managed, /device_class/);
  assert.match(managed, /deviceClass/);
});
