import { resolveClientOrigin } from "./client-origin.server";
import type { ControlRole } from "./control-device.server";

export class UpstreamError extends Error {
  status: number;
  payload: unknown;

  constructor(message: string, status: number, payload: unknown) {
    super(message);
    this.status = status;
    this.payload = payload;
  }
}

async function configuration() {
  const workers = await import("cloudflare:workers");
  const values = workers.env as unknown as Record<string, unknown>;
  const secret = typeof values.CONTROL_SERVICE_SECRET === "string" ? values.CONTROL_SERVICE_SECRET : "";
  let origin;
  try {
    origin = await resolveClientOrigin("boi-ech");
  } catch (error) {
    throw new UpstreamError(
      error instanceof Error ? error.message : "Kết nối Bơi ếch chưa được cấu hình.",
      503,
      { code: "BOI_ECH_NOT_CONFIGURED" },
    );
  }
  if (secret.length < 32) {
    throw new UpstreamError("Khóa kết nối Bơi ếch chưa được cấu hình.", 503, { code: "BOI_ECH_SECRET_NOT_CONFIGURED" });
  }
  return { ...origin, secret };
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

export async function issueBoiBrowserBridge(actor: string, role: ControlRole) {
  const { baseUrl, secret, source } = await configuration();
  const expiresAt = Date.now() + 5 * 60 * 1000;
  const payload = base64Url(new TextEncoder().encode(JSON.stringify({
    iss: "quan-ly-hoc-tap",
    aud: "boi-ech-control",
    actor: actor.trim().toLowerCase().slice(0, 160),
    role,
    exp: expiresAt,
  })));
  const signedInput = `v1.${payload}`;
  return {
    baseUrl,
    token: `${signedInput}.${await signature(secret, signedInput)}`,
    expiresAt,
    originSource: source,
  };
}
