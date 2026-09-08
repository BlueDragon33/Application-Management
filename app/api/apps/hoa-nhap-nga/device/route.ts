import {
  authorizeRuLifeDevice,
  createRuLifeChallenge,
  registerRuLifeDevice,
  ruLifeErrorResponse,
} from "../../../../ru-life-device.server";

export const dynamic = "force-dynamic";

async function allowedOrigin(request: Request) {
  const origin = request.headers.get("origin") ?? "";
  const workers = await import("cloudflare:workers");
  const values = workers.env as unknown as Record<string, unknown>;
  const configured = typeof values.RU_LIFE_ORIGIN === "string" ? values.RU_LIFE_ORIGIN.replace(/\/$/, "") : "";
  if (configured && origin === configured) return origin;
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin)) return origin;
  if (!origin) return "";
  return null;
}

function cors(origin: string) {
  return origin ? {
    "access-control-allow-origin": origin,
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-allow-headers": "content-type",
    "access-control-max-age": "600",
    vary: "Origin",
  } : {};
}

export async function OPTIONS(request: Request) {
  const origin = await allowedOrigin(request);
  if (origin === null) return new Response(null, { status: 403 });
  return new Response(null, { status: 204, headers: cors(origin) });
}

export async function POST(request: Request) {
  const origin = await allowedOrigin(request);
  if (origin === null) return Response.json({ error: "Origin Hòa nhập Nga không được phép.", code: "RU_LIFE_ORIGIN_FORBIDDEN" }, { status: 403 });
  try {
    const payload = await request.json() as Record<string, unknown>;
    const action = typeof payload.action === "string" ? payload.action : "";
    let data: unknown;
    if (action === "register") {
      data = { device: await registerRuLifeDevice(payload.publicKey, payload.profile) };
    } else if (action === "challenge") {
      data = await createRuLifeChallenge(payload.deviceId);
    } else if (action === "authorize") {
      data = await authorizeRuLifeDevice(payload);
    } else {
      return Response.json({ error: "Thao tác gateway Hòa nhập Nga không hợp lệ.", code: "INVALID_RU_LIFE_GATEWAY_ACTION" }, { status: 400, headers: { ...cors(origin), "cache-control": "no-store, private" } });
    }
    return Response.json(data, { headers: { ...cors(origin), "cache-control": "no-store, private", "x-content-type-options": "nosniff" } });
  } catch (error) {
    const response = ruLifeErrorResponse(error);
    const headers = new Headers(response.headers);
    for (const [key, value] of Object.entries(cors(origin))) headers.set(key, value);
    return new Response(response.body, { status: response.status, headers });
  }
}
