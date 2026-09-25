import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

function read(path) {
  return fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

const migration = read("drizzle/0005_managed_app_catalog.sql");
const schema = read("db/schema.ts");
const contract = read("app/open-contract.server.ts");
const discovery = read("app/managed-contract-discovery.server.ts");
const profiles = read("app/contract-category-profiles.ts");
const operations = read("app/api/operations/route.ts");
const catalogApi = read("app/api/managed-apps/route.ts");
const dashboard = read("app/management-dashboard-v2.tsx");
const catalogUi = read("app/tools/managed-apps/page.tsx");
const client = read("app/admin-device-client.ts");
const production = read(".github/workflows/deploy-application-management-production.yml");
const preview = read(".github/workflows/deploy-application-management-preview.yml");
const productionWrangler = read("wrangler.production.example.jsonc");
const previewWrangler = read("wrangler.cloudflare.example.jsonc");

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
  assert.ok(contract.includes("manifest.policy?.remoteAdminReady !== false"));
  assert.ok(contract.includes("remoteAdminReady?: boolean"));
  assert.ok(contract.includes("credentialRequired?: boolean"));
  assert.ok(contract.includes("localFirst?: boolean"));
  assert.ok(contract.includes("productionRuntimeReady?: boolean"));
  assert.ok(contract.includes('ManagedContractMode = "remote-admin" | "observe-only" | "local-first" | "metadata-only"'));
});

test("dynamic credentials are AES-GCM encrypted with a one-time root key", () => {
  assert.ok(contract.includes("MANAGED_APP_CREDENTIAL_ENCRYPTION_KEY"));
  assert.ok(contract.includes('{ name: "AES-GCM"'));
  assert.ok(contract.includes("credential_ciphertext"));
  assert.ok(contract.includes("credential_iv"));
  assert.ok(production.includes("MANAGED_APP_CREDENTIAL_ENCRYPTION_KEY"));
  assert.ok(preview.includes("MANAGED_APP_CREDENTIAL_ENCRYPTION_KEY"));
  assert.ok(production.includes("Ensure managed app credential encryption key"));
  assert.ok(preview.includes("Ensure managed app credential encryption key"));
  assert.ok(production.includes("crypto.randomBytes(32).toString('base64url')"));
  assert.ok(preview.includes("crypto.randomBytes(32).toString('base64url')"));
  assert.ok(production.includes("secret list --config wrangler.production.jsonc"));
  assert.ok(preview.includes("secret list --config wrangler.cloudflare.jsonc"));
});

test("category profiles define defaults instead of per-app UI code", () => {
  for (const category of ["Học tập", "Y tế", "Nga", "Học thuật", "Gia đình", "Kế toán", "Kỹ thuật"]) {
    assert.ok(profiles.includes(`"${category}"`), `missing category profile ${category}`);
  }
  assert.ok(profiles.includes("defaultCapabilities"));
  assert.ok(profiles.includes("defaultGuardrails"));
  assert.ok(profiles.includes("recommendedContractCapabilities"));
  assert.ok(profiles.includes("contractStarterForCategory"));
  assert.ok(profiles.includes("dynamicApplicationConfig"));
});

test("operations dashboard is dynamic-first with safe legacy fallback", () => {
  assert.ok(operations.includes("probeDynamicManagedApplications"));
  assert.ok(operations.includes("dynamicSnapshots"));
  assert.ok(operations.includes("dynamicById"));
  assert.ok(operations.includes('dynamic?.connection === "connected"'));
  assert.ok(operations.includes("Adapter legacy đang làm fallback"));
  assert.ok(operations.includes("deviceFromUniversal"));
  assert.ok(operations.includes("executeUniversalDeviceCommand"));
  assert.ok(operations.includes("dynamicMutationReady"));
  assert.ok(operations.includes('contractPath: "universal"'));
  assert.ok(operations.includes("managedApps: dynamicConfigs"));
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
  assert.ok(catalogApi.includes('action === "probe-all"'));
  assert.ok(catalogApi.includes('action === "sync-existing"'));
  assert.ok(catalogApi.includes('action === "remove"'));
  assert.ok(catalogApi.includes('action === "template"'));
  assert.ok(catalogApi.includes("OWNER_REQUIRED"));
  assert.ok(client.includes("managedAppsAction"));
  assert.ok(catalogUi.includes("Ứng dụng & Universal Contract"));
  assert.ok(catalogUi.includes("Lưu & kiểm tra contract"));
  assert.ok(catalogUi.includes("Tạo contract mẫu theo phân loại"));
  assert.ok(catalogUi.includes("Đồng bộ ứng dụng hiện có"));
  assert.ok(catalogUi.includes("Kiểm tra lại tất cả contract"));
  assert.ok(catalogUi.includes("CẦN CONTROL ORIGIN"));
  assert.ok(catalogUi.includes("BATCH CONTRACT PROBE"));
  assert.ok(catalogUi.includes("CATEGORY CONTRACT STARTER"));
  assert.ok(catalogUi.includes("/api/application-management/contract"));
  assert.ok(dashboard.includes('id: "tool-managed-apps"'));
});

