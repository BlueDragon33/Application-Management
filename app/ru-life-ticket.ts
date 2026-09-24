import type { ControlRole } from "./control-device.server";

const TICKET_TTL_MS = 5 * 60 * 1000;

function base64Url(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

/** RU_LIFE verifies this locally; no cross-Site request is needed to authenticate a browser operation. */
export async function signRuLifeBrowserTicket(secret: string, actor: string, role: ControlRole, controlDeviceId: string, now = Date.now()) {
  if (secret.length < 32 || !/^[a-f0-9]{64}$/.test(controlDeviceId) || !actor.includes("@")) {
    throw new Error("RU_LIFE_SIGNED_TICKET_CONFIGURATION_INVALID");
  }
  const claims = {
    iss: "application-management",
    aud: "ru-life-control",
    app: "hoa-nhap-nga",
    actor: actor.trim().toLowerCase().slice(0, 160),
    role,
    controlDeviceId,
    jti: base64Url(crypto.getRandomValues(new Uint8Array(24))),
    exp: now + TICKET_TTL_MS,
  };
  const encoded = base64Url(new TextEncoder().encode(JSON.stringify(claims)));
  const signingInput = `v1.${encoded}`;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = base64Url(new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(signingInput))));
  return `${signingInput}.${signature}`;
}
