import {
  acknowledgeDesktopAgentCommand,
  createDesktopAgentChallenge,
  desktopAgentContract,
  desktopAgentErrorResponse,
  heartbeatDesktopAgent,
  registerDesktopAgent,
} from "../../desktop-agent-gateway.server";

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

export async function GET() {
  return json(desktopAgentContract());
}

export async function POST(request: Request) {
  try {
    const contentLength = Number(request.headers.get("content-length") ?? "0");
    if (Number.isFinite(contentLength) && contentLength > 32_768) {
      return json({ ok: false, error: "Payload quá lớn.", code: "AGENT_PAYLOAD_TOO_LARGE" }, 413);
    }

    const payload = (await request.json()) as Record<string, unknown>;
    const action = typeof payload.action === "string" ? payload.action : "";
    if (action === "register") return json(await registerDesktopAgent(payload));
    if (action === "challenge") return json(await createDesktopAgentChallenge(payload));
    if (action === "heartbeat") return json(await heartbeatDesktopAgent(payload));
    if (action === "ack") return json(await acknowledgeDesktopAgentCommand(payload));
    return json({ ok: false, error: "Desktop Agent action không hợp lệ.", code: "INVALID_AGENT_ACTION" }, 400);
  } catch (error) {
    return desktopAgentErrorResponse(error);
  }
}
