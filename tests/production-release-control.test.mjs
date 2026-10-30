import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { spawnSync, execFileSync } from "node:child_process";
import os from "node:os";
import path from "node:path";

async function gate() {
  assert.ok(fs.existsSync("scripts/production-release-control.mjs"), "exact-revision manual release gate is missing");
  return import(pathToFileURL(`${process.cwd()}/scripts/production-release-control.mjs`));
}
const revision = "a".repeat(40);
const request = { event: "workflow_dispatch", actor: "BlueDragon33", confirm: "DEPLOY_PRODUCTION", requested: revision, workflow: revision, checkout: revision };
test("release gate accepts only the owner-confirmed exact workflow and checked-out revision", async () => {
  const { requireProductionRelease } = await gate();
  assert.equal(requireProductionRelease(request), revision);
  for (const change of [{ event: "push" }, { actor: "other-writer" }, { confirm: "INSPECT_PRODUCTION" }, { requested: "b".repeat(40) }, { checkout: "b".repeat(40) }, { workflow: "main" }]) {
    assert.throws(() => requireProductionRelease({ ...request, ...change }));
  }
});
test("release readback waits for exact revision and preserves the existing login mode", async () => {
  const { productionReadbackReady } = await gate();
  const data = { application: "application-management", runtime: "control-plane", channel: "cloudflare-production", revision, databaseReady: true, assetsReady: true, productionAuthConfigured: true, ownerPolicyConfigured: true, networkMode: "production", accessMode: "google-oauth+account-session", googleAuthConfigured: true };
  assert.equal(productionReadbackReady(data, revision, "google-oauth+account-session"), true);
  for (const change of [{ revision: "b".repeat(40) }, { databaseReady: "true" }, { accessMode: "account-session" }, { googleAuthConfigured: false }]) {
    assert.equal(productionReadbackReady({ ...data, ...change }, revision, "google-oauth+account-session"), false);
  }
  assert.equal(productionReadbackReady({ ...data, revision: undefined }, undefined, "google-oauth+account-session"), false);
});
test("release account normalization consumes whitespace without changing credentials", async () => {
  const { normalizeCloudflareAccountId } = await gate();
  assert.equal(normalizeCloudflareAccountId(` \n${"a".repeat(32)}\r\n`), "a".repeat(32));
  assert.throws(() => normalizeCloudflareAccountId("invalid"));
});
test("release command enforces the real checkout and writes only a validated account environment line", () => {
  const head = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  const safeEnv = { ...process.env, GITHUB_EVENT_NAME: "workflow_dispatch", GITHUB_ACTOR: "BlueDragon33", RELEASE_CONFIRM: "DEPLOY_PRODUCTION", RELEASE_REVISION: head, GITHUB_SHA: head };
  const command = env => spawnSync(process.execPath, ["scripts/production-release-control.mjs", "check"], { env, encoding: "utf8" });
  assert.equal(command(safeEnv).status, 0);
  const rejected = command({ ...safeEnv, RELEASE_REVISION: "b".repeat(40), RELEASE_CONFIRM: "UNTRUSTED_NEVER_ECHO" });
  assert.equal(rejected.status, 1); assert.match(rejected.stderr, /PRODUCTION_RELEASE_GATE_FAILED/);
  assert.doesNotMatch(rejected.stderr, /UNTRUSTED_NEVER_ECHO/);
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "release-env-"));
  try {
    const output = path.join(directory, "github-env");
    const run = spawnSync(process.execPath, ["scripts/production-release-control.mjs", "normalize-account"], { env: { ...safeEnv, CLOUDFLARE_ACCOUNT_ID: ` \n${"a".repeat(32)}\r\n`, GITHUB_ENV: output }, encoding: "utf8" });
    assert.equal(run.status, 0); assert.equal(run.stdout, "");
    assert.equal(fs.readFileSync(output, "utf8"), `CLOUDFLARE_ACCOUNT_ID=${"a".repeat(32)}\n`);
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});

