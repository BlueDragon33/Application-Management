import {
  challengeDesktopAgent,
  desktopAgentErrorResponse,
  heartbeatDesktopAgent,
  registerDesktopAgent,
  submitDesktopAgentResult,
} from "../../desktop-agent.server";

export const dynamic = "force-dynamic";

function json(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as Record<string, unknown>;
    const action = typeof payload.action === "string" ? payload.action : "";

    if (action === "register") {
      return json(await registerDesktopAgent(payload));
    }
    if (action === "challenge") {
      return json(await challengeDesktopAgent(payload));
    }
    if (action === "heartbeat") {
      return json(await heartbeatDesktopAgent(payload));
    }
    if (action === "result") {
      return json(await submitDesktopAgentResult(payload));
    }

    return json(
      { error: "Desktop agent action không hợp lệ.", code: "INVALID_AGENT_ACTION" },
      400,
    );
  } catch (error) {
    return desktopAgentErrorResponse(error);
  }
}
