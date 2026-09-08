import { controlErrorResponse, verifyControlProof } from "../../../../control-device.server";
import {
  listRuLifeAudit,
  listRuLifeDevices,
  listRuLifeSessions,
  manageRuLifeDevice,
  revokeRuLifeSession,
  ruLifeErrorResponse,
} from "../../../../ru-life-device.server";

export const dynamic = "force-dynamic";

function response(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { "cache-control": "no-store, private", "x-content-type-options": "nosniff" } });
}

export async function POST(request: Request) {
  try {
    const payload = await request.json() as Record<string, unknown>;
    const previewRequest = ["terminal.local", "localhost"].includes(new URL(request.url).hostname);
    const actor = await verifyControlProof(payload, undefined, previewRequest);
    const action = typeof payload.action === "string" ? payload.action : "bootstrap";

    if (action === "bootstrap") {
      const [devices, sessions, audit] = await Promise.all([
        listRuLifeDevices(),
        listRuLifeSessions(),
        ["reviewer", "publisher", "owner"].includes(actor.role) ? listRuLifeAudit() : Promise.resolve([]),
      ]);
      return response({ actor, application: "ru-life", devices, sessions, audit });
    }

    if (action === "manage-device") {
      const device = await manageRuLifeDevice(actor.email, actor.role, payload);
      return response({ device, devices: await listRuLifeDevices(), sessions: await listRuLifeSessions() });
    }

    if (action === "revoke-session") {
      await revokeRuLifeSession(actor.email, actor.role, payload.sessionId);
      return response({ sessions: await listRuLifeSessions(), audit: ["reviewer", "publisher", "owner"].includes(actor.role) ? await listRuLifeAudit() : [] });
    }

    return response({ error: "Thao tác quản trị Hòa nhập Nga không hợp lệ.", code: "INVALID_RU_LIFE_ADMIN_ACTION" }, 400);
  } catch (error) {
    const ruResponse = ruLifeErrorResponse(error);
    if (ruResponse.status !== 500 || error instanceof Error && error.name === "RuLifeAccessError") return ruResponse;
    return controlErrorResponse(error);
  }
}
