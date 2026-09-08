import { ControlAccessError, controlErrorResponse, verifyControlProof } from "../../../../control-device.server";
import { listManagedAppDevicesWithProfiles } from "../../../../managed-app-device-profile.server";
import { checkRuLifeIntegrationHealth } from "../../../../ru-life-integration-health.server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json() as Record<string, unknown>;
    const previewRequest = ["terminal.local", "localhost"].includes(new URL(request.url).hostname);
    const actor = await verifyControlProof(body, undefined, previewRequest);
    if (!["reviewer", "publisher", "owner"].includes(actor.role)) {
      throw new ControlAccessError("Không đủ quyền xem trạng thái tích hợp Hòa nhập Nga.", 403, "ROLE_REQUIRED");
    }

    const [integration, devices] = await Promise.all([
      checkRuLifeIntegrationHealth(),
      listManagedAppDevicesWithProfiles("hoa-nhap-nga"),
    ]);

    const now = Date.now();
    const active = devices.filter((device) => {
      const lastSeen = Date.parse(device.lastSeenAt);
      return Number.isFinite(lastSeen) && now - lastSeen < 5 * 60 * 1000;
    }).length;

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
        unknownClass: devices.filter((device) => device.deviceClass === "unknown").length,
        missingUserProfile: devices.filter((device) => !device.profile?.personName?.trim() || !device.profile?.personCode?.trim()).length,
      },
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
