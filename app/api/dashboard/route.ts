import { issueBoiBrowserBridge } from "../../boi-ech.server";
import {
  ControlAccessError,
  controlErrorResponse,
  verifyControlProof,
} from "../../control-device.server";

export const dynamic = "force-dynamic";

function json(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      "cache-control": "no-store, private",
      "x-content-type-options": "nosniff",
    },
  });
}

/**
 * Legacy Bơi ếch bootstrap bridge.
 *
 * Central control-device CRUD and central audit are intentionally NOT owned here.
 * They live exclusively in /api/center. This endpoint only proves the approved
 * administration device and issues the short-lived Bơi ếch browser bridge used
 * by the existing Bơi ếch control surface while that client is being decomposed.
 */
export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as Record<string, unknown>;
    const previewRequest = ["terminal.local", "localhost"].includes(new URL(request.url).hostname);
    const actorDevice = await verifyControlProof(payload, undefined, previewRequest);
    const action = typeof payload.action === "string" ? payload.action : "bootstrap";

    if (action === "bootstrap") {
      return json({
        actor: actorDevice,
        application: { id: "boi-ech", name: "Bơi ếch AI", lessonCount: 8 },
        learningDevices: [],
        controlDevices: [],
        upstreamError: null,
        boiBridge: await issueBoiBrowserBridge(actorDevice.email, actorDevice.role),
        applications: [
          { id: "boi-ech", name: "Bơi ếch AI", status: "online" },
        ],
        auditLog: [],
      });
    }

    if (action === "manage-control-device") {
      throw new ControlAccessError(
        "Quyền và thiết bị quản trị Trung tâm chỉ được quản lý qua /api/center.",
        409,
        "CENTER_ACTION_MOVED",
      );
    }

    throw new ControlAccessError(
      "Thao tác dashboard Bơi ếch không hợp lệ.",
      400,
      "INVALID_BOI_DASHBOARD_ACTION",
    );
  } catch (error) {
    return controlErrorResponse(error);
  }
}
