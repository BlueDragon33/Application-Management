const TOTP_PERIOD_SECONDS = 30;
const TOTP_DIGITS = 6;
const TOTP_WINDOW = 1;
const encoder = new TextEncoder();

export type TotpEnv = {
  DB: D1Database;
  APPLICATION_MANAGEMENT_MFA_ENCRYPTION_KEY?: string;
};

export type TotpState = {
  configured: boolean;
  enabled: boolean;
  pending: boolean;
  verifiedAt: number | null;
};

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function base64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/g, "");
}

function base64UrlBytes(value: string) {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base32Encode(bytes: Uint8Array) {
  let bits = 0;
  let value = 0;
  let output = "";
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += BASE32[(value << (5 - bits)) & 31];
  return output;
}

function base32Decode(value: string) {
  const normalized = value.toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = 0;
  let buffer = 0;
  const bytes: number[] = [];
  for (const char of normalized) {
    const index = BASE32.indexOf(char);
    if (index < 0) throw new Error("invalid_totp_secret");
    buffer = (buffer << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((buffer >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return new Uint8Array(bytes);
}

async function encryptionKey(env: TotpEnv) {
  const encoded = text(env.APPLICATION_MANAGEMENT_MFA_ENCRYPTION_KEY);
  if (!/^[A-Za-z0-9_-]{43}$/.test(encoded)) throw new Error("mfa_encryption_key_not_configured");
  const bytes = base64UrlBytes(encoded);
  if (bytes.length !== 32) throw new Error("mfa_encryption_key_invalid");
  return crypto.subtle.importKey("raw", bytes as BufferSource, "AES-GCM", false, ["encrypt", "decrypt"]);
}

async function encryptSecret(env: TotpEnv, secret: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await encryptionKey(env);
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv as BufferSource },
    key,
    encoder.encode(secret),
  );
  return {
    ciphertext: base64Url(new Uint8Array(ciphertext)),
    iv: base64Url(iv),
  };
}

async function decryptSecret(env: TotpEnv, ciphertext: string, iv: string) {
  const key = await encryptionKey(env);
  const clear = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64UrlBytes(iv) as BufferSource },
    key,
    base64UrlBytes(ciphertext) as BufferSource,
  );
  return new TextDecoder().decode(clear);
}

function counterBytes(counter: number) {
  const bytes = new Uint8Array(8);
  let value = BigInt(counter);
  for (let index = 7; index >= 0; index -= 1) {
    bytes[index] = Number(value & 255n);
    value >>= 8n;
  }
  return bytes;
}

async function totpCode(secret: string, counter: number) {
  const key = await crypto.subtle.importKey(
    "raw",
    base32Decode(secret) as BufferSource,
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"],
  );
  const digest = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, counterBytes(counter) as BufferSource),
  );
  const offset = digest[digest.length - 1] & 0x0f;
  const binary = (
    ((digest[offset] & 0x7f) << 24)
    | ((digest[offset + 1] & 0xff) << 16)
    | ((digest[offset + 2] & 0xff) << 8)
    | (digest[offset + 3] & 0xff)
  ) >>> 0;
  return String(binary % (10 ** TOTP_DIGITS)).padStart(TOTP_DIGITS, "0");
}

async function secureCodeEqual(left: string, right: string) {
  const a = encoder.encode(left);
  const b = encoder.encode(right);
  let difference = a.length ^ b.length;
  const length = Math.max(a.length, b.length);
  for (let index = 0; index < length; index += 1) {
    difference |= (a[index] ?? 0) ^ (b[index] ?? 0);
  }
  return difference === 0;
}

async function factorRow(env: TotpEnv, email: string) {
  return env.DB.prepare(
    "SELECT secret_ciphertext,secret_iv,enabled,verified_at FROM control_mfa_factors WHERE account_email=?1 AND factor_type='totp' LIMIT 1",
  ).bind(email).first<{
    secret_ciphertext: string;
    secret_iv: string;
    enabled: number;
    verified_at: number | null;
  }>();
}

