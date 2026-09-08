import { integrationRussiaSiteUrl } from "./site-links";

const REQUEST_PREFIX = "ru-life-health-request:v1:";
const RESPONSE_PREFIX = "ru-life-health-response:v1:";
const HEALTH_PROTOCOL = "ru-life-control-health-v1";
const TIMEOUT_MS = 6_000;

type HealthCapabilities = Record<string, boolean>;

type HealthPayload = {
  ok?: boolean;
  code?: string;
  app?: { id?: string; runtime?: string };
  protocol?: string;
  checkedAt?: number;
  proof?: string;
  capabilities?: HealthCapabilities;
};

export type RuLifeIntegrationHealth = {
  overall: "healthy" | "degraded" | "down";
  checkedAt: string;
  targetUrl: string;
  expectedOrigin: string;
  configuredOrigin: string;
  originMatches: boolean;
  reachable: boolean;
  latencyMs: number | null;
  httpStatus: number | null;
  runtime: string | null;
  protocol: string | null;
  secretHandshake: "ok" | "mismatch" | "unavailable" | "failed";
  capabilities: HealthCapabilities;
  code: string;
  message: string;
};

function base64Url(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function fromBase64Url(value: string) {
  if (!/^[A-Za-z0-9_-]{20,160}$/.test(value)) throw new Error("INVALID_PROOF");
  const padded = value.replaceAll("-", "+").replaceAll("_", "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
}

async function workerEnvironment() {
  try {
    const workers = await import("cloudflare:workers");
    return workers.env as unknown as Record<string, unknown>;
  } catch {
    return {} as Record<string, unknown>;
  }
}

async function configuration() {
  const env = await workerEnvironment();
  const configuredUrl = typeof env.MEDICINE_APP_BASE_URL === "string" && env.MEDICINE_APP_BASE_URL.trim()
    ? env.MEDICINE_APP_BASE_URL.trim()
    : process.env.MEDICINE_APP_BASE_URL?.trim() || integrationRussiaSiteUrl;
  const secret = typeof env.MEDICINE_SERVICE_SECRET === "string" && env.MEDICINE_SERVICE_SECRET.length >= 32
    ? env.MEDICINE_SERVICE_SECRET
    : process.env.MEDICINE_SERVICE_SECRET || "";
  return { configuredUrl: configuredUrl.replace(/\/$/, ""), secret };
}

async function hmacKey(secret: string, usages: KeyUsage[]) {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    usages,
  );
}

async function signRequest(secret: string, nonce: string) {
  const key = await hmacKey(secret, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${REQUEST_PREFIX}${nonce}`));
  return base64Url(new Uint8Array(signature));
}

async function verifyResponse(secret: string, nonce: string, checkedAt: number, proof: string) {
  const key = await hmacKey(secret, ["verify"]);
  return crypto.subtle.verify(
    "HMAC",
    key,
    fromBase64Url(proof),
    new TextEncoder().encode(`${RESPONSE_PREFIX}${nonce}:${checkedAt}`),
  );
}

async function fetchWithTimeout(url: string, init?: RequestInit) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal, cache: "no-store" });
  } finally {
    clearTimeout(timeout);
  }
}

function origins(configuredUrl: string) {
  try {
    return {
      expectedOrigin: new URL(integrationRussiaSiteUrl).origin,
      configuredOrigin: new URL(configuredUrl).origin,
    };
  } catch {
    return { expectedOrigin: integrationRussiaSiteUrl, configuredOrigin: configuredUrl };
  }
}

export async function checkRuLifeIntegrationHealth(): Promise<RuLifeIntegrationHealth> {
  const { configuredUrl, secret } = await configuration();
  const { expectedOrigin, configuredOrigin } = origins(configuredUrl);
  const targetUrl = `${configuredUrl}/api/integration/health`;
  const base = {
    checkedAt: new Date().toISOString(),
    targetUrl,
    expectedOrigin,
    configuredOrigin,
    originMatches: expectedOrigin === configuredOrigin,
  };

  let liveness: HealthPayload = {};
  let latencyMs: number | null = null;
  let httpStatus: number | null = null;
  const started = Date.now();
  try {
    const response = await fetchWithTimeout(targetUrl, { method: "GET", headers: { accept: "application/json" } });
    latencyMs = Date.now() - started;
    httpStatus = response.status;
    liveness = await response.json().catch(() => ({})) as HealthPayload;
    if (!response.ok || liveness.ok !== true || liveness.app?.id !== "hoa-nhap-nga" || liveness.app?.runtime !== "RU_LIFE") {
      return {
        ...base,
        overall: "down",
        reachable: response.ok,
        latencyMs,
        httpStatus,
        runtime: liveness.app?.runtime || null,
        protocol: liveness.protocol || null,
        secretHandshake: "failed",
        capabilities: liveness.capabilities || {},
        code: "RU_LIFE_INVALID_HEALTH_RESPONSE",
        message: "Đã kết nối được URL nhưng phản hồi không đúng runtime RU_LIFE mong đợi.",
      };
    }
  } catch {
    return {
      ...base,
      overall: "down",
      reachable: false,
      latencyMs: Date.now() - started,
      httpStatus: null,
      runtime: null,
      protocol: null,
      secretHandshake: "failed",
      capabilities: {},
      code: "RU_LIFE_UNREACHABLE",
      message: "Quản trị ứng dụng không kết nối được endpoint health của RU_LIFE.",
    };
  }

  if (!secret || secret.length < 32) {
    return {
      ...base,
      overall: "degraded",
      reachable: true,
      latencyMs,
      httpStatus,
      runtime: liveness.app?.runtime || null,
      protocol: liveness.protocol || null,
      secretHandshake: "unavailable",
      capabilities: liveness.capabilities || {},
      code: "CONTROL_SECRET_UNAVAILABLE",
      message: "RU_LIFE đang online nhưng Quản trị ứng dụng chưa có MEDICINE_SERVICE_SECRET hợp lệ để kiểm tra hai chiều.",
    };
  }

  const nonce = base64Url(crypto.getRandomValues(new Uint8Array(24)));
  try {
    const signature = await signRequest(secret, nonce);
    const response = await fetchWithTimeout(targetUrl, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ nonce, signature }),
    });
    const payload = await response.json().catch(() => ({})) as HealthPayload;
    if (response.status === 403 && payload.code === "SECRET_MISMATCH") {
      return {
        ...base,
        overall: "degraded",
        reachable: true,
        latencyMs,
        httpStatus: response.status,
        runtime: liveness.app?.runtime || null,
        protocol: liveness.protocol || null,
        secretHandshake: "mismatch",
        capabilities: liveness.capabilities || {},
        code: "SHARED_SECRET_MISMATCH",
        message: "Hai deployment đang dùng MEDICINE_SERVICE_SECRET khác nhau.",
      };
    }
    if (!response.ok || payload.ok !== true || payload.protocol !== HEALTH_PROTOCOL || typeof payload.checkedAt !== "number" || typeof payload.proof !== "string") {
      return {
        ...base,
        overall: "degraded",
        reachable: true,
        latencyMs,
        httpStatus: response.status,
        runtime: liveness.app?.runtime || null,
        protocol: payload.protocol || liveness.protocol || null,
        secretHandshake: payload.code === "SERVICE_SECRET_UNAVAILABLE" ? "unavailable" : "failed",
        capabilities: payload.capabilities || liveness.capabilities || {},
        code: payload.code || "RU_LIFE_HANDSHAKE_FAILED",
        message: payload.code === "SERVICE_SECRET_UNAVAILABLE"
          ? "RU_LIFE chưa được cấu hình MEDICINE_SERVICE_SECRET hợp lệ."
          : "RU_LIFE online nhưng health handshake chưa hoàn tất.",
      };
    }
    const valid = await verifyResponse(secret, nonce, payload.checkedAt, payload.proof);
    if (!valid) throw new Error("INVALID_RESPONSE_PROOF");

    return {
      ...base,
      overall: base.originMatches ? "healthy" : "degraded",
      reachable: true,
      latencyMs,
      httpStatus: response.status,
      runtime: payload.app?.runtime || liveness.app?.runtime || null,
      protocol: payload.protocol,
      secretHandshake: "ok",
      capabilities: payload.capabilities || liveness.capabilities || {},
      code: base.originMatches ? "OK" : "APP_ORIGIN_MISMATCH",
      message: base.originMatches
        ? "RU_LIFE online, đúng runtime và shared secret hai đầu đã xác minh thành công."
        : "Handshake thành công nhưng MEDICINE_APP_BASE_URL không trùng origin Hòa nhập Nga đã khai báo.",
    };
  } catch {
    return {
      ...base,
      overall: "degraded",
      reachable: true,
      latencyMs,
      httpStatus,
      runtime: liveness.app?.runtime || null,
      protocol: liveness.protocol || null,
      secretHandshake: "failed",
      capabilities: liveness.capabilities || {},
      code: "RU_LIFE_HANDSHAKE_FAILED",
      message: "RU_LIFE online nhưng không xác minh được proof phản hồi của kết nối hai chiều.",
    };
  }
}
