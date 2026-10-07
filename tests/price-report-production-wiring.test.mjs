import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("PriceReport control origin is materialized into Preview and Production Worker vars", () => {
  const productionTemplate = source("wrangler.production.example.jsonc");
  const previewTemplate = source("wrangler.cloudflare.example.jsonc");
  const productionPrepare = source("scripts/prepare-cloudflare-production.mjs");
  const previewPrepare = source("scripts/prepare-cloudflare-preview.mjs");
  for (const text of [productionTemplate, previewTemplate]) {
    assert.match(text, /"PRICE_REPORT_CONTROL_BASE_URL": "__PRICE_REPORT_CONTROL_BASE_URL__"/);
    assert.doesNotMatch(text, /PRICE_REPORT_CONTROL_SERVICE_SECRET/);
  }
  assert.match(productionPrepare, /PRICE_REPORT_CONTROL_BASE_URL: exactHttpsOrigin\("PRICE_REPORT_CONTROL_BASE_URL"\)/);
  assert.match(previewPrepare, /PRICE_REPORT_CONTROL_BASE_URL: exactHttpsOrigin\("PRICE_REPORT_CONTROL_BASE_URL"\)/);
});

test("PriceReport bridge secret remains a Worker secret and is wired fail-closed", () => {
  const live = source(".github/workflows/live-development-deploy.yml");
  const production = source(".github/workflows/deploy-application-management-production.yml");
  const preview = source(".github/workflows/deploy-application-management-preview.yml");
  assert.match(live, /PRICE_REPORT_CONTROL_PRODUCTION_ORIGIN/);
  assert.match(live, /price-report-control-service\\.boiech-ai\\.workers\\.dev/);
  assert.match(production, /PRICE_REPORT_CONTROL_PRODUCTION_ORIGIN/);
  assert.match(preview, /PRICE_REPORT_CONTROL_PREVIEW_ORIGIN/);
  for (const workflow of [live, production, preview]) {
    assert.match(workflow, /PRICE_REPORT_CONTROL_SERVICE_SECRET/);
    assert.match(workflow, /wrangler secret put PRICE_REPORT_CONTROL_SERVICE_SECRET/);
  }
  assert.match(production, /PriceReport bridge secret already exists on the Worker; preserving it/);
  assert.match(production, /Run Bootstrap PriceReport Control Service first/);
  assert.match(live, /PriceReport remains fail-closed\/read-only/);
  assert.match(preview, /PriceReport stays read-only/);
});
