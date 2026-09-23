import { issueBoiBrowserBridge } from "../../../../boi-ech.server";
import { controlErrorResponse, verifyControlProof } from "../../../../control-device.server";

export const dynamic = "force-dynamic";

const TIMEOUT_MS = 4_500;
const MAX_PAYMENT_PROOF_BYTES = 8 * 1024 * 1024;
const PAYMENT_PROOF_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
type UnknownRecord = Record<string, unknown>;
type AccessOperation = "grant-free" | "require-payment" | "renew-access" | "verify-payment" | "reject-payment";

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
  if (value === null || value === undefined || value === "") return null;
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

async function bridgeProof(bridge: Bridge, deviceId: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(`${bridge.baseUrl}/api/control/payment-proof?deviceId=${encodeURIComponent(deviceId)}`, {
      method: "GET",
      headers: { authorization: `Bearer ${bridge.token}` },
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok) {
      const payload = record(await response.json().catch(() => ({})));
      return { ok: false as const, status: response.status, payload };
    }
    const contentType = (response.headers.get("content-type") ?? "").split(";", 1)[0].trim().toLowerCase();
    if (!PAYMENT_PROOF_TYPES.has(contentType) || !response.body) {
      response.body?.cancel().catch(() => undefined);
      return { ok: false as const, status: 502, payload: { error: "Bơi ếch trả về chứng từ không đúng định dạng ảnh cho phép.", code: "PAYMENT_PROOF_INVALID_UPSTREAM_TYPE" } };
    }
    const declaredBytes = Number(response.headers.get("content-length"));
    if (Number.isFinite(declaredBytes) && declaredBytes > MAX_PAYMENT_PROOF_BYTES) {
      response.body.cancel().catch(() => undefined);
      return { ok: false as const, status: 413, payload: { error: "Chứng từ thanh toán vượt quá giới hạn 8 MB.", code: "PAYMENT_PROOF_TOO_LARGE" } };
    }
    const body = await response.arrayBuffer();
    if (!body.byteLength) {
      return { ok: false as const, status: 502, payload: { error: "Chứng từ thanh toán rỗng.", code: "PAYMENT_PROOF_EMPTY" } };
    }
    if (body.byteLength > MAX_PAYMENT_PROOF_BYTES) {
      return { ok: false as const, status: 413, payload: { error: "Chứng từ thanh toán vượt quá giới hạn 8 MB.", code: "PAYMENT_PROOF_TOO_LARGE" } };
    }
    return { ok: true as const, status: 200, contentType, body };
  } catch (error) {
    if (controller.signal.aborted) return { ok: false as const, status: 504, payload: { error: `Bơi ếch không phản hồi trong ${TIMEOUT_MS / 1_000} giây.` } };
    return { ok: false as const, status: 502, payload: { error: error instanceof Error ? error.message : "Không tải được chứng từ Bơi ếch." } };
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
  if (operation === "require-payment") return text(row.accessGroup) === "paid" && text(row.paymentStatus) === "awaiting_payment";
  if (operation === "verify-payment") return text(row.status) === "approved" && text(row.accessGroup) === "paid" && text(row.paymentStatus) === "paid_verified";
  if (operation === "reject-payment") return text(row.status) === "pending" && text(row.accessGroup) === "paid" && text(row.paymentStatus) === "awaiting_payment" && !bool(row.paymentProofAvailable);
  return text(row.status) === "approved" && !bool(row.accessExpired) && Boolean(text(row.accessExpiresAt));
}

async function overview(bridge: Bridge) {
  return await bridgeJson(bridge, "/api/control/overview?activityDays=0");
}

function paymentReviewReady(row: UnknownRecord) {
  return text(row.accessGroup) === "paid" && text(row.paymentStatus) === "proof_submitted" && bool(row.paymentProofAvailable);
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
          paid: devices.filter((device) => device.paymentStatus === "paid_verified").length,
          free: devices.filter((device) => device.accessGroup === "free").length,
          awaitingPayment: devices.filter((device) => device.paymentStatus === "awaiting_payment").length,
          proofSubmitted: devices.filter((device) => device.paymentStatus === "proof_submitted").length,
          expired: devices.filter((device) => device.accessExpired).length,
          expiringSoon: devices.filter((device) => device.accessExpiringSoon).length,
        },
        generatedAt: new Date().toISOString(),
      });
    }

    if (action === "payment-proof") {
      if (actor.role !== "publisher" && actor.role !== "owner") return json({ error: "Vai trò hiện tại không được xem chứng từ thanh toán Bơi ếch.", code: "PUBLISHER_REQUIRED" }, 403);
      const deviceId = text(payload.deviceId).toLowerCase();
      if (!/^[a-f0-9]{64}$/.test(deviceId)) return json({ error: "Mã thiết bị Bơi ếch không hợp lệ.", code: "INVALID_DEVICE_ID" }, 400);
      const before = await overview(bridge);
      if (!before.ok) return json(before.payload, before.status);
      const current = deviceById(before.payload, deviceId);
      if (!current) return json({ error: "Thiết bị Bơi ếch không còn trong registry.", code: "DEVICE_NOT_FOUND" }, 404);
      if (!paymentReviewReady(current)) return json({ error: "Thiết bị không có chứng từ đang chờ xác minh.", code: "PAYMENT_PROOF_NOT_REVIEWABLE" }, 409);
      const proof = await bridgeProof(bridge, deviceId);
      if (!proof.ok) return json(proof.payload, proof.status);
      return new Response(proof.body, {
        status: 200,
        headers: {
          "content-type": proof.contentType,
          "cache-control": "no-store, private",
          "content-disposition": "inline",
          "content-security-policy": "default-src 'none'; frame-ancestors 'none'",
          "cross-origin-resource-policy": "same-origin",
          "x-content-type-options": "nosniff",
        },
      });
    }

    if (action === "manage-access") {
      if (actor.role !== "publisher" && actor.role !== "owner") return json({ error: "Vai trò hiện tại không được thay đổi thanh toán/quyền Bơi ếch.", code: "PUBLISHER_REQUIRED" }, 403);
      const deviceId = text(payload.deviceId).toLowerCase();
      const operation = text(payload.operation) as AccessOperation;
      if (!/^[a-f0-9]{64}$/.test(deviceId)) return json({ error: "Mã thiết bị Bơi ếch không hợp lệ.", code: "INVALID_DEVICE_ID" }, 400);
      if (!["grant-free", "require-payment", "renew-access", "verify-payment", "reject-payment"].includes(operation)) return json({ error: "Thao tác thanh toán/quyền không hợp lệ.", code: "INVALID_ACCESS_OPERATION" }, 400);

      const before = await overview(bridge);
      if (!before.ok) return json(before.payload, before.status);
      const current = deviceById(before.payload, deviceId);
      if (!current) return json({ error: "Thiết bị Bơi ếch không còn trong registry.", code: "DEVICE_NOT_FOUND" }, 404);
      const expectedPaymentStatus = text(payload.expectedPaymentStatus);
      const expectedAccessGroup = text(payload.expectedAccessGroup);
      const currentPaymentStatus = text(current.paymentStatus);
      const currentAccessGroup = text(current.accessGroup);
      if (expectedPaymentStatus && currentPaymentStatus !== expectedPaymentStatus) return json({ error: "Trạng thái thanh toán đã thay đổi. Hãy đồng bộ lại.", code: "PAYMENT_STATE_CONFLICT" }, 409);
      if (expectedAccessGroup && currentAccessGroup !== expectedAccessGroup) return json({ error: "Nhóm quyền đã thay đổi. Hãy đồng bộ lại.", code: "ACCESS_STATE_CONFLICT" }, 409);
      if (!bool(current.registrationComplete)) return json({ error: "Hồ sơ người học chưa đầy đủ nên chưa thể thay đổi quyền.", code: "REGISTRATION_INCOMPLETE" }, 409);
      if (operation === "require-payment" && (currentAccessGroup !== "unassigned" || currentPaymentStatus !== "unassigned")) return json({ error: "Tài khoản đã bắt đầu hoặc hoàn tất luồng thanh toán/phân quyền; không gửi lại yêu cầu thanh toán.", code: "PAYMENT_STATE_CONFLICT" }, 409);
      if (operation === "renew-access" && (text(current.status) !== "approved" || !["free_approved", "paid_verified"].includes(currentPaymentStatus))) {
        return json({ error: "Chỉ gia hạn khi quyền miễn phí hoặc thanh toán đã được xác nhận.", code: "ACCESS_STATE_CONFLICT" }, 409);
      }
      if (operation === "grant-free" && ["proof_submitted", "paid_verified"].includes(currentPaymentStatus)) return json({ error: "Tài khoản đã có chứng từ hoặc đã xác minh thanh toán; không chuyển sang miễn phí tại Trung tâm.", code: "PAYMENT_STATE_CONFLICT" }, 409);
      if ((operation === "verify-payment" || operation === "reject-payment") && !paymentReviewReady(current)) return json({ error: "Cần có chứng từ trả phí đang chờ xác minh trước khi thực hiện thao tác này.", code: "PAYMENT_STATE_CONFLICT" }, 409);
      const note = operation === "reject-payment" ? text(payload.note).slice(0, 500) : "";
      if (operation === "reject-payment" && note.length < 5) return json({ error: "Hãy ghi lý do từ chối ít nhất 5 ký tự để người học biết cần sửa gì.", code: "PAYMENT_REJECTION_NOTE_REQUIRED" }, 400);

      const command = await bridgeJson(bridge, "/api/control/overview", {
        method: "POST",
        body: { action: operation, deviceId, ...(operation === "reject-payment" ? { note } : {}) },
      });
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
