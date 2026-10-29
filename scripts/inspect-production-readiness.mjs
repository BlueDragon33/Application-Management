import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { pathToFileURL } from "node:url";
import { preservedProductionEnvironment } from "./production-release-control.mjs";

const origin = "https://application-management.boiech-ai.workers.dev";
const databaseName = "application-management-production-db";
const uuid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
// Current documented D1 bookmark representation; unknown formats fail closed.
const bookmarkShape = /^[a-f0-9]{8}-[a-f0-9]{8}-[a-f0-9]{8}-[a-f0-9]{32}$/i;
const requiredTables = ["control_accounts", "control_sessions", "control_members", "control_devices", "control_audit_log", "managed_app_catalog"];
const inspectionSql = "SELECT name FROM sqlite_master WHERE type='table'; SELECT name FROM d1_migrations ORDER BY id; SELECT COUNT(*) AS total, SUM(CASE WHEN role='owner' AND status='active' THEN 1 ELSE 0 END) AS active_owners FROM control_accounts;";

function configuration(env) {
  const productionId = String(env.APPLICATION_MANAGEMENT_PRODUCTION_D1_DATABASE_ID ?? "").toLowerCase();
  const previewId = String(env.APPLICATION_MANAGEMENT_PREVIEW_D1_DATABASE_ID ?? "").toLowerCase();
  const accountId = String(env.CLOUDFLARE_ACCOUNT_ID ?? "").trim();
  if (!uuid.test(productionId ?? "") || !uuid.test(previewId ?? "") || productionId === previewId
    || ["1cf8f6b4-6c23-4479-8751-47703ecac92b", "7816425d-ce8a-4b3c-b303-7697fd4a529c"].includes(productionId)
    || productionId.startsWith("00000000-")) throw new Error("DATABASE_BOUNDARY_INVALID");
  if (env.APPLICATION_MANAGEMENT_PRODUCTION_ORIGIN !== origin) throw new Error("PRODUCTION_ORIGIN_INVALID");
  if (!/^[a-f0-9]{32}$/i.test(accountId) || (env.CLOUDFLARE_API_TOKEN?.length ?? 0) < 20) throw new Error("CLOUDFLARE_READ_ACCESS_NOT_CONFIGURED");
  if ((env.APPLICATION_MANAGEMENT_PRODUCTION_READBACK_SECRET?.length ?? 0) < 32) throw new Error("PRODUCTION_READBACK_NOT_CONFIGURED");
  if (!/^[a-f0-9]{40}$/i.test(env.GITHUB_SHA ?? "")) throw new Error("CANDIDATE_REVISION_INVALID");
  return { productionId, accountId };
}

