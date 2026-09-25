import { applicationRegistry, standardDeviceExperiences, type ApplicationConfig } from "./application-registry";
import { getControlDatabase } from "./control-device.server";

export const MANAGED_CONTRACT_PROTOCOL = "application-management.contract.v1";
export const DEFAULT_MANIFEST_PATH = "/.well-known/application-management.json";

export const managedClassifications = [
  "learning",
  "health",
  "academic",
  "family",
  "accounting",
  "engineering",
  "infrastructure",
  "operations",
  "other",
] as const;

export type ManagedClassification = typeof managedClassifications[number];
export type ManagedContractAuthMode = "none" | "paired-bearer" | "legacy-env";
export type ManagedContractState = "connected" | "warning" | "pending" | "disabled";

export type ManagedContractManifestV1 = {
  protocol: typeof MANAGED_CONTRACT_PROTOCOL;
  application: {
    id: string;
    name: string;
    shortName: string;
    initials: string;
    classification: ManagedClassification;
    categoryLabel: string;
    repository?: string;
    runtimeOrigin?: string;
  };
  auth: {
    mode: "none" | "paired-bearer";
    pairEndpoint?: string;
  };
  endpoints: {
    status: string;
    devices?: string;
    deviceCommands?: string;
    automation?: string;
    launch?: string;
  };
  capabilities: Record<string, boolean | string | number>;
};

export type ManagedContractRecord = {
  applicationId: string;
  name: string;
  shortName: string;
  initials: string;
  classification: ManagedClassification;
  categoryLabel: string;
  repository: string | null;
  controlOrigin: string | null;
  runtimeOrigin: string | null;
  manifestPath: string;
  contractVersion: string;
  authMode: ManagedContractAuthMode;
  tokenExpiresAt: number | null;
  manifest: ManagedContractManifestV1 | null;
  capabilities: Record<string, boolean | string | number>;
  endpoints: Record<string, string>;
  enabled: boolean;
  state: ManagedContractState;
  lastProbeAt: string | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
};

type ManagedContractRow = {
  application_id: string;
  name: string;
  short_name: string;
  initials: string;
  classification: string;
  category_label: string;
  repository: string | null;
  control_origin: string | null;
  runtime_origin: string | null;
  manifest_path: string;
  contract_version: string;
  auth_mode: string;
  token_ciphertext: string | null;
  token_iv: string | null;
  token_expires_at: number | null;
  manifest_json: string;
  capabilities_json: string;
  endpoints_json: string;
  enabled: number;
  state: string;
  last_probe_at: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
};

type UnknownRecord = Record<string, unknown>;

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const PROBE_TIMEOUT_MS = 4_500;

const classificationLabels: Record<ManagedClassification, string> = {
  learning: "Học tập",
  health: "Y tế",
  academic: "Học thuật",
  family: "Gia đình",
  accounting: "Kế toán",
  engineering: "Kỹ thuật",
  infrastructure: "Hạ tầng",
  operations: "Vận hành",
  other: "Khác",
};

function record(value: unknown): UnknownRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as UnknownRecord : {};
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function safeJson<T>(value: string, fallback: T): T {
  try { return JSON.parse(value) as T; } catch { return fallback; }
}

function validApplicationId(value: string) {
  return /^[a-z0-9](?:[a-z0-9-]{1,62}[a-z0-9])?$/.test(value);
}

