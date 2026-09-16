import { verifyControlProof, type ControlDeviceState } from "../../control-device.server";
import { issueBoiBrowserBridge } from "../../boi-ech.server";
import { issueBaumanBrowserBridge } from "../../bauman.server";

export const dynamic = "force-dynamic";

const UPSTREAM_TIMEOUT_MS = 4_500;
type UnknownRecord = Record<string, unknown>;
type Bridge = { baseUrl: string; token: string };
type DeviceStatus = "pending" | "approved" | "blocked" | "unknown";

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

function expectedFromPayload(payload: Record<string, unknown>, liveStatus: DeviceStatus) {
  const supplied = normalizedStatus(payload.expectedStatus);
  return supplied === "unknown" ? liveStatus : supplied;
}

function assertSnapshot(payload: Record<string, unknown>, liveStatus: DeviceStatus, appName: string) {
  const expectedStatus = expectedFromPayload(payload, liveStatus);
  if (expectedStatus !== liveStatus) {
    return json({ error: `Snapshot ${appName} đã thay đổi: expected ${expectedStatus}, hiện tại ${liveStatus}.`, code: "DEVICE_STATE_CONFLICT" }, 409);
  }
  return null;
}

async function handleBoi(actor: ControlDeviceState, payload: Record<string, unknown>, operation: "approve" | "remove", deviceId: string) {
  if (operation === "approve" && actor.role !== "publisher" && actor.role !== "owner") {
    return json({ error: "Vai trò hiện tại không được duyệt thiết bị Bơi ếch.", code: "PUBLISHER_REQUIRED" }, 403);
  }
  if (operation === "remove" && actor.role !== "owner") {
    return json({ error: "Chỉ Chủ hệ thống được xóa thiết bị Bơi ếch.", code: "OWNER_REQUIRED" }, 403);
  }

  const bridge = await issueBoiBrowserBridge(actor.email, actor.role);
  const before = await bridgeJson(bridge, "/api/control/overview?activityDays=0");
  const current = rowByDeviceId(before, deviceId);
  if (!current) return json({ error: "Thiết bị Bơi ếch không còn trong registry.", code: "DEVICE_NOT_FOUND" }, 404);

  const liveStatus = normalizedStatus(current.status);
  const conflict = assertSnapshot(payload, liveStatus, "Bơi ếch");
  if (conflict) return conflict;

  if (operation === "approve") {
    if (liveStatus !== "pending") return json({ error: "Thiết bị Bơi ếch không còn ở trạng thái chờ duyệt.", code: "DEVICE_STATE_CONFLICT" }, 409);
    await bridgeJson(bridge, "/api/control/overview", {
      method: "POST",
      body: { action: "grant-free", deviceId },
    });
    const after = await bridgeJson(bridge, "/api/control/overview?activityDays=0");
    const updated = rowByDeviceId(after, deviceId);
    if (!updated || normalizedStatus(updated.status) === "pending") {
      return json({ error: "Bơi ếch chưa xác nhận quyền truy cập sau thao tác duyệt.", code: "DEVICE_COMMAND_READBACK_MISMATCH" }, 502);
    }
    return json({ ok: true, verified: true, verifiedStatus: normalizedStatus(updated.status), approvedDeviceId: deviceId });
  }

  if (liveStatus === "blocked" || liveStatus === "unknown") {
    return json({ error: "Thiết bị Bơi ếch đã bị khóa hoặc trạng thái không xác định.", code: "DEVICE_STATE_CONFLICT" }, 409);
  }

  const liveDeviceCode = text(current.deviceCode).toUpperCase();
  const suppliedDeviceCode = text(payload.deviceCode).toUpperCase();
  const deviceCode = liveDeviceCode || suppliedDeviceCode;
  if (!/^BE-[A-Z0-9-]{8,60}$/.test(deviceCode)) {
    return json({ error: "Mã xác nhận thiết bị Bơi ếch không hợp lệ.", code: "INVALID_DEVICE_CODE" }, 400);
  }
  if (liveDeviceCode && suppliedDeviceCode && liveDeviceCode !== suppliedDeviceCode) {
    return json({ error: "Mã thiết bị Bơi ếch đã thay đổi; cần đồng bộ lại trước khi xóa.", code: "DEVICE_STATE_CONFLICT" }, 409);
  }

  await bridgeJson(bridge, "/api/control/overview", {
    method: "POST",
    body: { action: "delete-spam-device", deviceId, confirmDeviceCode: deviceCode, deleteReason: "spam" },
  });
  const after = await bridgeJson(bridge, "/api/control/overview?activityDays=0");
  if (rowByDeviceId(after, deviceId)) {
    return json({ error: "Bơi ếch chưa xác nhận thiết bị đã được xóa.", code: "DEVICE_COMMAND_READBACK_MISMATCH" }, 502);
  }
  return json({ ok: true, verified: true, verifiedStatus: "deleted", removedDeviceId: deviceId });
}

