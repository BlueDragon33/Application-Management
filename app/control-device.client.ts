"use client";

export type ControlRole = "viewer" | "reviewer" | "publisher" | "owner";
export type ControlDeviceStatus = "pending" | "approved" | "blocked";

export type ControlAccess = {
  deviceId: string;
  deviceCode: string;
  email: string;
  displayName: string;
  status: ControlDeviceStatus;
  role: ControlRole;
  label: string | null;
  owner: boolean;
};

type Credential = { version: 1; privateKey: CryptoKey | null; publicKey: JsonWebKey };
type ControlApiResult = {
  error?: string;
  code?: string;
  device?: ControlAccess;
  challenge?: string;
  [key: string]: unknown;
};

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
  return new Promise<Credential | undefined>((resolve, reject) => {
    const request = db.transaction("credential", "readonly").objectStore("credential").get("primary");
    request.onsuccess = () => resolve(request.result as Credential | undefined);
    request.onerror = () => reject(request.error);
  });
}

async function writeCredential(value: Credential) {
  const db = await openDb();
  return new Promise<void>((resolve, reject) => {
    const request = db.transaction("credential", "readwrite").objectStore("credential").put(value, "primary");
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

async function credentialForDevice() {
  const current = await readCredential();
  if (current?.version === 1 && current.publicKey && current.privateKey) return current;
  if (!globalThis.crypto?.subtle) {
    throw new Error("Trung tâm quản trị cần trình duyệt ở secure context (HTTPS) để tạo khóa thiết bị.");
  }
  const generated = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]) as CryptoKeyPair;
  const publicKey = await crypto.subtle.exportKey("jwk", generated.publicKey);
  const privateJwk = await crypto.subtle.exportKey("jwk", generated.privateKey);
  const privateKey = await crypto.subtle.importKey("jwk", privateJwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const credential = { version: 1, privateKey, publicKey } satisfies Credential;
  await writeCredential(credential);
  return credential;
}

async function rawApi(path: string, body: Record<string, unknown>) {
  const response = await fetch(path, {
    method: "POST",
    credentials: "same-origin",
    cache: "no-store",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const responseText = await response.text();
  let data: ControlApiResult;
  try {
    data = JSON.parse(responseText) as ControlApiResult;
  } catch {
    throw new Error(response.redirected || /<!doctype html|<html[\s>]/i.test(responseText)
      ? "Phiên quản trị đã hết hạn hoặc API không trả về JSON. Hãy tải lại Trung tâm quản trị."
      : "Phản hồi API Trung tâm quản trị không hợp lệ.");
  }
  if (!response.ok) {
    if (data.code === "DEVICE_PENDING") throw new Error("Thiết bị quản trị này đang chờ Trung tâm cấp quyền.");
    if (data.code === "DEVICE_BLOCKED") throw new Error("Thiết bị quản trị này đã bị khóa.");
    if (data.code === "MEMBER_INACTIVE") throw new Error("Tài khoản quản trị chưa được kích hoạt.");
    throw new Error(data.error || "Không thể kết nối Trung tâm quản trị.");
  }
  return data;
}

export async function getControlAccess() {
  const credential = await credentialForDevice();
  const registered = await rawApi("/api/device", { action: "register", publicKey: credential.publicKey });
  if (!registered.device) throw new Error("Trung tâm chưa trả về trạng thái thiết bị.");
  return { credential, access: registered.device };
}

export async function signedControlPost<T extends ControlApiResult = ControlApiResult>(path: string, body: Record<string, unknown>): Promise<T> {
  const { credential, access } = await getControlAccess();
  if (access.status !== "approved") throw new Error(access.status === "blocked" ? "Thiết bị quản trị này đã bị khóa." : "Thiết bị quản trị này đang chờ Trung tâm cấp quyền.");
  const challenge = await rawApi("/api/device", { action: "challenge", deviceId: access.deviceId });
  if (!challenge.challenge || !credential.privateKey) throw new Error("Không thể xác thực thiết bị quản trị.");
  const message = new TextEncoder().encode(`learning-control:${access.deviceId}:${challenge.challenge}`);
  const signature = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, credential.privateKey, message);
  return rawApi(path, { ...body, deviceId: access.deviceId, challenge: challenge.challenge, signature: base64Url(new Uint8Array(signature)) }) as Promise<T>;
}
