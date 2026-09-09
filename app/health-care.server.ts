import type { ControlRole } from "./control-device.server";

const TOKEN_ISSUER = "application-management";
const TOKEN_AUDIENCE = "health-care-control";
const TOKEN_APP = "health-care";
const CONTROL_PROTOCOL = "application-management-health-control-v1";
const CONTRACT_TIMEOUT_MS = 4_500;

export type HealthContractProbe = {
  baseUrl: string;
  siteOrigin: string;
  contractVersion: number;
  controlProtocol: string;
  capabilities: string[];
  deviceNamespace: string;
};

export class HealthBridgeError extends Error {
  status: number;
  payload: unknown;

  constructor(message: string, status: number, payload: unknown) {
    super(message);
    this.status = status;
    this.payload = payload;
  }
}

function normalizeOrigin(value: unknown) {
  if (typeof value !== "string") return "";
  const trimmed = value.trim().replace(/\/$/, "");
  if (!/^https:\/\/[a-z0-9.-]+(?::\d+)?$/i.test(trimmed)) return "";
  return trimmed;
}

async function environment() {
  const workers = await import("cloudflare:workers");
  const values = workers.env as unknown as Record<string, unknown>;
  return {
    baseUrl: normalizeOrigin(values.HEALTH_CARE_BASE_URL),
    secret: typeof values.HEALTH_CONTROL_SERVICE_SECRET === "string" ? values.HEALTH_CONTROL_SERVICE_SECRET : "",
  };
}

async function requireBaseUrl() {
  const { baseUrl } = await environment();
  if (!baseUrl) {
    throw new HealthBridgeError(
      "Chưa cấu hình URL Site Sức khỏe Y tế trong ChatGPT Sites.",
      503,
      { code: "HEALTH_CARE_SITE_URL_NOT_CONFIGURED" },
    );
  }
  return baseUrl;
}

async function configuration() {
  const { baseUrl, secret } = await environment();
  if (!baseUrl) {
    throw new HealthBridgeError(
      "Chưa cấu hình URL Site Sức khỏe Y tế trong ChatGPT Sites.",
      503,
      { code: "HEALTH_CARE_SITE_URL_NOT_CONFIGURED" },
    );
  }
  if (secret.length < 32) {
    throw new HealthBridgeError(
      "Chưa cấu hình khóa kết nối Sức khỏe Y tế trong ChatGPT Sites.",
      503,
      { code: "HEALTH_CARE_SITE_SECRET_NOT_CONFIGURED", baseUrl },
    );
  }
  return { baseUrl, secret };
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function text(value: unknown) {
  return typeof value === "string" ? value : "";
}

export async function probeHealthManagementContract(): Promise<HealthContractProbe> {
  const baseUrl = await requireBaseUrl();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CONTRACT_TIMEOUT_MS);
  try {
    const response = await fetch(`${baseUrl}/api/control/contract`, { cache: "no-store", signal: controller.signal });
    const payload = asRecord(await response.json().catch(() => ({})));
    if (!response.ok) {
      throw new HealthBridgeError(
        text(payload.error) || `Health contract trả HTTP ${response.status}.`,
        502,
        { code: "HEALTH_CARE_CONTRACT_UNAVAILABLE", baseUrl, upstreamStatus: response.status },
      );
    }

    const auth = asRecord(payload.auth);
    const endpoints = asRecord(payload.endpoints);
    const boundary = asRecord(payload.boundary);
    const registry = asRecord(payload.deviceRegistry);
    const siteOrigin = normalizeOrigin(payload.siteOrigin);
    const contractVersion = Number(payload.contractVersion);
    const capabilities = Array.isArray(payload.capabilities)
      ? payload.capabilities.filter((item): item is string => typeof item === "string")
      : [];

    const valid = payload.application === TOKEN_APP
      && payload.canonicalApplication === TOKEN_APP
      && payload.controlProtocol === CONTROL_PROTOCOL
      && Number.isInteger(contractVersion)
      && contractVersion >= 2
      && auth.issuer === TOKEN_ISSUER
      && auth.audience === TOKEN_AUDIENCE
      && auth.app === TOKEN_APP
      && auth.secretEnv === "HEALTH_CONTROL_SERVICE_SECRET"
      && endpoints.status === "/api/control/status"
      && endpoints.devices === "/api/control/devices"
      && endpoints.sessions === "/api/control/sessions"
      && endpoints.policy === "/api/control/policy"
      && endpoints.automation === "/api/control/automation"
      && endpoints.contentReview === "/api/control/health-content"
      && endpoints.audit === "/api/control/audit"
      && capabilities.includes("device-auto-approval")
      && boundary.healthDataInControlPlane === false
      && boundary.profileDataInControlPlane === false
      && boundary.independentRuntime === true
      && registry.owner === "Health_Care"
      && registry.namespace === "SK-"
      && siteOrigin === baseUrl;

    if (!valid) {
      throw new HealthBridgeError(
        "Contract production của Sức khỏe Y tế chưa đạt phiên bản quản trị v2 (bao gồm duyệt thiết bị tự động).",
        409,
        { code: "HEALTH_CARE_CONTRACT_MISMATCH", baseUrl },
      );
    }

    return {
      baseUrl,
      siteOrigin,
      contractVersion,
      controlProtocol: CONTROL_PROTOCOL,
      capabilities,
      deviceNamespace: "SK-",
    };
  } catch (error) {
    if (error instanceof HealthBridgeError) throw error;
    if (controller.signal.aborted) {
      throw new HealthBridgeError(
        `Site Sức khỏe Y tế không trả contract trong ${CONTRACT_TIMEOUT_MS / 1_000} giây.`,
        504,
        { code: "HEALTH_CARE_CONTRACT_TIMEOUT", baseUrl },
      );
    }
    throw new HealthBridgeError(
      error instanceof Error ? error.message : "Không đọc được contract Sức khỏe Y tế.",
      502,
      { code: "HEALTH_CARE_CONTRACT_UNAVAILABLE", baseUrl },
    );
  } finally {
    clearTimeout(timeout);
  }
}

function base64Url(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

async function signature(secret: string, value: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signed = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return base64Url(new Uint8Array(signed));
}

export async function issueHealthBrowserBridge(
  actor: string,
  role: ControlRole,
  controlDeviceId: string,
) {
  const [configured, contract] = await Promise.all([configuration(), probeHealthManagementContract()]);
  if (configured.baseUrl !== contract.baseUrl) {
    throw new HealthBridgeError(
      "URL bridge và URL contract Sức khỏe Y tế không trùng nhau.",
      409,
      { code: "HEALTH_CARE_ORIGIN_MISMATCH" },
    );
  }
  const expiresAt = Date.now() + 5 * 60 * 1000;
  const ticketId = base64Url(crypto.getRandomValues(new Uint8Array(18)));
  const payload = base64Url(new TextEncoder().encode(JSON.stringify({
    iss: TOKEN_ISSUER,
    aud: TOKEN_AUDIENCE,
    app: TOKEN_APP,
    actor: actor.trim().toLowerCase().slice(0, 160),
    role,
    controlDeviceId,
    jti: ticketId,
    iat: Date.now(),
    exp: expiresAt,
  })));
  const signedInput = `v1.${payload}`;
  return {
    baseUrl: configured.baseUrl,
    token: `${signedInput}.${await signature(configured.secret, signedInput)}`,
    expiresAt,
    application: "health-care" as const,
    transport: "chatgpt-sites" as const,
    contractVersion: contract.contractVersion,
    controlProtocol: contract.controlProtocol,
  };
}
