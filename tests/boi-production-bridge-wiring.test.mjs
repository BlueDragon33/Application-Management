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
  assert.match(live, /- name: Install Bơi ếch bridge secret/);
  assert.match(live, /secret put CONTROL_SERVICE_SECRET --config wrangler\.production\.jsonc/);
  assert.match(live, /- name: Verify Bơi ếch live automation bridge/);
  assert.match(live, /\/api\/control\/overview\?activityDays=0/);
  assert.match(live, /Bơi ếch live automation bridge PASS/);
});

test("Boi bridge smoke happens only after the Application Management worker is deployed and read back", () => {
  const deploy = live.indexOf("- name: Deploy current main to live Worker");
  const revisionReadback = live.indexOf("- name: Read back live deployment revision");
  const boiSmoke = live.indexOf("- name: Verify Bơi ếch live automation bridge");
  assert.ok(deploy >= 0 && revisionReadback > deploy && boiSmoke > revisionReadback);
});
