import {
  authorizeManagedAppDevice,
  createManagedAppChallenge,
  managedAppDeviceErrorResponse,
  ManagedAppDeviceError,
  registerManagedAppDevice,
} from "../../../../managed-app-device.server";
import { integrationRussiaSiteUrl } from "../../../../site-links";

export const dynamic = "force-dynamic";

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
      const device = await registerManagedAppDevice("hoa-nhap-nga", body.publicKey, body.profile, request);
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
