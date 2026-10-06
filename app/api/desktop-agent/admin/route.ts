import { verifyControlProof } from "../../../control-device.server";
import {
  desktopAgentErrorResponse,
  listDesktopAgents,
  queueDesktopAgentCommand,
  setDesktopAgentPolicy,
  setDesktopAgentStatus,
} from "../../../desktop-agent.server";

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

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as Record<string, unknown>;
    const previewRequest = ["terminal.local", "localhost"].includes(
      new URL(request.url).hostname,
    );
    const actor = await verifyControlProof(payload, undefined, previewRequest);
    const action = typeof payload.action === "string" ? payload.action : "list";

    if (action === "list") {
      return json({ ok: true, devices: await listDesktopAgents() });
    }

    const deviceId = typeof payload.targetDeviceId === "string" ? payload.targetDeviceId : "";
    if (action === "set-status") {
      return json({
        ok: true,
        device: await setDesktopAgentStatus(actor, deviceId, payload.status),
      });
    }
    if (action === "set-policy") {
      return json({
        ok: true,
        device: await setDesktopAgentPolicy(actor, deviceId, payload.policy),
      });
    }
    if (action === "queue-command") {
      return json({
        ok: true,
        command: await queueDesktopAgentCommand(
          actor,
          deviceId,
          payload.commandType,
          payload.commandPayload,
        ),
      });
    }

    return json(
      { error: "Desktop agent admin action không hợp lệ.", code: "INVALID_AGENT_ADMIN_ACTION" },
      400,
    );
  } catch (error) {
    return desktopAgentErrorResponse(error);
  }
}
