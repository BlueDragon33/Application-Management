import { introspectRuLifeBridgeToken, RuLifeBridgeError } from "../../../../../ru-life.server";

export const dynamic = "force-dynamic";

function json(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      "cache-control": "no-store, private",
      "content-security-policy": "default-src 'none'; frame-ancestors 'none'",
      "x-content-type-options": "nosniff",
    },
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as Record<string, unknown>;
    return json(await introspectRuLifeBridgeToken(body.token));
  } catch (error) {
    if (error instanceof RuLifeBridgeError) {
      return json({ error: error.message, ...(typeof error.payload === "object" && error.payload ? error.payload : {}) }, error.status);
    }
    return json({ error: "Không thể xác minh vé quản trị Hòa nhập Nga.", code: "RU_LIFE_BRIDGE_INTROSPECTION_FAILED" }, 500);
  }
}
