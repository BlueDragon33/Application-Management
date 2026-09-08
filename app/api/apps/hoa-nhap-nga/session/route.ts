import { ruLifeErrorResponse, verifyRuLifeAccessToken } from "../../../../ru-life-device.server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const payload = await request.json() as Record<string, unknown>;
    const claims = await verifyRuLifeAccessToken(payload.accessToken, true);
    return Response.json({
      ok: true,
      appId: claims.appId,
      deviceId: claims.deviceId,
      deviceCode: claims.deviceCode,
      editEnabled: claims.editEnabled,
      expiresAt: claims.exp,
    }, {
      headers: {
        "cache-control": "no-store, private",
        "x-content-type-options": "nosniff",
      },
    });
  } catch (error) {
    return ruLifeErrorResponse(error);
  }
}
