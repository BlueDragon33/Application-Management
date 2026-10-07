import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const workflow = fs.readFileSync(new URL("../.github/workflows/bootstrap-price-report-control.yml", import.meta.url), "utf8");
const live = fs.readFileSync(new URL("../.github/workflows/live-development-deploy.yml", import.meta.url), "utf8");
const production = fs.readFileSync(new URL("../.github/workflows/deploy-application-management-production.yml", import.meta.url), "utf8");
const catalog = fs.readFileSync(new URL("../app/api/managed-apps/route.ts", import.meta.url), "utf8");

test("PriceReport bootstrap is centralized on the already-configured Application Management Cloudflare environment", () => {
  assert.match(workflow, /environment: application-management-production/);
  assert.match(workflow, /repository: BlueDragon33\/PriceReport_Tunggiabao/);
  assert.match(workflow, /wrangler d1 list --json/);
  assert.match(workflow, /wrangler d1 create price-report-control-db/);
  assert.match(workflow, /wrangler d1 migrations apply price-report-control-db/);
  assert.match(workflow, /wrangler deploy --config wrangler.production.jsonc/);
  assert.match(workflow, /PRICE_REPORT_CONTROL_SERVICE_SECRET/);
  assert.match(workflow, /PriceReport Control health PASS/);
  assert.match(workflow, /sync-existing/);
  assert.match(workflow, /probe-all/);
  assert.match(workflow, /remoteAdminReady/);
});

test("PriceReport production origin has a stable fallback after bootstrap", () => {
  for (const text of [live, production]) {
    assert.match(text, /price-report-control-service\.boiech-ai\.workers\.dev/);
  }
  assert.match(production, /secret already exists on the Worker; preserving it/);
});

test("catalog recovery promotes a credential-free public bootstrap directly to live transport", () => {
  assert.match(catalog, /public-bootstrap-upgraded-to-live/);
  assert.match(catalog, /liveCandidate\.origin \? liveCandidate : await repositoryCatalogCandidate\(application\)/);
  assert.match(catalog, /credential: recoveryCandidate\.credential/);
});
