import { pathToFileURL } from "node:url";

const MODES = new Set(["phase-a", "full-stack"]);
const READ_ONLY_METHODS = new Set(["GET", "OPTIONS"]);
const REQUEST_TIMEOUT_MS = 15_000;

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

export function normalizePreviewOrigin(name, value, { required = true } = {}) {
  const raw = typeof value === "string" ? value.trim().replace(/\/$/, "") : "";
  if (!raw) {
    if (required) throw new Error(`${name} is required.`);
    return "";
  }
  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error(`${name} must be a valid URL.`);
  }
  if (parsed.protocol !== "https:" || parsed.username || parsed.password || parsed.pathname !== "/" || parsed.search || parsed.hash) {
    throw new Error(`${name} must be a bare HTTPS origin.`);
  }
  const host = parsed.hostname.toLowerCase();
  if (host === "chatgpt.site" || host.endsWith(".chatgpt.site")) {
    throw new Error(`${name} must not use ChatGPT Sites.`);
  }
  return parsed.origin;
}

function requireSecret(name, value) {
  const secret = typeof value === "string" ? value : "";
  if (secret.length < 32) throw new Error(`${name} must be configured with at least 32 characters.`);
  return secret;
}

function modeFromArgv(argv) {
  const entry = argv.find((item) => item.startsWith("--mode="));
  const mode = entry ? entry.slice("--mode=".length) : "full-stack";
  if (!MODES.has(mode)) throw new Error(`Unsupported verifier mode: ${mode}`);
  return mode;
}

function accessHeaders(env) {
  const clientId = requireSecret("CF_ACCESS_CLIENT_ID", env.CF_ACCESS_CLIENT_ID);
  const clientSecret = requireSecret("CF_ACCESS_CLIENT_SECRET", env.CF_ACCESS_CLIENT_SECRET);
  return {
    "CF-Access-Client-Id": clientId,
    "CF-Access-Client-Secret": clientSecret,
  };
}

async function readOnlyRequest(fetchImpl, url, init = {}) {
  const method = String(init.method ?? "GET").toUpperCase();
  if (!READ_ONLY_METHODS.has(method)) throw new Error(`Preview verifier refuses non-read-only HTTP method: ${method}`);
  const options = {
    ...init,
    method,
    redirect: "manual",
    signal: init.signal ?? AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  };
  return fetchImpl(url, options);
}

async function jsonRequest(fetchImpl, url, init, label) {
  const response = await readOnlyRequest(fetchImpl, url, init);
  invariant(response.status === 200, `${label} returned HTTP ${response.status}, expected 200.`);
  let value;
  try {
    value = await response.json();
  } catch {
    throw new Error(`${label} did not return valid JSON.`);
  }
  invariant(value && typeof value === "object", `${label} returned an invalid JSON payload.`);
  return { response, value };
}

function assertCloudflarePreviewDeployment(label, deployment) {
  invariant(deployment && typeof deployment === "object", `${label} deployment metadata is missing.`);
  invariant(deployment.channel === "cloudflare-preview", `${label} is not running in cloudflare-preview channel.`);
  invariant(typeof deployment.revision === "string" && deployment.revision.length > 0 && deployment.revision !== "unknown", `${label} build revision is missing.`);
}

async function verifyCentral(mode, env, fetchImpl) {
  const origin = normalizePreviewOrigin("APPLICATION_MANAGEMENT_PREVIEW_ORIGIN", env.APPLICATION_MANAGEMENT_PREVIEW_ORIGIN);
  const access = accessHeaders(env);

  const anonymous = await readOnlyRequest(fetchImpl, `${origin}/__deployment`, { headers: { "cache-control": "no-cache" } });
  invariant(anonymous.status !== 200, "Anonymous request reached Application Management; Cloudflare Access is not enforcing the preview origin.");

  const { value } = await jsonRequest(fetchImpl, `${origin}/__deployment`, { headers: access }, "Application Management /__deployment");
  invariant(value.application === "application-management", "Application Management deployment identity mismatch.");
  invariant(value.runtime === "control-plane", "Application Management runtime identity mismatch.");
  invariant(value.channel === "cloudflare-preview", "Application Management deployment channel mismatch.");
  invariant(typeof value.revision === "string" && value.revision.length > 0 && value.revision !== "unknown", "Application Management build revision is missing.");
  invariant(value.databaseReady === true, "Application Management preview D1 schema is not ready.");
  invariant(value.accessConfigured === true, "Application Management Cloudflare Access adapter is not configured.");
  invariant(value.ownerPolicyConfigured === true, "Application Management owner policy is not configured.");
  invariant(value.networkMode === "production", "Application Management preview must use production network resolution.");
  invariant(value.clients && typeof value.clients === "object", "Application Management client readiness map is missing.");
  invariant(value.clients.growUp === false, "GrowUP must remain unconfigured until a verified preview contract exists.");

  const managedKeys = ["boiEch", "healthCare", "ruLife", "baumanControl", "baumanRuntime"];
  if (mode === "phase-a") {
    for (const key of managedKeys) invariant(value.clients[key] === false, `Phase A requires ${key} origin to remain blank.`);
  } else {
    for (const key of managedKeys) invariant(value.clients[key] === true, `Full-stack verification requires ${key} origin to be configured.`);
  }

  return { origin, access, deployment: value };
}

