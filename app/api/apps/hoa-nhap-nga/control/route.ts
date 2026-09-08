import { ControlAccessError, controlErrorResponse, verifyControlProof } from "../../../../control-device.server";
import { bulkUpdateManagedAppDevices, listManagedAppDeviceAudit } from "../../../../managed-app-device-admin.server";
import { listManagedAppDevices, updateManagedAppDevice } from "../../../../managed-app-device.server";

export const dynamic = "force-dynamic";

function requireGrantRole(role: string) {
  if (!["publisher", "owner"].includes(role)) {
    throw new ControlAccessError("Chỉ Publisher hoặc Owner được cấp/thu hồi quyền thiết bị Hòa nhập Nga.", 403, "ROLE_REQUIRED");
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as Record<string, unknown>;
    const previewRequest = ["terminal.local", "localhost"].includes(new URL(request.url).hostname);
    const actor = await verifyControlProof(body, undefined, previewRequest);
    const action = typeof body.action === "string" ? body.action : "bootstrap";

    if (action === "bootstrap") {
      return Response.json({
        actor,
        app: { id: "hoa-nhap-nga", name: "Hòa nhập Nga" },
        devices: await listManagedAppDevices("hoa-nhap-nga"),
        auditLog: ["publisher", "owner"].includes(actor.role) ? await listManagedAppDeviceAudit("hoa-nhap-nga") : [],
      }, { headers: { "cache-control": "no-store, private", "x-content-type-options": "nosniff" } });
    }

    if (["approve", "block", "pending", "label"].includes(action)) {
      requireGrantRole(actor.role);
      const status = action === "approve" ? "approved" : action === "block" ? "blocked" : action === "pending" ? "pending" : undefined;
      const device = await updateManagedAppDevice({
        appId: "hoa-nhap-nga",
        deviceId: body.deviceId,
        status,
        label: action === "label" ? body.label : undefined,
        actor: actor.email,
      });
      return Response.json({
        ok: true,
        device,
        devices: await listManagedAppDevices("hoa-nhap-nga"),
        auditLog: await listManagedAppDeviceAudit("hoa-nhap-nga"),
      }, { headers: { "cache-control": "no-store, private", "x-content-type-options": "nosniff" } });
    }

    if (action === "bulk") {
      requireGrantRole(actor.role);
      const operation = typeof body.operation === "string" ? body.operation : "";
      const status = operation === "approve" ? "approved" : operation === "block" ? "blocked" : operation === "pending" ? "pending" : null;
      if (!status) throw new ControlAccessError("Thao tác hàng loạt không hợp lệ.", 400, "INVALID_BULK_ACTION");
      const result = await bulkUpdateManagedAppDevices({
        appId: "hoa-nhap-nga",
        deviceIds: body.deviceIds,
        status,
        actor: actor.email,
      });
      return Response.json({
        ok: true,
        updated: result.updated,
        devices: result.devices,
        auditLog: await listManagedAppDeviceAudit("hoa-nhap-nga"),
      }, { headers: { "cache-control": "no-store, private", "x-content-type-options": "nosniff" } });
    }

    throw new ControlAccessError("Thao tác quản lý thiết bị Hòa nhập Nga không hợp lệ.", 400, "INVALID_APP_DEVICE_ACTION");
  } catch (error) {
    return controlErrorResponse(error);
  }
}
