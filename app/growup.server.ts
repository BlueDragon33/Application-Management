const CONTRACT_PATH = "/control/application-management.contract.json";
const CONTRACT_TIMEOUT_MS = 4_500;
const APPLICATION_ID = "growup-mychildren";
const REPOSITORY = "BlueDragon33/GrowUP_MyChildren";

export type GrowUpContractProbe = {
  baseUrl: string;
  contractVersion: number;
  application: typeof APPLICATION_ID;
  repository: typeof REPOSITORY;
  deviceNamespace: "GU-";
  directLaunch: true;
  remoteAdminReady: boolean;
};

export type GrowUpControlBridge = {
  baseUrl: string;
  token: string;
  expiresAt: number;
  deviceCommandsTarget: "/api/control/device-commands";
  registryInstanceId: string | null;
  transport: "local-control" | "cloud-control";
};

export class GrowUpBridgeError extends Error {
  status: number;
  detail: Record<string, unknown>;

  constructor(message: string, status = 503, detail: Record<string, unknown> = {}) {
    super(message);
    this.name = "GrowUpBridgeError";
    this.status = status;
    this.detail = detail;
  }
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeOrigin(value: unknown, allowPrivateHttp = false) {
  const raw = text(value).replace(/\/+$/, "");
  if (!raw) return "";
  try {
    const url = new URL(raw);
    if (url.username || url.password || url.pathname !== "/" || url.search || url.hash) return "";
    if (url.protocol === "https:") return url.origin;
    if (allowPrivateHttp && url.protocol === "http:" && ["127.0.0.1", "localhost", "::1"].includes(url.hostname)) return url.origin;
    return "";
  } catch {
    return "";
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function bool(value: unknown) {
  return value === true;
}

async function environment() {
  const processValues = process.env as unknown as Record<string, unknown>;
  try {
    const workers = await import("cloudflare:workers");
    return { ...processValues, ...(workers.env as unknown as Record<string, unknown>) };
  } catch {
    return processValues;
  }
}

function localNetwork(values: Record<string, unknown>) {
  const mode = text(values.CONTROL_PLANE_NETWORK_MODE).toLowerCase();
  return values.LOCAL_DEV_AUTH === "1" || mode === "local" || mode === "hybrid";
}

async function configuredBaseUrl() {
  const values = await environment();
  const allowLocal = localNetwork(values);
  const explicit = normalizeOrigin(values.GROWUP_BASE_URL, allowLocal);
  if (explicit) return explicit;
  if (allowLocal) return "http://127.0.0.1:3006";
  throw new GrowUpBridgeError(
    "Chưa cấu hình URL Site GrowUP trong Application Management.",
    503,
    { code: "GROWUP_SITE_URL_NOT_CONFIGURED" },
  );
}

async function controlConfiguration() {
  const values = await environment();
  const allowLocal = localNetwork(values);
  const localBaseUrl = normalizeOrigin(values.GROWUP_CONTROL_LOCAL_BASE_URL, true) || (allowLocal ? "http://127.0.0.1:3007" : "");
  const productionBaseUrl = normalizeOrigin(values.GROWUP_CONTROL_BASE_URL, false);
  const baseUrl = allowLocal ? (localBaseUrl || productionBaseUrl) : productionBaseUrl;
  const secret = text(values.GROWUP_CONTROL_SERVICE_SECRET);
  if (!baseUrl) {
    throw new GrowUpBridgeError("GrowUP chưa có Control Service được cấu hình.", 503, { code: "GROWUP_CONTROL_ORIGIN_NOT_CONFIGURED" });
  }
  if (secret.length < 24) {
    throw new GrowUpBridgeError("GrowUP chưa có khóa Control Service hợp lệ.", 503, { code: "GROWUP_CONTROL_SECRET_NOT_CONFIGURED", baseUrl });
  }
  return { baseUrl, secret, transport: baseUrl.startsWith("http://") ? "local-control" as const : "cloud-control" as const };
}

export async function probeGrowUpManagementContract(): Promise<GrowUpContractProbe> {
  const baseUrl = await configuredBaseUrl();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CONTRACT_TIMEOUT_MS);

  try {
    const response = await fetch(`${baseUrl}${CONTRACT_PATH}`, {
      cache: "no-store",
      signal: controller.signal,
      headers: { accept: "application/json" },
    });
    const payload = asRecord(await response.json().catch(() => ({})));
    if (!response.ok) {
      throw new GrowUpBridgeError(
        text(payload.error) || `GrowUP contract trả HTTP ${response.status}.`,
        502,
        { code: "GROWUP_CONTRACT_UNAVAILABLE", baseUrl, upstreamStatus: response.status },
      );
    }

    const application = asRecord(payload.application);
    const boundary = asRecord(payload.boundary);
    const readiness = asRecord(payload.readiness);
    const requiredDeviceContract = asRecord(payload.requiredDeviceContract);
    const policy = asRecord(payload.policy);
    const contractVersion = Number(payload.contractVersion);

    const valid = Number.isInteger(contractVersion)
      && contractVersion >= 1
      && application.id === APPLICATION_ID
      && application.repository === REPOSITORY
      && boundary.independentRuntime === true
      && boundary.pwaOffline === true
      && boundary.embeddedInApplicationManagement === false
      && boundary.childRecordsInControlPlane === false
      && boundary.healthRecordsInControlPlane === false
      && boundary.sharedDatabaseWithOtherClients === false
      && readiness.runtime === "available"
      && readiness.privacyLocalFirst === "available"
      && readiness.pwa === "available"
      && requiredDeviceContract.namespace === "GU-"
      && requiredDeviceContract.accessAndEditSeparated === true
      && policy.applicationManagementMayInventOperationsWithoutBackend === false
      && policy.applicationManagementMayReadChildData === false
      && policy.applicationManagementMayReadHealthData === false;

    if (!valid) {
      throw new GrowUpBridgeError(
        "Contract production của GrowUP không khớp ranh giới Application Management.",
        409,
        { code: "GROWUP_CONTRACT_MISMATCH", baseUrl },
      );
    }

    const remoteAdminReady = readiness.deviceRegistry === "available"
      && readiness.deviceGateway === "available"
      && readiness.adminApi === "available"
      && readiness.remoteAuditApi === "available"
      && readiness.configurationReviewApi === "available";

    return {
      baseUrl,
      contractVersion,
      application: APPLICATION_ID,
      repository: REPOSITORY,
      deviceNamespace: "GU-",
      directLaunch: true,
      remoteAdminReady,
    };
  } catch (error) {
    if (error instanceof GrowUpBridgeError) throw error;
    if (controller.signal.aborted) {
      throw new GrowUpBridgeError(
        `Site GrowUP không trả contract trong ${CONTRACT_TIMEOUT_MS / 1_000} giây.`,
        504,
        { code: "GROWUP_CONTRACT_TIMEOUT", baseUrl },
      );
    }
    throw new GrowUpBridgeError(
      error instanceof Error ? error.message : "Không đọc được contract GrowUP.",
      502,
      { code: "GROWUP_CONTRACT_UNAVAILABLE", baseUrl },
    );
  } finally {
    clearTimeout(timeout);
  }
}

async function probeGrowUpControl(configured: Awaited<ReturnType<typeof controlConfiguration>>) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CONTRACT_TIMEOUT_MS);
  try {
    const response = await fetch(`${configured.baseUrl}/api/control/status`, {
      cache: "no-store",
      signal: controller.signal,
      headers: { authorization: `Bearer ${configured.secret}`, accept: "application/json" },
    });
    const payload = asRecord(await response.json().catch(() => ({})));
    if (!response.ok) throw new GrowUpBridgeError(text(payload.error) || `GrowUP Control trả HTTP ${response.status}.`, 502, { code: "GROWUP_CONTROL_UNAVAILABLE", baseUrl: configured.baseUrl });
    const endpoints = asRecord(payload.endpoints);
    const capabilities = asRecord(payload.capabilities);
    const valid = payload.applicationId === APPLICATION_ID
      && endpoints.devices === "/api/control/devices"
      && endpoints.deviceCommands === "/api/control/device-commands"
      && endpoints.audit === "/api/control/audit"
      && bool(capabilities.deviceRegistry)
      && bool(capabilities.deviceApproval)
      && bool(capabilities.deviceIdempotentCommands)
      && bool(capabilities.optimisticConcurrency)
      && bool(capabilities.privacySafeAudit)
      && capabilities.childRecordsExposed === false
      && capabilities.healthRecordsExposed === false;
    if (!valid) throw new GrowUpBridgeError("GrowUP Control Service không khớp contract quản trị an toàn.", 409, { code: "GROWUP_CONTROL_CONTRACT_MISMATCH", baseUrl: configured.baseUrl });
    return { registryInstanceId: text(payload.registryInstanceId) || null };
  } catch (error) {
    if (error instanceof GrowUpBridgeError) throw error;
    if (controller.signal.aborted) throw new GrowUpBridgeError(`GrowUP Control Service không phản hồi trong ${CONTRACT_TIMEOUT_MS / 1_000} giây.`, 504, { code: "GROWUP_CONTROL_TIMEOUT", baseUrl: configured.baseUrl });
    throw new GrowUpBridgeError(error instanceof Error ? error.message : "Không đọc được GrowUP Control Service.", 502, { code: "GROWUP_CONTROL_UNAVAILABLE", baseUrl: configured.baseUrl });
  } finally {
    clearTimeout(timeout);
  }
}

export async function issueGrowUpBrowserBridge(): Promise<GrowUpControlBridge> {
  const configured = await controlConfiguration();
  const status = await probeGrowUpControl(configured);
  return {
    baseUrl: configured.baseUrl,
    token: configured.secret,
    expiresAt: Date.now() + 5 * 60 * 1000,
    deviceCommandsTarget: "/api/control/device-commands",
    registryInstanceId: status.registryInstanceId,
    transport: configured.transport,
  };
}
