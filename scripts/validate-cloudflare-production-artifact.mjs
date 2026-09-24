import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const REDIRECT_PATH = path.join(ROOT, ".wrangler", "deploy", "config.json");
const EXPECTED_WORKER = "application-management";
const EXPECTED_DATABASE_NAME = "application-management-production-db";
const EXPECTED_CHANNEL = "cloudflare-production";

function fail(message) { throw new Error(message); }
function requiredEnv(name) {
  const value = String(process.env[name] ?? "").trim();
  if (!value) fail(`${name} is required to validate the generated production artifact.`);
  return value;
}
function readJson(filePath, label) {
  if (!fs.existsSync(filePath)) fail(`${label} does not exist: ${path.relative(ROOT, filePath)}`);
  try { return JSON.parse(fs.readFileSync(filePath, "utf8")); }
  catch (error) { fail(`${label} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`); }
}
function insideRoot(filePath, label) {
  const relative = path.relative(ROOT, filePath);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) fail(`${label} must resolve inside the repository.`);
  return relative.split(path.sep).join("/");
}

const expectedD1Id = requiredEnv("APPLICATION_MANAGEMENT_PRODUCTION_D1_DATABASE_ID").toLowerCase();
const previewD1Id = requiredEnv("APPLICATION_MANAGEMENT_PREVIEW_D1_DATABASE_ID").toLowerCase();
if (expectedD1Id === previewD1Id) fail("Generated production artifact must not reuse preview D1.");

const redirect = readJson(REDIRECT_PATH, "Wrangler generated-config redirect");
if (!redirect || typeof redirect !== "object" || Array.isArray(redirect) || typeof redirect.configPath !== "string" || !redirect.configPath.trim()) {
  fail(".wrangler/deploy/config.json must contain a non-empty configPath redirect.");
}
const generatedPath = path.resolve(path.dirname(REDIRECT_PATH), redirect.configPath);
const generatedRelative = insideRoot(generatedPath, "Generated Wrangler config");
if (!generatedRelative.startsWith("dist/")) fail(`Generated Wrangler config must live under dist/, got ${generatedRelative}.`);
const generated = readJson(generatedPath, "Generated Wrangler config");

if (generated.name !== EXPECTED_WORKER) fail(`Generated Worker name mismatch: expected ${EXPECTED_WORKER}, got ${String(generated.name)}.`);
const databases = Array.isArray(generated.d1_databases) ? generated.d1_databases : [];
const database = databases.find((item) => item && item.binding === "DB");
if (!database) fail("Generated production config is missing the DB D1 binding.");
if (String(database.database_name ?? "") !== EXPECTED_DATABASE_NAME) fail(`Generated production D1 name mismatch: expected ${EXPECTED_DATABASE_NAME}.`);
if (String(database.database_id ?? "").toLowerCase() !== expectedD1Id) fail("Generated production D1 id mismatch.");

const assets = generated.assets && typeof generated.assets === "object" && !Array.isArray(generated.assets) ? generated.assets : {};
if (assets.run_worker_first !== true) fail("Generated production artifact must set assets.run_worker_first=true.");
if (String(assets.binding ?? "") !== "ASSETS") fail("Generated production artifact must expose ASSETS binding.");

if (typeof assets.directory !== "string" || !assets.directory.trim()) {
  fail("Generated production artifact must include an assets.directory for the built client bundle.");
}
const generatedAssetsDirectory = path.resolve(path.dirname(generatedPath), assets.directory);
insideRoot(generatedAssetsDirectory, "Generated assets directory");
if (!fs.existsSync(generatedAssetsDirectory) || !fs.statSync(generatedAssetsDirectory).isDirectory()) {
  fail(`Generated assets directory does not exist: ${path.relative(ROOT, generatedAssetsDirectory)}.`);
}
const generatedAssetFiles = fs.readdirSync(generatedAssetsDirectory, { recursive: true })
  .filter((entry) => typeof entry === "string" && /\.(?:css|js)$/.test(entry));
if (!generatedAssetFiles.some((entry) => entry.endsWith(".css")) || !generatedAssetFiles.some((entry) => entry.endsWith(".js"))) {
  fail("Generated assets directory must contain both CSS and JavaScript bundles.");
}

const vars = generated.vars && typeof generated.vars === "object" && !Array.isArray(generated.vars) ? generated.vars : {};
if (vars.APPLICATION_MANAGEMENT_DEPLOYMENT_CHANNEL !== EXPECTED_CHANNEL) fail(`Generated production channel must be ${EXPECTED_CHANNEL}.`);
const revision = String(vars.APPLICATION_MANAGEMENT_BUILD_REVISION ?? "").trim();
if (!/^[0-9a-f]{7,64}$/i.test(revision)) fail("Generated production artifact is missing a valid git revision.");

if (typeof generated.main !== "string" || !generated.main.trim()) fail("Generated production config is missing Worker main.");
const generatedMain = path.resolve(path.dirname(generatedPath), generated.main);
insideRoot(generatedMain, "Generated Worker main");
if (!fs.existsSync(generatedMain)) fail(`Generated production Worker main does not exist: ${path.relative(ROOT, generatedMain)}.`);

const generatedText = fs.readFileSync(generatedPath, "utf8");
for (const forbidden of [
  "APPLICATION_MANAGEMENT_PREVIEW_ACCESS_SECRET",
  "APPLICATION_MANAGEMENT_INITIAL_ADMIN_PASSWORD",
  "APPLICATION_MANAGEMENT_PRODUCTION_READBACK_SECRET",
  ".chatgpt.site",
]) {
  if (generatedText.includes(forbidden)) fail(`Generated production artifact leaks or references forbidden value: ${forbidden}`);
}

console.log("Application Management generated Cloudflare production artifact PASS.");
console.log(`Redirect: ${path.relative(ROOT, REDIRECT_PATH)} -> ${generatedRelative}`);
console.log(`Worker: ${generated.name}`);
console.log(`D1: ${database.database_name}`);
console.log(`Channel: ${vars.APPLICATION_MANAGEMENT_DEPLOYMENT_CHANNEL}`);
