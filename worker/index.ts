/** Cloudflare Worker entry point for Application Management. */
import handler from "vinext/server/app-router-entry";
import {
  handlePreviewLogin,
  handlePreviewLogout,
  previewAccessConfigured,
  previewLoginPath,
  previewLogoutPath,
  previewRequestAuthorized,
  withPreviewOwnerIdentity,
} from "./preview-access";
import {
  handleProductionAccount,
  handleProductionLogin,
  handleProductionLogout,
  productionAccountPath,
  productionIdentity,
  productionLoginPath,
  productionLogoutPath,
  productionReadbackAuthorized,
  productionUnauthorized,
  withProductionIdentity,
} from "./production-auth";

interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  BOI_ECH_BASE_URL?: string;
  CONTROL_SERVICE_SECRET?: string;
  CONTROL_OWNER_EMAILS?: string;
  CONTROL_PLANE_NETWORK_MODE?: string;
  HEALTH_CARE_BASE_URL?: string;
  HEALTH_CONTROL_SERVICE_SECRET?: string;
  RU_LIFE_BASE_URL?: string;
  RU_LIFE_CONTROL_SERVICE_SECRET?: string;
  BAUMAN_CONTROL_BASE_URL?: string;
  BAUMAN_APP_ORIGIN?: string;
  BAUMAN_CONTROL_SERVICE_SECRET?: string;
  GROWUP_BASE_URL?: string;
  APPLICATION_MANAGEMENT_PREVIEW_ACCESS_SECRET?: string;
  APPLICATION_MANAGEMENT_INITIAL_ADMIN_PASSWORD?: string;
  APPLICATION_MANAGEMENT_PRODUCTION_READBACK_SECRET?: string;
  APPLICATION_MANAGEMENT_DEPLOYMENT_CHANNEL?: string;
  APPLICATION_MANAGEMENT_BUILD_REVISION?: string;
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

async function databaseReady(env: Env) {
  try {
    await env.DB.prepare("SELECT device_id FROM control_devices LIMIT 1").first();
    await env.DB.prepare("SELECT email FROM control_members LIMIT 1").first();
    await env.DB.prepare("SELECT id FROM control_audit_log LIMIT 1").first();
    return true;
  } catch {
    return false;
  }
}

function configured(value: string | undefined) {
  return Boolean(value?.trim());
}

async function deploymentStatus(env: Env) {
  const channel = env.APPLICATION_MANAGEMENT_DEPLOYMENT_CHANNEL ?? "unknown";
  const isPreview = channel === "cloudflare-preview";
  const isProduction = channel === "cloudflare-production";
  return {
    ok: true,
    application: "application-management",
    runtime: "control-plane",
    channel,
    revision: env.APPLICATION_MANAGEMENT_BUILD_REVISION ?? "unknown",
    databaseReady: await databaseReady(env),
    previewAccessConfigured: isPreview && previewAccessConfigured(env.APPLICATION_MANAGEMENT_PREVIEW_ACCESS_SECRET),
    productionAuthConfigured: isProduction
      && configured(env.CONTROL_OWNER_EMAILS)
      && (env.APPLICATION_MANAGEMENT_PRODUCTION_READBACK_SECRET?.trim().length ?? 0) >= 32,
    accessMode: isProduction ? "account-session" : isPreview ? "application-preview-secret" : "upstream-identity",
    ownerPolicyConfigured: configured(env.CONTROL_OWNER_EMAILS),
    networkMode: env.CONTROL_PLANE_NETWORK_MODE ?? "unknown",
    clients: {
      boiEch: configured(env.BOI_ECH_BASE_URL),
      healthCare: configured(env.HEALTH_CARE_BASE_URL),
      ruLife: configured(env.RU_LIFE_BASE_URL),
      baumanControl: configured(env.BAUMAN_CONTROL_BASE_URL),
      baumanRuntime: configured(env.BAUMAN_APP_ORIGIN),
      growUp: configured(env.GROWUP_BASE_URL),
    },
    checkedAt: Date.now(),
  };
}

function previewUnavailable() {
  return Response.json(
    { ok: false, error: "preview_access_not_configured" },
    {
      status: 503,
      headers: {
        "cache-control": "no-store, private",
        "content-security-policy": "default-src 'none'; frame-ancestors 'none'",
        "x-content-type-options": "nosniff",
      },
    },
  );
}

function previewUnauthorized(request: Request) {
  const acceptsHtml = (request.headers.get("accept") ?? "").includes("text/html");
  if (request.method === "GET" && acceptsHtml) {
    return Response.redirect(new URL(previewLoginPath(), request.url), 303);
  }
  return Response.json(
    { ok: false, error: "preview_access_required" },
    {
      status: 401,
      headers: {
        "cache-control": "no-store, private",
        "content-security-policy": "default-src 'none'; frame-ancestors 'none'",
        "www-authenticate": 'Bearer realm="application-management-preview"',
        "x-content-type-options": "nosniff",
      },
    },
  );
}

async function routeNativeAutoApproval(request: Request) {
  const url = new URL(request.url);
  if (request.method !== "POST" || url.pathname !== "/api/operations") return request;
  const payload = await request.clone().json().catch(() => null) as { action?: unknown } | null;
  if (payload?.action !== "set-auto-approval") return request;
  url.pathname = "/api/operations-auto-approval";
  return new Request(url, request);
}

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const channel = env.APPLICATION_MANAGEMENT_DEPLOYMENT_CHANNEL;
    const isPreview = channel === "cloudflare-preview";
    const isProduction = channel === "cloudflare-production";

    if (isPreview) {
      if (!previewAccessConfigured(env.APPLICATION_MANAGEMENT_PREVIEW_ACCESS_SECRET)) return previewUnavailable();
      if (url.pathname === previewLoginPath()) return handlePreviewLogin(request, env.APPLICATION_MANAGEMENT_PREVIEW_ACCESS_SECRET);
      if (url.pathname === previewLogoutPath()) return handlePreviewLogout();
      if (!(await previewRequestAuthorized(request, env.APPLICATION_MANAGEMENT_PREVIEW_ACCESS_SECRET))) return previewUnauthorized(request);
    }

    if (isProduction) {
      if (url.pathname === productionLoginPath()) return handleProductionLogin(request, env);
      if (url.pathname === productionLogoutPath()) return handleProductionLogout(request, env);

      const readback = request.method === "GET"
        && url.pathname === "/__deployment"
        && await productionReadbackAuthorized(request, env.APPLICATION_MANAGEMENT_PRODUCTION_READBACK_SECRET);

      if (!readback) {
        const identity = await productionIdentity(request, env);
        if (!identity) return productionUnauthorized(request);
        if (url.pathname === productionAccountPath() || url.pathname.startsWith(`${productionAccountPath()}/`)) {
          return handleProductionAccount(request, env, identity);
        }
        request = withProductionIdentity(request, identity);
      }
    }

    if (request.method === "GET" && url.pathname === "/__deployment") {
      return Response.json(await deploymentStatus(env), {
        headers: {
          "cache-control": "no-store, private",
          "content-security-policy": "default-src 'none'; frame-ancestors 'none'",
          "x-content-type-options": "nosniff",
        },
      });
    }

    if (isPreview) {
      const authenticated = withPreviewOwnerIdentity(request, env.CONTROL_OWNER_EMAILS);
      if (!authenticated) return previewUnavailable();
      request = authenticated;
    }

    request = await routeNativeAutoApproval(request);
    return handler.fetch(request, env, ctx);
  },
};

export default worker;
