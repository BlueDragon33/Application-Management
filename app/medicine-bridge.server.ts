import type { ControlRole } from "./control-device.server";

export class MedicineBridgeError extends Error {
  status: number;
  code: string;

  constructor(message: string, status: number, code: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function configuration() {
  const workers = await import("cloudflare:workers");
  const values = workers.env as unknown as Record<string, unknown>;
  const baseUrl = typeof values.MEDICINE_APP_BASE_URL === "string" ? values.MEDICINE_APP_BASE_URL.replace(/\/$/, "") : "";
  const secret = typeof values.MEDICINE_SERVICE_SECRET === "string" ? values.MEDICINE_SERVICE_SECRET : "";
  if (!/^https:\/\/[a-z0-9.-]+$/i.test(baseUrl) || secret.length < 32) throw new MedicineBridgeError("Web App Hòa nhập Nga chưa được cấu hình kết nối.", 503, "MEDICINE_BRIDGE_NOT_CONFIGURED");
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

export async function issueMedicineBrowserBridge(actor: string, role: ControlRole) {
  const { baseUrl, secret } = await configuration();
  const expiresAt = Date.now() + 5 * 60 * 1000;
  const payload = base64Url(new TextEncoder().encode(JSON.stringify({
    v: 1, iss: "quan-ly-hoc-tap", aud: "hoa-nhap-nga", actor: actor.trim().toLowerCase().slice(0, 160),
    displayName: actor.trim().slice(0, 160), role, exp: expiresAt,
  })));
  const signedInput = `v1.${payload}`;
  const token = `${signedInput}.${await signature(secret, signedInput)}`;
  const target = new URL("/api/auth/bridge", baseUrl);
  target.searchParams.set("ticket", token);
  return { url: target.toString(), expiresAt };
}
