import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

function read(path) {
  return fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

const migration = read("drizzle/0005_managed_app_catalog.sql");
const schema = read("db/schema.ts");
const contract = read("app/open-contract.server.ts");
const profiles = read("app/contract-category-profiles.ts");
const operations = read("app/api/operations/route.ts");
const catalogApi = read("app/api/managed-apps/route.ts");
const dashboard = read("app/management-dashboard-v2.tsx");
const catalogUi = read("app/tools/managed-apps/page.tsx");
const client = read("app/admin-device-client.ts");
const production = read(".github/workflows/deploy-application-management-production.yml");
const preview = read(".github/workflows/deploy-application-management-preview.yml");

test("dynamic managed app catalog persists config without plaintext credentials", () => {
  assert.match(migration, /CREATE TABLE IF NOT EXISTS `managed_app_catalog`/);
  assert.match(migration, /`credential_ciphertext` text/);
  assert.match(migration, /`credential_iv` text/);
  assert.doesNotMatch(migration, /`credential` text/);
  assert.match(schema, /export const managedAppCatalog/);
});

test("Universal Contract v1 is schema-driven and fail-closed", () => {
  assert.ok(contract.includes('const CONTRACT_SCHEMA = "application-management.contract/v1"'));
  assert.ok(contract.includes('DEFAULT_CONTRACT_PATH = "/api/application-management/contract"'));
  assert.ok(contract.includes("manifest.capabilities.deviceRegistry"));
  assert.ok(contract.includes("manifest.capabilities.deviceIdempotentCommands"));
  assert.ok(contract.includes("manifest.capabilities.optimisticConcurrency"));
  assert.ok(contract.includes("OPEN_CONTRACT_PENDING"));
  assert.ok(contract.includes("Universal Contract chưa sẵn sàng cho thao tác từ xa."));
});

test("dynamic credentials are AES-GCM encrypted with a one-time root key", () => {
  assert.ok(contract.includes("MANAGED_APP_CREDENTIAL_ENCRYPTION_KEY"));
  assert.ok(contract.includes('{ name: "AES-GCM"'));
  assert.ok(contract.includes("credential_ciphertext"));
  assert.ok(contract.includes("credential_iv"));
  assert.ok(production.includes("MANAGED_APP_CREDENTIAL_ENCRYPTION_KEY"));
  assert.ok(preview.includes("MANAGED_APP_CREDENTIAL_ENCRYPTION_KEY"));
  assert.ok(production.includes("Install managed app credential encryption key"));
  assert.ok(preview.includes("Install managed app credential encryption key"));
});

test("category profiles define defaults instead of per-app UI code", () => {
  for (const category of ["Học tập", "Y tế", "Nga", "Học thuật", "Gia đình", "Kế toán", "Kỹ thuật"]) {
    assert.ok(profiles.includes(`"${category}"`), `missing category profile ${category}`);
  }
  assert.ok(profiles.includes("defaultCapabilities"));
  assert.ok(profiles.includes("defaultGuardrails"));
  assert.ok(profiles.includes("dynamicApplicationConfig"));
});

test("operations dashboard loads dynamic contracts beside legacy adapters", () => {
  assert.ok(operations.includes("probeDynamicManagedApplications"));
  assert.ok(operations.includes("dynamicSnapshots"));
  assert.ok(operations.includes("deviceFromUniversal"));
  assert.ok(operations.includes("executeUniversalDeviceCommand"));
  assert.ok(operations.includes("legacyAdapterIds"));
  assert.ok(operations.includes("managedApps: dynamicConfigs"));
  assert.ok(operations.includes("UNIVERSAL_CONTRACT_ACTION_UNAVAILABLE"));
});

test("dashboard merges static registry and D1 managed apps without a second allow-list", () => {
  assert.ok(dashboard.includes("const staticApps = applicationRegistry"));
  assert.ok(dashboard.includes("operations?.managedApps ?? []"));
  assert.ok(dashboard.includes("new Map<string, ApplicationConfig>"));
  assert.ok(dashboard.includes("activeAppSet"));
  assert.equal(dashboard.includes("const activeApps = applicationRegistry"), false);
  assert.ok(client.includes("managedApps?: ManagedApplicationDescriptor[]"));
});

test("owner can manage app catalog through UI and API without source edits", () => {
  assert.ok(catalogApi.includes('action === "upsert"'));
  assert.ok(catalogApi.includes('action === "probe"'));
  assert.ok(catalogApi.includes('action === "remove"'));
  assert.ok(catalogApi.includes("OWNER_REQUIRED"));
  assert.ok(client.includes("managedAppsAction"));
  assert.ok(catalogUi.includes("Ứng dụng & Universal Contract"));
  assert.ok(catalogUi.includes("Lưu & kiểm tra contract"));
  assert.ok(catalogUi.includes("/api/application-management/contract"));
  assert.ok(dashboard.includes('id: "tool-managed-apps"'));
});

test("new apps do not need new workflow secret names", () => {
  assert.equal(contract.includes("CONTROL_SERVICE_SECRET"), false);
  assert.equal(contract.includes("HEALTH_CONTROL_SERVICE_SECRET"), false);
  assert.equal(contract.includes("BAUMAN_CONTROL_SERVICE_SECRET"), false);
  assert.ok(contract.includes("credential_ciphertext"));
  assert.ok(production.includes("MANAGED_APP_CREDENTIAL_ENCRYPTION_KEY"));
});
