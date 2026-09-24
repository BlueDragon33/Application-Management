import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const worker = fs.readFileSync("worker/index.ts", "utf8");
const validator = fs.readFileSync("scripts/validate-cloudflare-production-artifact.mjs", "utf8");
const deploy = fs.readFileSync(".github/workflows/deploy-application-management-production.yml", "utf8");
const sentinel = fs.readFileSync("public/application-management-asset-health.txt", "utf8").trim();

test("production health checks a real static asset sentinel through ASSETS", () => {
  assert.equal(sentinel, "application-management-assets-ok-v1");
  assert.ok(worker.includes('const ASSET_HEALTH_PATH = "/application-management-asset-health.txt"'));
  assert.ok(worker.includes('ASSET_HEALTH_BODY = "application-management-assets-ok-v1"'));
  assert.ok(worker.includes("await env.ASSETS.fetch"));
  assert.ok(worker.includes("assetsReady: await staticAssetsReady(env)"));
});

test("production artifact and deployment readback fail when static assets are missing", () => {
  assert.ok(validator.includes("application-management-asset-health.txt"));
  assert.ok(validator.includes("Generated production asset health sentinel content mismatch."));
  assert.ok(deploy.includes("if (!value.assetsReady)"));
  assert.ok(deploy.includes("Production static assets are not ready on the live Worker version."));
});
