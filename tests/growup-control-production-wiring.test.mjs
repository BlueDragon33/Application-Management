import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("GrowUP website and control service remain separate network endpoints", () => {
  const registry = source("app/client-network-registry.ts");
  assert.match(registry, /id: "growup-control"/);
  assert.match(registry, /applicationId: "growup-mychildren"/);
  assert.match(registry, /productionEnv: "GROWUP_CONTROL_BASE_URL"/);
  assert.match(registry, /localEnv: "GROWUP_CONTROL_LOCAL_BASE_URL"/);
  assert.match(registry, /localDefault: "http:\/\/127\.0\.0\.1:3007"/);
  assert.match(registry, /bridgeSecretEnv: "GROWUP_CONTROL_SERVICE_SECRET"/);
});

test("GrowUP control origin is materialized without leaking its secret into Wrangler vars", () => {
  const productionTemplate = source("wrangler.production.example.jsonc");
  const previewTemplate = source("wrangler.cloudflare.example.jsonc");
  const productionPrepare = source("scripts/prepare-cloudflare-production.mjs");
  const previewPrepare = source("scripts/prepare-cloudflare-preview.mjs");
  for (const text of [productionTemplate, previewTemplate]) {
    assert.match(text, /"GROWUP_BASE_URL": "__GROWUP_BASE_URL__"/);
    assert.match(text, /"GROWUP_CONTROL_BASE_URL": "__GROWUP_CONTROL_BASE_URL__"/);
    assert.doesNotMatch(text, /GROWUP_CONTROL_SERVICE_SECRET/);
  }
  assert.match(productionPrepare, /GROWUP_CONTROL_BASE_URL: exactHttpsOrigin\("GROWUP_CONTROL_BASE_URL"\)/);
  assert.match(previewPrepare, /GROWUP_CONTROL_BASE_URL: exactHttpsOrigin\("GROWUP_CONTROL_BASE_URL"\)/);
});

test("GrowUP bridge secret is installed only when a real control origin exists", () => {
  const live = source(".github/workflows/live-development-deploy.yml");
  const production = source(".github/workflows/deploy-application-management-production.yml");
  const preview = source(".github/workflows/deploy-application-management-preview.yml");
  assert.match(live, /GROWUP_CONTROL_PRODUCTION_ORIGIN/);
  assert.match(production, /GROWUP_CONTROL_PRODUCTION_ORIGIN/);
  assert.match(preview, /GROWUP_CONTROL_PREVIEW_ORIGIN/);
  for (const workflow of [live, production, preview]) {
    assert.match(workflow, /GROWUP_CONTROL_SERVICE_SECRET/);
    assert.match(workflow, /wrangler secret put GROWUP_CONTROL_SERVICE_SECRET/);
  }
  assert.match(production, /GROWUP_CONTROL_SERVICE_SECRET is required when GROWUP_CONTROL_BASE_URL is configured/);
  assert.match(live, /GrowUP remains fail-closed\/read-only/);
  assert.match(preview, /GrowUP stays read-only/);
});
