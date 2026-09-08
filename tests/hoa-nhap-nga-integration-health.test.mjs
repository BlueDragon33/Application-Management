import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(path) {
  return readFile(new URL(path, import.meta.url), "utf8");
}

test("Application Management verifies RU_LIFE with a server-to-server HMAC challenge", async () => {
  const server = await source("../app/ru-life-integration-health.server.ts");
  assert.match(server, /ru-life-health-request:v1:/);
  assert.match(server, /ru-life-health-response:v1:/);
  assert.match(server, /crypto\.subtle\.sign/);
  assert.match(server, /crypto\.subtle\.verify/);
  assert.match(server, /MEDICINE_SERVICE_SECRET/);
  assert.match(server, /MEDICINE_APP_BASE_URL/);
  assert.match(server, /RU_LIFE_UNREACHABLE/);
  assert.match(server, /SHARED_SECRET_MISMATCH/);
  assert.match(server, /APP_ORIGIN_MISMATCH/);
});

test("health diagnostics API is admin-device protected and includes registry state", async () => {
  const route = await source("../app/api/apps/hoa-nhap-nga/health/route.ts");
  assert.match(route, /verifyControlProof/);
  assert.match(route, /checkRuLifeIntegrationHealth/);
  assert.match(route, /listManagedAppDevicesWithProfiles/);
  assert.match(route, /pending:/);
  assert.match(route, /approved:/);
  assert.match(route, /blocked:/);
  assert.match(route, /unknownClass:/);
  assert.match(route, /missingUserProfile:/);
});

test("Hòa nhập Nga operations exposes live integration status without exposing secret values", async () => {
  const page = await source("../app/medical-control/integration-health/page.tsx");
  const client = await source("../app/medical-control/integration-health/integration-health-client.tsx");
  const main = await source("../app/medical-control/page.tsx");
  assert.match(page, /IntegrationHealthClient/);
  assert.match(client, /KẾT NỐI TỐT/);
  assert.match(client, /Shared secret/);
  assert.match(client, /NĂNG LỰC RUNTIME/);
  assert.match(client, /REGISTRY HÒA NHẬP NGA/);
  assert.match(client, /60_000/);
  assert.match(main, /\/medical-control\/integration-health/);
  assert.doesNotMatch(client, /MEDICINE_SERVICE_SECRET/);
});