async function verifyCors(fetchImpl, label, clientOrigin, centralOrigin, access) {
  const response = await readOnlyRequest(fetchImpl, `${clientOrigin}/api/control/status`, {
    method: "OPTIONS",
    headers: {
      ...access,
      Origin: centralOrigin,
      "Access-Control-Request-Method": "GET",
      "Access-Control-Request-Headers": "authorization",
    },
  });
  invariant(response.status === 204, `${label} control preflight returned HTTP ${response.status}, expected 204.`);
  invariant(response.headers.get("access-control-allow-origin") === centralOrigin, `${label} did not echo the exact Application Management origin.`);
}

async function verifyRuntimeRoot(fetchImpl, label, origin, access) {
  const response = await readOnlyRequest(fetchImpl, `${origin}/`, { headers: access });
  invariant(response.status >= 200 && response.status < 400, `${label} user runtime root returned HTTP ${response.status}.`);
}

async function verifyControlStatus(fetchImpl, label, origin, centralOrigin, secret, access) {
  const result = await jsonRequest(fetchImpl, `${origin}/api/control/status`, {
    headers: {
      ...access,
      Origin: centralOrigin,
      Authorization: `Bearer ${secret}`,
      "x-control-actor": "preview-readonly-verifier@application-management.local",
      "x-control-role": "viewer",
    },
  }, `${label} /api/control/status`);
  invariant(result.response.headers.get("access-control-allow-origin") === centralOrigin, `${label} status response CORS origin mismatch.`);
  return result.value;
}