export function totpEnvironmentConfigured(env: TotpEnv) {
  return /^[A-Za-z0-9_-]{43}$/.test(text(env.APPLICATION_MANAGEMENT_MFA_ENCRYPTION_KEY));
}

export async function totpState(env: TotpEnv, email: string): Promise<TotpState> {
  const configured = totpEnvironmentConfigured(env);
  if (!configured) return { configured: false, enabled: false, pending: false, verifiedAt: null };
  const row = await factorRow(env, email);
  return {
    configured: true,
    enabled: row?.enabled === 1,
    pending: Boolean(row && row.enabled !== 1),
    verifiedAt: row?.verified_at ?? null,
  };
}

export async function beginTotpEnrollment(env: TotpEnv, email: string, displayName: string) {
  if (!totpEnvironmentConfigured(env)) throw new Error("totp_not_configured");
  const existing = await factorRow(env, email);
  if (existing?.enabled === 1) throw new Error("totp_already_enabled");

  const secret = base32Encode(crypto.getRandomValues(new Uint8Array(20)));
  const encrypted = await encryptSecret(env, secret);
  await env.DB.prepare(
    "INSERT INTO control_mfa_factors (account_email,factor_type,secret_ciphertext,secret_iv,enabled,verified_at,created_at,updated_at) VALUES (?1,'totp',?2,?3,0,NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP) ON CONFLICT(account_email) DO UPDATE SET secret_ciphertext=excluded.secret_ciphertext,secret_iv=excluded.secret_iv,enabled=0,verified_at=NULL,updated_at=CURRENT_TIMESTAMP",
  ).bind(email, encrypted.ciphertext, encrypted.iv).run();

  const issuer = "Application Management";
  const label = displayName.trim() || email;
  const uri = new URL(`otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(label)}`);
  uri.searchParams.set("secret", secret);
  uri.searchParams.set("issuer", issuer);
  uri.searchParams.set("algorithm", "SHA1");
  uri.searchParams.set("digits", String(TOTP_DIGITS));
  uri.searchParams.set("period", String(TOTP_PERIOD_SECONDS));
  return { secret, uri: uri.toString() };
}

export async function verifyTotp(env: TotpEnv, email: string, rawCode: unknown) {
  const code = text(rawCode).replace(/\s+/g, "");
  if (!/^\d{6}$/.test(code)) return false;
  const row = await factorRow(env, email);
  if (!row) return false;

  let secret: string;
  try {
    secret = await decryptSecret(env, row.secret_ciphertext, row.secret_iv);
  } catch {
    return false;
  }

  const current = Math.floor(Date.now() / 1000 / TOTP_PERIOD_SECONDS);
  for (let offset = -TOTP_WINDOW; offset <= TOTP_WINDOW; offset += 1) {
    if (await secureCodeEqual(code, await totpCode(secret, current + offset))) return true;
  }
  return false;
}

export async function completeTotpEnrollment(env: TotpEnv, email: string, code: unknown) {
  if (!(await verifyTotp(env, email, code))) return false;
  const now = Math.floor(Date.now() / 1000);
  await env.DB.prepare(
    "UPDATE control_mfa_factors SET enabled=1,verified_at=?2,updated_at=CURRENT_TIMESTAMP WHERE account_email=?1 AND factor_type='totp'",
  ).bind(email, now).run();
  return true;
}

export async function removeTotp(env: TotpEnv, email: string) {
  await env.DB.prepare(
    "DELETE FROM control_mfa_factors WHERE account_email=?1 AND factor_type='totp'",
  ).bind(email).run();
}

export const TOTP_GUARDRAILS = {
  digits: TOTP_DIGITS,
  periodSeconds: TOTP_PERIOD_SECONDS,
  allowedWindow: TOTP_WINDOW,
  secretEncryption: "AES-256-GCM",
  hmac: "SHA-1",
} as const;
