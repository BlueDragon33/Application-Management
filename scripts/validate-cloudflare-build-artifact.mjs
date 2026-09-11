import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const REDIRECT_PATH = path.join(ROOT, ".wrangler", "deploy", "config.json");
const EXPECTED_WORKER = "application-management-preview";
const EXPECTED_DATABASE_NAME = "application-management-preview-db";
const EXPECTED_CHANNEL = "cloudflare-preview";
const LOCAL_D1_ID = "00000000-0000-0000-0000-000000000003";
const LEGACY_SITES_D1_ID = "1cf8f6b4-6c23-4479-8751-47703ecac92b";

function fail(message) {
  throw new Error(message);
}

function requiredEnv(name) {
  const value = String(process.env[name] ?? "").trim();
  if (!value) fail(`${name} is required to validate the generated preview artifact.`);
  return value;
}

function readJson(filePath, label) {
  if (!fs.existsSync(filePath)) fail(`${label} does not exist: ${path.relative(ROOT, filePath)}`);
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    fail(`${label} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function assertInsideRoot(filePath, label) {
  const relative = path.relative(ROOT, filePath);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    fail(`${label} must resolve inside the repository.`);
  }
  return relative.split(path.sep).join("/");
}

const expectedD1Id = requiredEnv("APPLICATION_MANAGEMENT_PREVIEW_D1_DATABASE_ID").toLowerCase();
if (expectedD1Id === LOCAL_D1_ID || expectedD1Id === LEGACY_SITES_D1_ID) {
  fail("Preview artifact validation received a forbidden D1 identity.");
}

const redirect = readJson(REDIRECT_PATH, "Wrangler generated-config redirect");
if (!redirect || typeof redirect !== "object" || Array.isArray(redirect) || typeof redirect.configPath !== "string" || !redirect.configPath.trim()) {
  fail(".wrangler/deploy/config.json must contain a non-empty configPath redirect.");
}

const generatedPath = path.resolve(path.dirname(REDIRECT_PATH), redirect.configPath);
const generatedRelative = assertInsideRoot(generatedPath, "Generated Wrangler config");
if (!generatedRelative.startsWith("dist/")) {
  fail(`Generated Wrangler config must live under dist/, got ${generatedRelative}.`);
}

const generatedText = fs.readFileSync(generatedPath, "utf8");
if (generatedText.includes(LOCAL_D1_ID)) fail("Generated Wrangler config references the local-only D1 placeholder.");
if (generatedText.includes(LEGACY_SITES_D1_ID)) fail("Generated Wrangler config references the legacy ChatGPT Sites D1.");

let generated;
try {
  generated = JSON.parse(generatedText);
} catch (error) {
  fail(`Generated Wrangler config is not valid JSON: ${error instanceof Error ? error.message : String(error)}`);
}

if (generated.name !== EXPECTED_WORKER) {
  fail(`Generated Worker name mismatch: expected ${EXPECTED_WORKER}, got ${String(generated.name)}.`);
}

const databases = Array.isArray(generated.d1_databases) ? generated.d1_databases : [];
const database = databases.find((item) => item && item.binding === "DB");
if (!database) fail("Generated Wrangler config is missing the DB D1 binding.");
if (String(database.database_name ?? "") !== EXPECTED_DATABASE_NAME) {
  fail(`Generated D1 database name mismatch: expected ${EXPECTED_DATABASE_NAME}.`);
}
if (String(database.database_id ?? "").toLowerCase() !== expectedD1Id) {
  fail("Generated D1 database id does not match APPLICATION_MANAGEMENT_PREVIEW_D1_DATABASE_ID.");
}

const vars = generated.vars && typeof generated.vars === "object" && !Array.isArray(generated.vars) ? generated.vars : {};
if (vars.APPLICATION_MANAGEMENT_DEPLOYMENT_CHANNEL !== EXPECTED_CHANNEL) {
  fail(`Generated deployment channel must be ${EXPECTED_CHANNEL}.`);
}
const revision = String(vars.APPLICATION_MANAGEMENT_BUILD_REVISION ?? "").trim();
if (!/^[0-9a-f]{7,64}$/i.test(revision)) {
  fail("Generated deployment artifact is missing a valid git build revision.");
}

if (typeof generated.main !== "string" || !generated.main.trim()) {
  fail("Generated Wrangler config is missing its Worker main entrypoint.");
}
const generatedMain = path.resolve(path.dirname(generatedPath), generated.main);
assertInsideRoot(generatedMain, "Generated Worker main entrypoint");
if (!fs.existsSync(generatedMain)) {
  fail(`Generated Worker main entrypoint does not exist: ${path.relative(ROOT, generatedMain)}.`);
}

console.log("Application Management generated Cloudflare deployment artifact PASS.");
console.log(`Redirect: ${path.relative(ROOT, REDIRECT_PATH)} -> ${generatedRelative}`);
console.log(`Worker: ${generated.name}`);
console.log(`D1: ${database.database_name}`);
console.log(`Channel: ${vars.APPLICATION_MANAGEMENT_DEPLOYMENT_CHANNEL}`);
