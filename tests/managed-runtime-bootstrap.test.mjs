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

test("central bootstrap owns Bơi ếch, Health and RU_LIFE control provisioning", () => {
  assert.match(workflow, /repository: BlueDragon33\/BOIECH_AI/);
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
  assert.match(workflow, /CONTROL_SERVICE_SECRET --name boi-ech/);
  assert.match(workflow, /HEALTH_CONTROL_SERVICE_SECRET/);
  assert.match(workflow, /RU_LIFE_CONTROL_SERVICE_SECRET/);
  assert.match(workflow, /BOI_ECH_BASE_URL_OVERRIDE/);
  assert.match(workflow, /HEALTH_CARE_BASE_URL_OVERRIDE/);
  assert.match(workflow, /RU_LIFE_BASE_URL_OVERRIDE/);
});

test("bootstrap promotes only verified live runtimes into the Dynamic Catalog", () => {
  assert.match(workflow, /contractPath: "\/api\/application-management\/contract"/);
  assert.match(workflow, /contractPath: "\/api\/control\/contract"/);
  assert.match(workflow, /contractPath: "\/api\/control\/status"/);
  assert.match(workflow, /"health-care", "ru-life"/);
  assert.match(workflow, /boi\.contractConnected/);
  assert.match(workflow, /boi\.credentialConfigured/);
  assert.match(workflow, /boi\.remoteAdminReady/);
  assert.match(workflow, /SPECIAL boi-ech/);
  assert.match(workflow, /item\.connection !== "connected"/);
  assert.match(workflow, /!item\.contractConnected/);
  assert.match(workflow, /!item\.credentialConfigured/);
  assert.match(workflow, /!item\.remoteAdminReady/);
  assert.match(workflow, /Managed runtime bootstrap PASS/);
});

test("bootstrap never persists generated bridge secrets in repository files", () => {
  assert.match(workflow, /crypto\.randomBytes\(48\)\.toString\("base64url"\)/);
  assert.match(workflow, /::add-mask::/);
  assert.doesNotMatch(workflow, /<<'NODE' >> "\$GITHUB_ENV"[\s\S]{0,500}::add-mask::/);
  assert.match(workflow, /echo "BOI_BRIDGE_SECRET=\$BOI_BRIDGE_SECRET" >> "\$GITHUB_ENV"/);
  assert.match(workflow, /echo "HEALTH_BRIDGE_SECRET=\$HEALTH_BRIDGE_SECRET" >> "\$GITHUB_ENV"/);
  assert.match(workflow, /echo "BOOTSTRAP_QA_TOKEN=\$BOOTSTRAP_QA_TOKEN" >> "\$GITHUB_ENV"/);
  assert.match(workflow, /wrangler secret put CONTROL_SERVICE_SECRET --name boi-ech/);
  assert.match(workflow, /wrangler secret put HEALTH_CONTROL_SERVICE_SECRET/);
  assert.match(workflow, /wrangler secret put RU_LIFE_CONTROL_SERVICE_SECRET/);
  assert.doesNotMatch(workflow, /BOI_BRIDGE_SECRET:\s*[^$\n]/);
  assert.doesNotMatch(workflow, /HEALTH_BRIDGE_SECRET:\s*[^$\n]/);
  assert.doesNotMatch(workflow, /RU_LIFE_BRIDGE_SECRET:\s*[^$\n]/);
});

test("managed runtime smoke waits for Worker secret propagation instead of false-failing on transient 403", () => {
  assert.match(workflow, /Bơi ếch Production secret\/runtime not converged yet/);
  assert.match(workflow, /Health Production secret\/runtime not converged yet/);
  assert.match(workflow, /RU_LIFE Production secret\/runtime not converged yet/);
  assert.match(workflow, /for attempt in \{1\.\.12\}/);
  assert.match(workflow, /STATUS_CODE" != "200" && "\$STATUS_CODE" != "403"/);
  assert.match(workflow, /CODE" != "200" && "\$CODE" != "403"/);
  assert.match(workflow, /did not converge within 60 seconds after secret installation/);
});

test("Bơi ếch bootstrap verifies the real operations path, not only contract metadata", () => {
  assert.match(workflow, /Verify Bơi ếch operational fallback is truly live/);
  assert.match(workflow, /"\/api\/operations"/);
  assert.match(workflow, /boi\.connection !== "connected"/);
  assert.match(workflow, /boi\.controlChannel !== "legacy-adapter"/);
  assert.match(workflow, /boi\.remoteAdminReady !== true/);
  assert.match(workflow, /boi\.contractConnected !== true/);
  assert.match(workflow, /LIVE boi-ech runtime=/);
});

test("bootstrap cleans the temporary Production owner session", () => {
  assert.match(workflow, /Create short-lived owner catalog session/);
  assert.match(workflow, /Delete short-lived owner catalog session/);
  assert.match(workflow, /DELETE FROM control_sessions WHERE session_id_hash=/);
});