function validPath(value: string) {
  return /^\/[A-Za-z0-9._~!$&'()*+,;=:@%/-]{0,240}$/.test(value) && !value.startsWith("//");
}

function normalizeManifestPath(value: unknown) {
  const path = text(value) || DEFAULT_MANIFEST_PATH;
  if (!validPath(path)) throw new Error("Manifest path không hợp lệ.");
  return path;
}

function isPrivateIpv4(hostname: string) {
  const parts = hostname.split(".").map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  if (parts[0] === 10 || parts[0] === 127) return true;
  if (parts[0] === 192 && parts[1] === 168) return true;
  return parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31;
}

function privateHostname(hostname: string) {
  const normalized = hostname.toLowerCase();
  return normalized === "localhost" || normalized === "::1" || isPrivateIpv4(normalized);
}

export function normalizeManagedOrigin(value: unknown, allowPrivateHttp = false) {
  const raw = text(value).replace(/\/$/, "");
  if (!raw) return "";
  try {
    const url = new URL(raw);
    if (url.username || url.password || url.pathname !== "/" || url.search || url.hash) return "";
    if (url.protocol === "https:") return url.origin;
    if (allowPrivateHttp && url.protocol === "http:" && privateHostname(url.hostname)) return url.origin;
    return "";
  } catch {
    return "";
  }
}

function classification(value: unknown): ManagedClassification {
  const normalized = text(value).toLowerCase();
  return (managedClassifications as readonly string[]).includes(normalized)
    ? normalized as ManagedClassification
    : "other";
}

function pathFrom(value: unknown, name: string, required = false) {
  const path = text(value);
  if (!path && !required) return "";
  if (!validPath(path)) throw new Error(`Endpoint ${name} không hợp lệ.`);
  return path;
}

function parseCapabilities(value: unknown) {
  const source = record(value);
  const result: Record<string, boolean | string | number> = {};
  for (const [key, entry] of Object.entries(source)) {
    if (!/^[a-z][a-zA-Z0-9]{1,63}$/.test(key)) continue;
    if (typeof entry === "boolean" || typeof entry === "string" || typeof entry === "number") result[key] = entry;
  }
  return result;
}

export function parseManagedContractManifest(value: unknown): ManagedContractManifestV1 {
  const root = record(value);
  if (root.protocol !== MANAGED_CONTRACT_PROTOCOL) throw new Error(`Contract phải dùng protocol ${MANAGED_CONTRACT_PROTOCOL}.`);

  const app = record(root.application);
  const id = text(app.id).toLowerCase();
  if (!validApplicationId(id)) throw new Error("application.id không hợp lệ.");
  const name = text(app.name);
  if (!name || name.length > 120) throw new Error("application.name không hợp lệ.");
  const shortName = (text(app.shortName) || name).slice(0, 80);
  const initials = (text(app.initials) || shortName.replace(/[^A-Za-z0-9À-ỹ]/g, "").slice(0, 3) || "APP").slice(0, 4).toUpperCase();
  const kind = classification(app.classification);
  const categoryLabel = (text(app.categoryLabel) || classificationLabels[kind]).slice(0, 80);
  const repository = text(app.repository);
  if (repository && !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository)) throw new Error("application.repository không hợp lệ.");
  const runtimeOrigin = text(app.runtimeOrigin);
  if (runtimeOrigin && !normalizeManagedOrigin(runtimeOrigin, false)) throw new Error("application.runtimeOrigin phải là HTTPS origin.");

  const auth = record(root.auth);
  const authMode = auth.mode === "paired-bearer" ? "paired-bearer" : auth.mode === "none" ? "none" : "";
  if (!authMode) throw new Error("auth.mode phải là none hoặc paired-bearer.");
  const pairEndpoint = pathFrom(auth.pairEndpoint, "pairEndpoint", authMode === "paired-bearer");

  const endpoints = record(root.endpoints);
  const status = pathFrom(endpoints.status, "status", true);
  const devices = pathFrom(endpoints.devices, "devices");
  const deviceCommands = pathFrom(endpoints.deviceCommands, "deviceCommands");
  const automation = pathFrom(endpoints.automation, "automation");
  const launch = pathFrom(endpoints.launch, "launch");

  return {
    protocol: MANAGED_CONTRACT_PROTOCOL,
    application: {
      id,
      name,
      shortName,
      initials,
      classification: kind,
      categoryLabel,
      ...(repository ? { repository } : {}),
      ...(runtimeOrigin ? { runtimeOrigin: normalizeManagedOrigin(runtimeOrigin, false) } : {}),
    },
    auth: { mode: authMode, ...(pairEndpoint ? { pairEndpoint } : {}) },
    endpoints: {
      status,
      ...(devices ? { devices } : {}),
      ...(deviceCommands ? { deviceCommands } : {}),
      ...(automation ? { automation } : {}),
      ...(launch ? { launch } : {}),
    },
    capabilities: parseCapabilities(root.capabilities),
  };
}

async function environment() {
  try {
    const workers = await import("cloudflare:workers");
    return workers.env as unknown as Record<string, unknown>;
  } catch {
    return process.env as unknown as Record<string, unknown>;
  }
}

