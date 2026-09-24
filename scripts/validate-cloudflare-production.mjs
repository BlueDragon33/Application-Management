import fs from "node:fs";

const LOCAL_D1_ID = "00000000-0000-0000-0000-000000000003";
const LEGACY_SITES_D1_ID = "1cf8f6b4-6c23-4479-8751-47703ecac92b";

function fail(message) {
  throw new Error(message);
}

function stringVar(source, key) {
  const match = source.match(new RegExp(`"${key}"\\s*:\\s*"([^"]*)"`));
  return match ? match[1].trim() : null;
}

function validOwnerEmails(value) {
  if (!value) return false;
  const emails = value.split(",").map((item) => item.trim()).filter(Boolean);
  return emails.length > 0 && emails.every((email) => /^[^\s@,]+@[^\s@,]+\.[^\s@,]+$/.test(email));
}

for (const file of [
  "wrangler.production.example.jsonc",
  "worker/production-auth.ts",
  "worker/index.ts",
]) {
  if (!fs.existsSync(file)) fail(`Missing production scaffold: ${file}`);
}

const template = fs.readFileSync("wrangler.production.example.jsonc", "utf8");
if (!/"run_worker_first"\s*:\s*true/.test(template)) fail("Production assets must run Worker authentication first.");
if (!/"binding"\s*:\s*"ASSETS"/.test(template)) fail("Production template must expose ASSETS binding.");
if (!template.includes('"APPLICATION_MANAGEMENT_DEPLOYMENT_CHANNEL": "cloudflare-production"')) fail("Production template must declare cloudflare-production channel.");

if (!fs.existsSync("wrangler.production.jsonc")) {
  console.error("CLOUDFLARE_PRODUCTION_NOT_CONFIGURED: run npm run cloudflare:production:prepare first.");
  process.exit(2);
}

const config = fs.readFileSync("wrangler.production.jsonc", "utf8");
if (/__[A-Z0-9_]+__/.test(config) || /replace-with-/.test(config)) fail("Production config still contains placeholders.");
if (config.includes(LOCAL_D1_ID) || config.includes(LEGACY_SITES_D1_ID)) fail("Production config references local or legacy Sites D1.");
if (config.includes(".chatgpt.site")) fail("Production config must not point clients to ChatGPT Sites.");
if (/"LOCAL_DEV_AUTH"\s*:/.test(config)) fail("Production must never contain LOCAL_DEV_AUTH.");
if (config.includes("APPLICATION_MANAGEMENT_PREVIEW_ACCESS_SECRET")) fail("Preview access secret must never enter Production.");
for (const secretName of [
  "APPLICATION_MANAGEMENT_INITIAL_ADMIN_PASSWORD",
  "APPLICATION_MANAGEMENT_PRODUCTION_READBACK_SECRET",
  "CONTROL_SERVICE_SECRET",
  "HEALTH_CONTROL_SERVICE_SECRET",
  "RU_LIFE_CONTROL_SERVICE_SECRET",
  "BAUMAN_CONTROL_SERVICE_SECRET",
]) {
  if (config.includes(secretName)) fail(`${secretName} must remain a Worker secret and never enter production vars.`);
}

if (stringVar(config, "CONTROL_PLANE_NETWORK_MODE") !== "production") fail("Production must use production network resolution.");
if (stringVar(config, "APPLICATION_MANAGEMENT_DEPLOYMENT_CHANNEL") !== "cloudflare-production") fail("Production deployment channel mismatch.");
if (!validOwnerEmails(stringVar(config, "CONTROL_OWNER_EMAILS"))) fail("Production owner policy is invalid.");

const production = String(process.env.APPLICATION_MANAGEMENT_PRODUCTION_D1_DATABASE_ID ?? "").trim().toLowerCase();
const preview = String(process.env.APPLICATION_MANAGEMENT_PREVIEW_D1_DATABASE_ID ?? "").trim().toLowerCase();
if (production && preview && production === preview) fail("Production D1 must not match preview D1.");

const auth = fs.readFileSync("worker/production-auth.ts", "utf8");
const iterationMatch = auth.match(/const PASSWORD_ITERATIONS = ([0-9_]+);/);
if (!iterationMatch) fail("Production auth must pin PASSWORD_ITERATIONS explicitly.");
const iterationCount = Number(iterationMatch[1].replaceAll("_", ""));
if (!Number.isInteger(iterationCount) || iterationCount < 1 || iterationCount > 100000) {
  fail(`Production PBKDF2 iterations must stay within the Cloudflare Workers ceiling of 100000; got ${iterationCount}.`);
}
for (const token of [
  "__Host-am_prod_session",
  "PBKDF2",
  "100_000",
  "SameSite=Strict",
  "HttpOnly",
  "MAX_FAILED_ATTEMPTS = 5",
  "LOCK_SECONDS = 15 * 60",
  "APPLICATION_MANAGEMENT_PRODUCTION_READBACK_SECRET",
]) {
  if (!auth.includes(token)) fail(`Production authentication guard missing: ${token}`);
}

console.log("Cloudflare production preflight PASS: isolated D1 + account auth + Worker-first assets + secret boundaries present.");