async function handleBauman(actor: ControlDeviceState, payload: Record<string, unknown>, operation: "approve" | "remove", deviceId: string) {
  if (actor.role !== "owner") {
    return json({ error: "Bauman yêu cầu quyền Chủ hệ thống để thay đổi thiết bị.", code: "OWNER_REQUIRED" }, 403);
  }

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
    || !bool(capabilities.deviceApproval)
    || !bool(capabilities.deviceIdempotentCommands)
    || !bool(capabilities.optimisticConcurrency)
  ) {
    return json({ error: "Contract Bauman chưa xác nhận device control sẵn sàng.", code: "BAUMAN_DEVICE_COMMAND_CONTRACT_NOT_LIVE" }, 409);
  }

  const before = await bridgeJson(bridge, devicesPath);
  const current = rowByDeviceId(before, deviceId);
  if (!current) return json({ error: "Thiết bị Bauman không còn trong registry.", code: "DEVICE_NOT_FOUND" }, 404);

  const liveStatus = normalizedStatus(current.status);
  const conflict = assertSnapshot(payload, liveStatus, "Bauman");
  if (conflict) return conflict;
  if (operation === "approve" && liveStatus !== "pending") {
    return json({ error: "Thiết bị Bauman không còn ở trạng thái chờ duyệt.", code: "DEVICE_STATE_CONFLICT" }, 409);
  }
  if (operation === "remove" && liveStatus !== "pending" && liveStatus !== "approved") {
    return json({ error: "Thiết bị Bauman đã bị khóa hoặc trạng thái không xác định.", code: "DEVICE_STATE_CONFLICT" }, 409);
  }

  const suppliedCommandId = text(payload.commandId).toLowerCase();
  if (suppliedCommandId && !validCommandId(suppliedCommandId)) {
    return json({ error: "commandId không hợp lệ.", code: "INVALID_COMMAND_ID" }, 400);
  }
  const commandId = suppliedCommandId || crypto.randomUUID();
  const expectedResult = operation === "approve" ? "approved" as const : "blocked" as const;
  const command = await bridgeCommandJson(bridge, commandPath, {
    commandId,
    deviceId,
    operation: operation === "approve" ? "approve" : "block",
    expectedStatus: liveStatus,
  });
  if (text(command.commandId).toLowerCase() !== commandId || normalizedStatus(command.status) !== expectedResult) {
    return json({ error: "Bauman chưa xác nhận commandId hoặc trạng thái kết quả.", code: "DEVICE_COMMAND_READBACK_MISMATCH" }, 502);
  }

  const after = await bridgeJson(bridge, devicesPath);
  const updated = rowByDeviceId(after, deviceId);
  if (!updated || normalizedStatus(updated.status) !== expectedResult) {
    return json({ error: `Bauman chưa xác nhận trạng thái ${expectedResult} sau thao tác.`, code: "DEVICE_COMMAND_READBACK_MISMATCH" }, 502);
  }

  return json({
    ok: true,
    verified: true,
    verifiedStatus: expectedResult,
    commandId,
    commandReplayed: bool(command.replayed),
    ...(operation === "approve" ? { approvedDeviceId: deviceId } : { removedDeviceId: deviceId }),
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

    if (payload.action !== "manage-client-device") {
      return json({ error: "Thao tác điều phối không hợp lệ.", code: "INVALID_OPERATIONS_ACTION" }, 400);
    }
    if (operation !== "approve" && operation !== "remove") {
      return json({ error: "Thao tác thiết bị không hợp lệ.", code: "INVALID_DEVICE_OPERATION" }, 400);
    }
    if (!validDeviceId(deviceId)) {
      return json({ error: "Mã thiết bị không hợp lệ.", code: "INVALID_DEVICE_ID" }, 400);
    }
    if (appId === "boi-ech") return await handleBoi(actor, payload, operation, deviceId);
    if (appId === "bauman-master-ai") return await handleBauman(actor, payload, operation, deviceId);
    return json({ error: "Endpoint này chỉ xử lý Bơi ếch và Bauman Hub.", code: "CLIENT_ACTION_UNAVAILABLE" }, 409);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Không thể cập nhật thiết bị client.", code: "OPERATIONS_UNAVAILABLE" }, 500);
  }
}
