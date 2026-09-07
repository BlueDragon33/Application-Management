import { ControlAccessError, controlErrorResponse, verifyControlProof } from "../../../control-device.server";
import { issueMedicineBrowserBridge } from "../../../medicine-bridge.server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json() as Record<string, unknown>;
    const previewRequest = ["terminal.local", "localhost"].includes(new URL(request.url).hostname);
    const actor = await verifyControlProof(body, undefined, previewRequest);
    if (body.action !== "issue-access") throw new ControlAccessError("Thao tác cấp quyền Hòa nhập Nga không hợp lệ.", 400, "INVALID_MEDICINE_ACCESS_ACTION");
    return Response.json({ ...(await issueMedicineBrowserBridge(actor.email, actor.role)), actor }, { headers: { "cache-control": "no-store, private", "x-content-type-options": "nosniff" } });
  } catch (error) {
    return controlErrorResponse(error);
  }
}
