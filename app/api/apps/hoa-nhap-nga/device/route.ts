import {
  authorizeManagedAppDevice,
  createManagedAppChallenge,
  managedAppDeviceErrorResponse,
  ManagedAppDeviceError,
  registerManagedAppDevice,
} from "../../../../managed-app-device.server";
import { integrationRussiaSiteUrl } from "../../../../site-links";

export const dynamic = "force-dynamic";

type DeviceProfileInput = Record<string, unknown>;
type DeviceClass = "computer" | "phone" | "tablet" | "unknown";

function clean(value: unknown, max = 120) {
  return typeof value === "string" ? value.trim().replace(/[\u0000-\u001f\u007f]/g, " ").slice(0, max) : "";
}

function numeric(value: unknown, min: number, max: number) {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? Math.max(min, Math.min(max, number)) : 0;
}

function truthy(value: unknown) {
  return value === true || value === "true" || value === "?1" || value === 1;
}

function shortestScreenSide(profile: DeviceProfileInput) {
  const value = clean(profile.screen, 40);
  const match = value.match(/^(\d{2,5})x(\d{2,5})(?:@|$)/i);
  return match ? Math.min(Number(match[1]), Number(match[2])) : 0;
}

function classifyDevice(request: Request, profile: DeviceProfileInput): { deviceClass: DeviceClass; confidence: number; source: string } {
  const ua = (request.headers.get("user-agent") || "").slice(0, 500);
  const platformHeader = (request.headers.get("sec-ch-ua-platform") || "").replaceAll('"', "").toLowerCase();
  const mobileHeader = request.headers.get("sec-ch-ua-mobile") || "";
  const platformHint = clean(profile.platformHint, 80).toLowerCase();
  const modelHint = clean(profile.modelHint, 100).toLowerCase();
  const touchPoints = numeric(profile.touchPoints, 0, 20);
  const coarsePointer = truthy(profile.coarsePointer);
  const clientMobile = profile.mobileHint === null || profile.mobileHint === undefined ? null : truthy(profile.mobileHint);
  const shortestSide = shortestScreenSide(profile);
  const platform = `${platformHeader} ${platformHint}`;

  // iPadOS may present a Macintosh UA. Multi-touch distinguishes it from a Mac.
  if (/ipad/i.test(ua) || (/(macintosh|mac os x)/i.test(ua) && touchPoints > 1)) {
    return { deviceClass: "tablet", confidence: 99, source: "server:ipad" };
  }
  if (/iphone|ipod/i.test(ua)) return { deviceClass: "phone", confidence: 99, source: "server:iphone" };
  if (/android/i.test(ua)) {
    if (/mobile/i.test(ua) || mobileHeader === "?1" || clientMobile === true) {
      return { deviceClass: "phone", confidence: 98, source: "server:android-mobile" };
    }
    return { deviceClass: "tablet", confidence: 97, source: "server:android-tablet" };
  }
  if (modelHint.includes("ipad") || modelHint.includes("tablet")) {
    return { deviceClass: "tablet", confidence: 91, source: "server:model" };
  }
  if (modelHint.includes("iphone") || mobileHeader === "?1") {
    return { deviceClass: "phone", confidence: 92, source: "server:mobile-hint" };
  }
  if (/windows nt|cros|x11|linux x86_64|macintosh/i.test(ua) || /windows|chrome os|linux|mac/.test(platform)) {
    return { deviceClass: "computer", confidence: 96, source: "server:desktop-platform" };
  }
  if (coarsePointer && touchPoints > 0) {
    if (shortestSide >= 600) return { deviceClass: "tablet", confidence: 74, source: "server:touch-screen" };
    if (shortestSide > 0) return { deviceClass: "phone", confidence: 72, source: "server:touch-screen" };
  }
  return { deviceClass: "unknown", confidence: 35, source: "server:insufficient-signals" };
}

function verifiedProfile(request: Request, value: unknown) {
  const source = value && typeof value === "object" ? value as DeviceProfileInput : {};
  const classification = classifyDevice(request, source);
  return {
    ...source,
    // The client contributes signals only. Application Management chooses the final class.
    deviceClass: classification.deviceClass,
    classificationConfidence: classification.confidence,
    classificationSource: classification.source,
    classifierVersion: 2,
  };
}

async function allowedOrigin() {
  const workers = await import("cloudflare:workers");
  const configured = (workers.env as unknown as Record<string, unknown>).MEDICINE_APP_BASE_URL;
  const value = typeof configured === "string" && configured.trim() ? configured.trim() : integrationRussiaSiteUrl;
  try { return new URL(value).origin; }
  catch { return new URL(integrationRussiaSiteUrl).origin; }
}

async function corsHeaders(request: Request) {
  const origin = request.headers.get("origin") || "";
  const allowed = await allowedOrigin();
  const host = new URL(request.url).hostname;
  const preview = ["localhost", "terminal.local", "127.0.0.1"].includes(host);
  if (origin && origin !== allowed && !(preview && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin))) {
    throw new ManagedAppDeviceError("Nguồn truy cập không được phép.", 403, "ORIGIN_NOT_ALLOWED");
  }
  return {
    "access-control-allow-origin": origin || allowed,
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-allow-headers": "content-type",
    "access-control-max-age": "600",
    "cache-control": "no-store, private",
    "vary": "Origin",
    "x-content-type-options": "nosniff",
  } satisfies HeadersInit;
}

export async function OPTIONS(request: Request) {
  try { return new Response(null, { status: 204, headers: await corsHeaders(request) }); }
  catch (error) { return managedAppDeviceErrorResponse(error); }
}

export async function POST(request: Request) {
  let headers: HeadersInit = { "cache-control": "no-store, private" };
  try {
    headers = await corsHeaders(request);
    const body = await request.json() as Record<string, unknown>;
    const action = typeof body.action === "string" ? body.action : "";
    if (action === "register") {
      const device = await registerManagedAppDevice("hoa-nhap-nga", body.publicKey, verifiedProfile(request, body.profile), request);
      return Response.json({ device }, { headers });
    }
    if (action === "challenge") {
      return Response.json(await createManagedAppChallenge("hoa-nhap-nga", body.deviceId), { headers });
    }
    if (action === "authorize") {
      return Response.json(await authorizeManagedAppDevice({ ...body, appId: "hoa-nhap-nga" }), { headers });
    }
    throw new ManagedAppDeviceError("Thao tác thiết bị không hợp lệ.", 400, "INVALID_DEVICE_ACTION");
  } catch (error) {
    return managedAppDeviceErrorResponse(error, headers);
  }
}
