import { resolveClientOrigin } from "./client-origin.server";
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
  const secret = typeof values.BAUMAN_CONTROL_SERVICE_SECRET === "string" ? values.BAUMAN_CONTROL_SERVICE_SECRET : "";
  let origin;
  try {
    origin = await resolveClientOrigin("bauman-master-ai");
  } catch (error) {
    throw new BaumanBridgeError(
      error instanceof Error ? error.message : "Bauman Control Service chưa được cấu hình origin.",
      503,
      { code: "BAUMAN_CONTROL_NOT_CONFIGURED" },
    );
  }
  let runtimeOrigin = null;
  try {
    runtimeOrigin = await resolveClientOrigin("bauman-runtime");
  } catch {
    runtimeOrigin = null;
  }
  if (secret.length < 32) {
    throw new BaumanBridgeError(
      "Bauman Control Service chưa được cấu hình secret.",
      503,
      { code: "BAUMAN_CONTROL_SECRET_NOT_CONFIGURED", baseUrl: origin.baseUrl },
    );
  }
  return { ...origin, secret, runtimeOrigin };
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
  const { baseUrl, secret, source, runtimeOrigin } = await configuration();
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
    runtimeBaseUrl: runtimeOrigin?.baseUrl ?? null,
    runtimeOriginSource: runtimeOrigin?.source ?? null,
    token: `${signedInput}.${await signature(secret, signedInput)}`,
    expiresAt,
    application: "bauman-master-ai" as const,
    mode: "capability-gated" as const,
    originSource: source,
  };
}
