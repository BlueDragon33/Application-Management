import { issueBoiBrowserBridge } from "../../../../boi-ech.server";
import { controlErrorResponse, verifyControlProof } from "../../../../control-device.server";

export const dynamic = "force-dynamic";

const TIMEOUT_MS = 4_500;
type UnknownRecord = Record<string, unknown>;
type AccessOperation = "grant-free" | "require-payment" | "renew-access";

type Bridge = Awaited<ReturnType<typeof issueBoiBrowserBridge>>;

function record(value: unknown): UnknownRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as UnknownRecord : {};
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function bool(value: unknown) {
  return value === true;
}

function numberOrNull(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { "cache-control": "no-store, private", "x-content-type-options": "nosniff" } });
}

async function bridgeJson(bridge: Bridge, path: string, init?: { method?: "GET" | "POST"; body?: UnknownRecord }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(`${bridge.baseUrl}${path}`, {
      method: init?.method ?? "GET",
      headers: { authorization: `Bearer ${bridge.token}`, "content-type": "application/json" },
      body: init?.body ? JSON.stringify(init.body) : undefined,
      cache: "no-store",
      signal: controller.signal,
    });
    const payload = record(await response.json().catch(() => ({})));
    if (!response.ok) return { ok: false as const, status: response.status, payload };
    return { ok: true as const, status: response.status, payload };
  } catch (error) {
    if (controller.signal.aborted) return { ok: false as const, status: 504, payload: { error: `Bơi ếch không phản hồi trong ${TIMEOUT_MS / 1_000} giây.` } };
    return { ok: false as const, status: 502, payload: { error: error instanceof Error ? error.message : "Không kết nối được Bơi ếch." } };
  } finally {
    clearTimeout(timeout);
  }
}

function rows(payload: UnknownRecord) {
  return Array.isArray(payload.devices) ? payload.devices.map(record) : [];
}

function deviceById(payload: UnknownRecord, deviceId: string) {
  return rows(payload).find((row) => text(row.deviceId).toLowerCase() === deviceId) ?? null;
}

function accessDevice(row: UnknownRecord) {
  const paymentStatus = text(row.paymentStatus);
  const accessGroup = text(row.accessGroup);
  return {
    deviceId: text(row.deviceId),
    deviceCode: text(row.deviceCode),
    learnerName: text(row.learnerName) || text(row.personCode) || text(row.deviceCode) || "Chưa nhập hồ sơ",
    personCode: text(row.personCode) || null,
    registrationComplete: bool(row.registrationComplete),
    status: ["pending", "approved", "blocked"].includes(text(row.status)) ? text(row.status) : "pending",
    accessGroup: ["unassigned", "free", "paid"].includes(accessGroup) ? accessGroup : "unassigned",
    paymentStatus: ["unassigned", "awaiting_payment", "proof_submitted", "free_approved", "paid_verified"].includes(paymentStatus) ? paymentStatus : "unassigned",
    paymentAmount: numberOrNull(row.paymentAmount) ?? 0,
    paymentProofAvailable: bool(row.paymentProofAvailable),
    paymentSubmittedAt: text(row.paymentSubmittedAt) || null,
    paymentVerifiedAt: text(row.paymentVerifiedAt) || null,
    paymentRejectedAt: text(row.paymentRejectedAt) || null,
    paymentReviewNote: text(row.paymentReviewNote) || null,
    accessExpiresAt: text(row.accessExpiresAt) || null,
    accessExpired: bool(row.accessExpired),
    accessExpiringSoon: bool(row.accessExpiringSoon),
    accessDaysRemaining: numberOrNull(row.accessDaysRemaining),
    active: bool(row.active),
    lastSeenAt: text(row.lastSeenAt) || text(row.lastPresenceAt) || null,
  };
}

function readbackMatches(operation: AccessOperation, row: UnknownRecord) {
  if (operation === "grant-free") return text(row.accessGroup) === "free" && text(row.paymentStatus) === "free_approved";
  if (operation === "require-payment") return text(row.paymentStatus) === "awaiting_payment";
  return text(row.status) === "approved" && !bool(row.accessExpired) && Boolean(text(row.accessExpiresAt));
}

async function overview(bridge: Bridge) {
  return await bridgeJson(bridge, "/api/control/overview?activityDays=0");
}