function base64Url(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function decodeBase64Url(value: string) {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  const binary = atob(normalized + "=".repeat((4 - normalized.length % 4) % 4));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function vaultKey() {
  const values = await environment();
  const secret = text(values.APPLICATION_CONTRACT_VAULT_KEY);
  if (secret.length < 32) throw new Error("APPLICATION_CONTRACT_VAULT_KEY chưa được cấu hình hoặc quá ngắn.");
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(secret));
  return crypto.subtle.importKey("raw", digest, "AES-GCM", false, ["encrypt", "decrypt"]);
}

async function encryptToken(token: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await vaultKey();
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoder.encode(token));
  return { ciphertext: base64Url(new Uint8Array(encrypted)), iv: base64Url(iv) };
}

async function decryptToken(ciphertext: string, iv: string) {
  const key = await vaultKey();
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: decodeBase64Url(iv) },
    key,
    decodeBase64Url(ciphertext),
  );
  return decoder.decode(decrypted);
}

function rowToRecord(row: ManagedContractRow): ManagedContractRecord {
  const manifest = safeJson<ManagedContractManifestV1 | null>(row.manifest_json, null);
  return {
    applicationId: row.application_id,
    name: row.name,
    shortName: row.short_name,
    initials: row.initials,
    classification: classification(row.classification),
    categoryLabel: row.category_label,
    repository: row.repository,
    controlOrigin: row.control_origin,
    runtimeOrigin: row.runtime_origin,
    manifestPath: row.manifest_path,
    contractVersion: row.contract_version,
    authMode: row.auth_mode === "paired-bearer" ? "paired-bearer" : row.auth_mode === "legacy-env" ? "legacy-env" : "none",
    tokenExpiresAt: row.token_expires_at,
    manifest,
    capabilities: safeJson<Record<string, boolean | string | number>>(row.capabilities_json, {}),
    endpoints: safeJson<Record<string, string>>(row.endpoints_json, {}),
    enabled: row.enabled === 1,
    state: row.state === "connected" || row.state === "warning" || row.state === "disabled" ? row.state : "pending",
    lastProbeAt: row.last_probe_at,
    lastError: row.last_error,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function seedLegacyRegistryRows() {
  const database = await getControlDatabase();
  for (const app of applicationRegistry) {
    const kind: ManagedClassification =
      app.category === "Học tập" ? "learning"
      : app.category === "Y tế" ? "health"
      : app.category === "Học thuật" ? "academic"
      : app.category === "Gia đình" ? "family"
      : app.category === "Kế toán" ? "accounting"
      : app.category === "Kỹ thuật" ? "engineering"
      : "other";
    await database.prepare(
      "INSERT OR IGNORE INTO managed_contract_apps (application_id,name,short_name,initials,classification,category_label,repository,control_origin,runtime_origin,manifest_path,contract_version,auth_mode,manifest_json,capabilities_json,endpoints_json,enabled,state,created_at,updated_at) VALUES (?1,?2,?3,?4,?5,?6,?7,NULL,?8,?9,?10,'legacy-env','{}','{}','{}',1,?11,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)",
    ).bind(
      app.id,
      app.name,
      app.shortName,
      app.initials,
      kind,
      app.category,
      app.repository,
      app.publicUrl ?? null,
      DEFAULT_MANIFEST_PATH,
      MANAGED_CONTRACT_PROTOCOL,
      app.contractState === "connected" ? "connected" : "pending",
    ).run();
  }
}

export async function listManagedContracts() {
  await seedLegacyRegistryRows();
  const database = await getControlDatabase();
  const result = await database.prepare(
    "SELECT * FROM managed_contract_apps ORDER BY category_label ASC, name ASC",
  ).all<ManagedContractRow>();
  return result.results.map(rowToRecord);
}

export async function getManagedContract(applicationId: string) {
  await seedLegacyRegistryRows();
  const database = await getControlDatabase();
  const row = await database.prepare(
    "SELECT * FROM managed_contract_apps WHERE application_id=?1 LIMIT 1",
  ).bind(applicationId).first<ManagedContractRow>();
  return row ? rowToRecord(row) : null;
}

export async function discoverManagedContract(controlOrigin: string, manifestPath = DEFAULT_MANIFEST_PATH) {
  const origin = normalizeManagedOrigin(controlOrigin, false);
  if (!origin) throw new Error("Control origin phải là HTTPS origin hợp lệ.");
  const path = normalizeManifestPath(manifestPath);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  try {
    const response = await fetch(`${origin}${path}`, {
      method: "GET",
      cache: "no-store",
      redirect: "error",
      signal: controller.signal,
      headers: { accept: "application/json" },
    });
    if (!response.ok) throw new Error(`Manifest trả HTTP ${response.status}.`);
    const manifest = parseManagedContractManifest(await response.json());
    return { origin, manifestPath: path, manifest };
  } finally {
    clearTimeout(timer);
  }
}

export async function saveDiscoveredManagedContract(input: {
  controlOrigin: string;
  manifestPath?: string;
  manifest?: unknown;
}) {
  const discovered = input.manifest
    ? {
        origin: normalizeManagedOrigin(input.controlOrigin, false),
        manifestPath: normalizeManifestPath(input.manifestPath),
        manifest: parseManagedContractManifest(input.manifest),
      }
    : await discoverManagedContract(input.controlOrigin, input.manifestPath);
  if (!discovered.origin) throw new Error("Control origin phải là HTTPS origin hợp lệ.");

  const { manifest } = discovered;
  const runtimeOrigin = manifest.application.runtimeOrigin ?? null;
  const database = await getControlDatabase();
  await database.prepare(
    `INSERT INTO managed_contract_apps (
      application_id,name,short_name,initials,classification,category_label,repository,
      control_origin,runtime_origin,manifest_path,contract_version,auth_mode,
      manifest_json,capabilities_json,endpoints_json,enabled,state,last_error,created_at,updated_at
    ) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,1,'pending',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
    ON CONFLICT(application_id) DO UPDATE SET
      name=excluded.name,short_name=excluded.short_name,initials=excluded.initials,
      classification=excluded.classification,category_label=excluded.category_label,repository=excluded.repository,
      control_origin=excluded.control_origin,runtime_origin=COALESCE(excluded.runtime_origin,managed_contract_apps.runtime_origin),
      manifest_path=excluded.manifest_path,contract_version=excluded.contract_version,
      auth_mode=CASE WHEN managed_contract_apps.auth_mode='legacy-env' THEN managed_contract_apps.auth_mode ELSE excluded.auth_mode END,
      manifest_json=excluded.manifest_json,capabilities_json=excluded.capabilities_json,endpoints_json=excluded.endpoints_json,
      enabled=1,state='pending',last_error=NULL,updated_at=CURRENT_TIMESTAMP`,
  ).bind(
    manifest.application.id,
    manifest.application.name,
    manifest.application.shortName,
    manifest.application.initials,
    manifest.application.classification,
    manifest.application.categoryLabel,
    manifest.application.repository ?? null,
    discovered.origin,
    runtimeOrigin,
    discovered.manifestPath,
    manifest.protocol,
    manifest.auth.mode,
    JSON.stringify(manifest),
    JSON.stringify(manifest.capabilities),
    JSON.stringify(manifest.endpoints),
  ).run();
  return getManagedContract(manifest.application.id);
}

export async function saveLegacyManagedContract(input: {
  applicationId: string;
  controlOrigin?: string;
  runtimeOrigin?: string;
  classification?: string;
  categoryLabel?: string;
}) {
  const existing = applicationRegistry.find((item) => item.id === input.applicationId);
  if (!existing) throw new Error("Legacy override chỉ dùng cho ứng dụng đã có compatibility adapter.");
  const controlOrigin = input.controlOrigin ? normalizeManagedOrigin(input.controlOrigin, false) : "";
  const runtimeOrigin = input.runtimeOrigin ? normalizeManagedOrigin(input.runtimeOrigin, false) : "";
  if (input.controlOrigin && !controlOrigin) throw new Error("Control origin phải là HTTPS origin hợp lệ.");
  if (input.runtimeOrigin && !runtimeOrigin) throw new Error("Runtime origin phải là HTTPS origin hợp lệ.");

  await seedLegacyRegistryRows();
  const database = await getControlDatabase();
  const kind = classification(input.classification);
  await database.prepare(
    "UPDATE managed_contract_apps SET control_origin=COALESCE(?2,control_origin),runtime_origin=COALESCE(?3,runtime_origin),classification=?4,category_label=?5,auth_mode='legacy-env',enabled=1,state='pending',last_error=NULL,updated_at=CURRENT_TIMESTAMP WHERE application_id=?1",
  ).bind(
    input.applicationId,
    controlOrigin || null,
    runtimeOrigin || null,
    kind,
    text(input.categoryLabel) || existing.category,
  ).run();
  return getManagedContract(input.applicationId);
}

export async function pairManagedContract(applicationId: string, pairingCode: string) {
  const contract = await getManagedContract(applicationId);
  if (!contract?.controlOrigin || !contract.manifest) throw new Error("Ứng dụng chưa có manifest/discovery hợp lệ.");
  if (contract.manifest.auth.mode !== "paired-bearer" || !contract.manifest.auth.pairEndpoint) {
    throw new Error("Contract này không dùng pairing token.");
  }
  const code = pairingCode.trim();
  if (code.length < 6 || code.length > 256) throw new Error("Pairing code không hợp lệ.");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  try {
    const response = await fetch(`${contract.controlOrigin}${contract.manifest.auth.pairEndpoint}`, {
      method: "POST",
      cache: "no-store",
      redirect: "error",
      signal: controller.signal,
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        protocol: MANAGED_CONTRACT_PROTOCOL,
        applicationId,
        pairingCode: code,
        consumer: "application-management",
      }),
    });
    const data = record(await response.json().catch(() => ({})));
    if (!response.ok) throw new Error(text(data.error) || `Pairing trả HTTP ${response.status}.`);
    const accessToken = text(data.accessToken);
    if (accessToken.length < 24 || accessToken.length > 4096) throw new Error("Client không trả access token hợp lệ.");
    const expiresAt = typeof data.expiresAt === "number" && Number.isFinite(data.expiresAt) ? Math.floor(data.expiresAt) : null;
    const encrypted = await encryptToken(accessToken);
    const database = await getControlDatabase();
    await database.prepare(
      "UPDATE managed_contract_apps SET auth_mode='paired-bearer',token_ciphertext=?2,token_iv=?3,token_expires_at=?4,state='pending',last_error=NULL,updated_at=CURRENT_TIMESTAMP WHERE application_id=?1",
    ).bind(applicationId, encrypted.ciphertext, encrypted.iv, expiresAt).run();
    return probeManagedContract(applicationId);
  } finally {
    clearTimeout(timer);
  }
}

