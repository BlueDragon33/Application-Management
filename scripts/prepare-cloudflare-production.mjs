import fs from "node:fs";

const TEMPLATE = "wrangler.production.example.jsonc";
const OUTPUT = "wrangler.production.jsonc";
const LOCAL_D1_ID = "00000000-0000-0000-0000-000000000003";
const LEGACY_SITES_D1_ID = "1cf8f6b4-6c23-4479-8751-47703ecac92b";

function text(name) {
  return String(process.env[name] ?? "").trim();
}

function required(name) {
  const value = text(name);
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function validD1(name) {
  const value = required(name).toLowerCase();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value)) {
    throw new Error(`${name} must be a real D1 UUID.`);
  }
  return value;
}

function productionD1Id() {
  const production = validD1("APPLICATION_MANAGEMENT_PRODUCTION_D1_DATABASE_ID");
  const preview = validD1("APPLICATION_MANAGEMENT_PREVIEW_D1_DATABASE_ID");
  if (production === preview) throw new Error("Production must never reuse the Application Management preview D1 database.");
  if (production === LOCAL_D1_ID) throw new Error("Production must never use the local D1 placeholder.");
  if (production === LEGACY_SITES_D1_ID) throw new Error("Production must never reuse the legacy ChatGPT Sites D1 database.");
  return production;
}

function exactHttpsOrigin(name, optional = true) {
  const raw = text(name).replace(/\/$/, "");
  if (!raw && optional) return "";
  if (!raw) throw new Error(`${name} is required.`);
  let url;
  try { url = new URL(raw); } catch { throw new Error(`${name} must be a valid URL.`); }
  if (url.protocol !== "https:" || url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
    throw new Error(`${name} must be an exact HTTPS origin without path, query, credentials or fragment.`);
  }
  if (url.hostname.endsWith(".chatgpt.site")) throw new Error(`${name} must not point to ChatGPT Sites in Cloudflare production.`);
  return url.origin;
}

function ownerEmails() {
  const values = required("CONTROL_OWNER_EMAILS")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  if (!values.length || values.some((value) => !/^[^\s@,]+@[^\s@,]+\.[^\s@,]+$/.test(value))) {
    throw new Error("CONTROL_OWNER_EMAILS must contain one or more comma-separated valid email addresses.");
  }
  return [...new Set(values)].join(",");
}

function revision() {
  const value = text("GITHUB_SHA") || text("APPLICATION_MANAGEMENT_BUILD_REVISION");
  if (!/^[0-9a-f]{7,64}$/i.test(value)) throw new Error("A Git revision is required for production deployment.");
  return value;
}

function safeReplacement(value, name) {
  if (/["\\\r\n]/.test(value)) throw new Error(`${name} contains characters that are unsafe for the JSONC template.`);
  return value;
}

const clients = {
  BOI_ECH_BASE_URL: exactHttpsOrigin("BOI_ECH_BASE_URL"),
  HEALTH_CARE_BASE_URL: exactHttpsOrigin("HEALTH_CARE_BASE_URL"),
  RU_LIFE_BASE_URL: exactHttpsOrigin("RU_LIFE_BASE_URL"),
  BAUMAN_CONTROL_BASE_URL: exactHttpsOrigin("BAUMAN_CONTROL_BASE_URL"),
  BAUMAN_APP_ORIGIN: exactHttpsOrigin("BAUMAN_APP_ORIGIN"),
  GROWUP_BASE_URL: exactHttpsOrigin("GROWUP_BASE_URL"),
};

if (Boolean(clients.BAUMAN_CONTROL_BASE_URL) !== Boolean(clients.BAUMAN_APP_ORIGIN)) {
  throw new Error("Bauman production must configure BAUMAN_CONTROL_BASE_URL and BAUMAN_APP_ORIGIN together.");
}
if (clients.BAUMAN_CONTROL_BASE_URL && clients.BAUMAN_CONTROL_BASE_URL === clients.BAUMAN_APP_ORIGIN) {
  throw new Error("Bauman Control and Learning Runtime must use separate production origins.");
}

let source = fs.readFileSync(TEMPLATE, "utf8");
const replacements = {
  __APPLICATION_MANAGEMENT_PRODUCTION_D1_DATABASE_ID__: productionD1Id(),
  __CONTROL_OWNER_EMAILS__: ownerEmails(),
  __APPLICATION_MANAGEMENT_BUILD_REVISION__: revision(),
  ...Object.fromEntries(Object.entries(clients).map(([key, value]) => [`__${key}__`, value])),
};

for (const [token, rawValue] of Object.entries(replacements)) {
  if (!source.includes(token)) throw new Error(`${TEMPLATE} is missing placeholder ${token}.`);
  source = source.replaceAll(token, safeReplacement(rawValue, token));
}

if (/__[A-Z0-9_]+__/.test(source)) throw new Error("Cloudflare production config still contains unresolved placeholders.");
if (/"LOCAL_DEV_AUTH"\s*:/.test(source)) throw new Error("LOCAL_DEV_AUTH must never be materialized into Cloudflare production.");
for (const secretName of [
  "APPLICATION_MANAGEMENT_INITIAL_ADMIN_PASSWORD",
  "APPLICATION_MANAGEMENT_PRODUCTION_READBACK_SECRET",
  "CONTROL_SERVICE_SECRET",
  "HEALTH_CONTROL_SERVICE_SECRET",
  "RU_LIFE_CONTROL_SERVICE_SECRET",
  "BAUMAN_CONTROL_SERVICE_SECRET",
]) {
  if (source.includes(secretName)) throw new Error(`${secretName} must remain a Worker secret and never enter Wrangler vars.`);
}
if (source.includes(LEGACY_SITES_D1_ID) || source.includes(LOCAL_D1_ID)) throw new Error("Generated production config references a forbidden D1 identity.");
if (source.includes(".chatgpt.site")) throw new Error("Generated production config contains a ChatGPT Sites fallback.");

fs.writeFileSync(OUTPUT, source);
console.log("Application Management Cloudflare production config materialized safely.");
console.log("Worker: application-management");
console.log("D1: application-management-production-db (isolated production database)");
console.log(`Configured client origins: ${Object.entries(clients).filter(([, value]) => value).map(([key]) => key).join(", ") || "none"}`);
