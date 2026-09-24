"use client";

export type ControlRole = "viewer" | "reviewer" | "publisher" | "owner";
export type DeviceStatus = "pending" | "approved" | "blocked";

export type AdminAccess = {
  deviceId: string;
  deviceCode: string;
  email: string;
  displayName: string;
  status: DeviceStatus;
  role: ControlRole;
  label: string | null;
  owner: boolean;
};

export type ApplicationDescriptor = {
  id: string;
  name: string;
  status: "online" | "warning" | "planned";
};

export type ApplicationBridge = {
  baseUrl: string;
  token: string;
  expiresAt: number;
};

export type ControlAdminDevice = {
  deviceId: string;
  deviceCode: string;
  email: string;
  displayName: string;
  status: DeviceStatus;
  role: ControlRole;
  memberStatus: "active" | "inactive" | "unregistered";
  label: string | null;
  createdAt: string;
  approvedAt: string | null;
  blockedAt: string | null;
  lastSeenAt: string;
  offlineSinceAt: string | null;
  active: boolean;
  owner: boolean;
};

export type CenterAuditEntry = {
  id: string;
  source: string;
  actor: string;
  action: string;
  target: string;
  detail: Record<string, unknown>;
  createdAt: string;
};

export type AdminBootstrap = {
  actor: AdminAccess;
  application: { id: "boi-ech"; name: string; lessonCount: number };
  learningDevices: [];
  boiBridge: ApplicationBridge;
  upstreamError?: string | null;
};

export type HealthAdminBootstrap = {
  actor: AdminAccess;
  application: "health-care";
  bridge: ApplicationBridge & { application?: "health-care" };
};

export type RuLifeAdminBootstrap = {
  actor: AdminAccess;
  application: "ru-life";
  bridge: ApplicationBridge & { application?: "ru-life" };
};

export type CenterBootstrap = {
  actor: AdminAccess;
  applications: ApplicationDescriptor[];
  controlDevices: ControlAdminDevice[];
  auditLog: CenterAuditEntry[];
  upstreamError?: string | null;
};

export type OperationsDevice = {
  appId: string;
  appName: string;
  href: string;
  deviceId: string;
  deviceCode: string;
  deviceType: "desktop" | "phone" | "tablet" | "unknown";
  deviceTypeLabel: string;
  userLabel: string;
  status: "pending" | "approved" | "blocked" | "unknown";
  active: boolean;
  createdAt: string | null;
  lastSeenAt: string | null;
  attention: "new" | "environment" | "none";
  canApprove: boolean;
  canRemove: boolean;
  canUnblock?: boolean;
  canEditPermission?: boolean;
  editEnabled?: boolean;
  registryInstanceId?: string | null;
};

export type OperationsSummary = {
  appId: string;
  appName: string;
  href: string;
  webHref: string | null;
  managedWebLaunch: boolean;
  group: string;
  connection: "connected" | "warning" | "pending" | "unavailable";
  onlineCount: number | null;
  pendingCount: number | null;
  attentionCount: number | null;
  note: string;
  directWebAccess: boolean;
  remoteAdminReady?: boolean;
  issueCode?: string;
};

export type OperationsSettings = {
  autoApproveAppIds: string[];
  autoApproveSupportedAppIds: string[];
  autoBlockPendingAppIds?: string[];
  autoBlockPendingSupportedAppIds?: string[];
  pendingBlockAfterHoursByApp?: Record<string, number>;
  freeAccessDaysByApp?: Record<string, number>;
  freeDeviceLimitByApp?: Record<string, number>;
};

export type OperationsWorkItem = {
  id: string;
  appId: string;
  appName: string;
  href: string;
  kind: "device" | "environment" | "connection";
  title: string;
  detail: string;
  deviceType: string;
  occurredAt: string | null;
  priority: "high" | "normal" | "info";
};

export type OperationsBootstrap = {
  actor: { deviceCode: string; role: ControlRole };
  generatedAt: string;
  summaries: OperationsSummary[];
  devices: OperationsDevice[];
  workItems: OperationsWorkItem[];
  settings: OperationsSettings;
  metrics: {
    applications: number;
    pendingDevices: number;
    alerts: number;
    workItems: number;
  };
};

export type OperationsActionResponse = {
  ok?: boolean;
  error?: string;
  code?: string;
  dismissedIds?: string[];
  removedDeviceId?: string;
  approvedDeviceId?: string;
  launchUrl?: string;
  expiresAt?: number;
  settings?: OperationsSettings;
};

export type CenterApiResponse = Partial<CenterBootstrap> & {
  error?: string;
  code?: string;
};

type Credential = { version: 1; privateKey: CryptoKey | null; publicKey: JsonWebKey };
type ApiPayload = Partial<CenterBootstrap> & {
  actor?: AdminAccess;
  application?: unknown;
  learningDevices?: [];
  boiBridge?: ApplicationBridge;
  bridge?: ApplicationBridge & { application?: "health-care" | "ru-life" };
  upstreamError?: string | null;
  device?: AdminAccess;
  challenge?: string;
  error?: string;
  code?: string;
  [key: string]: unknown;
};