export async function inspectProduction({ env, runWrangler, fetch: http = fetch, expectedMigrations, now = () => new Date() }) {
  const { productionId, accountId } = configuration(env);
  const read = async (url, headers) => {
    const response = await http(url, { method: "GET", redirect: "manual", headers, signal: AbortSignal.timeout(20_000) });
    return { status: response.status, body: response.ok ? await response.json().catch(() => null) : null };
  };
  const results = await Promise.allSettled([
    read(`${origin}/__deployment`, { authorization: `Bearer ${env.APPLICATION_MANAGEMENT_PRODUCTION_READBACK_SECRET}` }),
    read(`${origin}/__deployment`),
    http(`${origin}/__login`, { method: "GET", redirect: "manual", signal: AbortSignal.timeout(20_000) }).then(response => ({ status: response.status })),
    read(`https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/scripts/application-management/settings`, { authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}` }),
    runWrangler(["d1", "execute", databaseName, "--remote", "--json", "--command", inspectionSql]),
    runWrangler(["d1", "time-travel", "info", databaseName, "--json"]),
    runWrangler(["deployments", "list", "--name", "application-management", "--json"]),
  ]);
  const value = index => results[index].status === "fulfilled" ? results[index].value : null;
  const blockers = [];
  const live = value(0)?.body;
  if (value(0)?.status !== 200 || !live) blockers.push("PROTECTED_READBACK_UNAVAILABLE");
  else if (live.application !== "application-management" || live.runtime !== "control-plane" || live.channel !== "cloudflare-production"
    || !/^[a-f0-9]{40}$/i.test(live.revision ?? "") || live.networkMode !== "production"
    || live.databaseReady !== true || live.assetsReady !== true || live.productionAuthConfigured !== true || live.ownerPolicyConfigured !== true
    || !["account-session", "google-oauth+account-session"].includes(live.accessMode)) blockers.push("LIVE_DEPLOYMENT_BOUNDARY_INVALID");
  if (value(1)?.status !== 401) blockers.push("ANONYMOUS_READBACK_NOT_PROTECTED");
  if (value(2)?.status !== 200) blockers.push("OWNER_LOGIN_UNAVAILABLE");
  const bindings = value(3)?.body?.result?.bindings;
  if (value(3)?.status !== 200 || value(3)?.body?.success !== true || !Array.isArray(bindings) || !bindings.some(binding => binding.name === "DB" && binding.type === "d1" && typeof binding.id === "string" && binding.id.toLowerCase() === productionId)) blockers.push("LIVE_DATABASE_BINDING_MISMATCH");
  let liveVariablesPreservable = false;
  try { preservedProductionEnvironment(value(3)?.body); liveVariablesPreservable = true; } catch { blockers.push("LIVE_VARIABLE_PRESERVATION_UNAVAILABLE"); }
  const database = value(4);
  let pendingMigrations = null;
  if (!Array.isArray(database) || database.length !== 3 || database.some(result => result.success !== true || !Array.isArray(result.results))) blockers.push("DATABASE_INSPECTION_UNAVAILABLE");
  else {
    const tables = new Set(database[0].results.map(row => row.name));
    if (requiredTables.some(name => !tables.has(name))) blockers.push("REQUIRED_SCHEMA_MISSING");
    const applied = new Set(database[1].results.map(row => row.name));
    pendingMigrations = expectedMigrations.filter(name => !applied.has(name));
    if (pendingMigrations.length) blockers.push("PENDING_MIGRATIONS");
    const counts = database[2].results[0];
    if (!counts || !Number.isSafeInteger(counts.total) || counts.total < 0
      || !Number.isSafeInteger(counts.active_owners) || counts.active_owners < 0 || counts.active_owners > counts.total) blockers.push("OWNER_AGGREGATE_INVALID");
    else if (counts.active_owners === 0) blockers.push("NO_ACTIVE_OWNER");
  }
  const bookmark = value(5)?.bookmark;
  const validBookmark = typeof bookmark === "string" && bookmarkShape.test(bookmark);
  if (!validBookmark) blockers.push("ROLLBACK_BOOKMARK_UNAVAILABLE");
  const deployments = value(6);
  const validDates = Array.isArray(deployments) && deployments.length > 0 && deployments.every(item => item
    && typeof item.created_on === "string" && Number.isFinite(Date.parse(item.created_on)) && Date.parse(item.created_on) <= now().getTime() + 300_000);
  const latest = validDates ? [...deployments].sort((a, b) => Date.parse(b.created_on) - Date.parse(a.created_on))[0] : null;
  const validVersions = latest && uuid.test(latest.id ?? "") && Array.isArray(latest.versions) && latest.versions.length > 0
    && latest.versions.every(version => version && uuid.test(version.version_id ?? "") && typeof version.percentage === "number" && Number.isFinite(version.percentage) && version.percentage > 0 && version.percentage <= 100)
    && Math.abs(latest.versions.reduce((total, version) => total + version.percentage, 0) - 100) < 0.00001
    && new Set(latest.versions.map(version => version.version_id.toLowerCase())).size === latest.versions.length;
  const versionIds = validVersions ? latest.versions.map(version => version.version_id.toLowerCase()) : [];
  if (!validVersions) blockers.push("ROLLBACK_WORKER_VERSION_UNAVAILABLE");
  return { schema: "application-management.release-readiness/v1", observedAt: now().toISOString(), candidateRevision: env.GITHUB_SHA,
    liveRevision: /^[a-f0-9]{40}$/i.test(live?.revision ?? "") ? live.revision : null,
    liveAccessMode: ["account-session", "google-oauth+account-session"].includes(live?.accessMode) ? live.accessMode : null,
    readyForReleaseReview: blockers.length === 0, blockers, pendingMigrations, liveVariablesPreservable,
    rollback: { databaseBookmark: validBookmark ? bookmark : null, workerVersionIds: versionIds,
      workerDeploymentId: validVersions ? latest.id.toLowerCase() : null, workerDeployedAt: validVersions ? new Date(latest.created_on).toISOString() : null },
    publicationAuthorized: false, authenticatedOwnerAcceptance: "not-performed" };
}

async function main() {
  const env = process.env;
  const { productionId, accountId } = configuration(env);
  const directory = path.resolve(".sites-runtime/production-inspection");
  await fs.mkdir(directory, { recursive: true, mode: 0o700 });
  const configFile = path.join(directory, "wrangler.json");
  await fs.writeFile(configFile, JSON.stringify({ name: "application-management", compatibility_date: "2026-09-10", d1_databases: [{ binding: "DB", database_name: databaseName, database_id: productionId }] }), { mode: 0o600 });
  const execute = promisify(execFile);
  const runWrangler = async args => {
    const { stdout } = await execute(process.execPath, ["node_modules/wrangler/bin/wrangler.js", ...args, "--config", configFile], { timeout: 60_000, maxBuffer: 4 * 1024 * 1024, env: { ...env, CLOUDFLARE_ACCOUNT_ID: accountId, WRANGLER_SEND_METRICS: "false" } });
    return JSON.parse(stdout);
  };
  const expectedMigrations = (await fs.readdir("drizzle")).filter(name => name.endsWith(".sql")).sort();
  const report = await inspectProduction({ env, runWrangler, expectedMigrations });
  await fs.writeFile(path.join(directory, "readiness.json"), JSON.stringify(report, null, 2), { mode: 0o600 });
  console.log(JSON.stringify(report, null, 2));
  if (!report.readyForReleaseReview) process.exitCode = 2;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch(error => {
    const safeCodes = new Set(["DATABASE_BOUNDARY_INVALID", "PRODUCTION_ORIGIN_INVALID", "CLOUDFLARE_READ_ACCESS_NOT_CONFIGURED", "PRODUCTION_READBACK_NOT_CONFIGURED", "CANDIDATE_REVISION_INVALID"]);
    const code = safeCodes.has(error?.message) ? error.message : "INSPECTION_INTERNAL_ERROR";
    console.error(`PRODUCTION_INSPECTION_FAILED: ${code}; no write attempted.`);
    if (code === "CLOUDFLARE_READ_ACCESS_NOT_CONFIGURED") {
      const account = process.env.CLOUDFLARE_ACCOUNT_ID ?? "";
      const token = process.env.CLOUDFLARE_API_TOKEN ?? "";
      console.error(JSON.stringify({ configurationEvidence: {
        accountPresent: Boolean(account), accountTagShapeValid: /^[a-f0-9]{32}$/i.test(account),
        trimmedAccountTagShapeValid: /^[a-f0-9]{32}$/i.test(account.trim()),
        apiTokenPresent: Boolean(token.trim()), apiTokenLengthGatePasses: token.length >= 20,
        authorizationTestPerformed: false,
      } }));
    }
    process.exitCode = 1;
  });
}
