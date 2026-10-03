import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const page = fs.readFileSync("app/tools/deploy-ops/page.tsx", "utf8");
const source = fs.readFileSync("app/tools/deploy-ops/deploy-ops.tsx", "utf8");
const server = fs.readFileSync("app/deploy-ops.server.ts", "utf8");
const credentials = fs.readFileSync("app/deploy-ops-credentials.server.ts", "utf8");
const route = fs.readFileSync("app/api/deploy-ops/route.ts", "utf8");
const css = fs.readFileSync("app/tools/deploy-ops/deploy-ops.module.css", "utf8");
const dashboard = fs.readFileSync("app/management-dashboard-v2.tsx", "utf8");
const worker = fs.readFileSync("worker/index.ts", "utf8");
const migration = fs.readFileSync("drizzle/0006_deploy_ops.sql", "utf8");
const removalMigration = fs.readFileSync("drizzle/0008_remove_tinyfish.sql", "utf8");
const credentialMigration = fs.readFileSync("drizzle/0007_deploy_ops_credentials.sql", "utf8");
const adminClient = fs.readFileSync("app/admin-device-client.ts", "utf8");

test("Deploy & Ops is an authenticated canonical Vercel + Neon Tool", () => {
  assert.match(page, /requireChatGPTUser\("\/tools\/deploy-ops"\)/);
  assert.match(dashboard, /id: "tool-deploy-ops"/);
  assert.match(dashboard, /href: "\/tools\/deploy-ops"/);
  assert.match(source, /Vercel · Neon/);
  assert.doesNotMatch(source, /TinyFish/i);
  assert.match(adminClient, /deployOpsAction/);
  assert.match(adminClient, /"\/api\/deploy-ops"/);
});

test("provider credentials stay server-side and support only Vercel and Neon", () => {
  assert.doesNotMatch(source, /VERCEL_TOKEN|NEON_API_KEY/);
  assert.doesNotMatch(source, /fetch\s*\(/);
  assert.match(credentials, /export type DeployOpsProvider = "vercel" \| "neon"/);
  assert.match(credentials, /MANAGED_APP_CREDENTIAL_ENCRYPTION_KEY/);
  assert.match(credentials, /AES-GCM/);
  assert.match(credentials, /ENV_BY_PROVIDER/);
  assert.match(credentials, /source: "worker"/);
  assert.match(credentials, /source: value \? "vault"/);
  assert.match(credentials, /credential_ciphertext/);
  assert.match(credentials, /credential_iv/);
  assert.doesNotMatch(credentials, /tinyfish/i);
  assert.match(route, /save-provider-credential/);
  assert.match(route, /remove-provider-credential/);
  assert.match(route, /verifyControlProof/);
  assert.match(route, /actor\.role !== "owner"/);
  assert.match(source, /type="password"/);
  assert.match(source, /không trả plaintext về trình duyệt/);
});

test("Auto Discover lists Vercel and Neon resources without exposing credentials", () => {
  assert.match(server, /discoverDeployOpsResources/);
  assert.match(server, /\/v10\/projects\?limit=100/);
  assert.match(server, /NEON_API_ORIGIN\}\/projects\?limit=100/);
  assert.match(server, /discoverNeonBranches/);
  assert.match(server, /\/projects\/\$\{encodeURIComponent\(projectId\)\}\/branches/);
  assert.match(server, /vercelRegistrySuggestion/);
  assert.match(route, /action === "discover-resources"/);
  assert.match(route, /action === "discover-neon-branches"/);
  assert.match(source, /Auto Discover Vercel \+ Neon/);
  assert.match(source, /Không tự ghi mapping · Owner chọn rồi lưu/);
  assert.doesNotMatch(source, /credential\.value/);
});

test("live Vercel and Neon probes are SHA and branch based", () => {
  assert.match(server, /loadDeployOpsCredential\("vercel"\)/);
  assert.match(server, /loadDeployOpsCredential\("neon"\)/);
  assert.match(server, /\/v7\/deployments/);
  assert.match(server, /sha: sourceSha/);
  assert.match(server, /state: "READY"/);
  assert.match(server, /\/projects\/\$\{encodeURIComponent\(projectId\)\}\/branches/);
  assert.match(server, /text\(item\.id\) === wantedBranch \|\| text\(item\.name\) === wantedBranch/);
  assert.doesNotMatch(server, /tinyfish/i);
});

test("paid browser provider is fully retired from runtime and public routing", () => {
  assert.doesNotMatch(route, /tinyfish/i);
  assert.doesNotMatch(worker, /tinyfish/i);
  assert.equal(fs.existsSync("app/api/deploy-ops/tinyfish-webhook/route.ts"), false);
  assert.match(removalMigration, /DELETE FROM deploy_ops_credentials WHERE provider = 'tinyfish'/);
  assert.match(removalMigration, /DROP INDEX IF EXISTS deploy_ops_runs_tinyfish_run_idx/);
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

test("Deploy & Ops state and provider Vault are persisted in D1", () => {
  assert.match(migration, /CREATE TABLE IF NOT EXISTS `deploy_ops_targets`/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS `deploy_ops_runs`/);
  assert.match(credentialMigration, /CREATE TABLE IF NOT EXISTS `deploy_ops_credentials`/);
  assert.match(credentialMigration, /credential_ciphertext/);
  assert.match(credentialMigration, /credential_iv/);
  assert.match(server, /INSERT INTO deploy_ops_runs/);
  assert.match(credentials, /deploy_ops_credential_saved/);
  assert.match(credentials, /deploy_ops_credential_removed/);
  assert.match(worker, /SELECT provider FROM deploy_ops_credentials/);
});

test("Deploy & Ops UI is responsive for two providers", () => {
  assert.match(css, /\.vaultGrid/);
  assert.match(css, /\.discoveryGrid/);
  assert.match(css, /\.branchPicker/);
  assert.match(css, /grid-template-columns: repeat\(2, minmax\(0,1fr\)\)/);
  assert.match(css, /@media \(max-width: 980px\)/);
  assert.match(css, /@media \(max-width: 700px\)/);
});