export class AdminApiError extends Error {
  data: ApiPayload;
  constructor(message: string, data: ApiPayload) {
    super(message);
    this.data = data;
  }
}

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
  const generated = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]) as CryptoKeyPair;
  const publicKey = await crypto.subtle.exportKey("jwk", generated.publicKey);
  const privateJwk = await crypto.subtle.exportKey("jwk", generated.privateKey);
  const privateKey = await crypto.subtle.importKey("jwk", privateJwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const credential = { version: 1, privateKey, publicKey } satisfies Credential;
  await writeCredential(credential);
  return credential;
}

async function jsonApi(path: string, body: Record<string, unknown>) {
  const response = await fetch(path, {
    method: "POST",
    credentials: "same-origin",
    cache: "no-store",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({ error: "Phản hồi quản trị không hợp lệ." })) as ApiPayload;
  if (!response.ok) throw new AdminApiError(data.error ?? "Không thể kết nối dịch vụ quản trị.", data);
  return data;
}

async function register(credential: Credential) {
  const data = await jsonApi("/api/device", { action: "register", publicKey: credential.publicKey });
  if (!data.device) throw new AdminApiError("Máy chủ chưa trả về trạng thái thiết bị quản trị.", data);
  return data.device;
}

async function proof(credential: Credential, access: AdminAccess) {
  const challenge = await jsonApi("/api/device", { action: "challenge", deviceId: access.deviceId });
  if (!challenge.challenge || typeof challenge.challenge !== "string" || !credential.privateKey) throw new AdminApiError("Không thể tạo thử thách thiết bị.", challenge);
  const message = new TextEncoder().encode(`learning-control:${access.deviceId}:${challenge.challenge}`);
  const signature = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, credential.privateKey, message);
  return { deviceId: access.deviceId, challenge: challenge.challenge, signature: base64Url(new Uint8Array(signature)) };
}

function isProductionSessionAccess(access: AdminAccess) {
  return access.deviceId.startsWith("production-session:");
}

async function secureApi(path: string, credential: Credential, access: AdminAccess, body: Record<string, unknown>) {
  if (isProductionSessionAccess(access)) return await jsonApi(path, body);

  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await jsonApi(path, { ...body, ...await proof(credential, access) });
    } catch (error) {
      lastError = error;
      if (!(error instanceof AdminApiError) || error.data.code !== "DEVICE_PROOF_EXPIRED") throw error;
    }
  }
  throw lastError;
}

async function productionSessionAccess() {
  try {
    const data = await jsonApi("/api/device", { action: "session" });
    if (!data.device || !data.device.deviceId?.startsWith("production-session:")) return null;
    return data.device;
  } catch (error) {
    if (error instanceof AdminApiError && error.data.code === "PRODUCTION_SESSION_UNAVAILABLE") return null;
    throw error;
  }
}

async function approvedSession() {
  if (!approvedSessionPromise) {
    approvedSessionPromise = (async () => {
      const productionAccess = await productionSessionAccess();
      if (productionAccess) {
        return {
          credential: { version: 1, privateKey: null, publicKey: {} } satisfies Credential,
          access: productionAccess,
        };
      }

      const credential = await credentialForDevice();
      const access = await register(credential);
      return { credential, access };
    })().catch((error) => {
      approvedSessionPromise = null;
      throw error;
    });
  }
  return await approvedSessionPromise;
}

let approvedSessionPromise: Promise<{ credential: Credential; access: AdminAccess }> | null = null;
const operationsCacheKey = "application-management:operations:v1";

// Bơi ếch và Bauman dùng endpoint hardening riêng để reconcile live registry.
// Danh sách này chỉ quyết định đường mutation; tuyệt đối không được dùng để ẩn
// Health_Care, Hòa nhập Nga hoặc các client khác khỏi dashboard quản trị.
const reconciledDeviceActionAppIds = new Set(["boi-ech", "bauman-master-ai"]);

