import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(path) {
  return readFile(new URL(path, import.meta.url), "utf8");
}

test("classification metadata is persisted without replacing the P-256 device identity", async () => {
  const managed = await source("../app/managed-app-device.server.ts");
  const schema = await source("../db/schema.ts");

  assert.match(managed, /deviceClassOverride/);
  assert.match(managed, /classificationConfidence/);
  assert.match(managed, /classificationSource/);
  assert.match(managed, /classifierVersion/);
  assert.match(managed, /classificationDetail/);
  assert.match(managed, /deviceClass: deviceClassOverride \|\| autoDeviceClass/);
  assert.match(managed, /crypto\.subtle\.digest\("SHA-256"/);
  assert.match(schema, /deviceClassOverride/);
  assert.match(schema, /classificationConfidence/);
  assert.match(schema, /classificationDetailJson/);
});

test("classification schema upgrade is idempotent for existing D1 databases", async () => {
  const managed = await source("../app/managed-app-device.server.ts");

  assert.match(managed, /PRAGMA table_info\(managed_app_devices\)/);
  assert.match(managed, /if \(!names\.has\("device_class_override"\)\)/);
  assert.match(managed, /if \(!names\.has\("classification_confidence"\)\)/);
  assert.match(managed, /if \(!names\.has\("classification_source"\)\)/);
  assert.match(managed, /if \(!names\.has\("classifier_version"\)\)/);
  assert.match(managed, /if \(!names\.has\("classification_detail_json"\)\)/);
});

test("central management keeps automatic class and manual override as separate values", async () => {
  const managed = await source("../app/managed-app-device.server.ts");
  const route = await source("../app/api/apps/hoa-nhap-nga/control/route.ts");

  assert.match(managed, /device_class_override = \?/);
  assert.match(managed, /requested === "auto"/);
  assert.match(route, /"classify"/);
  assert.match(route, /deviceClassOverride: action === "classify" \? body\.deviceClass/);
  assert.match(route, /classificationReviewThreshold/);
});

test("unresolved device type is blocked from approval until classified", async () => {
  const route = await source("../app/api/apps/hoa-nhap-nga/control/route.ts");

  assert.match(route, /CLASSIFICATION_REVIEW_THRESHOLD = 60/);
  assert.match(route, /function classificationResolved/);
  assert.match(route, /DEVICE_CLASSIFICATION_REQUIRED/);
  assert.match(route, /requireResolvedDeviceClassBeforeApprove: true/);
  assert.match(route, /if \(action === "approve"\) await requireIdentifiedDevices/);
});

test("classification operations page exposes review queue, filters, evidence and override selector", async () => {
  const page = await source("../app/medical-control/device-classification/page.tsx");
  const client = await source("../app/medical-control/device-classification/device-classification-client.tsx");
  const main = await source("../app/medical-control/page.tsx");

  assert.match(page, /DeviceClassificationClient/);
  assert.match(client, /Cần xác minh/);
  assert.match(client, /Máy tính bảng/);
  assert.match(client, /classificationConfidence/);
  assert.match(client, /classificationSource/);
  assert.match(client, /classificationDetail/);
  assert.match(client, /action: "classify"/);
  assert.match(client, /value="auto"/);
  assert.match(client, /Tự động nhận diện/);
  assert.match(client, /Phân loại đang dùng/);
  assert.match(main, /\/medical-control\/device-classification/);
});