test("Production catalog blocks SSRF-style origins while allowing controlled legacy migration", () => {
  assert.ok(contract.includes("Production không cho phép contract origin trỏ tới localhost/LAN/private IP."));
  assert.ok(contract.includes("privateHost(url.hostname) && !localAllowed"));
  assert.equal(contract.includes("protectedLegacyIds"), false);
  assert.ok(contract.includes("dynamic-first / legacy-fallback"));
  assert.ok(contract.includes("Credential quản trị vượt quá giới hạn 4096 ký tự."));
});

test("new apps do not need new workflow secret names", () => {
  assert.equal(contract.includes("CONTROL_SERVICE_SECRET"), false);
  assert.equal(contract.includes("HEALTH_CONTROL_SERVICE_SECRET"), false);
  assert.equal(contract.includes("BAUMAN_CONTROL_SERVICE_SECRET"), false);
  assert.ok(contract.includes("credential_ciphertext"));
  assert.ok(production.includes("MANAGED_APP_CREDENTIAL_ENCRYPTION_KEY"));
});


test("contract discovery normalizes multiple protocol families without app-name branching", () => {
  for (const candidate of [
    "/api/control/contract",
    "/api/control/status",
    "/management-contract.json",
    "/control/application-management.contract.json",
  ]) {
    assert.ok(contract.includes(candidate), `missing discovery candidate ${candidate}`);
  }
  assert.ok(contract.includes("normalizeLegacyContract"));
  assert.ok(contract.includes("discoverContract"));
  assert.ok(contract.includes("Contract category"));
  assert.ok(contract.includes("discoveredVia"));
  assert.ok(contract.includes("protocol"));
  assert.equal(contract.includes('if (row.id === "health-care")'), false);
  assert.equal(contract.includes('if (row.id === "bauman-master-ai")'), false);
});

test("contract path supports safe static manifests but endpoint paths remain API-only", () => {
  assert.ok(contract.includes("validContractPath"));
  assert.ok(contract.includes("validEndpointPath"));
  assert.ok(contract.includes("Contract path phải là absolute path an toàn"));
  assert.ok(contract.includes('/^\\/api\\/[a-z0-9/_-]+$/i'));
});


test("legacy sync preserves owner config but can bootstrap from verified public repository contracts", () => {
  assert.ok(catalogApi.includes("applicationRegistry"));
  assert.ok(catalogApi.includes("listClientNetworkSpecs"));
  assert.ok(catalogApi.includes("resolveClientBridge"));
  assert.ok(catalogApi.includes("legacyCatalogCandidate"));
  assert.ok(catalogApi.includes("repositoryCatalogCandidate"));
  assert.ok(catalogApi.includes("repositoryBootstrapRow"));
  assert.ok(catalogApi.includes("public-repository-contract"));
  assert.ok(catalogApi.includes("repository-bootstrap-upgraded"));
  assert.ok(catalogApi.includes("if (!current && !candidate.origin)"));
  assert.ok(catalogApi.includes("if (!current)"));
  assert.equal(catalogApi.includes("upsertManagedCatalog({ ...current"), false);
});

test("batch reprobe can recover pending contracts without deployment or source edits", () => {
  assert.ok(catalogApi.includes('if (action === "probe-all")'));
  assert.ok(catalogApi.includes("probeManagedCatalogEntry(row)"));
  assert.ok(catalogApi.includes('item.connection === "connected"'));
  assert.ok(catalogApi.includes('item.connection === "warning"'));
  assert.ok(catalogApi.includes('item.connection === "pending"'));
  assert.ok(catalogApi.includes('item.connection === "unavailable"'));
});


test("same-origin public subpaths participate in contract discovery without app-specific branching", () => {
  assert.ok(contract.includes("function publicBasePath"));
  assert.ok(contract.includes("function joinContractPath"));
  assert.ok(contract.includes("url.origin !== row.origin"));
  assert.ok(contract.includes('joinContractPath(basePath, "/management-contract.json")'));
  assert.ok(contract.includes('joinContractPath(basePath, "/control/application-management.contract.json")'));
  assert.ok(contract.includes('joinContractPath(basePath, "/api/control/contract")'));
  assert.equal(contract.includes("PriceReport_Tunggiabao/management-contract.json"), false);
  assert.equal(contract.includes('if (row.id === "price-report-tunggiabao")'), false);
});


