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
  return {
    ok: true,
    application: "application-management",
    runtime: "control-plane",
    channel: env.APPLICATION_MANAGEMENT_DEPLOYMENT_CHANNEL ?? "unknown",
    revision: env.APPLICATION_MANAGEMENT_BUILD_REVISION ?? "unknown",
    databaseReady: await databaseReady(env),
    previewAccessConfigured: previewAccessConfigured(env.APPLICATION_MANAGEMENT_PREVIEW_ACCESS_SECRET),
    accessMode: "application-preview-secret",
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

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const isPreview = env.APPLICATION_MANAGEMENT_DEPLOYMENT_CHANNEL === "cloudflare-preview";

    if (isPreview) {
      if (!previewAccessConfigured(env.APPLICATION_MANAGEMENT_PREVIEW_ACCESS_SECRET)) return previewUnavailable();
      if (url.pathname === previewLoginPath()) return handlePreviewLogin(request, env.APPLICATION_MANAGEMENT_PREVIEW_ACCESS_SECRET);
      if (url.pathname === previewLogoutPath()) return handlePreviewLogout();
      if (!(await previewRequestAuthorized(request, env.APPLICATION_MANAGEMENT_PREVIEW_ACCESS_SECRET))) return previewUnauthorized(request);
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

    return handler.fetch(request, env, ctx);
  },
};

export default worker;
