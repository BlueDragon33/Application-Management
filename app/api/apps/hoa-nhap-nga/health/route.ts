import { ControlAccessError, controlErrorResponse, verifyControlProof } from "../../../../control-device.server";
import { listManagedAppDevicesWithProfiles } from "../../../../managed-app-device-profile.server";
import { listManagedAppSessions } from "../../../../managed-app-session.server";
import { checkRuLifeIntegrationHealth } from "../../../../ru-life-integration-health.server";
import { listRuLifeIntegrationIncidents, recordRuLifeIntegrationHealth } from "../../../../ru-life-integration-incident.server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json() as Record<string, unknown>;
    const previewRequest = ["terminal.local", "localhost"].includes(new URL(request.url).hostname);
    const actor = await verifyControlProof(body, undefined, previewRequest);
    if (!["reviewer", "publisher", "owner"].includes(actor.role)) {
      throw new ControlAccessError("Không đủ quyền xem trạng thái tích hợp Hòa nhập Nga.", 403, "ROLE_REQUIRED");
    }

    const [integration, devices, sessions] = await Promise.all([
      checkRuLifeIntegrationHealth(),
      listManagedAppDevicesWithProfiles("hoa-nhap-nga"),
      listManagedAppSessions("hoa-nhap-nga", 50),
    ]);
    await recordRuLifeIntegrationHealth(integration);
    const incidents = await listRuLifeIntegrationIncidents(30);

    const now = Date.now();
    const active = devices.filter((device) => {
      const lastSeen = Date.parse(device.lastSeenAt);
      return Number.isFinite(lastSeen) && now - lastSeen < 5 * 60 * 1000;
    }).length;
    const activeSessions = sessions.filter((session) => session.state === "active").length;

    return Response.json({
      ok: true,
      actor,
      integration,
      registry: {
        total: devices.length,
        pending: devices.filter((device) => device.status === "pending").length,
        approved: devices.filter((device) => device.status === "approved").length,
        blocked: devices.filter((device) => device.status === "blocked").length,
        active,
        activeSessions,
        unknownClass: devices.filter((device) => device.deviceClass === "unknown").length,
        missingUserProfile: devices.filter((device) => !device.profile?.personName?.trim() || !device.profile?.personCode?.trim()).length,
      },
      sessions,
      incidents,
    }, {
      headers: {
        "cache-control": "no-store, private",
        "x-content-type-options": "nosniff",
      },
    });
  } catch (error) {
    return controlErrorResponse(error);
  }
}
