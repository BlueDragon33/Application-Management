import fs from "node:fs";

const LOCAL_D1_ID = "00000000-0000-0000-0000-000000000003";
const LEGACY_SITES_D1_ID = "1cf8f6b4-6c23-4479-8751-47703ecac92b";
const required = [
  "wrangler.cloudflare.example.jsonc",
  "wrangler.local.jsonc",
  "vite.config.ts",
  "worker/index.ts",
  "worker/preview-access.ts",
  "app/chatgpt-auth.ts",
  "app/client-origin.server.ts",
  "app/client-network-registry.ts",
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
const gate = fs.readFileSync("worker/preview-access.ts", "utf8");
const chatAuth = fs.readFileSync("app/chatgpt-auth.ts", "utf8");
const resolver = fs.readFileSync("app/client-origin.server.ts", "utf8");
const networkRegistry = fs.readFileSync("app/client-network-registry.ts", "utf8");
const prepare = fs.readFileSync("scripts/prepare-cloudflare-preview.mjs", "utf8");
const previewCi = fs.readFileSync(".github/workflows/cloudflare-preview-ci.yml", "utf8");
const deploy = fs.readFileSync(".github/workflows/deploy-application-management-preview.yml", "utf8");

for (const token of [
  '"name": "application-management-preview"',
  '"database_name": "application-management-preview-db"',
  '"binding": "DB"',
  '__APPLICATION_MANAGEMENT_PREVIEW_D1_DATABASE_ID__',
  '__CONTROL_OWNER_EMAILS__',
  '__APPLICATION_MANAGEMENT_BUILD_REVISION__',
  '"CONTROL_PLANE_NETWORK_MODE": "production"',
  '"global_fetch_strictly_public"',
]) {
  if (!template.includes(token)) throw new Error(`Cloudflare preview template thiếu: ${token}`);
}
if (template.includes("CF_ACCESS_TEAM_DOMAIN") || template.includes("CF_ACCESS_AUD")) throw new Error("Preview template không được phụ thuộc Cloudflare Zero Trust Access.");
if (template.includes("APPLICATION_MANAGEMENT_PREVIEW_ACCESS_SECRET")) throw new Error("Preview access secret không được nằm trong Wrangler vars/template.");
if (template.includes(LEGACY_SITES_D1_ID) || template.includes(LOCAL_D1_ID)) throw new Error("Preview template chứa D1 identity bị cấm.");
if (/"LOCAL_DEV_AUTH"\s*:/.test(template)) throw new Error("Preview template không được chứa LOCAL_DEV_AUTH.");

if (!local.includes(LOCAL_D1_ID) || local.includes(LEGACY_SITES_D1_ID)) {
  throw new Error("Local Application Management phải dùng local-only D1 identity, không dùng legacy Sites D1.");
}
for (const marker of ["CLOUDFLARE_VITE_WRANGLER_CONFIG_PATH", "configPath: cloudflareConfigPath", "application-management-local", LOCAL_D1_ID]) {
  if (!vite.includes(marker)) throw new Error(`Vite migration boundary thiếu: ${marker}`);
}
for (const marker of ['url.pathname === "/__deployment"', "databaseReady", "previewAccessConfigured", 'isPreview ? "application-preview-secret"']) {
  if (!worker.includes(marker)) throw new Error(`Worker thiếu preview deployment boundary: ${marker}`);
}

for (const marker of ["Authorization: Bearer <preview-secret>", "HMAC-SHA-256", "HttpOnly", "SameSite=Strict", "secretNeverInUrl", "oai-authenticated-user-email"]) {
  if (!gate.includes(marker)) throw new Error(`Application preview access gate thiếu: ${marker}`);
}
if (gate.includes("CF_ACCESS_") || chatAuth.includes("getCloudflareAccessUser")) throw new Error("Preview authentication vẫn còn phụ thuộc Cloudflare Access.");
if (!resolver.includes('ControlPlaneNetworkMode = "production" | "local" | "hybrid"')) throw new Error("Client resolver thiếu network-mode boundary.");
if (!resolver.includes("getClientNetworkSpec(applicationId)")) throw new Error("Client resolver chưa đọc shared network registry.");
for (const marker of ["BAUMAN_CONTROL_BASE_URL", "BAUMAN_APP_ORIGIN", "BOI_ECH_BASE_URL", "HEALTH_CARE_BASE_URL", "RU_LIFE_BASE_URL"]) {
  if (!networkRegistry.includes(marker)) throw new Error(`Client network registry thiếu: ${marker}`);
}

for (const marker of [LEGACY_SITES_D1_ID, LOCAL_D1_ID, "APPLICATION_MANAGEMENT_PRODUCTION_D1_DATABASE_ID", ".chatgpt.site", "CONTROL_OWNER_EMAILS"]) {
  if (!prepare.includes(marker)) throw new Error(`Preview materializer thiếu guard: ${marker}`);
}
if (!prepare.includes("APPLICATION_MANAGEMENT_PREVIEW_ACCESS_SECRET")) throw new Error("Preview materializer phải chặn việc nhúng preview secret vào vars.");

if (!deploy.includes("workflow_dispatch")) throw new Error("Application Management preview deploy phải manual-only.");
if (/\n\s*push\s*:/.test(deploy)) throw new Error("Application Management preview không được auto-deploy theo push.");
for (const token of [
  "DEPLOY_PREVIEW",
  "APPLICATION_MANAGEMENT_PREVIEW_D1_DATABASE_ID",
  "APPLICATION_MANAGEMENT_PRODUCTION_D1_DATABASE_ID",
  "APPLICATION_MANAGEMENT_PREVIEW_ACCESS_SECRET",
  "application-management-preview-db --remote",
  "CLOUDFLARE_VITE_WRANGLER_CONFIG_PATH: wrangler.cloudflare.jsonc",
  "npx wrangler secret put APPLICATION_MANAGEMENT_PREVIEW_ACCESS_SECRET",
  "npx wrangler deploy",
  "Expected anonymous /__deployment to return 401",
  "Application Management Cloudflare preview read-back PASS",
]) {
  if (!deploy.includes(token)) throw new Error(`Preview deploy workflow thiếu: ${token}`);
}
if (deploy.includes("CF_ACCESS_CLIENT_ID") || deploy.includes("CF_ACCESS_CLIENT_SECRET")) throw new Error("Preview deploy không được yêu cầu Zero Trust service token.");
if (deploy.includes("learning-management-db --remote")) throw new Error("Preview workflow không được migrate legacy/production database name.");
if (/\n\s*push\s*:/.test(previewCi)) throw new Error("Cloudflare preview CI không được là một đường auto-deploy trá hình; chỉ PR dry-run được phép.");
if (!previewCi.includes("--dry-run") || !previewCi.includes("validate:cloudflare-preview")) throw new Error("Preview CI phải dry-run và chạy migration boundary gate.");

if (fs.existsSync("wrangler.cloudflare.jsonc")) {
  const generated = fs.readFileSync("wrangler.cloudflare.jsonc", "utf8");
  if (/__[A-Z0-9_]+__/.test(generated)) throw new Error("Generated Cloudflare config còn placeholder.");
  if (generated.includes(LEGACY_SITES_D1_ID) || generated.includes(LOCAL_D1_ID) || generated.includes(".chatgpt.site")) {
    throw new Error("Generated Cloudflare config vi phạm preview isolation.");
  }
  if (/"LOCAL_DEV_AUTH"\s*:/.test(generated)) throw new Error("Generated Cloudflare config chứa LOCAL_DEV_AUTH.");
  if (generated.includes("APPLICATION_MANAGEMENT_PREVIEW_ACCESS_SECRET")) throw new Error("Generated Cloudflare config làm lộ preview access secret binding.");
}

console.log("Application Management Cloudflare migration gate PASS: app-level preview secret, local-only D1, isolated preview D1, manual deploy, runtime resolver and deployment read-back boundary present.");
