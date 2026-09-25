import { verifyControlProof, type ControlDeviceState } from "../../control-device.server";
import { issueBoiBrowserBridge } from "../../boi-ech.server";
import { issueBaumanBrowserBridge } from "../../bauman.server";

export const dynamic = "force-dynamic";

const UPSTREAM_TIMEOUT_MS = 4_500;
type UnknownRecord = Record<string, unknown>;
type Bridge = { baseUrl: string; token: string };
type DeviceStatus = "pending" | "approved" | "blocked" | "unknown";
type ReconciledDevice = {
  row: UnknownRecord;
  rebound: boolean;
  reason: "device-id" | "device-code" | "single-pending-reconcile";
};

function json(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: { "cache-control": "no-store, private", "x-content-type-options": "nosniff" },
  });
}

function record(value: unknown): UnknownRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as UnknownRecord : {};
}

function text(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function bool(value: unknown) {
  return value === true;
}

function normalizedStatus(value: unknown): DeviceStatus {
  return value === "pending" || value === "approved" || value === "blocked" ? value : "unknown";
}

function normalizedDeviceCode(value: unknown) {
  return text(value).trim().toUpperCase();
}

function normalizedLooseText(value: unknown) {
  return text(value).trim().toLocaleLowerCase("vi-VN");
}

function validDeviceId(value: string) {
  return value.length >= 1 && value.length <= 256 && !/[\u0000-\u001f\u007f]/.test(value);
}

function validCommandId(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function rows(data: UnknownRecord) {
  return Array.isArray(data.devices) ? data.devices.map(record) : [];
}

function rowByDeviceId(data: UnknownRecord, deviceId: string) {
  return rows(data).find((item) => text(item.deviceId) === deviceId) ?? null;
}

function rowByDeviceCode(data: UnknownRecord, deviceCode: string) {
  if (!deviceCode || deviceCode === "—") return null;
  return rows(data).find((item) => normalizedDeviceCode(item.deviceCode) === deviceCode) ?? null;
}

function resolveLiveDevice(data: UnknownRecord, deviceId: string, deviceCode: string): ReconciledDevice | null {
  const byId = rowByDeviceId(data, deviceId);
  if (byId) return { row: byId, rebound: false, reason: "device-id" as const };
  const byCode = rowByDeviceCode(data, deviceCode);
  return byCode ? { row: byCode, rebound: text(byCode.deviceId) !== deviceId, reason: "device-code" as const } : null;
}

function resolveBaumanPendingFallback(data: UnknownRecord, payload: Record<string, unknown>, deviceId: string): ReconciledDevice | null {
  const pending = rows(data).filter((item) => normalizedStatus(item.status) === "pending");
  if (!pending.length) return null;

  const suppliedType = normalizedLooseText(payload.deviceType);
  const suppliedLabel = normalizedLooseText(payload.userLabel);
  const compatible = pending.filter((item) => {
    const liveType = normalizedLooseText(item.deviceType);
    const liveLabel = normalizedLooseText(item.displayName || item.label || item.platform || item.browser);
    const typeMatches = !suppliedType || !liveType || suppliedType === liveType;
    const labelMatches = !suppliedLabel || !liveLabel || suppliedLabel === liveLabel || liveLabel.includes(suppliedLabel) || suppliedLabel.includes(liveLabel);
    return typeMatches && labelMatches;
  });

  const candidates = compatible.length ? compatible : pending;
  if (candidates.length !== 1) return null;
  const row = candidates[0];
  return { row, rebound: text(row.deviceId) !== deviceId, reason: "single-pending-reconcile" as const };
}

async function bridgeJson(bridge: Bridge, path: string, init?: { method?: "GET" | "POST"; body?: UnknownRecord }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
  try {
    const response = await fetch(`${bridge.baseUrl}${path}`, {
      method: init?.method ?? "GET",
      headers: { authorization: `Bearer ${bridge.token}`, "content-type": "application/json" },
      body: init?.body ? JSON.stringify(init.body) : undefined,
      cache: "no-store",
      signal: controller.signal,
    });
    const data = await response.json().catch(() => ({})) as UnknownRecord;
    if (!response.ok) throw new Error(text(data.error, `HTTP_${response.status}`));
    return data;
  } catch (error) {
    if (controller.signal.aborted) throw new Error(`Client phản hồi quá thời hạn ${UPSTREAM_TIMEOUT_MS / 1_000} giây.`);
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function bridgeCommandJson(bridge: Bridge, path: string, body: UnknownRecord) {
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await bridgeJson(bridge, path, { method: "POST", body });
    } catch (error) {
      lastError = error;
      const retryable = error instanceof TypeError
        || (error instanceof Error && error.message.includes("Client phản hồi quá thời hạn"));
      if (!retryable || attempt === 1) throw error;
      await new Promise((resolve) => setTimeout(resolve, 120));
    }
  }
  throw lastError;
}

function expectedFromPayload(payload: Record<string, unknown>) {
  return normalizedStatus(payload.expectedStatus);
}

function assertSnapshot(payload: Record<string, unknown>, liveStatus: DeviceStatus, appName: string) {
  const expectedStatus = expectedFromPayload(payload);
  if (expectedStatus === "unknown") {
    return json({ error: "expectedStatus hợp lệ là bắt buộc cho thao tác thiết bị.", code: "INVALID_EXPECTED_STATUS" }, 400);
  }
  if (expectedStatus !== liveStatus) {
    return json({ error: `Snapshot ${appName} đã thay đổi: expected ${expectedStatus}, hiện tại ${liveStatus}.`, code: "DEVICE_STATE_CONFLICT" }, 409);
  }
  return null;
}

async function handleBoi(actor: ControlDeviceState, payload: Record<string, unknown>, operation: "approve" | "remove", deviceId: string) {
  if (operation === "approve") {
    if (actor.role !== "publisher" && actor.role !== "owner") {
      return json({ error: "Vai trò hiện tại không được phân quyền Bơi ếch.", code: "PUBLISHER_REQUIRED" }, 403);
    }
    return json({
      error: "Thiết bị Bơi ếch phải được xử lý tại Thanh toán & Quyền để chọn rõ Miễn phí hoặc Trả phí; không duyệt mặc định thành miễn phí.",
      code: "BOI_ACCESS_FLOW_REQUIRED",
    }, 409);
  }
  if (actor.role !== "owner") {
    return json({ error: "Chỉ Chủ hệ thống được xóa thiết bị Bơi ếch.", code: "OWNER_REQUIRED" }, 403);
  }

  const bridge = await issueBoiBrowserBridge(actor.email, actor.role);
  const before = await bridgeJson(bridge, "/api/control/overview?activityDays=0");
  const suppliedDeviceCode = normalizedDeviceCode(payload.deviceCode);
  const resolved = resolveLiveDevice(before, deviceId, suppliedDeviceCode);
  if (!resolved) {
    return json({ ok: true, code: "STALE_DEVICE_REMOVED", stale: true, removedDeviceId: deviceId, message: "Thiết bị Bơi ếch đã rời registry; danh sách cần được đồng bộ lại." });
  }
  const current = resolved.row;
  const liveDeviceId = text(current.deviceId);
  if (!validDeviceId(liveDeviceId)) return json({ error: "Registry Bơi ếch trả về deviceId không hợp lệ.", code: "INVALID_LIVE_DEVICE_ID" }, 502);

  const liveStatus = normalizedStatus(current.status);
  const conflict = assertSnapshot(payload, liveStatus, "Bơi ếch");
  if (conflict) return conflict;

  if (liveStatus === "blocked" || liveStatus === "unknown") return json({ error: "Thiết bị Bơi ếch đã bị khóa hoặc trạng thái không xác định.", code: "DEVICE_STATE_CONFLICT" }, 409);

  const liveDeviceCode = normalizedDeviceCode(current.deviceCode);
  const deviceCode = liveDeviceCode || suppliedDeviceCode;
  if (!/^BE-[A-Z0-9-]{8,60}$/.test(deviceCode)) return json({ error: "Mã xác nhận thiết bị Bơi ếch không hợp lệ.", code: "INVALID_DEVICE_CODE" }, 400);
  if (liveDeviceCode && suppliedDeviceCode && liveDeviceCode !== suppliedDeviceCode) return json({ error: "Mã thiết bị Bơi ếch đã thay đổi; cần đồng bộ lại trước khi xóa.", code: "DEVICE_STATE_CONFLICT" }, 409);

  await bridgeJson(bridge, "/api/control/overview", { method: "POST", body: { action: "delete-spam-device", deviceId: liveDeviceId, confirmDeviceCode: deviceCode, deleteReason: "spam" } });
  const after = await bridgeJson(bridge, "/api/control/overview?activityDays=0");
  if (rowByDeviceId(after, liveDeviceId)) return json({ error: "Bơi ếch chưa xác nhận thiết bị đã được xóa.", code: "DEVICE_COMMAND_READBACK_MISMATCH" }, 502);
  return json({ ok: true, verified: true, verifiedStatus: "deleted", removedDeviceId: liveDeviceId, reboundFromDeviceId: resolved.rebound ? deviceId : undefined });
}

async function handleBauman(
  actor: ControlDeviceState,
  payload: Record<string, unknown>,
  operation: "approve" | "remove" | "unblock" | "set-edit-permission",
  deviceId: string,
) {
  if (actor.role !== "owner") return json({ error: "Bauman yêu cầu quyền Chủ hệ thống để thay đổi thiết bị.", code: "OWNER_REQUIRED" }, 403);

  const bridge = await issueBaumanBrowserBridge(actor.email, actor.role, actor.deviceId);
  const status = await bridgeJson(bridge, "/api/control/status");
  const endpoints = record(status.endpoints);
  const capabilities = record(status.capabilities);
  const devicesPath = text(endpoints.devices);
  const commandPath = text(endpoints.deviceCommands);
  if (
    devicesPath !== "/api/control/devices"
    || commandPath !== "/api/control/device-commands"
    || !bool(capabilities.deviceRegistry)
    || !bool(capabilities.deviceIdempotentCommands)
    || !bool(capabilities.optimisticConcurrency)
    || ((operation === "approve" || operation === "remove") && !bool(capabilities.deviceApproval))
    || (operation === "unblock" && !bool(capabilities.deviceUnblock))
    || (operation === "set-edit-permission" && !bool(capabilities.deviceEditPermission))
  ) return json({ error: "Contract Bauman chưa xác nhận capability thiết bị tương ứng.", code: "BAUMAN_DEVICE_COMMAND_CONTRACT_NOT_LIVE" }, 409);

  const suppliedDeviceCode = normalizedDeviceCode(payload.deviceCode);
  let before = await bridgeJson(bridge, devicesPath);
  let resolved = resolveLiveDevice(before, deviceId, suppliedDeviceCode);

  if (!resolved) {
    await new Promise((resolve) => setTimeout(resolve, 180));
    before = await bridgeJson(bridge, devicesPath);
    resolved = resolveLiveDevice(before, deviceId, suppliedDeviceCode) ?? resolveBaumanPendingFallback(before, payload, deviceId);
  }

  if (!resolved) {
    return json({
      ok: true,
      code: "STALE_DEVICE_REMOVED",
      stale: true,
      removedDeviceId: deviceId,
      message: "Thiết bị Bauman cũ đã rời registry; Trung tâm đã bỏ snapshot cũ và sẽ tải lại registry live.",
    });
  }

  const current = resolved.row;
  const liveDeviceId = text(current.deviceId);
  if (!validDeviceId(liveDeviceId)) return json({ error: "Registry Bauman trả về deviceId không hợp lệ.", code: "INVALID_LIVE_DEVICE_ID" }, 502);

  const liveStatus = normalizedStatus(current.status);
  const conflict = assertSnapshot(payload, liveStatus, "Bauman");
  if (conflict) return conflict;
  if (operation === "approve" && liveStatus !== "pending") return json({ error: "Thiết bị Bauman không còn ở trạng thái chờ duyệt.", code: "DEVICE_STATE_CONFLICT" }, 409);
  if (operation === "remove" && liveStatus !== "pending" && liveStatus !== "approved") return json({ error: "Thiết bị Bauman đã bị khóa hoặc trạng thái không xác định.", code: "DEVICE_STATE_CONFLICT" }, 409);
  if (operation === "unblock" && liveStatus !== "blocked") return json({ error: "Chỉ thiết bị Bauman đang bị khóa mới được mở khóa.", code: "DEVICE_STATE_CONFLICT" }, 409);
  const editEnabled = typeof payload.editEnabled === "boolean" ? payload.editEnabled : null;
  if (operation === "set-edit-permission" && (liveStatus !== "approved" || editEnabled === null)) {
    return json({ error: "Quyền sửa chỉ thay đổi trên thiết bị Bauman đã duyệt và phải có editEnabled boolean.", code: "DEVICE_EDIT_PERMISSION_CONFLICT" }, 409);
  }

  const suppliedCommandId = text(payload.commandId).toLowerCase();
  if (suppliedCommandId && !validCommandId(suppliedCommandId)) return json({ error: "commandId không hợp lệ.", code: "INVALID_COMMAND_ID" }, 400);
  const commandId = suppliedCommandId || crypto.randomUUID();
  const expectedResult = operation === "remove" ? "blocked" as const : "approved" as const;
  const upstreamOperation = operation === "approve"
    ? "approve"
    : operation === "remove"
      ? "block"
      : operation === "unblock"
        ? "unblock"
        : "set_edit_permission";
  const command = await bridgeCommandJson(bridge, commandPath, {
    commandId,
    deviceId: liveDeviceId,
    operation: upstreamOperation,
    expectedStatus: liveStatus,
    ...(operation === "set-edit-permission" ? { editEnabled } : {}),
  });
  if (text(command.commandId).toLowerCase() !== commandId || normalizedStatus(command.status) !== expectedResult) {
    return json({ error: "Bauman chưa xác nhận commandId hoặc trạng thái kết quả.", code: "DEVICE_COMMAND_READBACK_MISMATCH" }, 502);
  }

  const after = await bridgeJson(bridge, devicesPath);
  const updated = rowByDeviceId(after, liveDeviceId);
  if (
    !updated
    || normalizedStatus(updated.status) !== expectedResult
    || (operation === "set-edit-permission" && bool(updated.editEnabled) !== editEnabled)
  ) {
    return json({ error: `Bauman chưa xác nhận trạng thái/quyền sau thao tác ${operation}.`, code: "DEVICE_COMMAND_READBACK_MISMATCH" }, 502);
  }

  return json({
    ok: true,
    verified: true,
    verifiedStatus: expectedResult,
    commandId,
    commandReplayed: bool(command.replayed),
    reconciledBy: resolved.reason,
    reboundFromDeviceId: resolved.rebound ? deviceId : undefined,
    ...(operation === "approve" ? { approvedDeviceId: liveDeviceId } : {}),
    ...(operation === "remove" ? { removedDeviceId: liveDeviceId } : {}),
    ...(operation === "unblock" ? { unblockedDeviceId: liveDeviceId } : {}),
    ...(operation === "set-edit-permission" ? { editPermissionDeviceId: liveDeviceId, editEnabled } : {}),
  });
}


export async function POST(request: Request) {
  try {
    const payload = await request.json() as Record<string, unknown>;
    const previewRequest = ["terminal.local", "localhost"].includes(new URL(request.url).hostname);
    const actor = await verifyControlProof(payload, undefined, previewRequest);
    const operation = payload.operation;
    const appId = text(payload.appId);
    const deviceId = text(payload.deviceId);

    if (payload.action !== "manage-client-device") return json({ error: "Thao tác điều phối không hợp lệ.", code: "INVALID_OPERATIONS_ACTION" }, 400);
    if (operation !== "approve" && operation !== "remove" && operation !== "unblock" && operation !== "set-edit-permission") {
      return json({ error: "Thao tác thiết bị không hợp lệ.", code: "INVALID_DEVICE_OPERATION" }, 400);
    }
    if (!validDeviceId(deviceId)) return json({ error: "Mã thiết bị không hợp lệ.", code: "INVALID_DEVICE_ID" }, 400);
    if (appId === "boi-ech") {
      if (operation !== "approve" && operation !== "remove") return json({ error: "Bơi ếch không hỗ trợ thao tác này.", code: "CLIENT_ACTION_UNAVAILABLE" }, 409);
      return await handleBoi(actor, payload, operation, deviceId);
    }
    if (appId === "bauman-master-ai") return await handleBauman(actor, payload, operation, deviceId);
    return json({ error: "Endpoint này chỉ xử lý client đã công bố device-command reconciliation.", code: "CLIENT_ACTION_UNAVAILABLE" }, 409);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Không thể cập nhật thiết bị client.", code: "OPERATIONS_UNAVAILABLE" }, 500);
  }
}