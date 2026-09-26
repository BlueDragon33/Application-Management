import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const vite = fs.readFileSync("vite.config.ts", "utf8");
const local = fs.readFileSync("wrangler.local.jsonc", "utf8");
const template = fs.readFileSync("wrangler.cloudflare.example.jsonc", "utf8");
const prepare = fs.readFileSync("scripts/prepare-cloudflare-preview.mjs", "utf8");
const artifact = fs.readFileSync("scripts/validate-cloudflare-build-artifact.mjs", "utf8");
const previewCi = fs.readFileSync(".github/workflows/cloudflare-preview-ci.yml", "utf8");
const deploy = fs.readFileSync(".github/workflows/deploy-application-management-preview.yml", "utf8");
const liveDevelopment = fs.readFileSync(".github/workflows/live-development-deploy.yml", "utf8");
const worker = fs.readFileSync("worker/index.ts", "utf8");
const gate = fs.readFileSync("worker/preview-access.ts", "utf8");

const LOCAL_D1 = "00000000-0000-0000-0000-000000000003";
const LEGACY_D1 = "1cf8f6b4-6c23-4479-8751-47703ecac92b";

test("local Application Management never reuses the legacy Sites D1 identity", () => {
  assert.ok(vite.includes(LOCAL_D1));
  assert.ok(local.includes(LOCAL_D1));
  assert.equal(vite.includes(LEGACY_D1), false);
  assert.equal(local.includes(LEGACY_D1), false);
  assert.ok(vite.includes("CLOUDFLARE_VITE_WRANGLER_CONFIG_PATH"));
  assert.ok(vite.includes("configPath: cloudflareConfigPath"));
});

test("Cloudflare preview uses a materialized isolated D1 and production network resolver", () => {
  assert.ok(template.includes("__APPLICATION_MANAGEMENT_PREVIEW_D1_DATABASE_ID__"));
  assert.ok(template.includes('"database_name": "application-management-preview-db"'));
  assert.ok(template.includes('"CONTROL_PLANE_NETWORK_MODE": "production"'));
  assert.equal(template.includes(LOCAL_D1), false);
  assert.equal(template.includes(LEGACY_D1), false);
  assert.equal(/"LOCAL_DEV_AUTH"\s*:/.test(template), false);
  assert.equal(template.includes("CF_ACCESS_TEAM_DOMAIN"), false);
  assert.equal(template.includes("CF_ACCESS_AUD"), false);
  assert.equal(template.includes("APPLICATION_MANAGEMENT_PREVIEW_ACCESS_SECRET"), false);
  assert.ok(prepare.includes(LOCAL_D1));
  assert.ok(prepare.includes(LEGACY_D1));
  assert.ok(prepare.includes('required("APPLICATION_MANAGEMENT_PRODUCTION_D1_DATABASE_ID")'));
  assert.ok(prepare.includes(".chatgpt.site"));
});

test("generated Cloudflare artifact validation follows Wrangler's config redirect", () => {
  for (const marker of [
    'path.join(ROOT, ".wrangler", "deploy", "config.json")',
    "redirect.configPath",
    'generated.name !== EXPECTED_WORKER',
    'item.binding === "DB"',
    "APPLICATION_MANAGEMENT_PREVIEW_D1_DATABASE_ID",
    "APPLICATION_MANAGEMENT_DEPLOYMENT_CHANNEL",
    LOCAL_D1,
    LEGACY_D1,
  ]) {
    assert.ok(artifact.includes(marker), `missing generated-artifact guard: ${marker}`);
  }
  assert.ok(previewCi.includes("npm run cloudflare:artifact:check"));
  assert.ok(deploy.includes("npm run cloudflare:artifact:check"));
  assert.match(template, /"run_worker_first"\s*:\s*true/);
  assert.match(template, /"binding"\s*:\s*"ASSETS"/);
  assert.ok(artifact.includes("assets.run_worker_first !== true"));
});

test("Cloudflare preview remains an explicit protected verification path while main auto-publishes standalone development", () => {
  assert.ok(deploy.includes("workflow_dispatch"));
  assert.doesNotMatch(deploy, /push:\s*\n\s*branches: \[main\]/);
  assert.match(liveDevelopment, /push:\s*\n\s*branches: \[main\]/);
  assert.match(liveDevelopment, /APPLICATION_MANAGEMENT_ACCESS_MODE: standalone/);
  assert.ok(deploy.includes("cancel-in-progress: true"));
  assert.ok(deploy.includes("Detect preview readiness"));
  assert.ok(deploy.includes("APPLICATION_MANAGEMENT_PREVIEW_ACCESS_SECRET"));
  assert.ok(deploy.includes("wrangler secret put APPLICATION_MANAGEMENT_PREVIEW_ACCESS_SECRET"));
  assert.ok(deploy.includes("Expected anonymous /__deployment to return 401"));
  assert.ok(deploy.includes("Application Management Cloudflare preview read-back PASS"));
  assert.equal(deploy.includes("CF_ACCESS_CLIENT_ID"), false);
  assert.equal(deploy.includes("CF_ACCESS_CLIENT_SECRET"), false);
  assert.ok(worker.includes('url.pathname === "/__deployment"'));
});

test("application preview identity gate is origin-side and secret-backed", () => {
  for (const marker of ["Authorization: Bearer <preview-secret>", "HMAC-SHA-256", "HttpOnly", "SameSite=Strict", "secretNeverInUrl", "oai-authenticated-user-email"]) {
    assert.ok(gate.includes(marker), `missing application preview guard: ${marker}`);
  }
  assert.equal(gate.includes("CF_ACCESS_"), false);
});
