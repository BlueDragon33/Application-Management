import { resolveClientOrigin } from "./client-origin.server";
import type { ControlRole } from "./control-device.server";

const CONTRACT_PATH = "/management-contract.json";
const CONTRACT_TIMEOUT_MS = 4_500;
const APPLICATION_ID = "price-report-tunggiabao";
const REPOSITORY = "BlueDragon33/PriceReport_Tunggiabao";
const DEFAULT_BASE_URL = "https://bluedragon33.github.io/PriceReport_Tunggiabao";

export type PriceReportContractProbe = {
  baseUrl: string;
  contractVersion: number;
  application: typeof APPLICATION_ID;
  repository: typeof REPOSITORY;
  category: "Kế toán";
  deviceNamespace: "KT-";
  deviceClasses: readonly ["desktop", "tablet", "phone"];
  remoteAdminReady: boolean;
};

export class PriceReportBridgeError extends Error {
  status: number;
  detail: Record<string, unknown>;

  constructor(message: string, status = 503, detail: Record<string, unknown> = {}) {
    super(message);
    this.name = "PriceReportBridgeError";
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

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function text(value: unknown) {
  return typeof value === "string" ? value : "";
}

async function configuredBaseUrl() {
  try {
    const workers = await import("cloudflare:workers");
    const values = workers.env as unknown as Record<string, unknown>;
    return normalizeOrigin(values.PRICE_REPORT_BASE_URL) || DEFAULT_BASE_URL;
  } catch {
    return DEFAULT_BASE_URL;
  }
}

export async function probePriceReportManagementContract(): Promise<PriceReportContractProbe> {
  const baseUrl = await configuredBaseUrl();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CONTRACT_TIMEOUT_MS);

  try {
    const response = await fetch(`${baseUrl}${CONTRACT_PATH}`, {
      cache: "no-store",
      signal: controller.signal,
      headers: { accept: "application/json" },
    });
    const payload = record(await response.json().catch(() => ({})));
    if (!response.ok) {
      throw new PriceReportBridgeError(
        text(payload.error) || `PriceReport contract trả HTTP ${response.status}.`,
        502,
        { code: "PRICE_REPORT_CONTRACT_UNAVAILABLE", baseUrl, upstreamStatus: response.status },
      );
    }

    const application = record(payload.application);
    const boundary = record(payload.boundary);
    const device = record(payload.device);
    const readiness = record(payload.readiness);
    const policy = record(payload.policy);
    const contractVersion = Number(payload.contractVersion);
    const classes = Array.isArray(device.classes) ? device.classes : [];

    const valid = Number.isInteger(contractVersion)
      && contractVersion >= 1
      && application.id === APPLICATION_ID
      && application.repository === REPOSITORY
      && application.category === "Kế toán"
      && boundary.independentRuntime === true
      && boundary.localFirst === true
      && boundary.pwaOffline === true
      && boundary.embeddedInApplicationManagement === false
      && boundary.sharedDatabaseWithOtherClients === false
      && boundary.quotationDataInControlPlane === false
      && boundary.customerDataInControlPlane === false
      && device.namespace === "KT-"
      && classes.includes("desktop")
      && classes.includes("tablet")
      && classes.includes("phone")
      && device.classification === "client-runtime"
      && readiness.runtime === "available"
      && readiness.deviceClassification === "available"
      && readiness.adaptiveUi === "available"
      && policy.applicationManagementMayInventOperationsWithoutBackend === false
      && policy.applicationManagementMayReadQuotationData === false
      && policy.applicationManagementMayReadCustomerData === false;

    if (!valid) {
      throw new PriceReportBridgeError(
        "Contract PriceReport không khớp ranh giới quản trị Kế toán.",
        409,
        { code: "PRICE_REPORT_CONTRACT_MISMATCH", baseUrl },
      );
    }

    const remoteAdminReady = readiness.deviceRegistry === "available"
      && readiness.deviceGateway === "available"
      && readiness.adminApi === "available"
      && policy.remoteAdminReady === true;

    return {
      baseUrl,
      contractVersion,
      application: APPLICATION_ID,
      repository: REPOSITORY,
      category: "Kế toán",
      deviceNamespace: "KT-",
      deviceClasses: ["desktop", "tablet", "phone"],
      remoteAdminReady,
    };
  } catch (error) {
    if (error instanceof PriceReportBridgeError) throw error;
    if (controller.signal.aborted) {
      throw new PriceReportBridgeError(
        `PriceReport không trả management contract trong ${CONTRACT_TIMEOUT_MS / 1_000} giây.`,
        504,
        { code: "PRICE_REPORT_CONTRACT_TIMEOUT", baseUrl },
      );
    }
    throw new PriceReportBridgeError(
      error instanceof Error ? error.message : "Không đọc được management contract PriceReport.",
      502,
      { code: "PRICE_REPORT_CONTRACT_UNAVAILABLE", baseUrl },
    );
  } finally {
    clearTimeout(timeout);
  }
}


const CONTROL_TOKEN_ISSUER = "application-management";
const CONTROL_TOKEN_AUDIENCE = "price-report-control";
const CONTROL_TOKEN_APP = "price-report-tunggiabao";

async function controlConfiguration() {
  let origin;
  try {
    origin = await resolveClientOrigin("price-report-control");
  } catch (error) {
    throw new PriceReportBridgeError(
      error instanceof Error ? error.message : "PriceReport KT Control chưa được cấu hình origin.",
      503,
      { code: "PRICE_REPORT_CONTROL_NOT_CONFIGURED" },
    );
  }

  let values: Record<string, unknown> = {};
  try {
    const workers = await import("cloudflare:workers");
    values = workers.env as unknown as Record<string, unknown>;
  } catch {
    values = process.env as unknown as Record<string, unknown>;
  }
  const secret = typeof values.PRICE_REPORT_CONTROL_SERVICE_SECRET === "string"
    ? values.PRICE_REPORT_CONTROL_SERVICE_SECRET
    : "";
  if (secret.length < 32) {
    throw new PriceReportBridgeError(
      "PriceReport KT Control chưa được cấu hình secret.",
      503,
      { code: "PRICE_REPORT_CONTROL_SECRET_NOT_CONFIGURED", baseUrl: origin.baseUrl },
    );
  }
  return { ...origin, secret };
}

function bridgeBase64Url(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

async function bridgeSignature(secret: string, value: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return bridgeBase64Url(new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value))));
}

export async function issuePriceReportBrowserBridge(actor: string, role: ControlRole, controlDeviceId: string) {
  const { baseUrl, secret, source } = await controlConfiguration();
  const expiresAt = Date.now() + 5 * 60 * 1000;
  const payload = bridgeBase64Url(new TextEncoder().encode(JSON.stringify({
    iss: CONTROL_TOKEN_ISSUER,
    aud: CONTROL_TOKEN_AUDIENCE,
    app: CONTROL_TOKEN_APP,
    actor: actor.trim().toLowerCase().slice(0, 160),
    role,
    controlDeviceId,
    jti: bridgeBase64Url(crypto.getRandomValues(new Uint8Array(18))),
    exp: expiresAt,
  })));
  const signedInput = `v1.${payload}`;
  return {
    baseUrl,
    token: `${signedInput}.${await bridgeSignature(secret, signedInput)}`,
    expiresAt,
    application: CONTROL_TOKEN_APP,
    mode: "capability-gated" as const,
    originSource: source,
  };
}