export async function setManagedContractEnabled(applicationId: string, enabled: boolean) {
  const database = await getControlDatabase();
  await database.prepare(
    "UPDATE managed_contract_apps SET enabled=?2,state=?3,updated_at=CURRENT_TIMESTAMP WHERE application_id=?1",
  ).bind(applicationId, enabled ? 1 : 0, enabled ? "pending" : "disabled").run();
  return getManagedContract(applicationId);
}

export async function deleteManagedContract(applicationId: string) {
  if (applicationRegistry.some((item) => item.id === applicationId)) {
    throw new Error("Ứng dụng compatibility lõi không được xóa; chỉ có thể tắt hoặc cập nhật origin.");
  }
  const database = await getControlDatabase();
  await database.prepare("DELETE FROM managed_contract_apps WHERE application_id=?1").bind(applicationId).run();
}

async function storedToken(contract: ManagedContractRecord) {
  if (contract.authMode !== "paired-bearer") return "";
  const database = await getControlDatabase();
  const row = await database.prepare(
    "SELECT token_ciphertext,token_iv,token_expires_at FROM managed_contract_apps WHERE application_id=?1 LIMIT 1",
  ).bind(contract.applicationId).first<{ token_ciphertext: string | null; token_iv: string | null; token_expires_at: number | null }>();
  if (!row?.token_ciphertext || !row.token_iv) throw new Error("Ứng dụng chưa được pairing.");
  if (row.token_expires_at && row.token_expires_at <= Math.floor(Date.now() / 1000)) throw new Error("Access token của ứng dụng đã hết hạn; cần pairing lại.");
  return decryptToken(row.token_ciphertext, row.token_iv);
}