test("dynamic Catalog can fetch public Workers without per-app Service Bindings", () => {
  assert.ok(productionWrangler.includes('"global_fetch_strictly_public"'));
  assert.ok(previewWrangler.includes('"global_fetch_strictly_public"'));
  assert.equal(productionWrangler.includes('"services"'), false);
  assert.equal(previewWrangler.includes('"services"'), false);
  assert.ok(contract.includes("fetch(`${origin}${path}`"));
});


test("origin-only discovery onboards new apps without Application Management source edits", () => {
  assert.ok(discovery.includes("discoverManagedContractOrigin"));
  assert.ok(discovery.includes("/api/application-management/contract"));
  assert.ok(discovery.includes("/api/control/contract"));
  assert.ok(discovery.includes("/management-contract.json"));
  assert.ok(discovery.includes("/control/application-management.contract.json"));
  assert.ok(discovery.includes("/api/control/status"));
  assert.ok(discovery.includes("Contract chưa công bố application.id hợp lệ."));
  assert.ok(discovery.includes("categoryRequired"));
  assert.equal(discovery.includes('if (id === "boi-ech")'), false);
  assert.equal(discovery.includes('if (id === "health-care")'), false);
  assert.equal(discovery.includes('if (id === "bauman-master-ai")'), false);
  assert.ok(catalogApi.includes('if (action === "discover")'));
  assert.ok(catalogApi.includes("discoverManagedContractOrigin"));
  assert.ok(catalogUi.includes("ZERO-CODE ONBOARDING"));
  assert.ok(catalogUi.includes("Khám phá contract"));
  assert.ok(catalogUi.includes("Không cần sửa source Trung tâm"));
});

test("contract handshake is distinct from remote-admin readiness and repository metadata", () => {
  assert.ok(contract.includes("contractConnected: boolean"));
  assert.ok(contract.includes("contractConnected: !repositoryMetadataOnly"));
  assert.ok(contract.includes("contractConnected: false"));
  assert.ok(contract.includes('issueCode: "REPOSITORY_METADATA_ONLY"'));
  assert.ok(contract.includes("contractManagementMode"));
  assert.ok(contract.includes('protocol.includes("local-first")'));
  assert.ok(contract.includes("metadataVerified"));
  assert.ok(catalogApi.includes("contractConnected: probe.contractConnected"));
  assert.ok(catalogUi.includes('label="Contract"'));
  assert.ok(operations.includes("snapshot.contractConnected"));
  assert.ok(operations.includes("Contract đã kết nối · Remote admin chưa sẵn sàng"));
  assert.ok(operations.includes('snapshot.issueCode === "REPOSITORY_METADATA_ONLY"'));
});

test("unknown dynamic app mutations remain generic instead of requiring a new app branch", () => {
  assert.ok(operations.includes("executeUniversalDeviceCommand"));
  assert.ok(operations.includes("dynamicMutationReady"));
  assert.ok(operations.includes('contractPath: "universal"'));
  assert.ok(operations.includes("if (appId !== \"boi-ech\")"));
});


test("public GitHub repository manifests can classify apps without pretending remote admin is live", () => {
  assert.ok(discovery.includes("discoverManagedRepositoryContract"));
  assert.ok(discovery.includes("raw.githubusercontent.com"));
  assert.ok(discovery.includes("PUBLIC_REPOSITORY_CONTRACT_PATHS"));
  assert.ok(discovery.includes("public/control/application-management.contract.json"));
  assert.ok(discovery.includes("expectedId"));
  assert.ok(discovery.includes("repository trong contract không khớp"));
  assert.ok(catalogApi.includes("public-repository-contract"));
  assert.ok(catalogApi.includes("candidate.contractPath"));
});


test("repository bootstrap metadata never masquerades as a Website or live control origin", () => {
  assert.ok(contract.includes("metadataOnlyRepositoryOrigin"));
  assert.ok(contract.includes('hostname.toLowerCase() === "raw.githubusercontent.com"'));
  assert.ok(contract.includes("!repositoryMetadataOnly && manifest.capabilities.webLaunch"));
  assert.ok(contract.includes("managementMode"));
  assert.ok(contract.includes("metadataVerified"));
  assert.ok(contract.includes("không yêu cầu Remote Admin cloud"));
  assert.ok(contract.includes("không tạo cảnh báo kết nối giả"));
});


test("failed credential-free public bootstrap rows can recover from the canonical repository contract", () => {
  assert.ok(catalogApi.includes("recoverablePublicBootstrapRow"));
  assert.ok(catalogApi.includes("public-bootstrap-recovered-from-repository"));
  assert.ok(catalogApi.includes("!probe.contractConnected"));
  assert.ok(catalogApi.includes("row.origin === fallback"));
  assert.ok(catalogApi.includes("row.repository?.toLowerCase() === application.repository.toLowerCase()"));
  assert.ok(catalogApi.includes("repositoryCatalogCandidate(application)"));
});
