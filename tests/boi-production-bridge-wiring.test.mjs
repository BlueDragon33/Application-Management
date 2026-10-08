import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const live = fs.readFileSync(new URL("../.github/workflows/live-development-deploy.yml", import.meta.url), "utf8");
const production = fs.readFileSync(new URL("../.github/workflows/deploy-application-management-production.yml", import.meta.url), "utf8");

test("live deploy always materializes the canonical Boi production origin", () => {
  assert.match(live, /BOI_ECH_BASE_URL: \$\{\{ vars\.BOI_ECH_PRODUCTION_ORIGIN \|\| 'https:\/\/boi-ech\.boiech-ai\.workers\.dev' \}\}/);
  assert.match(production, /BOI_ECH_BASE_URL: \$\{\{ vars\.BOI_ECH_PRODUCTION_ORIGIN \|\| 'https:\/\/boi-ech\.boiech-ai\.workers\.dev' \}\}/);
});

test("live deploy installs the Boi bridge secret and verifies real automation readback", () => {
  assert.match(live, /CONTROL_SERVICE_SECRET: \$\{\{ secrets\.CONTROL_SERVICE_SECRET \}\}/);
  assert.match(live, /- name: Establish shared Bơi ếch bridge secret/);
  assert.match(live, /crypto\.createHmac\("sha256", root\)/);
  assert.match(live, /application-management\/boi-ech\/control-service\/v1/);
  assert.match(live, /::add-mask::\$bridge_secret/);
  assert.match(live, /BOI_RUNTIME_BRIDGE_SECRET/);
  assert.match(live, /secret put CONTROL_SERVICE_SECRET --config wrangler\.production\.jsonc/);
  assert.match(live, /secret put CONTROL_SERVICE_SECRET --name boi-ech/);
  assert.match(live, /- name: Verify Bơi ếch live automation bridge/);
  assert.match(live, /\/api\/control\/automation/);
  assert.match(live, /Bơi ếch live automation bridge PASS/);
});

test("Boi bridge smoke happens only after the Application Management worker is deployed and read back", () => {
  const deploy = live.indexOf("- name: Deploy current main to live Worker");
  const revisionReadback = live.indexOf("- name: Read back live deployment revision");
  const boiSmoke = live.indexOf("- name: Verify Bơi ếch live automation bridge");
  assert.ok(deploy >= 0 && revisionReadback > deploy && boiSmoke > revisionReadback);
});


test("live Boi bridge can self-heal without a manually configured GitHub secret", () => {
  assert.match(live, /bridge_secret="\$\{CONTROL_SERVICE_SECRET:-\}"/);
  assert.match(live, /if \[\[ \$\{#bridge_secret\} -lt 32 \]\]/);
  assert.match(live, /Using the stable domain-separated Bơi ếch bridge key/);
  assert.match(live, /process\.env\.APPLICATION_MANAGEMENT_PRODUCTION_READBACK_SECRET/);
  assert.doesNotMatch(live, /CONTROL_SERVICE_SECRET is required when Bơi ếch production is configured/);
});


test("manual production deploy self-heals the same shared Boi bridge secret", () => {
  assert.match(production, /- name: Establish shared Bơi ếch bridge secret/);
  assert.match(production, /crypto\.randomBytes\(32\)\.toString\('base64url'\)/);
  assert.match(production, /secret put CONTROL_SERVICE_SECRET --config wrangler\.production\.jsonc/);
  assert.match(production, /secret put CONTROL_SERVICE_SECRET --name boi-ech/);
  assert.match(production, /- name: Verify Bơi ếch live automation bridge/);
  assert.match(production, /Bơi ếch Production automation bridge PASS/);
  assert.doesNotMatch(production, /CONTROL_SERVICE_SECRET is required when Bơi ếch production is configured/);
});