export async function resolveManagedContractTransport(applicationId: string) {
  const contract = await getManagedContract(applicationId);
  if (!contract?.enabled || !contract.controlOrigin) return null;
  const token = contract.authMode === "paired-bearer" ? await storedToken(contract) : "";
  return { contract, baseUrl: contract.controlOrigin, token };
}

export async function managedContractRequest(
  applicationId: string,
  path: string,
  init?: { method?: "GET" | "POST"; body?: UnknownRecord },
) {
  const transport = await resolveManagedContractTransport(applicationId);
  if (!transport) throw new Error("Ứng dụng chưa có transport trong Contract Registry.");
  if (!validPath(path)) throw new Error("Contract endpoint path không hợp lệ.");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  try {
    const headers: Record<string, string> = { accept: "application/json" };
    if (init?.body) headers["content-type"] = "application/json";
    if (transport.token) headers.authorization = `Bearer ${transport.token}`;
    const response = await fetch(`${transport.baseUrl}${path}`, {
      method: init?.method ?? "GET",
      headers,
      body: init?.body ? JSON.stringify(init.body) : undefined,
      cache: "no-store",
      redirect: "error",
      signal: controller.signal,
    });
    const data = await response.json().catch(() => ({})) as UnknownRecord;
    if (!response.ok) throw new Error(text(data.error) || `Client trả HTTP ${response.status}.`);
    return data;
  } finally {
    clearTimeout(timer);
  }
}

