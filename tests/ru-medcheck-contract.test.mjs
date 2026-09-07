import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(path) {
  return readFile(new URL(path, import.meta.url), "utf8");
}

test("RU MedCheck recomputes submitted risk on the server", async () => {
  const server = await source("../app/medicine.server.ts");
  const submit = await source("../app/api/medicine/reviews/route.ts");

  assert.match(server, /export async function analyzeMedicineText/);
  assert.match(submit, /const analysis = await analyzeMedicineText\(ocrText\)/);
  assert.match(submit, /analysis\.matchedRuleIds/);
  assert.match(submit, /analysis\.level/);
  assert.doesNotMatch(submit, /body\.matchedRuleIds/);
  assert.doesNotMatch(submit, /body\.proposedLevel/);
});

test("public review results require a separate unguessable token", async () => {
  const submit = await source("../app/api/medicine/reviews/route.ts");
  const lookup = await source("../app/api/medicine/reviews/[id]/route.ts");
  const client = await source("../app/ru-medcheck/ru-medcheck-client.tsx");
  const schema = await source("../db/schema.ts");

  assert.match(submit, /createMedicineReviewToken/);
  assert.match(submit, /public_token_hash/);
  assert.match(submit, /sha256Hex\(token\)/);
  assert.match(lookup, /searchParams\.get\("token"\)/);
  assert.match(lookup, /public_token_hash/);
  assert.match(lookup, /sha256Hex\(token\)/);
  assert.match(client, /ru-medcheck-review-access/);
  assert.match(client, /token=\$\{encodeURIComponent\(access\.token\)\}/);
  assert.match(schema, /publicTokenHash: text\("public_token_hash"\)/);
});

test("public medicine submissions are bounded and do not upload image bytes", async () => {
  const submit = await source("../app/api/medicine/reviews/route.ts");
  const client = await source("../app/ru-medcheck/ru-medcheck-client.tsx");
  const server = await source("../app/medicine.server.ts");

  assert.match(submit, /declaredLength > 100_000/);
  assert.match(submit, /consumeMedicineReviewQuota\(request\)/);
  assert.match(server, /medicine_rate_limits/);
  assert.match(server, /> 30/);
  assert.match(client, /body: JSON\.stringify\(\{ medicineName, ocrText: text, confidence \}\)/);
  assert.doesNotMatch(client, /FormData/);
  assert.doesNotMatch(submit, /request\.formData/);
});

test("medicine administration reuses signed central control-device authorization", async () => {
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
  assert.match(shared, /crypto\.subtle\.sign/);
});

test("rule publication validates central Russian source identifiers", async () => {
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
  assert.match(server, /RU-MED-2026\.09\.05-v4/);
  assert.match(server, /id: "ketamine"[\s\S]*?sourceIds: \["RU-681-II", "RU-459N"\]/);
});

test("RU MedCheck runtime shell can be reused after a successful online visit", async () => {
  const worker = await source("../public/sw.js");
  const client = await source("../app/ru-medcheck/ru-medcheck-client.tsx");

  assert.match(worker, /url\.pathname === "\/ru-medcheck"/);
  assert.match(worker, /networkFirst\(request, "\/offline\.html"\)/);
  assert.match(worker, /url\.pathname\.startsWith\("\/_next\/"\)/);
  assert.match(client, /localStorage\.setItem\("ru-medcheck-rules"/);
  assert.match(client, /navigator\.onLine/);
});

test("Hòa nhập Nga has no direct login and only accepts a central signed ticket", async () => {
  const access = await source("../app/medicine-access.server.ts");
  const bridge = await source("../app/api/auth/bridge/route.ts");
  const page = await source("../app/ru-medcheck/page.tsx");
  const rules = await source("../app/api/medicine/rules/route.ts");
  const submit = await source("../app/api/medicine/reviews/route.ts");
  const lookup = await source("../app/api/medicine/reviews/[id]/route.ts");
  const worker = await source("../worker/index.ts");

  assert.match(access, /MEDICINE_SERVICE_SECRET/);
  assert.match(access, /aud !== "hoa-nhap-nga"/);
  assert.match(access, /HttpOnly/);
  assert.match(access, /SameSite=Strict/);
  assert.match(bridge, /verifyMedicineAccessTicket/);
  assert.match(bridge, /createMedicineAccessCookie/);
  assert.match(page, /Web App không có màn hình đăng nhập riêng/);
  assert.match(page, /controlCenterSiteUrl/);
  assert.match(rules, /getMedicineAccess/);
  assert.match(submit, /getMedicineAccess/);
  assert.match(lookup, /getMedicineAccess/);
  assert.match(worker, /api\/auth\/bridge/);
});

test("the standalone Site exposes medicine control only to the central service", async () => {
  const worker = await source("../worker/index.ts");

  assert.match(worker, /MEDICINE_SERVICE_SECRET/);
  assert.match(worker, /x-medicine-service-secret/);
  assert.match(worker, /request\.method === "POST"/);
  assert.match(worker, /serviceControlRequest/);
  assert.doesNotMatch(worker, /url\.pathname === "\/api\/medicine\/control" \|\|/);
});

test("RU MedCheck keeps the network badge hydration-safe", async () => {
  const client = await source("../app/ru-medcheck/ru-medcheck-client.tsx");

  assert.match(client, /useSyncExternalStore/);
  assert.match(client, /function getServerOnlineSnapshot\(\)/);
  assert.match(client, /return true;/);
  assert.match(client, /function getOnlineSnapshot\(\)/);
  assert.match(client, /return navigator\.onLine;/);
});

test("Hòa nhập Nga is a user-only Site surface with a protected control bridge", async () => {
  const worker = await source("../worker/index.ts");
  const control = await source("../app/api/medicine/control/route.ts");
  const page = await source("../app/ru-medcheck/page.tsx");
  const manifest = JSON.parse(await source("../public/ru-medcheck.webmanifest"));

  assert.match(worker, /SITE_SURFACE/);
  assert.match(worker, /integration-russia/);
  assert.match(worker, /Not found/);
  assert.match(control, /MEDICINE_APP_BASE_URL/);
  assert.match(control, /x-medicine-service-secret/);
  assert.match(control, /__controlActor/);
  assert.match(page, /Hòa nhập Nga/);
  assert.equal(manifest.name, "Hòa nhập Nga — Kiểm tra thuốc");
  assert.equal(manifest.start_url, "/");
});
