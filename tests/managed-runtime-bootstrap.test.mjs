import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const workflow = fs.readFileSync(
  new URL("../.github/workflows/bootstrap-managed-client-production.yml", import.meta.url),
  "utf8",
);

test("managed runtime bootstrap is owner-gated and uses the Production environment", () => {
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /BOOTSTRAP_MANAGED_RUNTIMES/);
  assert.match(workflow, /github\.actor == 'BlueDragon33'/);
  assert.match(workflow, /github\.event\.issue\.pull_request != null/);
  assert.match(workflow, /github\.event\.comment\.body == '\/bootstrap-managed-runtimes'/);
  assert.match(workflow, /environment: application-management-production/);
});

test("central bootstrap owns Health and RU_LIFE Cloudflare runtime provisioning", () => {
  assert.match(workflow, /repository: BlueDragon33\/Health_Care/);
  assert.match(workflow, /repository: BlueDragon33\/RU_LIFE/);
  assert.match(workflow, /ensure_d1 "health-care-production-db"/);
  assert.match(workflow, /ensure_d1 "ru-life-production-db"/);
  assert.match(workflow, /D1_INVENTORY=/);
  assert.match(workflow, /no database was deleted automatically/);
  assert.match(workflow, /HEALTH_PREVIEW_D1_DATABASE_ID=\$APPLICATION_MANAGEMENT_PREVIEW_D1_DATABASE_ID/);
  assert.match(workflow, /RU_LIFE_PREVIEW_D1_DATABASE_ID=\$APPLICATION_MANAGEMENT_PREVIEW_D1_DATABASE_ID/);
  assert.doesNotMatch(workflow, /ensure_d1 "health-care-preview-db"/);
  assert.doesNotMatch(workflow, /ensure_d1 "ru-life-preview-db"/);
  assert.match(workflow, /HEALTH_CONTROL_SERVICE_SECRET/);
  assert.match(workflow, /RU_LIFE_CONTROL_SERVICE_SECRET/);
  assert.match(workflow, /HEALTH_CARE_BASE_URL_OVERRIDE/);
  assert.match(workflow, /RU_LIFE_BASE_URL_OVERRIDE/);
});

test("bootstrap promotes only verified live runtimes into the Dynamic Catalog", () => {
  assert.match(workflow, /contractPath: "\/api\/control\/contract"/);
  assert.match(workflow, /contractPath: "\/api\/control\/status"/);
  assert.match(workflow, /"health-care", "ru-life"/);
  assert.match(workflow, /item\.connection !== "connected"/);
  assert.match(workflow, /!item\.contractConnected/);
  assert.match(workflow, /!item\.credentialConfigured/);
  assert.match(workflow, /!item\.remoteAdminReady/);
  assert.match(workflow, /Managed runtime bootstrap PASS/);
});

test("bootstrap never persists generated bridge secrets in repository files", () => {
  assert.match(workflow, /crypto\.randomBytes\(48\)\.toString\("base64url"\)/);
  assert.match(workflow, /::add-mask::/);
  assert.match(workflow, /wrangler secret put HEALTH_CONTROL_SERVICE_SECRET/);
  assert.match(workflow, /wrangler secret put RU_LIFE_CONTROL_SERVICE_SECRET/);
  assert.doesNotMatch(workflow, /HEALTH_BRIDGE_SECRET:\s*[^$\n]/);
  assert.doesNotMatch(workflow, /RU_LIFE_BRIDGE_SECRET:\s*[^$\n]/);
});

test("bootstrap cleans the temporary Production owner session", () => {
  assert.match(workflow, /Create short-lived owner catalog session/);
  assert.match(workflow, /Delete short-lived owner catalog session/);
  assert.match(workflow, /DELETE FROM control_sessions WHERE session_id_hash=/);
});
