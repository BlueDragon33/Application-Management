import { normalizeClientOrigin, resolveClientOrigin } from "./client-origin.server";
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
  deviceCommandsTarget: string;
  webLaunchTarget: string;
  originSource: "local" | "production";
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

async function secret() {
  const workers = await import("cloudflare:workers");
  const values = workers.env as unknown as Record<string, unknown>;
  return typeof values.HEALTH_CONTROL_SERVICE_SECRET === "string" ? values.HEALTH_CONTROL_SERVICE_SECRET : "";
}

async function requireOrigin() {
  try {
    return await resolveClientOrigin("health-care");
  } catch (error) {
    throw new HealthBridgeError(
      error instanceof Error ? error.message : "Chưa cấu hình origin Sức khỏe Y tế.",
      503,
      { code: "HEALTH_CARE_ORIGIN_NOT_CONFIGURED" },
    );
  }
}

async function configuration() {
  const [origin, configuredSecret] = await Promise.all([requireOrigin(), secret()]);
  if (configuredSecret.length < 32) {
    throw new HealthBridgeError(
      "Chưa cấu hình khóa kết nối Sức khỏe Y tế.",
      503,
      { code: "HEALTH_CARE_SECRET_NOT_CONFIGURED", baseUrl: origin.baseUrl },
    );
  }
  return { ...origin, secret: configuredSecret };
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function text(value: unknown) {
  return typeof value === "string" ? value : "";
}

export async function probeHealthManagementContract(): Promise<HealthContractProbe> {
  const origin = await requireOrigin();
  const baseUrl = origin.baseUrl;
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
    const siteOrigin = normalizeClientOrigin(payload.siteOrigin, origin.source === "local");
    const contractVersion = Number(payload.contractVersion);
    const capabilities = Array.isArray(payload.capabilities)
      ? payload.capabilities.filter((item): item is string => typeof item === "string")
      : [];
    const deviceCommandsTarget = text(endpoints.deviceCommands);
    const webLaunchTarget = text(endpoints.webLaunchTarget);

    const valid = payload.application === TOKEN_APP
      && payload.canonicalApplication === TOKEN_APP
      && payload.controlProtocol === CONTROL_PROTOCOL
      && Number.isInteger(contractVersion)
      && contractVersion >= 3
      && auth.issuer === TOKEN_ISSUER
      && auth.audience === TOKEN_AUDIENCE
      && auth.app === TOKEN_APP
      && auth.secretEnv === "HEALTH_CONTROL_SERVICE_SECRET"
      && Number(auth.webLaunchTtlSeconds) === 60
      && endpoints.status === "/api/control/status"
      && endpoints.devices === "/api/control/devices"
      && deviceCommandsTarget === "/api/control/device-commands"
      && endpoints.sessions === "/api/control/sessions"
      && endpoints.policy === "/api/control/policy"
      && endpoints.automation === "/api/control/automation"
      && endpoints.contentReview === "/api/control/health-content"
      && endpoints.audit === "/api/control/audit"
      && webLaunchTarget === "/suc-khoe-tre"
      && capabilities.includes("device-idempotent-commands")
      && capabilities.includes("device-auto-approval")
      && capabilities.includes("control-web-launch")
      && boundary.healthDataInControlPlane === false
      && boundary.profileDataInControlPlane === false
      && boundary.independentRuntime === true
      && registry.owner === "Health_Care"
      && registry.namespace === "SK-"
      && siteOrigin === baseUrl;

    if (!valid) {
      throw new HealthBridgeError(
        "Contract của Sức khỏe Y tế chưa đạt phiên bản quản trị v3 có idempotent device commands.",
        409,
        { code: "HEALTH_CARE_CONTRACT_MISMATCH", baseUrl, originSource: origin.source },
      );
    }

    return {
      baseUrl,
      siteOrigin,
      contractVersion,
      controlProtocol: CONTROL_PROTOCOL,
      capabilities,
      deviceNamespace: "SK-",
      deviceCommandsTarget,
      webLaunchTarget,
      originSource: origin.source,
    };
  } catch (error) {
    if (error instanceof HealthBridgeError) throw error;
    if (controller.signal.aborted) {
      throw new HealthBridgeError(
        `Sức khỏe Y tế không trả contract trong ${CONTRACT_TIMEOUT_MS / 1_000} giây.`,
        504,
        { code: "HEALTH_CARE_CONTRACT_TIMEOUT", baseUrl, originSource: origin.source },
      );
    }
    throw new HealthBridgeError(
      error instanceof Error ? error.message : "Không đọc được contract Sức khỏe Y tế.",
      502,
      { code: "HEALTH_CARE_CONTRACT_UNAVAILABLE", baseUrl, originSource: origin.source },
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

async function signature(secretValue: string, value: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secretValue),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signed = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return base64Url(new Uint8Array(signed));
}

async function issueTicket(secretValue: string, claims: Record<string, unknown>) {
  const payload = base64Url(new TextEncoder().encode(JSON.stringify(claims)));
  const signedInput = `v1.${payload}`;
  return `${signedInput}.${await signature(secretValue, signedInput)}`;
}

function baseClaims(actor: string, role: ControlRole, controlDeviceId: string, expiresAt: number, purpose: "control" | "web-launch") {
  return {
    iss: TOKEN_ISSUER,
    aud: TOKEN_AUDIENCE,
    app: TOKEN_APP,
    purpose,
    actor: actor.trim().toLowerCase().slice(0, 160),
    role,
    controlDeviceId,
    jti: base64Url(crypto.getRandomValues(new Uint8Array(18))),
    iat: Date.now(),
    exp: expiresAt,
  };
}

export async function issueHealthBrowserBridge(actor: string, role: ControlRole, controlDeviceId: string) {
  const [configured, contract] = await Promise.all([configuration(), probeHealthManagementContract()]);
  if (configured.baseUrl !== contract.baseUrl) {
    throw new HealthBridgeError("URL bridge và URL contract Sức khỏe Y tế không trùng nhau.", 409, { code: "HEALTH_CARE_ORIGIN_MISMATCH" });
  }
  const expiresAt = Date.now() + 5 * 60 * 1000;
  return {
    baseUrl: configured.baseUrl,
    token: await issueTicket(configured.secret, baseClaims(actor, role, controlDeviceId, expiresAt, "control")),
    expiresAt,
    application: "health-care" as const,
    transport: configured.source === "local" ? "local-control" as const : "cloud-control" as const,
    contractVersion: contract.contractVersion,
    controlProtocol: contract.controlProtocol,
    deviceCommandsTarget: contract.deviceCommandsTarget,
    originSource: configured.source,
  };
}

export async function issueHealthWebLaunch(actor: string, role: ControlRole, controlDeviceId: string) {
  const [configured, contract] = await Promise.all([configuration(), probeHealthManagementContract()]);
  if (configured.baseUrl !== contract.baseUrl) {
    throw new HealthBridgeError("URL Site và URL contract Sức khỏe Y tế không trùng nhau.", 409, { code: "HEALTH_CARE_ORIGIN_MISMATCH" });
  }
  const expiresAt = Date.now() + 60_000;
  const token = await issueTicket(configured.secret, baseClaims(actor, role, controlDeviceId, expiresAt, "web-launch"));
  return {
    launchUrl: `${configured.baseUrl}${contract.webLaunchTarget}#control-launch=${encodeURIComponent(token)}`,
    expiresAt,
    application: "health-care" as const,
    transport: configured.source === "local" ? "local-fragment" as const : "cloud-fragment" as const,
    originSource: configured.source,
  };
}