export function readCachedOperations() {
  try {
    const raw = window.sessionStorage.getItem(operationsCacheKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as OperationsBootstrap;
    if (!parsed.generatedAt || Date.now() - Date.parse(parsed.generatedAt) > 10 * 60_000) return null;
    return parsed;
  } catch {
    return null;
  }
}

function cacheOperations(bootstrap: OperationsBootstrap) {
  try { window.sessionStorage.setItem(operationsCacheKey, JSON.stringify(bootstrap)); } catch { /* Device-local cache is optional. */ }
}

export async function connectAdminCenter() {
  const { credential, access } = await approvedSession();
  if (access.status !== "approved") return { access, bootstrap: null as CenterBootstrap | null };
  const bootstrap = await secureApi("/api/center", credential, access, { action: "bootstrap" }) as CenterBootstrap;
  return { access, bootstrap };
}

/** Tải sau shell chính để một client chậm không chặn toàn bộ giao diện Trung tâm. */
export async function connectOperationsDashboard() {
  const { credential, access } = await approvedSession();
  if (access.status !== "approved") return { access, bootstrap: null as OperationsBootstrap | null };
  const bootstrap = await secureApi("/api/operations", credential, access, { action: "bootstrap" }) as unknown as OperationsBootstrap;
  cacheOperations(bootstrap);
  return { access, bootstrap };
}

export async function operationsAction(body: Record<string, unknown>) {
  const { credential, access } = await approvedSession();
  if (access.status !== "approved") throw new AdminApiError("Thiết bị quản trị chưa được cấp quyền.", { device: access });
  const appId = typeof body.appId === "string" ? body.appId : "";
  const focusedDeviceAction = body.action === "manage-client-device" && reconciledDeviceActionAppIds.has(appId);
  let actionBody = body;
  if (focusedDeviceAction && typeof body.expectedStatus !== "string") {
    const deviceId = typeof body.deviceId === "string" ? body.deviceId : "";
    const snapshot = readCachedOperations()?.devices.find((device) => device.appId === appId && device.deviceId === deviceId);
    if (snapshot) actionBody = { ...body, expectedStatus: snapshot.status };
  }
  const path = body.action === "set-auto-approval" ? "/api/operations-auto-approval"
    : focusedDeviceAction ? "/api/focused-device-operation" : "/api/operations";
  return await secureApi(path, credential, access, actionBody) as OperationsActionResponse;
}

export async function centerAdminAction(body: Record<string, unknown>) {
  const { credential, access } = await approvedSession();
  if (access.status !== "approved") throw new AdminApiError("Thiết bị quản trị chưa được cấp quyền.", { device: access });
  return await secureApi("/api/center", credential, access, body) as CenterApiResponse;
}

/** Bridge bootstrap dành riêng cho client Bơi ếch. */
export async function connectAdminDevice(application: "boi-ech" = "boi-ech") {
  if (application !== "boi-ech") throw new AdminApiError("Client này chưa có admin adapter riêng; không được dùng bridge Bơi ếch.", { code: "APPLICATION_BRIDGE_MISMATCH" });
  const { credential, access } = await approvedSession();
  if (access.status !== "approved") return { access, bootstrap: null as AdminBootstrap | null };
  const bootstrap = await secureApi("/api/dashboard", credential, access, { action: "bootstrap" }) as AdminBootstrap;
  return { access, bootstrap };
}

/** Health_Care có adapter và secret riêng. */
export async function connectHealthCareAdmin() {
  const { credential, access } = await approvedSession();
  if (access.status !== "approved") return { access, bootstrap: null as HealthAdminBootstrap | null };
  const bootstrap = await secureApi("/api/apps/health-care/bridge", credential, access, { action: "bootstrap" }) as HealthAdminBootstrap;
  return { access, bootstrap };
}

/** Hòa nhập Nga sở hữu registry/session; Trung tâm chỉ xin vé bridge ngắn hạn. */
export async function connectRuLifeAdmin() {
  const { credential, access } = await approvedSession();
  if (access.status !== "approved") return { access, bootstrap: null as RuLifeAdminBootstrap | null };
  const bootstrap = await secureApi("/api/apps/hoa-nhap-nga/bridge", credential, access, { action: "bootstrap" }) as RuLifeAdminBootstrap;
  return { access, bootstrap };
}

export async function upstreamJson<T>(bridge: ApplicationBridge, path: string, init?: { method?: "GET" | "POST"; body?: Record<string, unknown>; query?: string }) {
  if (!/^https:\/\/[a-z0-9.-]+$/i.test(bridge.baseUrl) || !bridge.token.startsWith("v1.")) throw new Error("Vé kết nối ứng dụng không hợp lệ.");
  if (!/^\/api\/control\/[a-z0-9-]+$/i.test(path)) throw new Error("Đường dẫn quản trị ứng dụng không hợp lệ.");
  const response = await fetch(`${bridge.baseUrl}${path}${init?.query ?? ""}`, {
    method: init?.method ?? "GET",
    mode: "cors",
    credentials: "omit",
    cache: "no-store",
    headers: { authorization: `Bearer ${bridge.token}`, "content-type": "application/json" },
    body: init?.body ? JSON.stringify(init.body) : undefined,
  });
  const data = await response.json().catch(() => ({ error: "Phản hồi ứng dụng không hợp lệ." })) as T & { error?: string };
  if (!response.ok) throw new Error(data.error ?? "Không thể kết nối ứng dụng.");
  return data as T;
}

export const roleLabels: Record<ControlRole, string> = {
  viewer: "Chỉ xem",
  reviewer: "Kiểm duyệt viên",
  publisher: "Người xuất bản",
  owner: "Chủ hệ thống",
};