export async function POST(request: Request) {
  try {
    const payload = await request.json() as Record<string, unknown>;
    const previewRequest = ["terminal.local", "localhost"].includes(new URL(request.url).hostname);
    const actor = await verifyControlProof(payload, undefined, previewRequest);
    const bridge = await issueBoiBrowserBridge(actor.email, actor.role);
    const action = text(payload.action) || "bootstrap";

    if (action === "bootstrap") {
      const result = await overview(bridge);
      if (!result.ok) return json(result.payload, result.status);
      const devices = rows(result.payload).map(accessDevice);
      return json({
        ok: true,
        application: "boi-ech",
        devices,
        counts: {
          total: devices.length,
          paid: devices.filter((device) => device.accessGroup === "paid").length,
          free: devices.filter((device) => device.accessGroup === "free").length,
          awaitingPayment: devices.filter((device) => device.paymentStatus === "awaiting_payment").length,
          proofSubmitted: devices.filter((device) => device.paymentStatus === "proof_submitted").length,
          expired: devices.filter((device) => device.accessExpired).length,
          expiringSoon: devices.filter((device) => device.accessExpiringSoon).length,
        },
        generatedAt: new Date().toISOString(),
      });
    }

    if (action === "manage-access") {
      if (actor.role !== "publisher" && actor.role !== "owner") return json({ error: "Vai trò hiện tại không được thay đổi thanh toán/quyền Bơi ếch.", code: "PUBLISHER_REQUIRED" }, 403);
      const deviceId = text(payload.deviceId).toLowerCase();
      const operation = text(payload.operation) as AccessOperation;
      if (!/^[a-f0-9]{64}$/.test(deviceId)) return json({ error: "Mã thiết bị Bơi ếch không hợp lệ.", code: "INVALID_DEVICE_ID" }, 400);
      if (!["grant-free", "require-payment", "renew-access"].includes(operation)) return json({ error: "Thao tác thanh toán/quyền không hợp lệ.", code: "INVALID_ACCESS_OPERATION" }, 400);

      const before = await overview(bridge);
      if (!before.ok) return json(before.payload, before.status);
      const current = deviceById(before.payload, deviceId);
      if (!current) return json({ error: "Thiết bị Bơi ếch không còn trong registry.", code: "DEVICE_NOT_FOUND" }, 404);
      const expectedPaymentStatus = text(payload.expectedPaymentStatus);
      const expectedAccessGroup = text(payload.expectedAccessGroup);
      if (expectedPaymentStatus && text(current.paymentStatus) !== expectedPaymentStatus) return json({ error: "Trạng thái thanh toán đã thay đổi. Hãy đồng bộ lại.", code: "PAYMENT_STATE_CONFLICT" }, 409);
      if (expectedAccessGroup && text(current.accessGroup) !== expectedAccessGroup) return json({ error: "Nhóm quyền đã thay đổi. Hãy đồng bộ lại.", code: "ACCESS_STATE_CONFLICT" }, 409);
      if (!bool(current.registrationComplete)) return json({ error: "Hồ sơ người học chưa đầy đủ nên chưa thể thay đổi quyền.", code: "REGISTRATION_INCOMPLETE" }, 409);
      if (operation === "require-payment" && text(current.accessGroup) !== "unassigned") return json({ error: "Tài khoản đã được phân nhóm quyền, không thể gửi yêu cầu thanh toán mới.", code: "ACCESS_STATE_CONFLICT" }, 409);
      if (operation === "grant-free" && text(current.paymentStatus) === "paid_verified") return json({ error: "Tài khoản đã xác minh thanh toán, không chuyển sang miễn phí tại Trung tâm.", code: "PAYMENT_STATE_CONFLICT" }, 409);

      const command = await bridgeJson(bridge, "/api/control/overview", { method: "POST", body: { action: operation, deviceId } });
      if (!command.ok) return json(command.payload, command.status);
      const after = await overview(bridge);
      if (!after.ok) return json(after.payload, after.status);
      const updated = deviceById(after.payload, deviceId);
      if (!updated || !readbackMatches(operation, updated)) return json({ error: "Bơi ếch chưa xác nhận trạng thái thanh toán/quyền sau thao tác.", code: "ACCESS_READBACK_MISMATCH" }, 502);
      return json({ ok: true, verified: true, device: accessDevice(updated) });
    }

    return json({ error: "Thao tác thanh toán/quyền Bơi ếch không hợp lệ.", code: "INVALID_ACCESS_ACTION" }, 400);
  } catch (error) {
    return controlErrorResponse(error);
  }
}
