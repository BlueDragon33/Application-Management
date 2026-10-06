import { verifyControlProof } from "../../control-device.server";
import {
  desktopAgentErrorResponse,
  listDesktopAgents,
  manageDesktopAgent,
  queueDesktopAgentCommand,
} from "../../desktop-agent-gateway.server";

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
    const previewRequest = ["terminal.local", "localhost"].includes(new URL(request.url).hostname);
    const actor = await verifyControlProof(payload, undefined, previewRequest);
    const action = typeof payload.action === "string" ? payload.action : "list";

    if (action === "list") return json(await listDesktopAgents(actor));
    if (action === "manage") return json(await manageDesktopAgent(payload, actor));
    if (action === "queue-command") return json(await queueDesktopAgentCommand(payload, actor));
    return json({ ok: false, error: "Desktop Agent admin action không hợp lệ.", code: "INVALID_AGENT_ADMIN_ACTION" }, 400);
  } catch (error) {
    return desktopAgentErrorResponse(error);
  }
}