async function verifyFullStack(env, fetchImpl, central) {
  const boiOrigin = normalizePreviewOrigin("BOI_ECH_PREVIEW_ORIGIN", env.BOI_ECH_PREVIEW_ORIGIN);
  const healthOrigin = normalizePreviewOrigin("HEALTH_CARE_PREVIEW_ORIGIN", env.HEALTH_CARE_PREVIEW_ORIGIN);
  const ruOrigin = normalizePreviewOrigin("RU_LIFE_PREVIEW_ORIGIN", env.RU_LIFE_PREVIEW_ORIGIN);
  const baumanControlOrigin = normalizePreviewOrigin("BAUMAN_CONTROL_PREVIEW_ORIGIN", env.BAUMAN_CONTROL_PREVIEW_ORIGIN);
  const baumanRuntimeOrigin = normalizePreviewOrigin("BAUMAN_RUNTIME_PREVIEW_ORIGIN", env.BAUMAN_RUNTIME_PREVIEW_ORIGIN);

  const boiSecret = requireSecret("CONTROL_SERVICE_SECRET", env.CONTROL_SERVICE_SECRET);
  const healthSecret = requireSecret("HEALTH_CONTROL_SERVICE_SECRET", env.HEALTH_CONTROL_SERVICE_SECRET);
  const ruSecret = requireSecret("RU_LIFE_CONTROL_SERVICE_SECRET", env.RU_LIFE_CONTROL_SERVICE_SECRET);
  const baumanSecret = requireSecret("BAUMAN_CONTROL_SERVICE_SECRET", env.BAUMAN_CONTROL_SERVICE_SECRET);

  await Promise.all([
    verifyRuntimeRoot(fetchImpl, "Bơi ếch", boiOrigin, central.access),
    verifyRuntimeRoot(fetchImpl, "Sức khỏe Y tế", healthOrigin, central.access),
    verifyRuntimeRoot(fetchImpl, "Hòa nhập Nga", ruOrigin, central.access),
    verifyRuntimeRoot(fetchImpl, "Bauman Learning Runtime", baumanRuntimeOrigin, central.access),
  ]);

  await Promise.all([
    verifyCors(fetchImpl, "Bơi ếch", boiOrigin, central.origin, central.access),
    verifyCors(fetchImpl, "Sức khỏe Y tế", healthOrigin, central.origin, central.access),
    verifyCors(fetchImpl, "Hòa nhập Nga", ruOrigin, central.origin, central.access),
    verifyCors(fetchImpl, "Bauman Control", baumanControlOrigin, central.origin, central.access),
  ]);

  const [boi, health, ru, baumanControl, healthContract, baumanRuntime] = await Promise.all([
    verifyControlStatus(fetchImpl, "Bơi ếch", boiOrigin, central.origin, boiSecret, central.access),
    verifyControlStatus(fetchImpl, "Sức khỏe Y tế", healthOrigin, central.origin, healthSecret, central.access),
    verifyControlStatus(fetchImpl, "Hòa nhập Nga", ruOrigin, central.origin, ruSecret, central.access),
    verifyControlStatus(fetchImpl, "Bauman Control", baumanControlOrigin, central.origin, baumanSecret, central.access),
    jsonRequest(fetchImpl, `${healthOrigin}/api/control/contract`, { headers: central.access }, "Health control contract").then((item) => item.value),
    jsonRequest(fetchImpl, `${baumanRuntimeOrigin}/__deployment`, { headers: central.access }, "Bauman Learning Runtime /__deployment").then((item) => item.value),
  ]);

  invariant(boi.application === "boi-ech" && boi.protocol === "boi-ech-control-v1", "Bơi ếch control identity mismatch.");
  assertCloudflarePreviewDeployment("Bơi ếch", boi.deployment);
  invariant(boi.deployment.paymentStorageReady === true, "Bơi ếch preview R2 payment storage is not ready.");
  invariant(boi.ownership?.centralRole === "policy-and-remote-admin-only", "Bơi ếch ownership boundary mismatch.");

  invariant(health.controlAuth?.secretScope === "health", "Health app-scoped control secret is not active.");
  invariant(Array.isArray(health.capabilities) && health.capabilities.includes("app-scoped-secret-v1"), "Health control capability contract is incomplete.");
  invariant(typeof health.buildRevision === "string" && health.buildRevision.length > 0, "Health build revision is missing.");
  invariant(healthContract.application === "health-care" && healthContract.canonicalApplication === "health-care", "Health management contract identity mismatch.");
  invariant(healthContract.siteOrigin === healthOrigin, "Health contract siteOrigin does not match the configured preview origin.");
  invariant(healthContract.boundary?.healthDataInControlPlane === false && healthContract.boundary?.profileDataInControlPlane === false, "Health privacy boundary contract is invalid.");

  invariant(ru.application === "ru-life" && ru.appId === "hoa-nhap-nga" && ru.protocol === "ru-life-control-v2", "RU_LIFE control identity mismatch.");
  assertCloudflarePreviewDeployment("RU_LIFE", ru.deployment);
  invariant(ru.ownership?.centralRole === "policy-and-remote-admin-only", "RU_LIFE ownership boundary mismatch.");

  invariant(baumanControl.application === "bauman-master-ai" && baumanControl.protocol === "bauman-control-v4", "Bauman Control identity mismatch.");
  assertCloudflarePreviewDeployment("Bauman Control", baumanControl.deployment);
  invariant(baumanControl.deployment.databaseReady === true, "Bauman Control preview D1 is not ready.");
  invariant(baumanControl.deployment.applicationManagementOriginConfigured === true, "Bauman Control is missing Application Management origin.");
  invariant(baumanControl.deployment.appOriginConfigured === true, "Bauman Control is missing Learning Runtime origin.");
  invariant(baumanControl.readiness?.accessGate === "available", "Bauman learning access gate is not available.");
  invariant(baumanControl.capabilities?.learningAccessGate === true, "Bauman learning access gate capability is not active.");

  invariant(baumanRuntime.application === "bauman-master-ai" && baumanRuntime.runtime === "learning-runtime", "Bauman Learning Runtime identity mismatch.");
  assertCloudflarePreviewDeployment("Bauman Learning Runtime", baumanRuntime);
  invariant(baumanRuntime.controlOriginConfigured === true, "Bauman Learning Runtime is missing Bauman Control origin.");

  return {
    boiEch: boiOrigin,
    healthCare: healthOrigin,
    ruLife: ruOrigin,
    baumanControl: baumanControlOrigin,
    baumanRuntime: baumanRuntimeOrigin,
  };
}

export async function verifyPreviewStack({ mode = "full-stack", env = process.env, fetchImpl = fetch } = {}) {
  if (!MODES.has(mode)) throw new Error(`Unsupported verifier mode: ${mode}`);
  const central = await verifyCentral(mode, env, fetchImpl);
  const clients = mode === "full-stack" ? await verifyFullStack(env, fetchImpl, central) : {};
  return {
    ok: true,
    mode,
    applicationManagement: central.origin,
    clients,
    mutationMethodsUsed: false,
  };
}

async function main() {
  const mode = modeFromArgv(process.argv.slice(2));
  const result = await verifyPreviewStack({ mode });
  console.log(JSON.stringify(result, null, 2));
  console.log(`Application Management ${mode} read-only preview verification PASS.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(`Preview verification failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
}
