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
import { publicVisaIntakePage } from "./visa-intake-public";
import {
  handleProductionAccount,
  handleProductionGoogleCallback,
  handleProductionGoogleStart,
  handleProductionLogin,
  handleProductionLogout,
  productionAccountPath,
  productionGoogleAuthConfigured,
  productionGoogleCallbackPath,
  productionGoogleStartPath,
  productionIdentity,
  productionLoginPath,
  productionLogoutPath,
  productionReadbackAuthorized,
  productionStepUpGate,
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
  GOOGLE_OAUTH_CLIENT_ID?: string;
  GOOGLE_OAUTH_CLIENT_SECRET?: string;
  GOOGLE_OAUTH_REDIRECT_URI?: string;
  APPLICATION_MANAGEMENT_MFA_ENCRYPTION_KEY?: string;
  APPLICATION_MANAGEMENT_DEPLOYMENT_CHANNEL?: string;
  APPLICATION_MANAGEMENT_BUILD_REVISION?: string;
  VERCEL_TOKEN?: string;
  NEON_API_KEY?: string;
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
    await env.DB.prepare("SELECT app_id FROM deploy_ops_targets LIMIT 1").first();
    await env.DB.prepare("SELECT id FROM deploy_ops_runs LIMIT 1").first();
    await env.DB.prepare("SELECT provider FROM deploy_ops_credentials LIMIT 1").first();
    await env.DB.prepare("SELECT id FROM visa_intake_links LIMIT 1").first();
    await env.DB.prepare("SELECT id FROM visa_intake_submissions LIMIT 1").first();
    await env.DB.prepare("SELECT id FROM visa_intake_results LIMIT 1").first();
    return true;
  } catch {
    return false;
  }
}

const ASSET_HEALTH_PATH = "/application-management-asset-health.txt";
const ASSET_HEALTH_BODY = "application-management-assets-ok-v1";

async function staticAssetsReady(env: Env) {
  try {
    const response = await env.ASSETS.fetch(new Request(`https://asset-health.internal${ASSET_HEALTH_PATH}`));
    if (!response.ok) return false;
    return (await response.text()).trim() === ASSET_HEALTH_BODY;
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
    assetsReady: await staticAssetsReady(env),
    previewAccessConfigured: isPreview && previewAccessConfigured(env.APPLICATION_MANAGEMENT_PREVIEW_ACCESS_SECRET),
    productionAuthConfigured: isProduction
      && configured(env.CONTROL_OWNER_EMAILS)
      && (env.APPLICATION_MANAGEMENT_PRODUCTION_READBACK_SECRET?.trim().length ?? 0) >= 32,
    googleAuthConfigured: isProduction && productionGoogleAuthConfigured(env),
    accessMode: isProduction
      ? productionGoogleAuthConfigured(env)
        ? "google-oauth+account-session"
        : "account-session"
      : isPreview
        ? "application-preview-secret"
        : "upstream-identity",
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
    deployOps: {
      vercelConfigured: configured(env.VERCEL_TOKEN),
      neonConfigured: configured(env.NEON_API_KEY),
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

function isPublicPwaAsset(request: Request, url: URL) {
  if (request.method !== "GET" && request.method !== "HEAD") return false;
  return new Set([
    "/manifest.webmanifest",
    "/sw.js",
    "/icon-192.png",
    "/icon-512.png",
    "/favicon.svg",
    "/offline.html",
    "/kd-mid-visa-companion.user.js",
  ]).has(url.pathname);
}

function isCloudflareClientAsset(request: Request, url: URL) {
  if (request.method !== "GET" && request.method !== "HEAD") return false;
  if (url.pathname.startsWith("/assets/")) return true;
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/_vinext/")) return true;
  return /\.(?:css|m?js|map|png|jpe?g|webp|avif|gif|svg|ico|woff2?|ttf|otf|webmanifest)$/i.test(url.pathname);
}

function isPublicVisaIntakeRequest(request: Request, url: URL) {
  if (request.method === "GET" || request.method === "HEAD") {
    if (url.pathname === "/api/kd-mid-visa-intake/public") return true;
  }
  return request.method === "POST" && url.pathname === "/api/kd-mid-visa-intake/public";
}

function freshDynamicResponse(response: Response, cloudflareChannel: boolean) {
  if (!cloudflareChannel) return response;
  const headers = new Headers(response.headers);
  headers.set("cache-control", "no-store, no-cache, must-revalidate, private");
  headers.set("cloudflare-cdn-cache-control", "no-store");
  headers.set("pragma", "no-cache");
  headers.set("expires", "0");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function repairBrowserCache(env: Env) {
  const revision = env.APPLICATION_MANAGEMENT_BUILD_REVISION?.trim() || "latest";
  const headers = new Headers({
    location: `/?fresh=${encodeURIComponent(revision)}`,
    "cache-control": "no-store, no-cache, must-revalidate, private",
    "cloudflare-cdn-cache-control": "no-store",
    "clear-site-data": '"cache"',
    pragma: "no-cache",
    expires: "0",
  });
  return new Response(null, { status: 303, headers });
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
    // PWA installability metadata contains no private application data and must
    // be readable before login so Chromium can validate the manifest and
    // service worker deterministically.
    if ((isPreview || isProduction) && isPublicPwaAsset(request, url)) {
      return env.ASSETS.fetch(request);
    }

    // Public visa-intake is intentionally shareable without an admin session.
    // The HTML is standalone/inline so authenticated application bundles remain protected.
    if (isProduction && request.method === "GET" && url.pathname === "/visa-intake") {
      return await publicVisaIntakePage(request, env);
    }
    if (isProduction && isPublicVisaIntakeRequest(request, url)) {
      return freshDynamicResponse(await handler.fetch(request, env, ctx), true);
    }

    if (isPreview) {
      if (!previewAccessConfigured(env.APPLICATION_MANAGEMENT_PREVIEW_ACCESS_SECRET)) return previewUnavailable();
      if (url.pathname === previewLoginPath()) return handlePreviewLogin(request, env.APPLICATION_MANAGEMENT_PREVIEW_ACCESS_SECRET);
      if (url.pathname === previewLogoutPath()) return handlePreviewLogout();
      if (!(await previewRequestAuthorized(request, env.APPLICATION_MANAGEMENT_PREVIEW_ACCESS_SECRET))) return previewUnauthorized(request);
    }

    if (isProduction) {
      if (url.pathname === productionGoogleStartPath()) return handleProductionGoogleStart(request, env);
      if (url.pathname === productionGoogleCallbackPath()) return handleProductionGoogleCallback(request, env);
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
        const stepUpResponse = await productionStepUpGate(request, env, identity);
        if (stepUpResponse) return stepUpResponse;
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

    if (isProduction && request.method === "GET" && url.pathname === "/__repair-cache") {
      return repairBrowserCache(env);
    }

    if ((isPreview || isProduction) && isCloudflareClientAsset(request, url)) {
      return env.ASSETS.fetch(request);
    }

    if (isPreview) {
      const authenticated = withPreviewOwnerIdentity(request, env.CONTROL_OWNER_EMAILS);
      if (!authenticated) return previewUnavailable();
      request = authenticated;
    }

    request = await routeNativeAutoApproval(request);
    const response = await handler.fetch(request, env, ctx);
    return freshDynamicResponse(response, isPreview || isProduction);
  },
};

export default worker;
