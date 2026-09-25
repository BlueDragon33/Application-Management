import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const registry = fs.readFileSync("app/managed-contract-registry.server.ts", "utf8");
const migration = fs.readFileSync("drizzle/0005_managed_contract_registry.sql", "utf8");
const origin = fs.readFileSync("app/client-origin.server.ts", "utf8");
const operations = fs.readFileSync("app/api/operations/route.ts", "utf8");
const automationRead = fs.readFileSync("app/automation-policy-read.server.ts", "utf8");
const automationWrite = fs.readFileSync("app/api/operations-auto-approval/route.ts", "utf8");
const dashboard = fs.readFileSync("app/management-dashboard-v2.tsx", "utf8");
const autoUi = fs.readFileSync("app/automatic-device-policies.tsx", "utf8");
const registryApi = fs.readFileSync("app/api/contract-registry/route.ts", "utf8");
const registryPage = fs.readFileSync("app/tools/contract-registry/page.tsx", "utf8");
const appRegistry = fs.readFileSync("app/application-registry.ts", "utf8");
const worker = fs.readFileSync("worker/index.ts", "utf8");
const productionDeploy = fs.readFileSync(".github/workflows/deploy-application-management-production.yml", "utf8");
const schema = JSON.parse(fs.readFileSync("public/application-management-contract-v1.schema.json", "utf8"));

test("dynamic registry removes the central fixed application id type boundary", () => {
  assert.ok(appRegistry.includes("id: string;"));
  assert.equal(appRegistry.includes('id: "boi-ech" | "health-care"'), false);
  assert.ok(registry.includes('MANAGED_CONTRACT_PROTOCOL = "application-management.contract.v1"'));
  assert.ok(registry.includes('DEFAULT_MANIFEST_PATH = "/.well-known/application-management.json"'));
});

test("registry persists metadata and encrypted token material without plaintext token column", () => {
  assert.ok(migration.includes("CREATE TABLE IF NOT EXISTS `managed_contract_apps`"));
  assert.ok(migration.includes("`token_ciphertext` text"));
  assert.ok(migration.includes("`token_iv` text"));
  assert.equal(migration.includes("access_token"), false);
  assert.ok(registry.includes('crypto.subtle.encrypt({ name: "AES-GCM"'));
  assert.ok(registry.includes("application-management:contract-vault:v1:"));
  assert.ok(registry.includes("APPLICATION_MANAGEMENT_PRODUCTION_READBACK_SECRET"));
});

test("manifest discovery validates same-origin paths and supports paired bearer auth", () => {
  assert.ok(registry.includes("parseManagedContractManifest"));
  assert.ok(registry.includes("normalizeManagedOrigin"));
  assert.ok(registry.includes('auth.mode === "paired-bearer"'));
  assert.ok(registry.includes("pairManagedContract"));
  assert.ok(registry.includes('consumer: "application-management"'));
  assert.ok(registry.includes("saveDiscoveredManagedContract"));
});

test("legacy network resolver prefers D1 Contract Registry before environment origins", () => {
  assert.ok(origin.includes("getManagedContract"));
  assert.ok(origin.includes("registryProduction || normalizeClientOrigin"));
  assert.ok(origin.includes("resolveManagedContractTransport"));
  assert.ok(origin.includes('"CONTRACT_REGISTRY_VAULT"'));
});

test("operations bootstrap appends dynamic applications and generic device capability path", () => {
  assert.ok(operations.includes("listDynamicApplicationConfigs"));
  assert.ok(operations.includes("applications: allApplications"));
  assert.ok(operations.includes("loadManagedContract"));
  assert.ok(operations.includes("managedContractRequest"));
  assert.ok(operations.includes("deviceIdempotentCommands"));
  assert.ok(operations.includes("optimisticConcurrency"));
  assert.ok(operations.includes("GENERIC_DEVICE_COMMAND_CONTRACT_NOT_LIVE"));
  assert.ok(operations.includes('capabilities.deviceRemoval === "delete"'));
});

test("automation is discovered and written from live Contract v1 capabilities", () => {
  assert.ok(automationRead.includes("readManagedAutomation"));
  assert.ok(automationRead.includes("deviceAutoApproval"));
  assert.ok(automationRead.includes("deviceAutoBlockPending"));
  assert.equal(automationWrite.includes("CANDIDATE_APP_IDS"), false);
  assert.ok(automationWrite.includes("setManagedContractAutomation"));
  assert.ok(operations.includes("AUTO_BLOCK_CONTRACT_NOT_LIVE"));
  assert.ok(operations.includes("managedContractRequest(appId, automationPath"));
});

test("canonical dashboard renders runtime applications and automation UI receives them", () => {
  assert.ok(dashboard.includes("const runtimeApps = useMemo"));
  assert.ok(dashboard.includes("operations?.applications?.length ? operations.applications : staticApps"));
  assert.equal(dashboard.includes("activeAppSet"), false);
  assert.ok(dashboard.includes("applications={runtimeApps}"));
  assert.ok(autoUi.includes("applications?: readonly ApplicationConfig[]"));
  assert.ok(autoUi.includes("const apps = applications?.length ? applications : applicationRegistry"));
});

test("owner registry API and UI expose discovery pairing probe and legacy origin override", () => {
  for (const action of ["bootstrap","discover","save-discovered","save-legacy","pair","probe","probe-all","set-enabled","delete"]) {
    assert.ok(registryApi.includes(`action === "${action}"`), `missing registry action ${action}`);
  }
  assert.ok(registryPage.includes("Ứng dụng & Contract"));
  assert.ok(registryPage.includes("Đưa vào quản trị"));
  assert.ok(registryPage.includes("Pair & Probe"));
  assert.ok(registryPage.includes("Không cần redeploy Trung tâm"));
});

test("dynamic origins block private hosts and deployment health requires registry schema", () => {
  assert.ok(registry.includes('url.protocol === "https:" && !privateHostname(url.hostname)'));
  assert.ok(worker.includes('SELECT application_id FROM managed_contract_apps LIMIT 1'));
  assert.ok(migration.includes("managed_contract_apps_state_idx"));
});

test("legacy secret installation no longer depends on legacy URL env variables", () => {
  assert.ok(productionDeploy.includes("if: ${{ env.CONTROL_SERVICE_SECRET != '' }}"));
  assert.ok(productionDeploy.includes("if: ${{ env.HEALTH_CONTROL_SERVICE_SECRET != '' }}"));
  assert.ok(productionDeploy.includes("if: ${{ env.RU_LIFE_CONTROL_SERVICE_SECRET != '' }}"));
  assert.ok(productionDeploy.includes("if: ${{ env.BAUMAN_CONTROL_SERVICE_SECRET != '' }}"));
});

test("public JSON schema advertises the no-code Contract Registry protocol", () => {
  assert.equal(schema.properties.protocol.const, "application-management.contract.v1");
  assert.equal(schema.properties.application.properties.classification.enum.includes("engineering"), true);
  assert.equal(schema.properties.auth.properties.mode.enum.includes("paired-bearer"), true);
  assert.ok(schema.properties.endpoints.required.includes("status"));
});
