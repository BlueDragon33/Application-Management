import type { ChatGPTUser } from "./chatgpt-auth";

type RuntimeEnv = Record<string, unknown>;
type JwtHeader = { alg?: unknown; kid?: unknown; typ?: unknown };
type JwtPayload = {
  aud?: unknown;
  email?: unknown;
  exp?: unknown;
  iat?: unknown;
  iss?: unknown;
  name?: unknown;
  nbf?: unknown;
  sub?: unknown;
};
type JwksResponse = { keys?: unknown };

type CachedJwks = { expiresAt: number; keys: JsonWebKey[] };

const ACCESS_HEADER = "cf-access-jwt-assertion";
const ACCESS_TEAM_DOMAIN = /^https:\/\/[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.cloudflareaccess\.com$/i;
const AUDIENCE = /^[A-Za-z0-9._:-]{8,256}$/;
const JWT_PART = /^[A-Za-z0-9_-]+$/;
const CLOCK_SKEW_SECONDS = 60;
const JWKS_CACHE_MS = 5 * 60 * 1000;
const jwksCache = new Map<string, CachedJwks>();

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeTeamDomain(value: unknown) {
  const domain = asString(value).replace(/\/+$/, "");
  return ACCESS_TEAM_DOMAIN.test(domain) ? domain : "";
}

function configuredAudience(value: unknown) {
  const aud = asString(value);
  return AUDIENCE.test(aud) ? aud : "";
}

function decodeBase64Url(value: string) {
  if (!JWT_PART.test(value)) throw new Error("invalid JWT encoding");
  const padded = value.replaceAll("-", "+").replaceAll("_", "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
}

function decodeJson<T>(value: string): T {
  const bytes = decodeBase64Url(value);
  const text = new TextDecoder().decode(bytes);
  return JSON.parse(text) as T;
}

function audienceMatches(value: unknown, expected: string) {
  if (typeof value === "string") return value === expected;
  return Array.isArray(value) && value.some((item) => item === expected);
}

function numericClaim(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function validateClaims(payload: JwtPayload, teamDomain: string, audience: string) {
  const now = Math.floor(Date.now() / 1000);
  const issuer = asString(payload.iss).replace(/\/+$/, "");
  const expiration = numericClaim(payload.exp);
  const notBefore = numericClaim(payload.nbf);
  const issuedAt = numericClaim(payload.iat);

  if (issuer !== teamDomain) throw new Error("invalid Access issuer");
  if (!audienceMatches(payload.aud, audience)) throw new Error("invalid Access audience");
  if (expiration === null || expiration < now - CLOCK_SKEW_SECONDS) throw new Error("expired Access token");
  if (notBefore !== null && notBefore > now + CLOCK_SKEW_SECONDS) throw new Error("Access token not active yet");
  if (issuedAt !== null && issuedAt > now + CLOCK_SKEW_SECONDS) throw new Error("Access token issued in the future");
}

function usableRsaKey(value: unknown, kid: string) {
  if (!value || typeof value !== "object") return null;
  const key = value as JsonWebKey & { kid?: string; alg?: string; use?: string };
  if (key.kid !== kid || key.kty !== "RSA" || !key.n || !key.e) return null;
  if (key.alg && key.alg !== "RS256") return null;
  if (key.use && key.use !== "sig") return null;
  return key;
}

async function fetchJwks(teamDomain: string) {
  const cached = jwksCache.get(teamDomain);
  if (cached && cached.expiresAt > Date.now()) return cached.keys;

  const response = await fetch(`${teamDomain}/cdn-cgi/access/certs`, {
    headers: { accept: "application/json" },
    redirect: "error",
  });
  if (!response.ok) throw new Error(`Access JWKS unavailable: ${response.status}`);
  const body = await response.json() as JwksResponse;
  if (!Array.isArray(body.keys)) throw new Error("Access JWKS missing keys");
  const keys = body.keys.filter((item): item is JsonWebKey => Boolean(item) && typeof item === "object");
  if (!keys.length) throw new Error("Access JWKS empty");
  jwksCache.set(teamDomain, { expiresAt: Date.now() + JWKS_CACHE_MS, keys });
  return keys;
}

async function verifyJwt(token: string, teamDomain: string, audience: string) {
  if (token.length < 80 || token.length > 8192) throw new Error("invalid Access token length");
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("invalid Access JWT");
  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  const header = decodeJson<JwtHeader>(encodedHeader);
  const payload = decodeJson<JwtPayload>(encodedPayload);
  const kid = asString(header.kid);
  if (header.alg !== "RS256" || !kid) throw new Error("unsupported Access JWT algorithm");

  const keys = await fetchJwks(teamDomain);
  const jwk = keys.map((candidate) => usableRsaKey(candidate, kid)).find(Boolean);
  if (!jwk) throw new Error("Access signing key not found");

  const publicKey = await crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"],
  );
  const signedData = new TextEncoder().encode(`${encodedHeader}.${encodedPayload}`);
  const signature = decodeBase64Url(encodedSignature);
  const valid = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", publicKey, signature, signedData);
  if (!valid) throw new Error("invalid Access JWT signature");

  validateClaims(payload, teamDomain, audience);
  return payload;
}

export function cloudflareAccessConfigured(env: RuntimeEnv) {
  return Boolean(normalizeTeamDomain(env.CF_ACCESS_TEAM_DOMAIN) && configuredAudience(env.CF_ACCESS_AUD));
}

export async function getCloudflareAccessUser(requestHeaders: Headers, env: RuntimeEnv): Promise<ChatGPTUser | null> {
  const teamDomain = normalizeTeamDomain(env.CF_ACCESS_TEAM_DOMAIN);
  const audience = configuredAudience(env.CF_ACCESS_AUD);
  if (!teamDomain || !audience) return null;

  const token = requestHeaders.get(ACCESS_HEADER)?.trim() ?? "";
  if (!token) return null;

  try {
    const payload = await verifyJwt(token, teamDomain, audience);
    const email = asString(payload.email).toLowerCase();
    const subject = asString(payload.sub);
    if (!subject || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
    const fullName = asString(payload.name) || null;
    return {
      userId: `cf-access:${subject}`,
      email,
      displayName: fullName || email.split("@")[0] || email,
      fullName,
    };
  } catch {
    return null;
  }
}

export const CLOUDFLARE_ACCESS_AUTH_GUARDRAILS = {
  header: ACCESS_HEADER,
  algorithm: "RS256",
  jwksPath: "/cdn-cgi/access/certs",
  exactAudienceRequired: true,
  exactIssuerRequired: true,
  loopbackBypassForbidden: true,
} as const;
