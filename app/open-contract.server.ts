import { getControlDatabase, type ControlDeviceState } from "./control-device.server";
import { contractCategoryProfiles, dynamicApplicationConfig } from "./contract-category-profiles";
import type { ApplicationCategory } from "./application-registry";

const CONTRACT_SCHEMA = "application-management.contract/v1";
const DEFAULT_CONTRACT_PATH = "/api/application-management/contract";
const CONTRACT_TIMEOUT_MS = 5_000;

export type ManagedCatalogRow = {
  id: string;
  name: string;
  short_name: string;
  category: string;
  origin: string;
  public_url: string | null;
  repository: string | null;
  contract_path: string;
  enabled: number;
  credential_ciphertext: string | null;
  credential_iv: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  last_contract_connected_at: string | null;
  last_probe_at: string | null;
  last_probe_error: string | null;
};

export type UniversalContractManifest = {
  schema: typeof CONTRACT_SCHEMA;
  protocol?: string;
  discoveredVia?: string;
  application: {
    id: string;
    name: string;
    category?: string;
    version?: string;
  };
  capabilities: Record<string, boolean>;
  endpoints: {
    status?: string;
    devices?: string;
    deviceCommands?: string;
    web?: string;
  };
};

export type UniversalContractDevice = {
  deviceId: string;
  deviceCode: string;
  deviceType: "desktop" | "phone" | "tablet" | "unknown";
  userLabel: string;
  status: "pending" | "approved" | "blocked" | "unknown";
  active: boolean;
  createdAt: string | null;
  lastSeenAt: string | null;
  environmentChanged: boolean;
  editEnabled: boolean;
  registryInstanceId?: string | null;
};

export type DynamicContractSnapshot = {
  catalog: ManagedCatalogRow;
  config: ReturnType<typeof dynamicApplicationConfig>;
  manifest: UniversalContractManifest | null;
  credentialConfigured: boolean;
  contractConnected: boolean;
  connection: "connected" | "warning" | "pending" | "unavailable";
  devices: UniversalContractDevice[];
  webHref: string | null;
  remoteAdminReady: boolean;
  note: string;
  issueCode?: string;
};

const categoryNames = new Set<ApplicationCategory>(Object.keys(contractCategoryProfiles) as ApplicationCategory[]);

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function validAppId(value: string) {
  return /^[a-z0-9][a-z0-9-]{1,62}$/.test(value);
}

function validEndpointPath(value: string) {
  return /^\/api\/[a-z0-9/_-]+$/i.test(value) && !value.includes("..");
}

function validContractPath(value: string) {
  return /^\/[a-z0-9._/-]+$/i.test(value)
    && !value.includes("..")
    && !value.includes("//")
    && !value.includes("?")
    && !value.includes("#");
}

function privateHost(hostname: string) {
  const normalized = hostname.toLowerCase();
  if (normalized === "localhost" || normalized === "127.0.0.1" || normalized === "::1") return true;
  if (/^10\./.test(normalized) || /^192\.168\./.test(normalized)) return true;
  const match = normalized.match(/^172\.(\d+)\./);
  return Boolean(match && Number(match[1]) >= 16 && Number(match[1]) <= 31);
}

async function runtimeEnv() {
  try {
    const workers = await import("cloudflare:workers");
    return workers.env as unknown as Record<string, unknown>;
  } catch {
    return process.env as unknown as Record<string, unknown>;
  }
}

async function allowPrivateHttp() {
  const values = await runtimeEnv();
  return values.LOCAL_DEV_AUTH === "1" || text(values.CONTROL_PLANE_NETWORK_MODE).toLowerCase() === "local";
}

