import { cookies } from "next/headers";

export type MedicineAccessRole = "viewer" | "reviewer" | "publisher" | "owner";

export type MedicineAccess = {
  email: string;
  displayName: string;
  role: MedicineAccessRole;
  expiresAt: number;
};

const SESSION_COOKIE = "__Host-hoa_nhap_nga_session";
const INSECURE_SESSION_COOKIE = "hoa_nhap_nga_session";
const TICKET_TTL_MS = 5 * 60 * 1000;
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;

function normalizedEmail(value: unknown) {
  const email = typeof value === "string" ? value.trim().toLowerCase() : "";
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : "";
}

function base64Url(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function fromBase64Url(value: string) {
  if (!/^[A-Za-z0-9_-]+$/.test(value) || value.length > 4096) return null;
  const padded = value.replaceAll("-", "+").replaceAll("_", "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  try { return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0)); }
  catch { return null; }
}

function secureEqual(left: string, right: string) {
  const leftBytes = new TextEncoder().encode(left);
  const rightBytes = new TextEncoder().encode(right);
  let difference = leftBytes.length ^ rightBytes.length;
  const length = Math.max(leftBytes.length, rightBytes.length);
  for (let index = 0; index < length; index += 1) difference |= (leftBytes[index] ?? 0) ^ (rightBytes[index] ?? 0);
  return difference === 0;
}

async function serviceSecret() {
  const workers = await import("cloudflare:workers");
  const value = (workers.env as unknown as Record<string, unknown>).MEDICINE_SERVICE_SECRET;
  return typeof value === "string" && value.length >= 32 ? value : "";
}

async function hmac(secret: string, value: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return base64Url(new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value))));
}

function accessFromPayload(payload: Record<string, unknown>, now = Date.now(), latestAllowedExpiry = Number.POSITIVE_INFINITY): MedicineAccess | null {
  const email = normalizedEmail(payload.actor);
  const displayName = typeof payload.displayName === "string" ? payload.displayName.trim().slice(0, 160) : email;
  const role = typeof payload.role === "string" ? payload.role : "";
  const expiresAt = typeof payload.exp === "number" ? payload.exp : 0;
  if (payload.v !== 1 || payload.iss !== "quan-ly-hoc-tap" || !email || !displayName || !["viewer", "reviewer", "publisher", "owner"].includes(role) || expiresAt <= now || expiresAt > latestAllowedExpiry) return null;
  return { email, displayName, role: role as MedicineAccessRole, expiresAt };
}

export async function verifyMedicineAccessTicket(token: string) {
  if (!/^[A-Za-z0-9_.-]{80,4096}$/.test(token)) return null;
  const [version, payloadRaw, signature, extra] = token.split(".");
  if (version !== "v1" || !payloadRaw || !signature || extra) return null;
  const secret = await serviceSecret();
  if (!secret) return null;
  const expected = await hmac(secret, `${version}.${payloadRaw}`);
  if (!secureEqual(expected, signature)) return null;
  const bytes = fromBase64Url(payloadRaw);
  if (!bytes) return null;
  try {
    const payload = JSON.parse(new TextDecoder().decode(bytes)) as Record<string, unknown>;
    if (payload.aud !== "hoa-nhap-nga") return null;
    return accessFromPayload(payload, Date.now(), Date.now() + TICKET_TTL_MS + 60_000);
  } catch { return null; }
}

export async function getMedicineAccess() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value ?? cookieStore.get(INSECURE_SESSION_COOKIE)?.value;
  if (!token || token.length > 4096) return null;
  const [version, payloadRaw, signature, extra] = token.split(".");
  if (version !== "v1" || !payloadRaw || !signature || extra) return null;
  const secret = await serviceSecret();
  if (!secret || !secureEqual(signature, await hmac(secret, `${version}.${payloadRaw}`))) return null;
  const bytes = fromBase64Url(payloadRaw);
  if (!bytes) return null;
  try {
    const payload = JSON.parse(new TextDecoder().decode(bytes)) as Record<string, unknown>;
    return accessFromPayload({ ...payload, iss: "quan-ly-hoc-tap", aud: "hoa-nhap-nga" });
  } catch { return null; }
}

export async function createMedicineAccessCookie(access: MedicineAccess, requestUrl: string) {
  const secret = await serviceSecret();
  if (!secret) throw new Error("MEDICINE_SERVICE_SECRET_NOT_CONFIGURED");
  const payload = base64Url(new TextEncoder().encode(JSON.stringify({
    v: 1, iss: "quan-ly-hoc-tap", aud: "hoa-nhap-nga-session", actor: access.email,
    displayName: access.displayName, role: access.role, exp: Date.now() + SESSION_TTL_MS,
  })));
  const signedInput = `v1.${payload}`;
  const token = `${signedInput}.${await hmac(secret, signedInput)}`;
  const secure = new URL(requestUrl).protocol === "https:";
  const cookieName = secure ? SESSION_COOKIE : INSECURE_SESSION_COOKIE;
  const secureAttribute = secure ? "; Secure" : "";
  return `${cookieName}=${token}; Path=/; Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}; HttpOnly${secureAttribute}; SameSite=Strict`;
}
