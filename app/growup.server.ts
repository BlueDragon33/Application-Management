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

function normalizeOrigin(value: unknown) {
  if (typeof value !== "string") return "";
  const trimmed = value.trim().replace(/\/+$/, "");
  if (!/^https?:\/\//i.test(trimmed)) return "";
  return trimmed;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function text(value: unknown) {
  return typeof value === "string" ? value : "";
}

async function configuredBaseUrl() {
  const workers = await import("cloudflare:workers");
  const values = workers.env as unknown as Record<string, unknown>;
  const baseUrl = normalizeOrigin(values.GROWUP_BASE_URL);
  if (!baseUrl) {
    throw new GrowUpBridgeError(
      "Chưa cấu hình URL Site GrowUP trong Application Management.",
      503,
      { code: "GROWUP_SITE_URL_NOT_CONFIGURED" },
    );
  }
  return baseUrl;
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
