import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";

async function inspector() {
  assert.ok(fs.existsSync("scripts/inspect-production-readiness.mjs"), "read-only production inspection is not implemented");
  return (await import(pathToFileURL(`${process.cwd()}/scripts/inspect-production-readiness.mjs`))).inspectProduction;
}
const prodId = "a1111111-b111-4111-8111-111111111111";
const bookmarkId = "00000001-00000002-00004e2f-0a83ea2fceebc654de0640c422be4653";
const versionId = "33333333-3333-4333-8333-333333333333";
const env = { CLOUDFLARE_ACCOUNT_ID: "1".repeat(32), CLOUDFLARE_API_TOKEN: "test-token-never-log".repeat(3), APPLICATION_MANAGEMENT_PRODUCTION_D1_DATABASE_ID: prodId,
  APPLICATION_MANAGEMENT_PREVIEW_D1_DATABASE_ID: "22222222-2222-4222-8222-222222222222", APPLICATION_MANAGEMENT_PRODUCTION_READBACK_SECRET: "test-readback-never-log".repeat(3), APPLICATION_MANAGEMENT_PRODUCTION_ORIGIN: "https://application-management.boiech-ai.workers.dev", GITHUB_SHA: "a".repeat(40) };
const tables = ["control_accounts", "control_sessions", "control_members", "control_devices", "control_audit_log", "managed_app_catalog"];
function boundaries({ activeOwners = 1, bookmark = bookmarkId, bindingId = prodId, missingMigration = false, badAuth = false, healthOverride = {}, ownerAggregate, workerDeployments, liveVariables = {} } = {}) {
  const commands = [];
  return { commands, env, expectedMigrations: ["0001_test.sql"], now: () => new Date("2026-10-29T10:00:00Z"),
    runWrangler: async args => {
      commands.push(args);
      if (args.includes("time-travel")) return { bookmark };
      if (args.includes("deployments")) return workerDeployments ?? [{ id: "44444444-4444-4444-8444-444444444444", created_on: "2026-10-28T00:00:00Z", author_email: "private@example.test", versions: [{ version_id: versionId, percentage: 100 }] }];
      assert.ok(args.includes("execute"));
      const sql = args[args.indexOf("--command") + 1];
      assert.doesNotMatch(sql, /\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|REPLACE)\b/i);
      return [{ success: true, results: tables.map(name => ({ name })) }, { success: true, results: missingMigration ? [] : [{ name: "0001_test.sql" }] }, { success: true, results: [ownerAggregate ?? { total: 2, active_owners: activeOwners }] }];
    },
    fetch: async (url, init) => {
      if (url.endsWith("/settings")) return Response.json({ success: true, result: { bindings: [{ name: "DB", type: "d1", id: bindingId }, ...Object.entries({ CONTROL_OWNER_EMAILS: "owner@example.test", CONTROL_PLANE_NETWORK_MODE: "production", APPLICATION_MANAGEMENT_DEPLOYMENT_CHANNEL: "cloudflare-production", APPLICATION_MANAGEMENT_ACCESS_MODE: "managed", BOI_ECH_BASE_URL: "https://boi-ech.boiech-ai.workers.dev", ...liveVariables }).map(([name, text]) => ({ name, text, type: "plain_text" }))] } });
      if (url.endsWith("/__login")) return new Response("Private login HTML is never logged", { status: 200 });
      if (!init.headers?.authorization) return new Response(null, { status: 401 });
      if (badAuth) return new Response(`Sensitive failure: ${env.APPLICATION_MANAGEMENT_PRODUCTION_READBACK_SECRET}`, { status: 403 });
      return Response.json({ application: "application-management", runtime: "control-plane", channel: "cloudflare-production", revision: "b".repeat(40), databaseReady: true, assetsReady: true, productionAuthConfigured: true, ownerPolicyConfigured: true, networkMode: "production", accessMode: "google-oauth+account-session", ...healthOverride });
    },
  };
}

test("inspection captures live revision, isolated binding and rollback metadata using only reads", async () => {
  const fixture = boundaries(); const result = await (await inspector())(fixture);
  assert.equal(result.readyForReleaseReview, true); assert.equal(result.liveRevision, "b".repeat(40));
  assert.equal(result.rollback.databaseBookmark, bookmarkId); assert.equal(result.rollback.workerVersionIds[0], versionId);
  assert.deepEqual(result.pendingMigrations, []); assert.equal(fixture.commands.length, 3);
  assert.doesNotMatch(JSON.stringify(result), /private@example|test-token-never-log|test-readback-never-log|Private login/);
});

test("inspection blocks code-only release when live client variables cannot be preserved", async () => {
  const result = await (await inspector())(boundaries({ liveVariables: { UNREVIEWED_FLAG: "PRIVATE_NEVER_LOG" } }));
  assert.equal(result.readyForReleaseReview, false); assert.equal(result.liveVariablesPreservable, false);
  assert.ok(result.blockers.includes("LIVE_VARIABLE_PRESERVATION_UNAVAILABLE"));
  assert.doesNotMatch(JSON.stringify(result), /PRIVATE_NEVER_LOG|owner@example/);
});