test("code-only release preserves actual live client variables and rejects unknown or unsafe state", async () => {
  const { preservedProductionEnvironment } = await gate();
  const vars = { CONTROL_OWNER_EMAILS: "owner@example.test", CONTROL_PLANE_NETWORK_MODE: "production", APPLICATION_MANAGEMENT_DEPLOYMENT_CHANNEL: "cloudflare-production", APPLICATION_MANAGEMENT_ACCESS_MODE: "managed", APPLICATION_MANAGEMENT_BUILD_REVISION: "b".repeat(40), BOI_ECH_BASE_URL: "https://boi-ech.boiech-ai.workers.dev", HEALTH_CARE_BASE_URL: "https://health.example.test" };
  const settings = overrides => ({ success: true, result: { bindings: [...Object.entries({ ...vars, ...overrides }).map(([name, text]) => ({ name, text, type: "plain_text" })), { name: "MANAGED_APP_CREDENTIAL_ENCRYPTION_KEY", type: "secret_text" }] } });
  const kept = preservedProductionEnvironment(settings());
  assert.equal(kept.HEALTH_CARE_BASE_URL, vars.HEALTH_CARE_BASE_URL);
  assert.equal(kept.BOI_ECH_BASE_URL, vars.BOI_ECH_BASE_URL);
  assert.equal(kept.APPLICATION_MANAGEMENT_ACCESS_MODE, "managed");
  assert.equal(kept.RU_LIFE_BASE_URL, "");
  assert.equal(Object.hasOwn(kept, "MANAGED_APP_CREDENTIAL_ENCRYPTION_KEY"), false);
  for (const change of [{ UNREVIEWED_FLAG: "on" }, { BOI_ECH_BASE_URL: "https://legacy.chatgpt.site" }, { HEALTH_CARE_BASE_URL: "https://health.example.test\nEVIL=true" }, { APPLICATION_MANAGEMENT_ACCESS_MODE: "unknown" }, { CONTROL_PLANE_NETWORK_MODE: "local" }]) {
    assert.throws(() => preservedProductionEnvironment(settings(change)));
  }
  assert.throws(() => preservedProductionEnvironment({ success: false }));
  const collision = settings(); collision.result.bindings.push({ name: "BOI_ECH_BASE_URL", type: "secret_text" });
  assert.throws(() => preservedProductionEnvironment(collision));
});

test("shared-device release smoke fails on Central bridge failure and mismatched owning-app devices", async () => {
  const { requireCentralDeviceReadback } = await gate();
  const device = { deviceId: "c".repeat(64), status: "approved", appId: "boi-ech", userLabel: "PRIVATE_NEVER_LOG" };
  const summary = { appId: "boi-ech", connection: "connected", remoteAdminReady: true, webHref: "https://boi-ech.boiech-ai.workers.dev" };
  const operations = { actor: { role: "owner" }, summaries: [summary], devices: [device] };
  const access = { ok: true, application: "boi-ech", devices: [device], counts: { total: 1 } };
  const result = requireCentralDeviceReadback(operations, access);
  assert.deepEqual(result, { centralBoiConnected: true, accessReadbackReady: true, deviceCount: 1, humanOwnerAcceptance: "not-performed" });
  assert.doesNotMatch(JSON.stringify(result), /PRIVATE_NEVER_LOG|cccccccc/);
  for (const changed of [{ summaries: [{ ...summary, connection: "unavailable" }] }, { summaries: [{ ...summary, remoteAdminReady: false }] }, { summaries: [{ ...summary, webHref: "https://other.example.test" }] }, { devices: [] }, { devices: [device, device] }]) {
    assert.throws(() => requireCentralDeviceReadback({ ...operations, ...changed }, access));
  }
  for (const changed of [{ ok: false }, { devices: [{ ...device, deviceId: "d".repeat(64) }] }, { devices: [{ ...device, status: "blocked" }] }, { counts: { total: 2 } }]) {
    assert.throws(() => requireCentralDeviceReadback(operations, { ...access, ...changed }));
  }
});
