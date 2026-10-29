import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const productionOrigin = "https://application-management.boiech-ai.workers.dev";
const boiOrigin = "https://boi-ech.boiech-ai.workers.dev";
const clientVariables = ["BOI_ECH_BASE_URL", "HEALTH_CARE_BASE_URL", "RU_LIFE_BASE_URL", "BAUMAN_CONTROL_BASE_URL", "BAUMAN_APP_ORIGIN", "GROWUP_BASE_URL", "GROWUP_CONTROL_BASE_URL", "PRICE_REPORT_CONTROL_BASE_URL"];

export function preservedProductionEnvironment(settings) {
  if (settings?.success !== true || !Array.isArray(settings.result?.bindings)) throw new Error("LIVE_VARIABLES_UNAVAILABLE");
  const allowed = new Set([...clientVariables, "CONTROL_OWNER_EMAILS", "CONTROL_PLANE_NETWORK_MODE", "APPLICATION_MANAGEMENT_DEPLOYMENT_CHANNEL", "APPLICATION_MANAGEMENT_ACCESS_MODE", "APPLICATION_MANAGEMENT_BUILD_REVISION"]);
  const vars = {};
  for (const binding of settings.result.bindings) {
    if (binding.type !== "plain_text") {
      if (allowed.has(binding.name)) throw new Error("LIVE_VARIABLE_TYPE_INVALID");
      continue;
    }
    if (!allowed.has(binding.name) || Object.hasOwn(vars, binding.name) || typeof binding.text !== "string" || /[\x00-\x1f\x7f]/.test(binding.text)) throw new Error("LIVE_VARIABLE_SCOPE_INVALID");
    vars[binding.name] = binding.text;
  }
  if (vars.CONTROL_PLANE_NETWORK_MODE !== "production" || vars.APPLICATION_MANAGEMENT_DEPLOYMENT_CHANNEL !== "cloudflare-production"
    || !["managed", "standalone"].includes(vars.APPLICATION_MANAGEMENT_ACCESS_MODE)
    || !vars.CONTROL_OWNER_EMAILS?.split(",").every(value => /^[^\s@,]+@[^\s@,]+\.[^\s@,]+$/.test(value.trim()))) throw new Error("LIVE_PRODUCTION_POLICY_INVALID");
  const preserved = { CONTROL_OWNER_EMAILS: vars.CONTROL_OWNER_EMAILS, APPLICATION_MANAGEMENT_ACCESS_MODE: vars.APPLICATION_MANAGEMENT_ACCESS_MODE };
  for (const name of clientVariables) {
    const value = vars[name] ?? "";
    if (value) {
      const url = new URL(value);
      if (url.protocol !== "https:" || url.origin !== value || url.hostname.endsWith(".chatgpt.site")) throw new Error("LIVE_CLIENT_ORIGIN_INVALID");
    }
    preserved[name] = value;
  }
  if (preserved.BOI_ECH_BASE_URL !== boiOrigin) throw new Error("LIVE_BOI_ORIGIN_MISMATCH");
  return preserved;
}

export function requireCentralDeviceReadback(operations, access) {
  const boi = operations?.summaries?.find(item => item.appId === "boi-ech");
  if (operations?.actor?.role !== "owner" || boi?.connection !== "connected" || boi.remoteAdminReady !== true || boi.webHref !== boiOrigin
    || !Array.isArray(operations.devices) || access?.ok !== true || access.application !== "boi-ech" || !Array.isArray(access.devices)
    || access.counts?.total !== access.devices.length) throw new Error("CENTRAL_BOI_READBACK_UNAVAILABLE");
  const shared = operations.devices.filter(item => item.appId === "boi-ech");
  const ids = devices => {
    const result = new Map();
    for (const device of devices) {
      if (!/^[a-f0-9]{64}$/.test(device.deviceId ?? "") || !["pending", "approved", "blocked"].includes(device.status) || result.has(device.deviceId)) throw new Error("CENTRAL_BOI_DEVICE_INVALID");
      result.set(device.deviceId, device.status);
    }
    return result;
  };
  const left = ids(shared); const right = ids(access.devices);
  if (left.size !== right.size || [...left].some(([id, status]) => right.get(id) !== status)) throw new Error("CENTRAL_BOI_DEVICE_READBACK_MISMATCH");
  return { centralBoiConnected: true, accessReadbackReady: true, deviceCount: left.size, humanOwnerAcceptance: "not-performed" };
}

