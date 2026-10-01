import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const page = fs.readFileSync("app/tools/deploy-ops/page.tsx", "utf8");
const source = fs.readFileSync("app/tools/deploy-ops/deploy-ops.tsx", "utf8");
const server = fs.readFileSync("app/deploy-ops.server.ts", "utf8");
const route = fs.readFileSync("app/api/deploy-ops/route.ts", "utf8");
const webhook = fs.readFileSync("app/api/deploy-ops/tinyfish-webhook/route.ts", "utf8");
const css = fs.readFileSync("app/tools/deploy-ops/deploy-ops.module.css", "utf8");
const dashboard = fs.readFileSync("app/management-dashboard-v2.tsx", "utf8");
const worker = fs.readFileSync("worker/index.ts", "utf8");
const migration = fs.readFileSync("drizzle/0006_deploy_ops.sql", "utf8");
const adminClient = fs.readFileSync("app/admin-device-client.ts", "utf8");

test("Deploy & Ops is an authenticated canonical Tool", () => {
  assert.match(page, /requireChatGPTUser\("\/tools\/deploy-ops"\)/);
  assert.match(dashboard, /id: "tool-deploy-ops"/);
  assert.match(dashboard, /href: "\/tools\/deploy-ops"/);
  assert.match(source, /Vercel · Neon · TinyFish/);
  assert.match(adminClient, /deployOpsAction/);
  assert.match(adminClient, /"\/api\/deploy-ops"/);
});

test("provider credentials stay server-side", () => {
  assert.doesNotMatch(source, /VERCEL_TOKEN|NEON_API_KEY|TINYFISH_API_KEY/);
  assert.doesNotMatch(source, /fetch\s*\(/);
  assert.match(server, /secret\(env, "VERCEL_TOKEN"\)/);
  assert.match(server, /secret\(env, "NEON_API_KEY"\)/);
  assert.match(server, /secret\(env, "TINYFISH_API_KEY"\)/);
  assert.match(route, /verifyControlProof/);
  assert.match(route, /actor\.role !== "owner"/);
});

test("live Vercel and Neon probes are SHA and branch based", () => {
  assert.match(server, /\/v7\/deployments/);
  assert.match(server, /sha: sourceSha/);
  assert.match(server, /state: "READY"/);
  assert.match(server, /\/projects\/\$\{encodeURIComponent\(projectId\)\}\/branches/);
  assert.match(server, /text\(item\.id\) === wantedBranch \|\| text\(item\.name\) === wantedBranch/);
});

test("TinyFish evidence is verified rather than trusted from webhook", () => {
  assert.match(server, /\/v1\/automation\/run-async/);
  assert.match(server, /\/v1\/runs\/\$\{encodeURIComponent\(runId\)\}/);
  assert.match(server, /Never trust the webhook body as release evidence/);
  assert.match(server, /callback_nonce_hash/);
  assert.match(webhook, /acceptTinyFishWebhook/);
  assert.match(worker, /publicTinyFishWebhook/);
  assert.match(worker, /request\.method === "POST"/);
  assert.match(worker, /url\.pathname === "\/api\/deploy-ops\/tinyfish-webhook"/);
});

test("Safe Publish re-probes and promotes the exact Vercel deployment", () => {
  assert.match(server, /probeDeployOps\(appId, sourceSha\)/);
  assert.match(server, /SAFE_PUBLISH_BLOCKED/);
  assert.match(server, /PRODUCTION_AUTHORITY_REQUIRED/);
  assert.match(server, /\/v10\/projects\/\$\{encodeURIComponent\(projectId\)\}\/promote/);
  assert.match(server, /deploy_ops_safe_publish/);
  assert.match(source, /Safe Publish → Vercel Production/);
  assert.match(source, /window\.confirm/);
});

test("Deploy & Ops state is persisted in D1 with audit-friendly run history", () => {
  assert.match(migration, /CREATE TABLE IF NOT EXISTS `deploy_ops_targets`/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS `deploy_ops_runs`/);
  assert.match(migration, /callback_nonce_hash/);
  assert.match(server, /INSERT INTO deploy_ops_runs/);
  assert.match(server, /INSERT INTO control_audit_log/);
});

test("Deploy & Ops UI is responsive", () => {
  assert.match(css, /@media \(max-width: 980px\)/);
  assert.match(css, /@media \(max-width: 700px\)/);
});
