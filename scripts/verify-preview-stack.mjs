const mode = process.argv[2] ?? "full-stack";
if (!new Set(["phase-a", "full-stack"]).has(mode)) throw new Error(`Unsupported mode: ${mode}`);

const timeoutMs = 8000;

function env(name, required = true) {
  const value = (process.env[name] ?? "").trim();
  if (required && !value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function previewOrigin(name, required = true) {
  const value = env(name, required);
  if (!value) return "";
  let url;
  try { url = new URL(value); } catch { throw new Error(`${name} must be a valid URL.`); }
  if (url.protocol !== "https:" || url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
    throw new Error(`${name} must be an HTTPS origin with no path/query/hash.`);
  }
  if (url.hostname === "chatgpt.site" || url.hostname.endsWith(".chatgpt.site")) {
    throw new Error(`${name} must not use a chatgpt.site fallback.`);
  }
  return url.origin;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function request(url, init = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { redirect: "manual", cache: "no-store", ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function json(response, label) {
  assert(response.ok, `${label} returned HTTP ${response.status}.`);
  const type = response.headers.get("content-type") ?? "";
  assert(type.includes("application/json"), `${label} did not return JSON.`);
  return response.json();
}

function serviceHeaders(secret, origin) {
  return {
    authorization: `Bearer ${secret}`,
    origin,
    "x-control-actor": "preview-verifier@application-management.invalid",
    "x-control-role": "viewer",
  };
}

async function verifyCors(origin, path, secret, centralOrigin, label) {
  const response = await request(`${origin}${path}`, {
    method: "OPTIONS",
    headers: {
      origin: centralOrigin,
      "access-control-request-method": "GET",
      "access-control-request-headers": "authorization, content-type",
      authorization: `Bearer ${secret}`,
    },
  });
  assert(response.status === 204, `${label} CORS preflight returned HTTP ${response.status}.`);
  assert(response.headers.get("access-control-allow-origin") === centralOrigin, `${label} CORS did not echo the exact Application Management origin.`);
}

const centralOrigin = previewOrigin("APPLICATION_MANAGEMENT_PREVIEW_ORIGIN");
const accessClientId = env("CF_ACCESS_CLIENT_ID");
const accessClientSecret = env("CF_ACCESS_CLIENT_SECRET");
const accessHeaders = { "CF-Access-Client-Id": accessClientId, "CF-Access-Client-Secret": accessClientSecret };

const anonymous = await request(`${centralOrigin}/__deployment`);
assert(anonymous.status !== 200, "Application Management /__deployment must not be anonymously readable through Cloudflare Access.");

const central = await json(await request(`${centralOrigin}/__deployment`, { headers: accessHeaders }), "Application Management /__deployment");
assert(central.application === "application-management", "Unexpected Application Management deployment identity.");
assert(central.runtime === "control-plane", "Application Management runtime identity is not control-plane.");
assert(central.channel === "cloudflare-preview", "Application Management is not running the cloudflare-preview channel.");
assert(central.databaseReady === true, "Application Management preview D1 is not ready.");
assert(central.accessConfigured === true, "Application Management Cloudflare Access configuration is incomplete.");
assert(central.ownerPolicyConfigured === true, "Application Management owner policy is not configured.");
assert(central.networkMode === "production", "Application Management preview must use production network mode for real client origins.");
console.log("PASS Application Management preview deployment/access/D1");

if (mode === "phase-a") {
  console.log("PASS phase-a preview verification (read-only)");
  process.exit(0);
}

const boiOrigin = previewOrigin("BOI_ECH_PREVIEW_ORIGIN");
const healthOrigin = previewOrigin("HEALTH_CARE_PREVIEW_ORIGIN");
const ruOrigin = previewOrigin("RU_LIFE_PREVIEW_ORIGIN");
const baumanControlOrigin = previewOrigin("BAUMAN_CONTROL_PREVIEW_ORIGIN");
const baumanRuntimeOrigin = previewOrigin("BAUMAN_RUNTIME_PREVIEW_ORIGIN");
assert(baumanControlOrigin !== baumanRuntimeOrigin, "Bauman Control and Learning Runtime origins must remain separate.");

const boiSecret = env("CONTROL_SERVICE_SECRET");
const healthSecret = env("HEALTH_CONTROL_SERVICE_SECRET");
const ruSecret = env("RU_LIFE_CONTROL_SERVICE_SECRET");
const baumanSecret = env("BAUMAN_CONTROL_SERVICE_SECRET");
for (const [name, secret] of [["CONTROL_SERVICE_SECRET", boiSecret], ["HEALTH_CONTROL_SERVICE_SECRET", healthSecret], ["RU_LIFE_CONTROL_SERVICE_SECRET", ruSecret], ["BAUMAN_CONTROL_SERVICE_SECRET", baumanSecret]]) {
  assert(secret.length >= 32, `${name} must be at least 32 characters.`);
}

await verifyCors(boiOrigin, "/api/control/status", boiSecret, centralOrigin, "Bơi ếch");
const boi = await json(await request(`${boiOrigin}/api/control/status`, { headers: serviceHeaders(boiSecret, centralOrigin) }), "Bơi ếch status");
assert(boi.application === "boi-ech", "Unexpected Bơi ếch application identity.");
assert(boi.deployment?.channel === "cloudflare-preview", "Bơi ếch is not on cloudflare-preview.");
assert(boi.deployment?.paymentStorageReady === true, "Bơi ếch preview R2 payment storage is not ready.");
console.log("PASS Bơi ếch status/CORS/D1/R2");

await verifyCors(healthOrigin, "/api/control/status", healthSecret, centralOrigin, "Health_Care");
const health = await json(await request(`${healthOrigin}/api/control/status`, { headers: serviceHeaders(healthSecret, centralOrigin) }), "Health_Care status");
assert(health.ok === true, "Health_Care status is not healthy.");
assert(health.controlAuth?.secretScope === "health", "Health_Care app-scoped control secret is not active.");
console.log("PASS Health_Care status/CORS/control secret");

await verifyCors(ruOrigin, "/api/control/status", ruSecret, centralOrigin, "RU_LIFE");
const ru = await json(await request(`${ruOrigin}/api/control/status`, { headers: serviceHeaders(ruSecret, centralOrigin) }), "RU_LIFE status");
assert(ru.application === "ru-life", "Unexpected RU_LIFE application identity.");
assert(ru.appId === "hoa-nhap-nga", "Unexpected RU_LIFE appId.");
assert(ru.deployment?.channel === "cloudflare-preview", "RU_LIFE is not on cloudflare-preview.");
assert(ru.ownership?.centralRole === "policy-and-remote-admin-only", "RU_LIFE ownership boundary is not preserved.");
console.log("PASS RU_LIFE status/CORS/ownership");

const baumanControl = await json(await request(`${baumanControlOrigin}/__deployment`, { headers: { authorization: `Bearer ${baumanSecret}`, origin: centralOrigin } }), "Bauman Control /__deployment");
assert(baumanControl.application === "bauman-master-ai" && baumanControl.runtime === "control-service", "Unexpected Bauman Control deployment identity.");
assert(baumanControl.channel === "cloudflare-preview", "Bauman Control is not on cloudflare-preview.");
assert(baumanControl.databaseReady === true, "Bauman Control preview D1 is not ready.");
assert(baumanControl.applicationManagementOriginConfigured === true, "Bauman Control is missing Application Management origin.");
assert(baumanControl.appOriginConfigured === true, "Bauman Control is missing Learning Runtime origin.");

const baumanRuntime = await json(await request(`${baumanRuntimeOrigin}/__deployment`), "Bauman Runtime /__deployment");
assert(baumanRuntime.application === "bauman-master-ai" && baumanRuntime.runtime === "learning-runtime", "Unexpected Bauman Learning Runtime deployment identity.");
assert(baumanRuntime.channel === "cloudflare-preview", "Bauman Learning Runtime is not on cloudflare-preview.");
assert(baumanRuntime.controlOriginConfigured === true, "Bauman Learning Runtime is missing Control origin.");
console.log("PASS Bauman Control/Learning Runtime linkage");

assert(central.clients?.boiEch === true, "Application Management does not report Bơi ếch origin configured.");
assert(central.clients?.healthCare === true, "Application Management does not report Health_Care origin configured.");
assert(central.clients?.ruLife === true, "Application Management does not report RU_LIFE origin configured.");
assert(central.clients?.baumanControl === true, "Application Management does not report Bauman Control origin configured.");
assert(central.clients?.baumanRuntime === true, "Application Management does not report Bauman Runtime origin configured.");
assert(central.clients?.growUp === false, "GrowUP must remain unconfigured until a verified preview contract exists.");

console.log("PASS full-stack preview verification (read-only)");
