import { issueBoiBrowserBridge } from "../../boi-ech.server";
import { ControlAccessError, controlErrorResponse, verifyControlProof } from "../../control-device.server";

export const dynamic = "force-dynamic";

function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { "cache-control": "no-store, private", "x-content-type-options": "nosniff" } });
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as Record<string, unknown>;
    const previewRequest = ["terminal.local", "localhost"].includes(new URL(request.url).hostname);
    const actorDevice = await verifyControlProof(payload, undefined, previewRequest);
    const action = typeof payload.action === "string" ? payload.action : "bootstrap";
    if (action !== "bootstrap") {
      throw new ControlAccessError("Khu Bơi ếch chỉ điều hành dữ liệu học tập. Quyền tài khoản và nhật ký dùng chung thuộc mục Hệ thống.", 400, "INVALID_LEARNING_ACTION");
    }

    return json({
      actor: actorDevice,
      application: { id: "boi-ech", name: "Bơi ếch AI", lessonCount: 8 },
      learningDevices: [],
      upstreamError: null,
      boiBridge: await issueBoiBrowserBridge(actorDevice.email, actorDevice.role),
    });
  } catch (error) {
    return controlErrorResponse(error);
  }
}
