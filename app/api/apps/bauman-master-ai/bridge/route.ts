import { controlErrorResponse, verifyControlProof } from "../../../../control-device.server";
import { BaumanBridgeError, issueBaumanBrowserBridge } from "../../../../bauman.server";

export const dynamic = "force-dynamic";

function json(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: { "cache-control": "no-store, private", "x-content-type-options": "nosniff" },
  });
}

export async function POST(request: Request) {
  try {
    const payload = await request.json() as Record<string, unknown>;
    const previewRequest = ["terminal.local", "localhost"].includes(new URL(request.url).hostname);
    const actor = await verifyControlProof(payload, undefined, previewRequest);
    const action = typeof payload.action === "string" ? payload.action : "bootstrap";
    if (action !== "bootstrap") {
      return json({ error: "Thao tác bridge Bauman không hợp lệ.", code: "INVALID_BAUMAN_BRIDGE_ACTION" }, 400);
    }
    return json({
      actor,
      application: "bauman-master-ai",
      bridge: await issueBaumanBrowserBridge(actor.email, actor.role, actor.deviceId),
    });
  } catch (error) {
    if (error instanceof BaumanBridgeError) {
      return json({ error: error.message, ...(typeof error.payload === "object" && error.payload ? error.payload : {}) }, error.status);
    }
    return controlErrorResponse(error);
  }
}
