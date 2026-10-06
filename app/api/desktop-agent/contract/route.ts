import {
  DESKTOP_AGENT_COMMANDS,
  DESKTOP_AGENT_PROTOCOL,
  PC_MANAGER_IDENTITY,
} from "../../../desktop-agent.server";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(
    {
      schema: DESKTOP_AGENT_PROTOCOL,
      protocol: DESKTOP_AGENT_PROTOCOL,
      application: {
        id: PC_MANAGER_IDENTITY.appId,
        platform: PC_MANAGER_IDENTITY.platform,
        deviceType: PC_MANAGER_IDENTITY.deviceType,
      },
      transport: {
        direction: "client-outbound-only",
        inboundPortRequired: false,
        heartbeatSeconds: 60,
        offlineAfterSeconds: 120,
      },
      authentication: {
        keyType: "P-256",
        proof: "one-time-challenge + ECDSA-SHA256",
        signatureMessage:
          "pc-manager-agent/v1:{deviceId}:{challenge}:{heartbeat|result}",
      },
      endpoints: {
        gateway: "/api/desktop-agent",
        contract: "/api/desktop-agent/contract",
        admin: "/api/desktop-agent/admin",
      },
      commandAllowList: DESKTOP_AGENT_COMMANDS,
      prohibited: [
        "arbitrary-shell",
        "arbitrary-powershell",
        "arbitrary-process-execution",
        "arbitrary-registry-mutation",
        "arbitrary-download-and-run",
      ],
    },
    {
      headers: {
        "cache-control": "no-store",
        "x-content-type-options": "nosniff",
      },
    },
  );
}
