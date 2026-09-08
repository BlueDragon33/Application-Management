import type { ControlRole } from "./control-device.server";

const TOKEN_ISSUER = "application-management";
const TOKEN_AUDIENCE = "bauman-control";
const TOKEN_APP = "bauman-master-ai";

export class BaumanBridgeError extends Error {
  status: number;
  payload: unknown;

  constructor(message: string, status: number, payload: unknown) {
    super(message);
    this.name = "BaumanBridgeError";
    this.status = status;
    this.payload = payload;
  }
}

async function configuration() {
  const workers = await import("cloudflare:workers");
  const values = workers.env as unknown as Record<string, unknown>;
  const baseUrl = typeof values.BAUMAN_CONTROL_BASE_URL === "string" ? values.BAUMAN_CONTROL_BASE_URL.replace(/\/$/, "") : "";
  const secret = typeof values.BAUMAN_CONTROL_SERVICE_SECRET === "string" ? values.BAUMAN_CONTROL_SERVICE_SECRET : "";
  if (!/^https:\/\/[a-z0-9.-]+$/i.test(baseUrl) || secret.length < 32) {
    throw new BaumanBridgeError(
      "Bauman Control Service chưa được cấu hình origin/secret production.",
      503,
      { code: "BAUMAN_CONTROL_NOT_CONFIGURED" },
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
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return base64Url(new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value))));
}

export async function issueBaumanBrowserBridge(actor: string, role: ControlRole, controlDeviceId: string) {
  const { baseUrl, secret } = await configuration();
  const expiresAt = Date.now() + 5 * 60 * 1000;
  const payload = base64Url(new TextEncoder().encode(JSON.stringify({
    iss: TOKEN_ISSUER,
    aud: TOKEN_AUDIENCE,
    app: TOKEN_APP,
    actor: actor.trim().toLowerCase().slice(0, 160),
    role,
    controlDeviceId,
    jti: base64Url(crypto.getRandomValues(new Uint8Array(18))),
    exp: expiresAt,
  })));
  const signedInput = `v1.${payload}`;
  return {
    baseUrl,
    token: `${signedInput}.${await signature(secret, signedInput)}`,
    expiresAt,
    application: "bauman-master-ai" as const,
    mode: "read-only" as const,
  };
}
