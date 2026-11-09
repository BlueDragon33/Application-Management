import { controlErrorResponse, verifyControlProof } from "../../../../control-device.server";
import { cloudflarePreviewAction, PreviewConnectionError } from "../../../../cloudflare-preview.server";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  const headers = { "cache-control": "no-store, private", "x-content-type-options": "nosniff" };
  try {
    const payload = await request.json() as Record<string, unknown>;
    const actor = await verifyControlProof(payload);
    return Response.json({ ok: true, state: await cloudflarePreviewAction(payload, actor) }, { headers });
  } catch (error) {
    if (error instanceof PreviewConnectionError) return Response.json({ error: error.message, code: error.code, applied: error.applied, verified: false }, { status: error.status, headers });
    return controlErrorResponse(error);
  }
}
