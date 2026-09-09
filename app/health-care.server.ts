import type { ControlRole } from "./control-device.server";

const TOKEN_ISSUER = "application-management";
const TOKEN_AUDIENCE = "health-care-control";
const TOKEN_APP = "health-care";

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

async function configuration() {
  const workers = await import("cloudflare:workers");
  const values = workers.env as unknown as Record<string, unknown>;
  const baseUrl = normalizeOrigin(values.HEALTH_CARE_BASE_URL);
  const secret = typeof values.HEALTH_CONTROL_SERVICE_SECRET === "string"
    ? values.HEALTH_CONTROL_SERVICE_SECRET
    : "";

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
      { code: "HEALTH_CARE_SITE_SECRET_NOT_CONFIGURED" },
    );
  }
  return { baseUrl, secret };
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
  const { baseUrl, secret } = await configuration();
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
    baseUrl,
    token: `${signedInput}.${await signature(secret, signedInput)}`,
    expiresAt,
    application: "health-care" as const,
    transport: "chatgpt-sites" as const,
  };
}
