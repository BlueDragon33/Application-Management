import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export type ChatGPTUser = {
  displayName: string;
  email: string;
  fullName: string | null;
};

const SESSION_COOKIE = "__Host-boiech_admin_session";
const SESSION_TTL_SECONDS = 8 * 60 * 60;
const PASSWORD_SCHEME = "pbkdf2-sha256";

function normalizedEmail(value: string | null | undefined) {
  const email = value?.trim().toLowerCase() ?? "";
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : "";
}

function base64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function fromBase64Url(value: string) {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) return null;
  const padded = value.replaceAll("-", "+").replaceAll("_", "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  try {
    return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
  } catch {
    return null;
  }
}

function secureEqual(left: Uint8Array, right: Uint8Array) {
  let difference = left.length ^ right.length;
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    difference |= (left[index] ?? 0) ^ (right[index] ?? 0);
  }
  return difference === 0;
}

async function runtimeValues() {
  const workers = await import("cloudflare:workers");
  return workers.env as unknown as Record<string, unknown>;
}

function ownerEmails(value: unknown) {
  return typeof value === "string"
    ? value.split(",").map((item) => normalizedEmail(item)).filter(Boolean)
    : [];
}

async function hmac(secret: string, value: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return base64Url(new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value))));
}

async function verifyPassword(password: string, encoded: unknown) {
  if (typeof encoded !== "string" || password.length < 10 || password.length > 512) return false;
  const [scheme, iterationsRaw, saltRaw, hashRaw, extra] = encoded.split("$");
  if (scheme !== PASSWORD_SCHEME || extra) return false;
  const iterations = Number(iterationsRaw);
  const salt = fromBase64Url(saltRaw ?? "");
  const expected = fromBase64Url(hashRaw ?? "");
  if (!Number.isInteger(iterations) || iterations < 100_000 || iterations > 1_000_000 || !salt || salt.length < 16 || !expected || expected.length < 32) return false;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const derived = new Uint8Array(await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations },
    key,
    expected.length * 8,
  ));
  return secureEqual(derived, expected);
}

export async function authenticateAdminPassword(emailValue: string, password: string) {
  const email = normalizedEmail(emailValue);
  const values = await runtimeValues();
  const allowed = ownerEmails(values.CONTROL_OWNER_EMAILS);
  const passwordOk = await verifyPassword(password, values.ADMIN_PASSWORD_HASH);
  return Boolean(email && passwordOk && allowed.includes(email)) ? email : null;
}

export async function createAdminSessionCookie(emailValue: string) {
  const email = normalizedEmail(emailValue);
  const values = await runtimeValues();
  const secret = typeof values.ADMIN_SESSION_SECRET === "string" ? values.ADMIN_SESSION_SECRET : "";
  if (!email || secret.length < 32) throw new Error("ADMIN_SESSION_NOT_CONFIGURED");

  const payload = base64Url(new TextEncoder().encode(JSON.stringify({
    v: 1,
    email,
    exp: Date.now() + SESSION_TTL_SECONDS * 1000,
  })));
  const signedInput = `v1.${payload}`;
  const token = `${signedInput}.${await hmac(secret, signedInput)}`;
  return `${SESSION_COOKIE}=${token}; Path=/; Max-Age=${SESSION_TTL_SECONDS}; HttpOnly; Secure; SameSite=Strict`;
}

export function clearAdminSessionCookie() {
  return `${SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict`;
}

async function sessionEmail(token: string | undefined) {
  if (!token || token.length > 4096) return null;
  const [version, payloadRaw, signatureRaw, extra] = token.split(".");
  if (version !== "v1" || !payloadRaw || !signatureRaw || extra) return null;

  const values = await runtimeValues();
  const secret = typeof values.ADMIN_SESSION_SECRET === "string" ? values.ADMIN_SESSION_SECRET : "";
  if (secret.length < 32) return null;
  const expectedSignature = await hmac(secret, `${version}.${payloadRaw}`);
  if (!secureEqual(new TextEncoder().encode(expectedSignature), new TextEncoder().encode(signatureRaw))) return null;

  const payloadBytes = fromBase64Url(payloadRaw);
  if (!payloadBytes) return null;
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(new TextDecoder().decode(payloadBytes)) as Record<string, unknown>;
  } catch {
    return null;
  }

  const email = normalizedEmail(typeof payload.email === "string" ? payload.email : "");
  const expiresAt = typeof payload.exp === "number" ? payload.exp : 0;
  if (payload.v !== 1 || !email || expiresAt <= Date.now() || expiresAt > Date.now() + SESSION_TTL_SECONDS * 1000 + 60_000) return null;
  if (!ownerEmails(values.CONTROL_OWNER_EMAILS).includes(email)) return null;
  return email;
}

export async function getChatGPTUser(): Promise<ChatGPTUser | null> {
  const cookieStore = await cookies();
  const email = await sessionEmail(cookieStore.get(SESSION_COOKIE)?.value);
  if (!email) return null;
  return {
    displayName: email.split("@")[0] || email,
    email,
    fullName: null,
  };
}

export async function requireChatGPTUser(returnTo = "/"): Promise<ChatGPTUser> {
  const user = await getChatGPTUser();
  if (user) return user;
  redirect(chatGPTSignInPath(returnTo));
}

export function chatGPTSignInPath(returnTo = "/") {
  return `/login?return_to=${encodeURIComponent(safeReturnPath(returnTo))}`;
}

export function chatGPTSignOutPath(returnTo = "/") {
  return `/logout?return_to=${encodeURIComponent(safeReturnPath(returnTo))}`;
}

export function safeReturnPath(value: string) {
  if (!value.startsWith("/") || value.startsWith("//")) return "/";
  try {
    const url = new URL(value, "https://app.local");
    if (url.origin !== "https://app.local" || url.pathname.startsWith("/login") || url.pathname.startsWith("/logout")) return "/";
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return "/";
  }
}