export async function probeManagedContract(applicationId: string) {
  const contract = await getManagedContract(applicationId);
  if (!contract) throw new Error("Không tìm thấy ứng dụng trong Contract Registry.");
  if (!contract.enabled) return contract;
  if (!contract.controlOrigin) {
    const database = await getControlDatabase();
    await database.prepare(
      "UPDATE managed_contract_apps SET state='pending',last_probe_at=CURRENT_TIMESTAMP,last_error='Chưa cấu hình control origin.',updated_at=CURRENT_TIMESTAMP WHERE application_id=?1",
    ).bind(applicationId).run();
    return getManagedContract(applicationId);
  }

  const statusPath = contract.endpoints.status || contract.manifest?.endpoints.status;
  if (!statusPath) {
    const database = await getControlDatabase();
    await database.prepare(
      "UPDATE managed_contract_apps SET state='pending',last_probe_at=CURRENT_TIMESTAMP,last_error='Contract chưa công bố status endpoint.',updated_at=CURRENT_TIMESTAMP WHERE application_id=?1",
    ).bind(applicationId).run();
    return getManagedContract(applicationId);
  }

  try {
    await managedContractRequest(applicationId, statusPath);
    const database = await getControlDatabase();
    await database.prepare(
      "UPDATE managed_contract_apps SET state='connected',last_probe_at=CURRENT_TIMESTAMP,last_error=NULL,updated_at=CURRENT_TIMESTAMP WHERE application_id=?1",
    ).bind(applicationId).run();
  } catch (error) {
    const database = await getControlDatabase();
    await database.prepare(
      "UPDATE managed_contract_apps SET state='warning',last_probe_at=CURRENT_TIMESTAMP,last_error=?2,updated_at=CURRENT_TIMESTAMP WHERE application_id=?1",
    ).bind(applicationId, error instanceof Error ? error.message.slice(0, 500) : "Không thể probe contract.").run();
  }
  return getManagedContract(applicationId);
}

export async function probeAllManagedContracts() {
  const contracts = await listManagedContracts();
  return Promise.all(contracts.filter((item) => item.enabled).map((item) => probeManagedContract(item.applicationId)));
}

export function managedContractToApplicationConfig(contract: ManagedContractRecord): ApplicationConfig {
  return {
    id: contract.applicationId,
    name: contract.name,
    shortName: contract.shortName,
    href: `/tools/contract-registry?app=${encodeURIComponent(contract.applicationId)}`,
    ...(contract.runtimeOrigin ? { publicUrl: contract.runtimeOrigin } : {}),
    initials: contract.initials,
    category: contract.categoryLabel,
    tier: "client",
    status: contract.state === "connected" ? "online" : contract.state === "warning" ? "warning" : "planned",
    contractState: contract.state === "connected" ? "connected" : contract.state === "warning" ? "migrating" : "pending",
    repository: contract.repository ?? "",
    scope: "Ứng dụng được quản lý động qua Application Management Contract Registry v1.",
    contractNote: contract.lastError
      ? `Contract Registry: ${contract.lastError}`
      : contract.state === "connected"
        ? "Contract Registry đã probe thành công."
        : "Đang chờ discovery/pairing/probe contract.",
    devicePolicy: "Thiết bị và policy thuộc client; Trung tâm chỉ dùng capability mà manifest công bố.",
    deviceExperiences: standardDeviceExperiences,
    capabilities: Object.entries(contract.capabilities).filter(([, value]) => value === true).map(([key]) => key),
    guardrails: [
      "Không suy diễn capability chưa công bố.",
      "Không dùng token pairing ngoài Contract Registry.",
      "Mọi thao tác remote phải đọc lại trạng thái client.",
    ],
  };
}

export async function listDynamicApplicationConfigs() {
  const staticIds = new Set(applicationRegistry.map((item) => item.id));
  return (await listManagedContracts())
    .filter((item) => item.enabled && !staticIds.has(item.applicationId))
    .map(managedContractToApplicationConfig);
}
