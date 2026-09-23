import { UpstreamError, issueBoiBrowserBridge } from "../../boi-ech.server";
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
 * Bơi ếch bridge bootstrap.
 *
 * Đây không phải API control-plane chung. Endpoint chỉ xác thực thiết bị quản trị
 * đã được Application Management cấp quyền rồi phát vé ngắn hạn cho client Bơi ếch.
 * Quyền QT, danh sách thiết bị QT và audit Trung tâm chỉ thuộc /api/center.
 */
export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as Record<string, unknown>;
    const previewRequest = ["terminal.local", "localhost"].includes(new URL(request.url).hostname);
    const actorDevice = await verifyControlProof(payload, undefined, previewRequest);
    const action = typeof payload.action === "string" ? payload.action : "bootstrap";

    if (action !== "bootstrap") {
      throw new ControlAccessError(
        "Dashboard Bơi ếch chỉ dùng để cấp bridge quản trị. Quyền Trung tâm được xử lý tại /api/center.",
        400,
        "INVALID_BOI_DASHBOARD_ACTION",
      );
    }

    return json({
      actor: actorDevice,
      application: { id: "boi-ech", name: "Bơi ếch AI", lessonCount: 8 },
      learningDevices: [],
      upstreamError: null,
      boiBridge: await issueBoiBrowserBridge(actorDevice.email, actorDevice.role),
    });
  } catch (error) {
    if (error instanceof UpstreamError) {
      const payload = error.payload && typeof error.payload === "object" && !Array.isArray(error.payload)
        ? error.payload as Record<string, unknown>
        : {};
      return json({ error: error.message, code: typeof payload.code === "string" ? payload.code : "BOI_ECH_UPSTREAM_ERROR" }, error.status);
    }
    return controlErrorResponse(error);
  }
}
