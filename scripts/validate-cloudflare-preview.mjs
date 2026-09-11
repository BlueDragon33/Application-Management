import fs from "node:fs";

const LOCAL_D1_ID = "00000000-0000-0000-0000-000000000003";
const LEGACY_SITES_D1_ID = "1cf8f6b4-6c23-4479-8751-47703ecac92b";
const required = [
  "wrangler.cloudflare.example.jsonc",
  "wrangler.local.jsonc",
  "vite.config.ts",
  "worker/index.ts",
  "app/cloudflare-access-auth.ts",
  "app/client-origin.server.ts",
  "scripts/prepare-cloudflare-preview.mjs",
  "docs/CLOUDFLARE_DEPLOYMENT_TRACK.md",
  ".github/workflows/application-management-ci.yml",
  ".github/workflows/cloudflare-preview-ci.yml",
  ".github/workflows/deploy-application-management-preview.yml",
];
for (const file of required) {
  if (!fs.existsSync(file)) throw new Error(`Thiếu Application Management Cloudflare scaffold: ${file}`);
}

const template = fs.readFileSync("wrangler.cloudflare.example.jsonc", "utf8");
const local = fs.readFileSync("wrangler.local.jsonc", "utf8");
const vite = fs.readFileSync("vite.config.ts", "utf8");
const worker = fs.readFileSync("worker/index.ts", "utf8");
const access = fs.readFileSync("app/cloudflare-access-auth.ts", "utf8");
const resolver = fs.readFileSync("app/client-origin.server.ts", "utf8");
const prepare = fs.readFileSync("scripts/prepare-cloudflare-preview.mjs", "utf8");
const previewCi = fs.readFileSync(".github/workflows/cloudflare-preview-ci.yml", "utf8");
const deploy = fs.readFileSync(".github/workflows/deploy-application-management-preview.yml", "utf8");

for (const token of [
  '"name": "application-management-preview"',
  '"database_name": "application-management-preview-db"',
  '"binding": "DB"',
  '__APPLICATION_MANAGEMENT_PREVIEW_D1_DATABASE_ID__',
  '__CONTROL_OWNER_EMAILS__',
  '__CF_ACCESS_TEAM_DOMAIN__',
  '__CF_ACCESS_AUD__',
  '__APPLICATION_MANAGEMENT_BUILD_REVISION__',
  '"CONTROL_PLANE_NETWORK_MODE": "production"',
]) {
  if (!template.includes(token)) throw new Error(`Cloudflare preview template thiếu: ${token}`);
}
if (template.includes(LEGACY_SITES_D1_ID) || template.includes(LOCAL_D1_ID)) throw new Error("Preview template chứa D1 identity bị cấm.");
if (/"LOCAL_DEV_AUTH"\s*:/.test(template)) throw new Error("Preview template không được chứa LOCAL_DEV_AUTH.");

if (!local.includes(LOCAL_D1_ID) || local.includes(LEGACY_SITES_D1_ID)) {
  throw new Error("Local Application Management phải dùng local-only D1 identity, không dùng legacy Sites D1.");
}
for (const marker of ["CLOUDFLARE_VITE_WRANGLER_CONFIG_PATH", "configPath: cloudflareConfigPath", "application-management-local", LOCAL_D1_ID]) {
  if (!vite.includes(marker)) throw new Error(`Vite migration boundary thiếu: ${marker}`);
}
if (!worker.includes('url.pathname === "/__deployment"') || !worker.includes("databaseReady") || !worker.includes("accessConfigured")) {
  throw new Error("Worker thiếu non-sensitive deployment readiness endpoint.");
}

for (const marker of ["cf-access-jwt-assertion", "CF_ACCESS_TEAM_DOMAIN", "CF_ACCESS_AUD", "RSASSA-PKCS1-v1_5", "exactAudienceRequired", "exactIssuerRequired"]) {
  if (!access.includes(marker)) throw new Error(`Cloudflare Access adapter thiếu: ${marker}`);
}
if (!resolver.includes('ControlPlaneNetworkMode = "production" | "local" | "hybrid"')) throw new Error("Client resolver thiếu network-mode boundary.");
for (const marker of ["BAUMAN_CONTROL_BASE_URL", "BAUMAN_APP_ORIGIN", "BOI_ECH_BASE_URL", "HEALTH_CARE_BASE_URL", "RU_LIFE_BASE_URL"]) {
  if (!resolver.includes(marker)) throw new Error(`Client resolver thiếu: ${marker}`);
}

for (const marker of [LEGACY_SITES_D1_ID, LOCAL_D1_ID, "APPLICATION_MANAGEMENT_PRODUCTION_D1_DATABASE_ID", ".chatgpt.site", "CONTROL_OWNER_EMAILS", "CF_ACCESS_TEAM_DOMAIN", "CF_ACCESS_AUD"]) {
  if (!prepare.includes(marker)) throw new Error(`Preview materializer thiếu guard: ${marker}`);
}

if (!deploy.includes("workflow_dispatch")) throw new Error("Application Management preview deploy phải manual-only.");
if (/\n\s*push\s*:/.test(deploy)) throw new Error("Application Management preview không được auto-deploy theo push.");
for (const token of [
  "DEPLOY_PREVIEW",
  "APPLICATION_MANAGEMENT_PREVIEW_D1_DATABASE_ID",
  "application-management-preview-db --remote",
  "CLOUDFLARE_VITE_WRANGLER_CONFIG_PATH=wrangler.cloudflare.jsonc",
  "CF_ACCESS_CLIENT_ID",
  "CF_ACCESS_CLIENT_SECRET",
  "wrangler deploy --config wrangler.cloudflare.jsonc",
]) {
  if (!deploy.includes(token)) throw new Error(`Preview deploy workflow thiếu: ${token}`);
}
if (deploy.includes("learning-management-db --remote")) throw new Error("Preview workflow không được migrate legacy/production database name.");
if (/\n\s*push\s*:/.test(previewCi)) throw new Error("Preview CI is allowed on PR/push only as dry-run; this guard checks deployment workflow separately.");
if (!previewCi.includes("--dry-run") || !previewCi.includes("validate:cloudflare-preview")) throw new Error("Preview CI phải dry-run và chạy migration boundary gate.");

if (fs.existsSync("wrangler.cloudflare.jsonc")) {
  const generated = fs.readFileSync("wrangler.cloudflare.jsonc", "utf8");
  if (/__[A-Z0-9_]+__/.test(generated)) throw new Error("Generated Cloudflare config còn placeholder.");
  if (generated.includes(LEGACY_SITES_D1_ID) || generated.includes(LOCAL_D1_ID) || generated.includes(".chatgpt.site")) {
    throw new Error("Generated Cloudflare config vi phạm preview isolation.");
  }
  if (/"LOCAL_DEV_AUTH"\s*:/.test(generated)) throw new Error("Generated Cloudflare config chứa LOCAL_DEV_AUTH.");
}

console.log("Application Management Cloudflare migration gate PASS: Access JWT, local-only D1, isolated preview D1, manual deploy, runtime resolver and deployment read-back boundary present.");
