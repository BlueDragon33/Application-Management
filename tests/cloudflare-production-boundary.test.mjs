import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const auth = fs.readFileSync("worker/production-auth.ts", "utf8");
const worker = fs.readFileSync("worker/index.ts", "utf8");
const template = fs.readFileSync("wrangler.production.example.jsonc", "utf8");
const prepare = fs.readFileSync("scripts/prepare-cloudflare-production.mjs", "utf8");
const validator = fs.readFileSync("scripts/validate-cloudflare-production.mjs", "utf8");
const artifact = fs.readFileSync("scripts/validate-cloudflare-production-artifact.mjs", "utf8");
const deploy = fs.readFileSync(".github/workflows/deploy-application-management-production.yml", "utf8");
const dashboard = fs.readFileSync("app/management-dashboard-v2.tsx", "utf8");
const authBridge = fs.readFileSync("app/chatgpt-auth.ts", "utf8");
const controlDevice = fs.readFileSync("app/control-device.server.ts", "utf8");
const migration = fs.readFileSync("drizzle/0004_production_accounts.sql", "utf8");

test("production account auth uses strong browser/session boundaries", () => {
  for (const marker of [
    "__Host-am_prod_session",
    "PBKDF2",
    "SHA-256",
    "100_000",
    "SameSite=Strict",
    "HttpOnly",
    "Secure",
    "MAX_FAILED_ATTEMPTS = 5",
    "LOCK_SECONDS = 15 * 60",
    "crypto.getRandomValues",
  ]) assert.ok(auth.includes(marker), `missing production auth guard: ${marker}`);
  assert.match(auth, /password\.length < 12/);
  assert.match(auth, /DELETE FROM control_sessions WHERE email=\?1 AND session_id_hash<>\?2/);
  assert.ok(auth.includes('origin && origin !== "null"'));
  assert.ok(auth.includes('fetchSite === "same-origin" || fetchSite === "none"'));
  assert.ok(auth.includes('fetchSite === "cross-site"'));
  assert.ok(auth.includes("allowOpaqueLoginOrigin"));
  assert.ok(auth.includes('allowOpaqueLoginOrigin && origin === "null" && !referer && !fetchSite'));
  assert.ok(auth.includes("sameOriginPost(request, true)"));
  assert.ok(auth.split("sameOriginPost(request)").length - 1 >= 2);
  assert.ok(auth.includes("const PASSWORD_ITERATIONS = 100_000;"));
  assert.equal(auth.includes("const PASSWORD_ITERATIONS = 310_000;"), false);
  assert.ok(validator.includes("Cloudflare Workers ceiling of 100000"));
});

test("production auth supports profile password and email management without losing owner role", () => {
  assert.match(auth, /ACCOUNT_PATH}\/profile/);
  assert.match(auth, /ACCOUNT_PATH}\/password/);
  assert.match(auth, /ACCOUNT_PATH}\/email/);
  assert.match(auth, /UPDATE control_devices SET email=\?2 WHERE email=\?1/);
  assert.match(auth, /UPDATE control_members SET email=\?2/);
  assert.match(auth, /UPDATE control_accounts SET email=\?2/);
  assert.match(migration, /`role` text DEFAULT 'owner' NOT NULL/);
  assert.match(controlDevice, /SELECT role,status FROM control_accounts WHERE email=\?1 LIMIT 1/);
  assert.match(controlDevice, /account\?\.status === "active" && account\.role === "owner"/);
});

test("production Worker authenticates before application and uses separate deployment readback secret", () => {
  assert.match(worker, /channel === "cloudflare-production"/);
  assert.match(worker, /handleProductionLogin\(request, env\)/);
  assert.match(worker, /productionIdentity\(request, env\)/);
  assert.match(worker, /withProductionIdentity\(request, identity\)/);
  assert.match(worker, /productionReadbackAuthorized/);
  assert.match(worker, /accessMode: isProduction \? "account-session"/);
  assert.match(worker, /productionAuthConfigured/);
  assert.doesNotMatch(auth, /APPLICATION_MANAGEMENT_PREVIEW_ACCESS_SECRET/);
});

test("production template is isolated, Worker-first, and secret-free", () => {
  assert.match(template, /"name": "application-management"/);
  assert.match(template, /"database_name": "application-management-production-db"/);
  assert.match(template, /"run_worker_first"\s*:\s*true/);
  assert.match(template, /"binding"\s*:\s*"ASSETS"/);
  assert.match(template, /"APPLICATION_MANAGEMENT_DEPLOYMENT_CHANNEL": "cloudflare-production"/);
  for (const forbidden of [
    "APPLICATION_MANAGEMENT_INITIAL_ADMIN_PASSWORD",
    "APPLICATION_MANAGEMENT_PRODUCTION_READBACK_SECRET",
    "APPLICATION_MANAGEMENT_PREVIEW_ACCESS_SECRET",
  ]) assert.equal(template.includes(forbidden), false, `template leaked secret name ${forbidden}`);
  assert.ok(prepare.includes("Production must never reuse the Application Management preview D1 database."));
  assert.ok(validator.includes("Production assets must run Worker authentication first."));
  assert.ok(artifact.includes("Generated production artifact must set assets.run_worker_first=true."));
  assert.ok(artifact.includes("must include an assets.directory"));
  assert.ok(artifact.includes("must contain both CSS and JavaScript bundles"));
});

