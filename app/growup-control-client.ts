"use client";

import { connectAdminCenter, type AdminAccess } from "./admin-device-client";

type Credential = { version: 1; privateKey: CryptoKey | null; publicKey: JsonWebKey };

export type GrowUpManagedDevice = {
  deviceId: string;
  deviceCode: string;
  deviceClass: "desktop" | "tablet" | "phone";
  label: string;
  status: "pending" | "approved" | "blocked";
  accessAllowed: boolean;
  editAllowed: boolean;
  active: boolean;
  createdAt: string;
  lastSeenAt: string;
  appVersion: string | null;
};

export type GrowUpAuditEntry = {
  id: string;
  action: string;
  target: string;
  createdAt: string;
  detail: Record<string, unknown>;
};

export type GrowUpControlBootstrap = {
  ok: true;
  application: "growup-mychildren";
  transport: "local-control" | "cloud-control";
  registryInstanceId: string | null;
  devices: GrowUpManagedDevice[];
  audit: GrowUpAuditEntry[];
  generatedAt: string;
};

type ErrorPayload = { error?: string; code?: string; [key: string]: unknown };

function base64Url(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function openDb() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open("learning-control-device", 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains("credential")) request.result.createObjectStore("credential");
    };
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
  const credential = await readCredential();
  if (!credential?.privateKey) throw new Error("Không đọc được khóa P-256 của thiết bị quản trị.");
  const nonce = await challenge(access);
  const message = new TextEncoder().encode(`learning-control:${access.deviceId}:${nonce}`);
  const signature = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, credential.privateKey, message);
  return { deviceId: access.deviceId, challenge: nonce, signature: base64Url(new Uint8Array(signature)) };
}

async function call(body: Record<string, unknown>) {
  const session = await connectAdminCenter();
  if (session.access.status !== "approved") throw new Error("Thiết bị quản trị chưa được cấp quyền.");
  const response = await fetch("/api/apps/growup-mychildren/control", {
    method: "POST",
    credentials: "same-origin",
    cache: "no-store",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...body, ...await proof(session.access) }),
  });
  const payload = await response.json().catch(() => ({ error: "Phản hồi GrowUP control không hợp lệ." })) as ErrorPayload;
  if (!response.ok) throw new Error(payload.error || "Không thể điều khiển GrowUP.");
  return payload;
}

export async function connectGrowUpControl() {
  return await call({ action: "bootstrap" }) as unknown as GrowUpControlBootstrap;
}

export async function manageGrowUpDevice(device: GrowUpManagedDevice, operation: "approve" | "block", registryInstanceId?: string | null) {
  return await call({
    action: "manage-device",
    operation,
    deviceId: device.deviceId,
    expectedStatus: device.status,
    registryInstanceId: registryInstanceId || undefined,
  });
}
