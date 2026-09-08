import { ControlAccessError, controlErrorResponse, verifyControlProof } from "../../../../control-device.server";
import { bulkUpdateManagedAppDevices, listManagedAppDeviceAudit } from "../../../../managed-app-device-admin.server";
import { listManagedAppDevicesWithProfiles, updateManagedAppDeviceProfile, type ManagedAppDeviceWithProfile } from "../../../../managed-app-device-profile.server";
import { updateManagedAppDevice } from "../../../../managed-app-device.server";

export const dynamic = "force-dynamic";

function requireGrantRole(role: string) {
  if (!["publisher", "owner"].includes(role)) {
    throw new ControlAccessError("Chỉ Publisher hoặc Owner được cấp/thu hồi quyền thiết bị Hòa nhập Nga.", 403, "ROLE_REQUIRED");
  }
}

function profileComplete(device: ManagedAppDeviceWithProfile) {
  return Boolean(device.profile?.personName?.trim() && device.profile?.personCode?.trim());
}

async function requireIdentifiedDevices(deviceIds: unknown) {
  const requested = Array.isArray(deviceIds)
    ? [...new Set(deviceIds.filter((value): value is string => typeof value === "string" && /^[a-f0-9]{64}$/.test(value)))]
    : typeof deviceIds === "string" && /^[a-f0-9]{64}$/.test(deviceIds) ? [deviceIds] : [];
  if (!requested.length) throw new ControlAccessError("Không có thiết bị Hòa nhập Nga hợp lệ để cấp quyền.", 400, "INVALID_DEVICE");

  const devices = await listManagedAppDevicesWithProfiles("hoa-nhap-nga");
  const selected = requested.map((deviceId) => devices.find((device) => device.deviceId === deviceId)).filter(Boolean) as ManagedAppDeviceWithProfile[];
  if (selected.length !== requested.length) {
    throw new ControlAccessError("Có thiết bị không còn tồn tại trong registry Hòa nhập Nga.", 404, "DEVICE_NOT_FOUND");
  }
  const incomplete = selected.filter((device) => !profileComplete(device));
  if (incomplete.length) {
    const codes = incomplete.slice(0, 5).map((device) => device.deviceCode).join(", ");
    throw new ControlAccessError(
      `Chưa thể cấp quyền. Hãy nhập đủ Họ tên và Mã người dùng cho ${incomplete.length} thiết bị${codes ? `: ${codes}` : ""}.`,
      409,
      "DEVICE_PROFILE_REQUIRED",
    );
  }
}

async function responseState(role: string) {
  return {
    devices: await listManagedAppDevicesWithProfiles("hoa-nhap-nga"),
    auditLog: ["publisher", "owner"].includes(role) ? await listManagedAppDeviceAudit("hoa-nhap-nga") : [],
  };
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
        policy: { requireIdentifiedUserBeforeApprove: true },
        ...(await responseState(actor.role)),
      }, { headers: { "cache-control": "no-store, private", "x-content-type-options": "nosniff" } });
    }

    if (["approve", "block", "pending", "label"].includes(action)) {
      requireGrantRole(actor.role);
      if (action === "approve") await requireIdentifiedDevices(body.deviceId);
      const status = action === "approve" ? "approved" : action === "block" ? "blocked" : action === "pending" ? "pending" : undefined;
      await updateManagedAppDevice({
        appId: "hoa-nhap-nga",
        deviceId: body.deviceId,
        status,
        label: action === "label" ? body.label : undefined,
        actor: actor.email,
      });
      return Response.json({ ok: true, policy: { requireIdentifiedUserBeforeApprove: true }, ...(await responseState(actor.role)) }, {
        headers: { "cache-control": "no-store, private", "x-content-type-options": "nosniff" },
      });
    }

    if (action === "profile") {
      requireGrantRole(actor.role);
      await updateManagedAppDeviceProfile({
        appId: "hoa-nhap-nga",
        deviceId: body.deviceId,
        personName: body.personName,
        personCode: body.personCode,
        groupName: body.groupName,
        purpose: body.purpose,
        adminNote: body.adminNote,
        actor: actor.email,
      });
      return Response.json({ ok: true, policy: { requireIdentifiedUserBeforeApprove: true }, ...(await responseState(actor.role)) }, {
        headers: { "cache-control": "no-store, private", "x-content-type-options": "nosniff" },
      });
    }

    if (action === "bulk") {
      requireGrantRole(actor.role);
      const operation = typeof body.operation === "string" ? body.operation : "";
      const status = operation === "approve" ? "approved" : operation === "block" ? "blocked" : operation === "pending" ? "pending" : null;
      if (!status) throw new ControlAccessError("Thao tác hàng loạt không hợp lệ.", 400, "INVALID_BULK_ACTION");
      if (operation === "approve") await requireIdentifiedDevices(body.deviceIds);
      await bulkUpdateManagedAppDevices({
        appId: "hoa-nhap-nga",
        deviceIds: body.deviceIds,
        status,
        actor: actor.email,
      });
      return Response.json({ ok: true, policy: { requireIdentifiedUserBeforeApprove: true }, ...(await responseState(actor.role)) }, {
        headers: { "cache-control": "no-store, private", "x-content-type-options": "nosniff" },
      });
    }

    throw new ControlAccessError("Thao tác quản lý thiết bị Hòa nhập Nga không hợp lệ.", 400, "INVALID_APP_DEVICE_ACTION");
  } catch (error) {
    return controlErrorResponse(error);
  }
}
