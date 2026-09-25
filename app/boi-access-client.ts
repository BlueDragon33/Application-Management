"use client";

import { connectAdminCenter, type AdminAccess } from "./admin-device-client";

type Credential = { version: 1; privateKey: CryptoKey | null; publicKey: JsonWebKey };

export type BoiAccessDevice = {
  deviceId: string;
  deviceCode: string;
  learnerName: string;
  personCode: string | null;
  registrationComplete: boolean;
  status: "pending" | "approved" | "blocked";
  accessGroup: "unassigned" | "free" | "paid";
  paymentStatus: "unassigned" | "awaiting_payment" | "proof_submitted" | "free_approved" | "paid_verified";
  paymentAmount: number;
  paymentProofAvailable: boolean;
  paymentSubmittedAt: string | null;
  paymentVerifiedAt: string | null;
  paymentRejectedAt: string | null;
  paymentReviewNote: string | null;
  accessExpiresAt: string | null;
  accessExpired: boolean;
  accessExpiringSoon: boolean;
  accessDaysRemaining: number | null;
  active: boolean;
  lastSeenAt: string | null;
};

export type BoiAccessBootstrap = {
  ok: true;
  application: "boi-ech";
  role: AdminAccess["role"];
  devices: BoiAccessDevice[];
  counts: {
    total: number;
    paid: number;
    free: number;
    awaitingPayment: number;
    proofSubmitted: number;
    expired: number;
    expiringSoon: number;
  };
  generatedAt: string;
};

export type BoiAccessOperation = "grant-free" | "require-payment" | "renew-access" | "verify-payment" | "reject-payment";
type ErrorPayload = { error?: string; code?: string; [key: string]: unknown };

function base64Url(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function openDb() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open("learning-control-device", 1);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function readCredential() {
  const db = await openDb();
  return await new Promise<Credential | undefined>((resolve, reject) => {
    const request = db.transaction("credential", "readonly").objectStore("credential").get("primary");
    request.onsuccess = () => resolve(request.result as Credential | undefined);
    request.onerror = () => reject(request.error);
  });
}

async function challenge(access: AdminAccess) {
  const response = await fetch("/api/device", {
    method: "POST",
    credentials: "same-origin",
    cache: "no-store",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action: "challenge", deviceId: access.deviceId }),
  });
  const payload = await response.json().catch(() => ({})) as ErrorPayload;
  if (!response.ok || typeof payload.challenge !== "string") throw new Error(payload.error || "Không tạo được thử thách thiết bị quản trị.");
  return payload.challenge;
}

async function proof(access: AdminAccess) {
  if (access.deviceId.startsWith("production-session:")) {
    return { controlDeviceId: access.deviceId };
  }
  const credential = await readCredential();
  if (!credential?.privateKey) throw new Error("Không đọc được khóa P-256 của thiết bị quản trị.");
  const nonce = await challenge(access);
  const message = new TextEncoder().encode(`learning-control:${access.deviceId}:${nonce}`);
  const signature = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, credential.privateKey, message);
  return { controlDeviceId: access.deviceId, challenge: nonce, signature: base64Url(new Uint8Array(signature)) };
}

async function approvedSession() {
  const session = await connectAdminCenter();
  if (session.access.status !== "approved") throw new Error("Thiết bị quản trị chưa được cấp quyền.");
  return session;
}

async function call(body: Record<string, unknown>, sessionOverride?: Awaited<ReturnType<typeof approvedSession>>) {
  const session = sessionOverride ?? await approvedSession();
  const response = await fetch("/api/apps/boi-ech/access", {
    method: "POST",
    credentials: "same-origin",
    cache: "no-store",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...body, ...await proof(session.access) }),
  });
  const payload = await response.json().catch(() => ({ error: "Phản hồi thanh toán/quyền Bơi ếch không hợp lệ." })) as ErrorPayload;
  if (!response.ok) throw new Error(payload.error || "Không thể tải thanh toán/quyền Bơi ếch.");
  return payload;
}

export async function connectBoiAccessManagement() {
  const session = await approvedSession();
  const payload = await call({ action: "bootstrap" }, session) as unknown as Omit<BoiAccessBootstrap, "role">;
  return { ...payload, role: session.access.role } as BoiAccessBootstrap;
}

export async function loadBoiPaymentProof(device: BoiAccessDevice) {
  const session = await approvedSession();
  const response = await fetch("/api/apps/boi-ech/access", {
    method: "POST",
    credentials: "same-origin",
    cache: "no-store",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action: "payment-proof", deviceId: device.deviceId, ...await proof(session.access) }),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({})) as ErrorPayload;
    throw new Error(payload.error || "Không thể tải chứng từ thanh toán Bơi ếch.");
  }
  const contentType = (response.headers.get("content-type") ?? "").split(";", 1)[0].trim().toLowerCase();
  if (!["image/jpeg", "image/png", "image/webp"].includes(contentType)) throw new Error("Chứng từ thanh toán không có định dạng ảnh hợp lệ.");
  return await response.blob();
}

export async function manageBoiAccess(device: BoiAccessDevice, operation: BoiAccessOperation, note = "", paidAccessDays = 60) {
  return await call({
    action: "manage-access",
    operation,
    deviceId: device.deviceId,
    expectedPaymentStatus: device.paymentStatus,
    expectedAccessGroup: device.accessGroup,
    ...(operation === "reject-payment" ? { note: note.trim().slice(0, 500) } : {}),
    ...(operation === "verify-payment" ? { paidAccessDays } : {}),
  });
}