test("inspection rejects preview/database binding collisions before claiming readiness", async () => {
  const inspect = await inspector();
  await assert.rejects(inspect({ ...boundaries(), env: { ...env, APPLICATION_MANAGEMENT_PRODUCTION_D1_DATABASE_ID: env.APPLICATION_MANAGEMENT_PREVIEW_D1_DATABASE_ID } }), /DATABASE_BOUNDARY_INVALID/);
  const result = await inspect(boundaries({ bindingId: env.APPLICATION_MANAGEMENT_PREVIEW_D1_DATABASE_ID }));
  assert.equal(result.readyForReleaseReview, false); assert.ok(result.blockers.includes("LIVE_DATABASE_BINDING_MISMATCH"));
});

test("missing owner, migration or rollback evidence blocks release review readiness", async () => {
  const inspect = await inspector();
  for (const [options, code] of [[{ activeOwners: 0 }, "NO_ACTIVE_OWNER"], [{ missingMigration: true }, "PENDING_MIGRATIONS"], [{ bookmark: "" }, "ROLLBACK_BOOKMARK_UNAVAILABLE"]]) {
    const result = await inspect(boundaries(options));
    assert.equal(result.readyForReleaseReview, false); assert.ok(result.blockers.includes(code));
  }
});

test("failed protected readback is sanitized and cannot emit secrets or false readiness", async () => {
  const result = await (await inspector())(boundaries({ badAuth: true }));
  assert.equal(result.readyForReleaseReview, false); assert.ok(result.blockers.includes("PROTECTED_READBACK_UNAVAILABLE"));
  assert.doesNotMatch(JSON.stringify(result), /test-readback-never-log|Sensitive failure/);
});


test("case-only database aliases and uppercase legacy identifiers are rejected", async () => {
  const inspect = await inspector();
  await assert.rejects(inspect({ ...boundaries(), env: { ...env, APPLICATION_MANAGEMENT_PRODUCTION_D1_DATABASE_ID: prodId.toUpperCase(), APPLICATION_MANAGEMENT_PREVIEW_D1_DATABASE_ID: prodId } }), /DATABASE_BOUNDARY_INVALID/);
  await assert.rejects(inspect({ ...boundaries(), env: { ...env, APPLICATION_MANAGEMENT_PRODUCTION_D1_DATABASE_ID: "1CF8F6B4-6C23-4479-8751-47703ECAC92B" } }), /DATABASE_BOUNDARY_INVALID/);
});

test("truthy malformed health and owner counts cannot authorize release review", async () => {
  const inspect = await inspector();
  for (const fixture of [boundaries({ healthOverride: { databaseReady: "false", assetsReady: "false", productionAuthConfigured: "false", ownerPolicyConfigured: "false" } }), boundaries({ ownerAggregate: { total: 1, active_owners: 2 } }), boundaries({ ownerAggregate: { total: "2", active_owners: "1" } })]) {
    assert.equal((await inspect(fixture)).readyForReleaseReview, false);
  }
});

test("malformed or partial rollback metadata is blocked and never copied into the report", async () => {
  const inspect = await inspector();
  for (const options of [{ bookmark: "Sensitive body copied from upstream" }, { workerDeployments: [{ id: "44444444-4444-4444-8444-444444444444", versions: [{ version_id: "not-a-uuid", percentage: 100 }, {}] }] }, { workerDeployments: [{ id: "44444444-4444-4444-8444-444444444444", created_on: "2026-10-28T00:00:00Z", versions: [{ version_id: versionId, percentage: 100 }, {}] }] }]) {
    const result = await inspect(boundaries(options));
    assert.equal(result.readyForReleaseReview, false);
    assert.doesNotMatch(JSON.stringify(result), /Sensitive body|not-a-uuid/);
  }
});

test("entry point identifies missing configuration with a whitelisted code without revealing values", () => {
  const run = spawnSync(process.execPath, ["scripts/inspect-production-readiness.mjs"], { env: { ...env, APPLICATION_MANAGEMENT_PRODUCTION_READBACK_SECRET: "" }, encoding: "utf8" });
  assert.equal(run.status, 1); assert.match(run.stderr, /PRODUCTION_READBACK_NOT_CONFIGURED/);
  assert.doesNotMatch(run.stderr, /test-token-never-log|test-readback-never-log/);
});

test("Cloudflare configuration failure reveals only safe presence and shape evidence", () => {
  const run = spawnSync(process.execPath, ["scripts/inspect-production-readiness.mjs"], { env: { ...env, CLOUDFLARE_ACCOUNT_ID: "private-invalid-account", CLOUDFLARE_API_TOKEN: "private-short" }, encoding: "utf8" });
  assert.equal(run.status, 1); assert.match(run.stderr, /"accountTagShapeValid":false/);
  assert.match(run.stderr, /"apiTokenPresent":true/); assert.match(run.stderr, /"apiTokenLengthGatePasses":false/);
  assert.doesNotMatch(run.stderr, /private-invalid-account|private-short|test-readback-never-log/);
});

test("surrounding whitespace in an account ID is normalized before actual provider reads", async () => {
  const fixture = boundaries();
  const request = fixture.fetch; const providerUrls = [];
  const result = await (await inspector())({ ...fixture, env: { ...env, CLOUDFLARE_ACCOUNT_ID: ` \n${env.CLOUDFLARE_ACCOUNT_ID}\r\n` }, fetch: async (url, init) => {
    if (url.startsWith("https://api.cloudflare.com/")) providerUrls.push(url);
    return request(url, init);
  } });
  assert.equal(result.readyForReleaseReview, true);
  assert.deepEqual(providerUrls, [`https://api.cloudflare.com/client/v4/accounts/${"1".repeat(32)}/workers/scripts/application-management/settings`]);
});