export async function normalizeManagedOrigin(value: unknown) {
  const raw = text(value).replace(/\/$/, "");
  if (!raw) throw new Error("Origin ứng dụng là bắt buộc.");
  let url: URL;
  try { url = new URL(raw); }
  catch { throw new Error("Origin ứng dụng không hợp lệ."); }
  if (url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
    throw new Error("Origin phải là origin thuần, không chứa path/query/credential.");
  }
  const localAllowed = await allowPrivateHttp();
  if (privateHost(url.hostname) && !localAllowed) {
    throw new Error("Production không cho phép contract origin trỏ tới localhost/LAN/private IP.");
  }
  if (url.protocol === "https:") return url.origin;
  if (url.protocol === "http:" && privateHost(url.hostname) && localAllowed) return url.origin;
  throw new Error("Production contract chỉ chấp nhận HTTPS; HTTP chỉ dùng cho local/LAN.");
}

function normalizePublicUrl(value: unknown) {
  const raw = text(value);
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    if (url.username || url.password) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function normalizeCategory(value: unknown): ApplicationCategory {
  const normalized = text(value) as ApplicationCategory;
  if (!categoryNames.has(normalized)) throw new Error("Phân loại ứng dụng không được hỗ trợ.");
  return normalized;
}

function normalizeContractPath(value: unknown) {
  const path = text(value) || DEFAULT_CONTRACT_PATH;
  if (!validContractPath(path)) throw new Error("Contract path phải là absolute path an toàn, không chứa '..', query hoặc fragment.");
  return path;
}

function publicBasePath(row: Pick<ManagedCatalogRow, "origin" | "public_url">) {
  const raw = text(row.public_url);
  if (!raw) return "";
  try {
    const url = new URL(raw);
    if (url.origin !== row.origin || url.username || url.password || url.search || url.hash) return "";
    const pathname = url.pathname.replace(/\/+$/, "");
    if (!pathname || pathname === "/") return "";
    return validContractPath(pathname) ? pathname : "";
  } catch {
    return "";
  }
}

function joinContractPath(base: string, path: string) {
  if (!base) return path;
  const joined = `${base}${path.startsWith("/") ? path : `/${path}`}`;
  return validContractPath(joined) ? joined : "";
}

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function base64UrlToBytes(value: string) {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error("Khóa mã hóa credential không hợp lệ.");
  const padded = value.replaceAll("-", "+").replaceAll("_", "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
}

async function credentialKey() {
  const values = await runtimeEnv();
  const encoded = text(values.MANAGED_APP_CREDENTIAL_ENCRYPTION_KEY);
  if (!encoded) return null;
  const bytes = base64UrlToBytes(encoded);
  if (bytes.byteLength !== 32) throw new Error("MANAGED_APP_CREDENTIAL_ENCRYPTION_KEY phải là khóa URL-safe 32 byte.");
  return crypto.subtle.importKey("raw", bytes, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

async function encryptCredential(value: string) {
  const key = await credentialKey();
  if (!key) throw new Error("Chưa cấu hình MANAGED_APP_CREDENTIAL_ENCRYPTION_KEY cho Trung tâm.");
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(value));
  return { ciphertext: bytesToBase64Url(new Uint8Array(encrypted)), iv: bytesToBase64Url(iv) };
}

async function decryptCredential(row: ManagedCatalogRow) {
  if (!row.credential_ciphertext || !row.credential_iv) return "";
  const key = await credentialKey();
  if (!key) return "";
  try {
    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: base64UrlToBytes(row.credential_iv) },
      key,
      base64UrlToBytes(row.credential_ciphertext),
    );
    return new TextDecoder().decode(decrypted);
  } catch {
    return "";
  }
}

export async function managedCredentialEncryptionReady() {
  try { return Boolean(await credentialKey()); }
  catch { return false; }
}

export async function listManagedCatalog() {
  const database = await getControlDatabase();
  const result = await database.prepare(
    `SELECT id,name,short_name,category,origin,public_url,repository,contract_path,enabled,
            credential_ciphertext,credential_iv,created_by,created_at,updated_at,
            last_contract_connected_at,last_probe_at,last_probe_error
       FROM managed_app_catalog
      ORDER BY category,name`,
  ).all<ManagedCatalogRow>();
  return result.results ?? [];
}

export async function upsertManagedCatalog(input: Record<string, unknown>, actor: ControlDeviceState) {
  if (actor.role !== "owner") throw new Error("Chỉ Chủ hệ thống được thêm hoặc sửa contract ứng dụng.");
  const id = text(input.id).toLowerCase();
  if (!validAppId(id)) throw new Error("ID ứng dụng phải là slug 2–63 ký tự.");
  const name = text(input.name);
  const shortName = text(input.shortName) || name;
  if (!name || name.length > 100 || !shortName || shortName.length > 60) throw new Error("Tên ứng dụng không hợp lệ.");
  const category = normalizeCategory(input.category);
  const origin = await normalizeManagedOrigin(input.origin);
  const publicUrl = normalizePublicUrl(input.publicUrl);
  const repository = text(input.repository).slice(0, 180) || null;
  const contractPath = normalizeContractPath(input.contractPath);
  const credential = text(input.credential);
  if (credential.length > 4_096) throw new Error("Credential quản trị vượt quá giới hạn 4096 ký tự.");
  // Legacy application IDs may also be enrolled in the Dynamic Catalog.
  // The operations layer uses a dynamic-first / legacy-fallback policy, so
  // adding a Universal Contract never requires a flag-day adapter removal.
  const database = await getControlDatabase();
  const current = await database.prepare(
    "SELECT credential_ciphertext,credential_iv FROM managed_app_catalog WHERE id=?1 LIMIT 1",
  ).bind(id).first<{ credential_ciphertext: string | null; credential_iv: string | null }>();
  let encrypted = current ?? { credential_ciphertext: null, credential_iv: null };
  if (credential) {
    const next = await encryptCredential(credential);
    encrypted = { credential_ciphertext: next.ciphertext, credential_iv: next.iv };
  }
  await database.prepare(
    `INSERT INTO managed_app_catalog
      (id,name,short_name,category,origin,public_url,repository,contract_path,enabled,credential_ciphertext,credential_iv,created_by,updated_at)
     VALUES (?1,?2,?3,?4,?5,?6,?7,?8,1,?9,?10,?11,CURRENT_TIMESTAMP)
     ON CONFLICT(id) DO UPDATE SET
       name=excluded.name,short_name=excluded.short_name,category=excluded.category,origin=excluded.origin,
       public_url=excluded.public_url,repository=excluded.repository,contract_path=excluded.contract_path,
       enabled=1,credential_ciphertext=excluded.credential_ciphertext,credential_iv=excluded.credential_iv,
       updated_at=CURRENT_TIMESTAMP`,
  ).bind(id,name,shortName,category,origin,publicUrl,repository,contractPath,encrypted.credential_ciphertext,encrypted.credential_iv,actor.email).run();
  return id;
}

export async function removeManagedCatalog(idValue: unknown, actor: ControlDeviceState) {
  if (actor.role !== "owner") throw new Error("Chỉ Chủ hệ thống được loại ứng dụng khỏi catalog.");
  const id = text(idValue).toLowerCase();
  if (!validAppId(id)) throw new Error("ID ứng dụng không hợp lệ.");
  const database = await getControlDatabase();
  await database.prepare("DELETE FROM managed_app_catalog WHERE id=?1").bind(id).run();
}

async function rememberManagedProbe(id: string, input: { connected: boolean; error?: string }) {
  const database = await getControlDatabase();
  if (input.connected) {
    await database.prepare(
      "UPDATE managed_app_catalog SET last_contract_connected_at=CURRENT_TIMESTAMP,last_probe_at=CURRENT_TIMESTAMP,last_probe_error=NULL WHERE id=?1",
    ).bind(id).run();
    return;
  }
  await database.prepare(
    "UPDATE managed_app_catalog SET last_probe_at=CURRENT_TIMESTAMP,last_probe_error=?2 WHERE id=?1",
  ).bind(id, text(input.error).slice(0, 1000) || null).run();
}

async function fetchJson(origin: string, path: string, credential = "") {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CONTRACT_TIMEOUT_MS);
  try {
    const response = await fetch(`${origin}${path}`, {
      method: "GET",
      cache: "no-store",
      redirect: "manual",
      headers: credential ? { authorization: `Bearer ${credential}`, accept: "application/json" } : { accept: "application/json" },
      signal: controller.signal,
    });
    const data = await response.json().catch(() => ({})) as Record<string, unknown>;
    if (!response.ok) throw new Error(`HTTP_${response.status}`);
    return data;
  } catch (error) {
    if (controller.signal.aborted) throw new Error(`Contract phản hồi quá ${CONTRACT_TIMEOUT_MS / 1000} giây.`);
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function endpoint(value: unknown) {
  const path = text(value);
  return path && validEndpointPath(path) ? path : undefined;
}

function record(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function capabilitySet(value: unknown) {
  if (!Array.isArray(value)) return new Set<string>();
  return new Set(value.filter((item): item is string => typeof item === "string").map((item) => item.trim().toLowerCase()));
}

function categoryMatches(value: unknown, expected: ApplicationCategory) {
  const actual = text(value);
  if (actual && actual !== expected) throw new Error(`Contract category "${actual}" không khớp Catalog "${expected}".`);
}

function parseManifest(raw: Record<string, unknown>, expectedId: string, expectedCategory: ApplicationCategory, discoveredVia = DEFAULT_CONTRACT_PATH): UniversalContractManifest {
  const schema = text(raw.schema);
  const application = record(raw.application);
  const capabilitiesRaw = record(raw.capabilities);
  const endpointsRaw = record(raw.endpoints);
  if (schema !== CONTRACT_SCHEMA) throw new Error(`Contract schema phải là ${CONTRACT_SCHEMA}.`);
  if (text(application.id) !== expectedId) throw new Error("Contract application.id không khớp catalog.");
  categoryMatches(application.category, expectedCategory);
  const capabilities = Object.fromEntries(Object.entries(capabilitiesRaw).filter(([, value]) => typeof value === "boolean")) as Record<string, boolean>;
  return {
    schema: CONTRACT_SCHEMA,
    protocol: text(raw.protocol) || CONTRACT_SCHEMA,
    discoveredVia,
    application: {
      id: expectedId,
      name: text(application.name) || expectedId,
      category: expectedCategory,
      version: text(application.version) || undefined,
    },
    capabilities,
    endpoints: {
      status: endpoint(endpointsRaw.status),
      devices: endpoint(endpointsRaw.devices),
      deviceCommands: endpoint(endpointsRaw.deviceCommands),
      web: endpoint(endpointsRaw.web),
    },
  };
}

function normalizeLegacyContract(
  raw: Record<string, unknown>,
  expectedId: string,
  expectedCategory: ApplicationCategory,
  discoveredVia: string,
  publicUrl: string | null,
): UniversalContractManifest | null {
  const applicationRaw = raw.application;
  const application = record(applicationRaw);
  const applicationId = typeof applicationRaw === "string"
    ? text(applicationRaw)
    : text(application.id) || text(raw.canonicalApplication) || text(raw.appId);
  if (!applicationId || applicationId !== expectedId) return null;

  categoryMatches(application.category, expectedCategory);

  const controlService = record(raw.controlService);
  const endpointsRaw = Object.keys(record(raw.endpoints)).length
    ? record(raw.endpoints)
    : record(controlService.endpoints);
  const routes = Array.isArray(controlService.routes)
    ? controlService.routes.filter((item): item is string => typeof item === "string")
    : [];

  const statusPath = endpoint(endpointsRaw.status)
    ?? (routes.includes("/api/control/status") ? "/api/control/status" : discoveredVia === "/api/control/status" ? "/api/control/status" : undefined);
  const devicesPath = endpoint(endpointsRaw.devices)
    ?? (routes.includes("/api/control/devices") ? "/api/control/devices" : undefined);
  const deviceCommandsPath = endpoint(endpointsRaw.deviceCommands)
    ?? (routes.includes("/api/control/device-commands") ? "/api/control/device-commands" : undefined);

  const capsObject = record(raw.capabilities);
  const capsList = capabilitySet(raw.capabilities);
  const readiness = record(raw.readiness);
  const policy = record(raw.policy);

  const explicit = (key: string, ...aliases: string[]) => {
    if (capsObject[key] === true) return true;
    return aliases.some((alias) => capsList.has(alias.toLowerCase()));
  };
  const readinessAvailable = (key: string) => {
    const value = text(readiness[key]).toLowerCase();
    return Boolean(value && value !== "missing" && value !== "unavailable" && value !== "disabled");
  };

  const deviceRegistry = Boolean(devicesPath) && (
    explicit("deviceRegistry", "device-registry", "device-access")
    || explicit("deviceRegistration", "device-registration")
    || readinessAvailable("deviceRegistry")
  );

  const capabilities: Record<string, boolean> = {
    deviceRegistry,
    deviceApproval: explicit("deviceApproval", "device-approval"),
    deviceBlock: explicit("deviceBlock", "device-block"),
    deviceUnblock: explicit("deviceUnblock", "device-unblock"),
    deviceEditPermission: explicit("deviceEditPermission", "device-edit-permission"),
    deviceIdempotentCommands: explicit("deviceIdempotentCommands", "device-idempotent-commands"),
    optimisticConcurrency: explicit("optimisticConcurrency", "optimistic-concurrency"),
    sessions: explicit("sessions", "session-revocation", "revocable-device-sessions")
      || capsObject.sessionRevocation === true
      || capsObject.revocableDeviceSessions === true,
    audit: explicit("audit", "control-audit"),
    contentReview: explicit("contentReview", "content-review") || capsObject.contentReviewApi === true,
    payments: explicit("payments", "payment-review") || capsObject.paymentReview === true,
    reports: explicit("reports", "reporting"),
    webLaunch: explicit("webLaunch", "control-web-launch") || Boolean(publicUrl),
  };

  // A legacy manifest may explicitly declare remote-admin false. Keep the
  // normalized contract observable, but never infer mutation readiness.
  if (policy.remoteAdminReady === false) {
    capabilities.deviceApproval = false;
    capabilities.deviceBlock = false;
    capabilities.deviceUnblock = false;
  }

  return {
    schema: CONTRACT_SCHEMA,
    protocol: text(raw.protocol) || text(controlService.protocol) || `legacy-contract-v${text(raw.contractVersion) || text(raw.schemaVersion) || "1"}`,
    discoveredVia,
    application: {
      id: expectedId,
      name: text(application.name) || text(raw.displayName) || expectedId,
      category: expectedCategory,
      version: text(application.version) || text(raw.contractVersion) || text(raw.schemaVersion) || undefined,
    },
    capabilities,
    endpoints: {
      status: statusPath,
      devices: devicesPath,
      deviceCommands: deviceCommandsPath,
      web: endpoint(endpointsRaw.web),
    },
  };
}

async function discoverContract(
  row: ManagedCatalogRow,
  credential: string,
  category: ApplicationCategory,
): Promise<UniversalContractManifest> {
  const candidates: Array<{ path: string; credential: string }> = [];
  const add = (path: string, suppliedCredential = "") => {
    if (!validContractPath(path)) return;
    if (!candidates.some((item) => item.path === path && item.credential === suppliedCredential)) {
      candidates.push({ path, credential: suppliedCredential });
    }
  };

  const basePath = publicBasePath(row);
  add(row.contract_path, row.contract_path === "/api/control/status" ? credential : "");
  if (basePath) {
    add(joinContractPath(basePath, row.contract_path), row.contract_path === "/api/control/status" ? credential : "");
  }
  add("/api/control/contract");
  add("/management-contract.json");
  add("/control/application-management.contract.json");
  if (basePath) {
    add(joinContractPath(basePath, "/api/control/contract"));
    add(joinContractPath(basePath, "/management-contract.json"));
    add(joinContractPath(basePath, "/control/application-management.contract.json"));
  }
  if (credential) {
    add("/api/control/status", credential);
    if (basePath) add(joinContractPath(basePath, "/api/control/status"), credential);
  }

  const failures: string[] = [];
  for (const candidate of candidates) {
    try {
      const raw = await fetchJson(row.origin, candidate.path, candidate.credential);
      if (text(raw.schema) === CONTRACT_SCHEMA) {
        return parseManifest(raw, row.id, category, candidate.path);
      }
      const normalized = normalizeLegacyContract(raw, row.id, category, candidate.path, row.public_url);
      if (normalized) return normalized;
      failures.push(`${candidate.path}: schema/id không khớp`);
    } catch (error) {
      failures.push(`${candidate.path}: ${error instanceof Error ? error.message : "không đọc được"}`);
    }
  }

  throw new Error(`Không phát hiện contract tương thích. ${failures.join(" · ").slice(0, 900)}`);
}

function deviceType(value: unknown): UniversalContractDevice["deviceType"] {
  const normalized = text(value).toLowerCase();
  if (normalized === "desktop" || normalized === "computer") return "desktop";
  if (normalized === "phone" || normalized === "mobile") return "phone";
  if (normalized === "tablet" || normalized === "ipad") return "tablet";
  return "unknown";
}

function deviceStatus(value: unknown): UniversalContractDevice["status"] {
  const normalized = text(value).toLowerCase();
  return normalized === "pending" || normalized === "approved" || normalized === "blocked" ? normalized : "unknown";
}

function universalDevice(raw: unknown): UniversalContractDevice | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const row = raw as Record<string, unknown>;
  const deviceId = text(row.deviceId);
  if (!deviceId || deviceId.length > 256) return null;
  return {
    deviceId,
    deviceCode: text(row.deviceCode) || deviceId.slice(0, 16),
    deviceType: deviceType(row.deviceType),
    userLabel: text(row.userLabel) || text(row.label) || "Thiết bị chưa gắn người dùng",
    status: deviceStatus(row.status),
    active: row.active === true,
    createdAt: text(row.createdAt) || null,
    lastSeenAt: text(row.lastSeenAt) || null,
    environmentChanged: row.environmentChanged === true,
    editEnabled: row.editEnabled === true,
    registryInstanceId: text(row.registryInstanceId) || null,
  };
}

function capabilityLabels(capabilities: Record<string, boolean>) {
  const labels: Record<string, string> = {
    deviceRegistry: "Thiết bị",
    deviceApproval: "Duyệt thiết bị",
    deviceBlock: "Khóa thiết bị",
    deviceUnblock: "Mở khóa thiết bị",
    deviceEditPermission: "Quyền chỉnh sửa",
    sessions: "Phiên & thu hồi",
    audit: "Audit",
    contentReview: "Kiểm duyệt nội dung",
    payments: "Thanh toán & thời hạn",
    reports: "Báo cáo",
    webLaunch: "Mở Website",
  };
  return Object.entries(capabilities).filter(([, enabled]) => enabled).map(([key]) => labels[key] ?? key);
}

export async function probeManagedCatalogEntry(row: ManagedCatalogRow): Promise<DynamicContractSnapshot> {
  const category = normalizeCategory(row.category);
  const credential = await decryptCredential(row);

  let manifest: UniversalContractManifest;
  try {
    manifest = await discoverContract(row, credential, category);
    await rememberManagedProbe(row.id, { connected: true });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Không đọc được manifest.";
    await rememberManagedProbe(row.id, { connected: false, error: errorMessage });
    const previouslyConnected = Boolean(row.last_contract_connected_at);
    const state = previouslyConnected ? "unavailable" as const : "pending" as const;
    const note = previouslyConnected
      ? `Universal Contract từng kết nối thành công nhưng hiện không phản hồi tại ${row.contract_path}. ${errorMessage}`
      : `Chưa phát hiện Universal Contract chuẩn tại ${row.contract_path}. ${errorMessage}`;
    const config = dynamicApplicationConfig({
      id: row.id,
      name: row.name,
      shortName: row.short_name,
      category,
      origin: row.origin,
      publicUrl: row.public_url,
      repository: row.repository,
      contractState: previouslyConnected ? "migrating" : "pending",
      contractNote: note,
    });
    return {
      catalog: row,
      config,
      manifest: null,
      credentialConfigured: Boolean(credential),
      contractConnected: false,
      connection: state,
      devices: [],
      webHref: row.public_url,
      remoteAdminReady: false,
      note,
      issueCode: previouslyConnected ? "OPEN_CONTRACT_UNAVAILABLE" : "OPEN_CONTRACT_PENDING",
    };
  }

  const remoteAdminDeclared = Boolean(
    credential
    && manifest.capabilities.deviceRegistry
    && manifest.endpoints.devices,
  );
  let devices: UniversalContractDevice[] = [];
  let remoteAdminReady = false;
  let remoteAdminError = "";

  if (remoteAdminDeclared && manifest.endpoints.devices) {
    try {
      const devicePayload = await fetchJson(row.origin, manifest.endpoints.devices, credential);
      const rawDevices = Array.isArray(devicePayload.devices) ? devicePayload.devices : [];
      devices = rawDevices.map(universalDevice).filter((item): item is UniversalContractDevice => Boolean(item));
      remoteAdminReady = true;
    } catch (error) {
      remoteAdminError = error instanceof Error ? error.message : "Không đọc được endpoint thiết bị.";
    }
  }

  const capabilities = capabilityLabels(manifest.capabilities);
  const note = remoteAdminReady
    ? `${manifest.protocol ?? CONTRACT_SCHEMA} đã xác minh qua ${manifest.discoveredVia ?? row.contract_path}; remote-admin đang hoạt động.`
    : remoteAdminError
      ? `Contract đã kết nối qua ${manifest.discoveredVia ?? row.contract_path}, nhưng remote-admin tạm chưa sẵn sàng: ${remoteAdminError}`
      : credential
        ? `Contract đã kết nối qua ${manifest.discoveredVia ?? row.contract_path}, nhưng client chưa công bố đủ device-control capability/endpoint.`
        : `Contract đã kết nối qua ${manifest.discoveredVia ?? row.contract_path}; chưa có credential quản trị nên đang ở chế độ quan sát.`;

  const config = dynamicApplicationConfig({
    id: row.id,
    name: row.name,
    shortName: row.short_name,
    category,
    origin: row.origin,
    publicUrl: row.public_url,
    repository: row.repository,
    contractState: remoteAdminReady ? "connected" : "migrating",
    contractNote: note,
    capabilities,
  });

  return {
    catalog: row,
    config,
    manifest,
    credentialConfigured: Boolean(credential),
    contractConnected: true,
    connection: remoteAdminReady ? "connected" : "warning",
    devices,
    webHref: row.public_url || (manifest.capabilities.webLaunch ? row.origin : null),
    remoteAdminReady,
    note,
    issueCode: remoteAdminError ? "OPEN_CONTRACT_REMOTE_ADMIN_UNAVAILABLE" : undefined,
  };
}

export async function probeDynamicManagedApplications() {
  const rows = (await listManagedCatalog()).filter((row) => row.enabled === 1);
  return Promise.all(rows.map((row) => probeManagedCatalogEntry(row)));
}

function managedLaunchUrl(row: ManagedCatalogRow, value: unknown) {
  const normalized = normalizePublicUrl(value);
  if (!normalized) return null;
  const candidate = new URL(normalized);
  const allowedOrigins = new Set<string>([row.origin]);
  if (row.public_url) {
    try { allowedOrigins.add(new URL(row.public_url).origin); } catch { /* Catalog validation already guards public URL. */ }
  }
  return allowedOrigins.has(candidate.origin) ? candidate.toString() : null;
}

export async function resolveUniversalWebLaunch(appIdValue: unknown, actor: ControlDeviceState) {
  const appId = text(appIdValue).toLowerCase();
  if (!validAppId(appId)) return null;
  const row = (await listManagedCatalog()).find((item) => item.id === appId && item.enabled === 1);
  if (!row) return null;

  const snapshot = await probeManagedCatalogEntry(row);
  const manifest = snapshot.manifest;
  if (!snapshot.contractConnected || !manifest || manifest.capabilities.webLaunch !== true) {
    return null;
  }

  const direct = managedLaunchUrl(row, row.public_url || row.origin);
  if (!manifest.endpoints.web) {
    if (!direct) throw new Error("Contract chưa công bố Website hợp lệ.");
    return { launchUrl: direct, managed: false, contractPath: manifest.discoveredVia ?? row.contract_path };
  }

  const credential = await decryptCredential(row);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CONTRACT_TIMEOUT_MS);
  try {
    const headers: Record<string, string> = {
      accept: "application/json",
      "x-control-actor": actor.email,
      "x-control-role": actor.role,
      "x-control-device": actor.deviceId,
    };
    if (credential) headers.authorization = `Bearer ${credential}`;
    const response = await fetch(`${row.origin}${manifest.endpoints.web}`, {
      method: "GET",
      cache: "no-store",
      redirect: "manual",
      headers,
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
    if (!response.ok) throw new Error(text(payload.error) || `HTTP_${response.status}`);
    const launchUrl = managedLaunchUrl(row, payload.launchUrl || payload.url || payload.href);
    if (!launchUrl) throw new Error("Web launch endpoint trả URL ngoài origin đã đăng ký.");
    return { launchUrl, managed: true, contractPath: manifest.discoveredVia ?? row.contract_path };
  } catch (error) {
    if (controller.signal.aborted) throw new Error(`Web launch phản hồi quá ${CONTRACT_TIMEOUT_MS / 1000} giây.`);
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export async function executeUniversalDeviceCommand(input: {
  appId: string;
  operation: "approve" | "remove";
  deviceId: string;
  expectedStatus: "pending" | "approved" | "blocked";
  commandId: string;
}, actor: ControlDeviceState) {
  if (actor.role !== "publisher" && actor.role !== "owner") throw new Error("Vai trò hiện tại không được thay đổi thiết bị.");
  const rows = await listManagedCatalog();
  const row = rows.find((item) => item.id === input.appId && item.enabled === 1);
  if (!row) throw new Error("Ứng dụng không nằm trong catalog động.");
  const snapshot = await probeManagedCatalogEntry(row);
  const manifest = snapshot.manifest;
  if (!manifest || !snapshot.remoteAdminReady) throw new Error("Universal Contract chưa sẵn sàng cho thao tác từ xa.");
  if (!manifest.endpoints.deviceCommands || !manifest.capabilities.deviceIdempotentCommands || !manifest.capabilities.optimisticConcurrency) {
    throw new Error("Contract chưa xác nhận idempotent commands và optimistic concurrency.");
  }
  if (input.operation === "approve" && !manifest.capabilities.deviceApproval) throw new Error("Client chưa công bố capability duyệt thiết bị.");
  if (input.operation === "remove" && !manifest.capabilities.deviceBlock) throw new Error("Client chưa công bố capability khóa thiết bị.");
  const credential = await decryptCredential(row);
  if (!credential) throw new Error("Credential quản trị chưa được cấu hình.");
  const response = await fetch(`${row.origin}${manifest.endpoints.deviceCommands}`, {
    method: "POST",
    cache: "no-store",
    headers: {
      authorization: `Bearer ${credential}`,
      "content-type": "application/json",
      "x-control-actor": actor.email,
      "x-control-role": actor.role,
      "x-control-device": actor.deviceId,
    },
    body: JSON.stringify({
      commandId: input.commandId,
      operation: input.operation === "remove" ? "block" : "approve",
      deviceId: input.deviceId,
      expectedStatus: input.expectedStatus,
    }),
  });
  const data = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) throw new Error(text(data.error) || `HTTP_${response.status}`);
  const after = await probeManagedCatalogEntry(row);
  const current = after.devices.find((device) => device.deviceId === input.deviceId);
  const expected = input.operation === "approve" ? "approved" : "blocked";
  if (!current || current.status !== expected) throw new Error(`Client chưa read-back trạng thái ${expected} sau command.`);
  return { ok: true, commandReplayed: data.replayed === true, device: current };
}