export function requireProductionRelease({ event, actor, confirm, requested, workflow, checkout }) {
  if (event !== "workflow_dispatch" || actor !== "BlueDragon33" || confirm !== "DEPLOY_PRODUCTION"
    || !/^[a-f0-9]{40}$/.test(requested ?? "") || requested !== workflow || requested !== checkout) {
    throw new Error("EXACT_OWNER_RELEASE_CONFIRMATION_REQUIRED");
  }
  return requested;
}

export function normalizeCloudflareAccountId(value) {
  const normalized = String(value ?? "").trim();
  if (!/^[a-f0-9]{32}$/i.test(normalized)) throw new Error("CLOUDFLARE_ACCOUNT_FORMAT_INVALID");
  return normalized;
}

export function productionReadbackReady(data, revision, accessMode) {
  return Boolean(/^[a-f0-9]{40}$/.test(revision ?? "") && data && data.application === "application-management" && data.runtime === "control-plane"
    && data.channel === "cloudflare-production" && data.revision === revision
    && data.databaseReady === true && data.assetsReady === true && data.productionAuthConfigured === true
    && data.ownerPolicyConfigured === true && data.networkMode === "production"
    && ["account-session", "google-oauth+account-session"].includes(accessMode) && data.accessMode === accessMode
    && (accessMode !== "google-oauth+account-session" || data.googleAuthConfigured === true));
}

async function main() {
  const mode = process.argv[2];
  if (mode === "check") {
    requireProductionRelease({ event: process.env.GITHUB_EVENT_NAME, actor: process.env.GITHUB_ACTOR,
      confirm: process.env.RELEASE_CONFIRM, requested: process.env.RELEASE_REVISION, workflow: process.env.GITHUB_SHA,
      checkout: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim() });
    console.log("Exact owner/revision release gate PASS.");
  } else if (mode === "normalize-account") {
    const value = normalizeCloudflareAccountId(process.env.CLOUDFLARE_ACCOUNT_ID);
    if (!process.env.GITHUB_ENV) throw new Error("GITHUB_ENV_UNAVAILABLE");
    fs.appendFileSync(process.env.GITHUB_ENV, `CLOUDFLARE_ACCOUNT_ID=${value}\n`);
  } else if (mode === "preserve-vars") {
    const account = normalizeCloudflareAccountId(process.env.CLOUDFLARE_ACCOUNT_ID);
    const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}/workers/scripts/application-management/settings`, { method: "GET", redirect: "error", headers: { authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN}` }, signal: AbortSignal.timeout(20_000) });
    if (!response.ok || !process.env.GITHUB_ENV) throw new Error("LIVE_VARIABLES_UNAVAILABLE");
    const values = preservedProductionEnvironment(await response.json());
    fs.appendFileSync(process.env.GITHUB_ENV, Object.entries(values).map(([key, value]) => `${key}=${value}\n`).join(""));
    console.log("Live production variables preserved; no credential write performed.");
  } else if (mode === "smoke-central") {
    if (process.env.APPLICATION_MANAGEMENT_PRODUCTION_ORIGIN !== productionOrigin || !/^[\w-]{43}$/.test(process.env.CATALOG_QA_SESSION_TOKEN ?? "")) throw new Error("CENTRAL_SMOKE_CONFIGURATION_INVALID");
    const read = async route => {
      const response = await fetch(productionOrigin + route, { method: "POST", redirect: "error", headers: { origin: productionOrigin, referer: productionOrigin + "/", "sec-fetch-site": "same-origin", "content-type": "application/json", cookie: `__Host-am_prod_session=${process.env.CATALOG_QA_SESSION_TOKEN}` }, body: JSON.stringify({ action: "bootstrap" }), signal: AbortSignal.timeout(90_000) });
      if (!response.ok) throw new Error("CENTRAL_SMOKE_HTTP_FAILED");
      return response.json();
    };
    let result;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const [operations, access] = await Promise.all([read("/api/operations"), read("/api/apps/boi-ech/access")]);
        result = requireCentralDeviceReadback(operations, access); break;
      } catch { if (attempt === 2) throw new Error("CENTRAL_BOI_SMOKE_FAILED"); }
    }
    console.log(JSON.stringify(result));
  } else if (mode === "readback") {
    const value = JSON.parse(fs.readFileSync(process.argv[3], "utf8"));
    const baseline = JSON.parse(fs.readFileSync(".sites-runtime/production-inspection/readiness.json", "utf8"));
    if (!productionReadbackReady(value, process.env.RELEASE_REVISION, baseline.liveAccessMode)) process.exitCode = 1;
  } else throw new Error("UNKNOWN_RELEASE_CONTROL_MODE");
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch(() => { console.error("PRODUCTION_RELEASE_GATE_FAILED"); process.exitCode = 1; });
}
