import fs from "node:fs";

const LOCAL_D1_ID = "00000000-0000-0000-0000-000000000003";
const LEGACY_SITES_D1_ID = "1cf8f6b4-6c23-4479-8751-47703ecac92b";
const requiredLocal = [
  "wrangler.cloudflare.example.jsonc",
  "worker/preview-access.ts",
  "docs/CLOUDFLARE_DEPLOYMENT_TRACK.md",
];
for (const file of requiredLocal) {
  if (!fs.existsSync(file)) throw new Error(`Thiếu Cloudflare scaffold: ${file}`);
}

function stringVar(source, key) {
  const match = source.match(new RegExp(`"${key}"\\s*:\\s*"([^"]*)"`));
  return match ? match[1].trim() : null;
}

function isHttpsOrigin(value) {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:"
      && url.origin === value.replace(/\/$/, "")
      && url.pathname === "/"
      && !url.username
      && !url.password
      && !url.search
      && !url.hash;
  } catch {
    return false;
  }
}

function validOwnerEmails(value) {
  if (!value) return false;
  const emails = value.split(",").map((item) => item.trim()).filter(Boolean);
  return emails.length > 0 && emails.every((email) => /^[^\s@,]+@[^\s@,]+\.[^\s@,]+$/.test(email));
}

const template = fs.readFileSync("wrangler.cloudflare.example.jsonc", "utf8");
if (/"LOCAL_DEV_AUTH"\s*:/.test(template)) throw new Error("Cloudflare template tuyệt đối không được cấu hình LOCAL_DEV_AUTH.");
if (template.includes("CF_ACCESS_TEAM_DOMAIN") || template.includes("CF_ACCESS_AUD")) throw new Error("Cloudflare template không được phụ thuộc Zero Trust Access.");
if (template.includes("APPLICATION_MANAGEMENT_PREVIEW_ACCESS_SECRET")) throw new Error("Preview access secret phải là Worker secret, không được nằm trong vars/template.");
for (const key of ["BAUMAN_CONTROL_BASE_URL", "BAUMAN_APP_ORIGIN"]) {
  if (stringVar(template, key) === null) throw new Error(`Cloudflare template thiếu ${key}.`);
}

if (!fs.existsSync("wrangler.cloudflare.jsonc")) {
  console.error("CLOUDFLARE_NOT_CONFIGURED: chạy npm run cloudflare:preview:prepare để tạo config preview đã kiểm tra.");
  process.exit(2);
}

const config = fs.readFileSync("wrangler.cloudflare.jsonc", "utf8");
if (/__[A-Z0-9_]+__/.test(config) || /replace-with-/.test(config)) {
  console.error("CLOUDFLARE_PLACEHOLDER_CONFIG: wrangler.cloudflare.jsonc vẫn còn placeholder.");
  process.exit(2);
}
if (config.includes(LOCAL_D1_ID) || config.includes(LEGACY_SITES_D1_ID)) {
  throw new Error("CLOUDFLARE_D1_BOUNDARY_VIOLATION: preview đang tham chiếu local hoặc legacy Sites D1.");
}
if (config.includes(".chatgpt.site")) throw new Error("CLOUDFLARE_CHATGPT_FALLBACK_FORBIDDEN: preview không được trỏ client về ChatGPT Sites.");
if (/"LOCAL_DEV_AUTH"\s*:/.test(config)) throw new Error("CLOUDFLARE_LOCAL_AUTH_FORBIDDEN: không được deploy local auth lên Cloudflare.");
if (config.includes("APPLICATION_MANAGEMENT_PREVIEW_ACCESS_SECRET")) throw new Error("CLOUDFLARE_PREVIEW_SECRET_EXPOSED: preview access secret không được materialize vào vars.");
if (stringVar(config, "CONTROL_PLANE_NETWORK_MODE") !== "production") {
  throw new Error("CLOUDFLARE_NETWORK_MODE_REQUIRED: Cloudflare preview phải dùng production resolver, không localhost fallback.");
}
if (stringVar(config, "APPLICATION_MANAGEMENT_DEPLOYMENT_CHANNEL") !== "cloudflare-preview") {
  throw new Error("CLOUDFLARE_DEPLOYMENT_CHANNEL_INVALID: config preview phải tự nhận dạng cloudflare-preview.");
}

const ownerEmails = stringVar(config, "CONTROL_OWNER_EMAILS");
if (!validOwnerEmails(ownerEmails)) throw new Error("CLOUDFLARE_OWNER_POLICY_INVALID: CONTROL_OWNER_EMAILS không hợp lệ.");

for (const key of ["BOI_ECH_BASE_URL", "HEALTH_CARE_BASE_URL", "RU_LIFE_BASE_URL", "BAUMAN_CONTROL_BASE_URL", "BAUMAN_APP_ORIGIN", "GROWUP_BASE_URL"]) {
  const value = stringVar(config, key);
  if (value === null) throw new Error(`Cloudflare config thiếu ${key}.`);
  if (value && !isHttpsOrigin(value)) throw new Error(`${key} phải là HTTPS exact origin.`);
}

const baumanControl = stringVar(config, "BAUMAN_CONTROL_BASE_URL");
const baumanRuntime = stringVar(config, "BAUMAN_APP_ORIGIN");
if (Boolean(baumanControl) !== Boolean(baumanRuntime)) {
  throw new Error("CLOUDFLARE_BAUMAN_ORIGINS_INCOMPLETE: khi bật Bauman phải cấu hình cả Control Service và Learning Runtime.");
}
if (baumanControl && baumanControl === baumanRuntime) {
  throw new Error("CLOUDFLARE_BAUMAN_ORIGINS_COLLIDE: Learning Runtime không được dùng cùng origin với Control Service.");
}

const gate = fs.readFileSync("worker/preview-access.ts", "utf8");
for (const token of ["APPLICATION_MANAGEMENT", "Authorization: Bearer <preview-secret>", "HMAC-SHA-256", "HttpOnly", "SameSite=Strict", "secretNeverInUrl"]) {
  if (!gate.includes(token)) throw new Error(`Application preview access gate thiếu: ${token}`);
}

console.log("Cloudflare preflight PASS: isolated preview D1 + application secret gate + owner policy + client HTTPS boundary + Bauman dual-origin boundary present.");