test("production deploy is manual-only and keeps strict deployment verification", () => {
  assert.ok(deploy.includes("workflow_dispatch"));
  assert.equal(/\n\s*push\s*:/.test(deploy), false);
  assert.equal(deploy.includes("issue_comment:"), false);
  assert.equal(deploy.includes("/deploy-production-qa-final"), false);
  assert.equal(deploy.includes("/deploy-production-bootstrap-e2e"), false);
  assert.ok(deploy.includes("DEPLOY_PRODUCTION"));
  assert.ok(deploy.includes("APPLICATION_MANAGEMENT_INITIAL_ADMIN_PASSWORD"));
  assert.ok(deploy.includes("APPLICATION_MANAGEMENT_PRODUCTION_READBACK_SECRET"));
  const finalArtifactRestore = deploy.indexOf("Restore generated Production artifact after secret versions");
  const lastSecretUpdate = Math.max(
    deploy.lastIndexOf("secret put APPLICATION_MANAGEMENT_INITIAL_ADMIN_PASSWORD"),
    deploy.lastIndexOf("secret put APPLICATION_MANAGEMENT_PRODUCTION_READBACK_SECRET"),
    deploy.lastIndexOf("secret put CONTROL_SERVICE_SECRET"),
    deploy.lastIndexOf("secret put HEALTH_CONTROL_SERVICE_SECRET"),
    deploy.lastIndexOf("secret put RU_LIFE_CONTROL_SERVICE_SECRET"),
    deploy.lastIndexOf("secret put BAUMAN_CONTROL_SERVICE_SECRET"),
  );
  const loginVerification = deploy.indexOf("Verify production login route and anonymous protection");
  assert.ok(lastSecretUpdate >= 0, "Production deploy must install at least one Worker secret.");
  assert.ok(finalArtifactRestore > lastSecretUpdate, "Generated Production artifact must be restored after all secret-created versions.");
  assert.ok(loginVerification > finalArtifactRestore, "Login verification must run against the restored asset-bearing Worker version.");
  assert.ok(deploy.includes("Expected Production /__login to return 200"));
  assert.ok(deploy.includes("Browser-like same-origin Production login POST was incorrectly rejected as Forbidden."));
  assert.ok(deploy.includes("Privacy-browser Production login POST was incorrectly rejected as Forbidden."));
  assert.ok(deploy.includes("Expected anonymous Production /__deployment to return 401"));
  assert.ok(deploy.includes("Application Management Cloudflare production read-back PASS"));
  assert.ok(deploy.includes("for attempt in {1..12}"));
  assert.ok(deploy.includes("waiting for Cloudflare secret/version propagation"));
  assert.ok(deploy.includes("did not become ready within 60 seconds"));
  assert.ok(deploy.includes("value.accessMode !== 'account-session'"));
  assert.ok(deploy.includes("value.productionAuthConfigured"));
  assert.ok(auth.includes("x-application-management-auth-stage"));
  assert.ok(auth.includes("productionAuthFailure"));
  for (const stage of [
    "account-lookup",
    "owner-bootstrap",
    "bootstrap-secret-verify",
    "bootstrap-password-hash",
    "bootstrap-account-insert",
    "bootstrap-account-readback",
    "password-verify",
    "login-reset",
    "session-create",
  ]) {
    assert.ok(auth.includes(`"${stage}"`), `missing auth diagnostic stage ${stage}`);
  }
  assert.ok(auth.includes("ProductionAuthStageError"));
});

test("dashboard uses production account controls only in production mode", () => {
  assert.match(authBridge, /"cloudflare-production"/);
  assert.match(dashboard, /authMode === "cloudflare-production" \? <a href="\/__account"/);
  assert.match(dashboard, /action="\/__logout"/);
  assert.match(dashboard, /authMode === "cloudflare-preview"/);
});

test("production migration creates account and session stores", () => {
  assert.match(migration, /CREATE TABLE IF NOT EXISTS `control_accounts`/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS `control_sessions`/);
  assert.match(migration, /`password_hash` text NOT NULL/);
  assert.match(migration, /`must_change_password` integer DEFAULT 1 NOT NULL/);
  assert.match(migration, /`locked_until` integer/);
  assert.match(migration, /FOREIGN KEY \(`email`\) REFERENCES `control_accounts`/);
});
