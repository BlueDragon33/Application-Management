const GOOGLE_AUTHORIZATION_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const GOOGLE_JWKS_ENDPOINT = "https://www.googleapis.com/oauth2/v3/certs";
const GOOGLE_START_PATH = "/__auth/google";
const GOOGLE_CALLBACK_PATH = "/__auth/google/callback";
const STATE_COOKIE = "__Host-am_google_state";
const NONCE_COOKIE = "__Host-am_google_nonce";
const FLOW_TTL_SECONDS = 10 * 60;
const encoder = new TextEncoder();
const decoder = new TextDecoder();

export type GoogleOAuthEnv = {
  GOOGLE_OAUTH_CLIENT_ID?: string;
  GOOGLE_OAUTH_CLIENT_SECRET?: string;
  GOOGLE_OAUTH_REDIRECT_URI?: string;
};

export type GoogleOAuthProfile = {
  provider: "google";
  subject: string;
  email: string;
  emailVerified: boolean;
  displayName: string;
  picture: string | null;
};

type GoogleIdTokenClaims = {
  iss?: unknown;
  aud?: unknown;
  sub?: unknown;
  exp?: unknown;
  iat?: unknown;
  nonce?: unknown;
  email?: unknown;
  email_verified?: unknown;
  name?: unknown;
  picture?: unknown;
};

type CachedJwks = {
  expiresAt: number;
  keys: JsonWebKey[];
};

let cachedJwks: CachedJwks | null = null;

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizedEmail(value: unknown) {
  const email = text(value).toLowerCase();
  return /^[^\s@,]+@[^\s@,]+\.[^\s@,]+$/.test(email) ? email : "";
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

function randomToken(size = 32) {
  return base64Url(crypto.getRandomValues(new Uint8Array(size)));
}

async function secureEqual(left: string, right: string) {
  if (!left || !right) return false;
  const [a, b] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(left)),
    crypto.subtle.digest("SHA-256", encoder.encode(right)),
  ]);
  const aa = new Uint8Array(a);
  const bb = new Uint8Array(b);
  let difference = aa.length ^ bb.length;
  const length = Math.max(aa.length, bb.length);
  for (let index = 0; index < length; index += 1) {
    difference |= (aa[index] ?? 0) ^ (bb[index] ?? 0);
  }
  return difference === 0;
}

function cookieValue(headers: Headers, name: string) {
  for (const entry of (headers.get("cookie") ?? "").split(";")) {
    const [rawName, ...rest] = entry.trim().split("=");
    if (rawName === name) return rest.join("=");
  }
  return "";
}

function temporaryCookie(name: string, value: string) {
  return `${name}=${value}; Max-Age=${FLOW_TTL_SECONDS}; Path=/; HttpOnly; Secure; SameSite=Lax`;
}

function clearedCookie(name: string) {
  return `${name}=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax`;
}

function redirectUri(request: Request, env: GoogleOAuthEnv) {
  const configured = text(env.GOOGLE_OAUTH_REDIRECT_URI);
  if (configured) return configured;
  return new URL(GOOGLE_CALLBACK_PATH, request.url).toString();
}

function oauthError(message: string, status = 400) {
  return new Response(message, {
    status,
    headers: {
      "cache-control": "no-store, private",
      "content-type": "text/plain; charset=utf-8",
      "content-security-policy": "default-src 'none'; frame-ancestors 'none'",
      "referrer-policy": "no-referrer",
      "x-content-type-options": "nosniff",
    },
  });
}

function parseMaxAge(cacheControl: string | null) {
  const match = cacheControl?.match(/(?:^|,)\s*max-age=(\d+)/i);
  const seconds = match ? Number(match[1]) : 300;
  return Number.isFinite(seconds) && seconds > 0 ? Math.min(seconds, 60 * 60) : 300;
}

async function googleJwks() {
  const now = Date.now();
  if (cachedJwks && cachedJwks.expiresAt > now) return cachedJwks.keys;

  const response = await fetch(GOOGLE_JWKS_ENDPOINT, {
    headers: { accept: "application/json" },
  });
  if (!response.ok) throw new Error(`google_jwks_http_${response.status}`);

  const payload = await response.json() as { keys?: JsonWebKey[] };
  const keys = Array.isArray(payload.keys) ? payload.keys : [];
  if (!keys.length) throw new Error("google_jwks_empty");

  cachedJwks = {
    keys,
    expiresAt: now + parseMaxAge(response.headers.get("cache-control")) * 1000,
  };
  return keys;
}

function decodeJwtPart(value: string) {
  return JSON.parse(decoder.decode(base64UrlBytes(value))) as Record<string, unknown>;
}

async function verifyGoogleIdToken(
  idToken: string,
  clientId: string,
  expectedNonce: string,
): Promise<GoogleOAuthProfile> {
  const parts = idToken.split(".");
  if (parts.length !== 3) throw new Error("google_id_token_format");

  const header = decodeJwtPart(parts[0]) as { alg?: unknown; kid?: unknown };
  const claims = decodeJwtPart(parts[1]) as GoogleIdTokenClaims;
  const alg = text(header.alg);
  const kid = text(header.kid);
  if (alg !== "RS256" || !kid) throw new Error("google_id_token_header");

  const keys = await googleJwks();
  const jwk = keys.find((item) => item.kid === kid && item.kty === "RSA");
  if (!jwk) throw new Error("google_id_token_key");

  const key = await crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"],
  );
  const verified = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    key,
    base64UrlBytes(parts[2]) as BufferSource,
    encoder.encode(`${parts[0]}.${parts[1]}`),
  );
  if (!verified) throw new Error("google_id_token_signature");

  const now = Math.floor(Date.now() / 1000);
  const issuer = text(claims.iss);
  const audience = typeof claims.aud === "string"
    ? claims.aud
    : Array.isArray(claims.aud)
      ? claims.aud.map((value) => text(value))
      : [];
  const audienceOk = typeof audience === "string"
    ? audience === clientId
    : audience.includes(clientId);
  const expiresAt = typeof claims.exp === "number" ? claims.exp : 0;
  const issuedAt = typeof claims.iat === "number" ? claims.iat : 0;
  const nonce = text(claims.nonce);
  const subject = text(claims.sub);
  const email = normalizedEmail(claims.email);
  const emailVerified = claims.email_verified === true || claims.email_verified === "true";

  if (issuer !== "https://accounts.google.com" && issuer !== "accounts.google.com") {
    throw new Error("google_id_token_issuer");
  }
  if (!audienceOk) throw new Error("google_id_token_audience");
  if (!expiresAt || expiresAt <= now - 60) throw new Error("google_id_token_expired");
  if (!issuedAt || issuedAt > now + 300) throw new Error("google_id_token_iat");
  if (!nonce || !(await secureEqual(nonce, expectedNonce))) throw new Error("google_id_token_nonce");
  if (!subject || !email || !emailVerified) throw new Error("google_identity_unverified");

  return {
    provider: "google",
    subject,
    email,
    emailVerified: true,
    displayName: text(claims.name) || email.split("@")[0] || email,
    picture: text(claims.picture) || null,
  };
}

async function exchangeAuthorizationCode(
  code: string,
  request: Request,
  env: GoogleOAuthEnv,
) {
  const clientId = text(env.GOOGLE_OAUTH_CLIENT_ID);
  const clientSecret = text(env.GOOGLE_OAUTH_CLIENT_SECRET);
  const response = await fetch(GOOGLE_TOKEN_ENDPOINT, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      accept: "application/json",
    },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri(request, env),
      grant_type: "authorization_code",
    }),
  });
  if (!response.ok) throw new Error(`google_token_http_${response.status}`);
  const payload = await response.json() as { id_token?: unknown };
  const idToken = text(payload.id_token);
  if (!idToken) throw new Error("google_token_missing_id_token");
  return idToken;
}

export function googleOAuthConfigured(env: GoogleOAuthEnv) {
  return Boolean(text(env.GOOGLE_OAUTH_CLIENT_ID) && text(env.GOOGLE_OAUTH_CLIENT_SECRET));
}

export function googleOAuthStartPath() {
  return GOOGLE_START_PATH;
}

export function googleOAuthCallbackPath() {
  return GOOGLE_CALLBACK_PATH;
}

export function clearGoogleOAuthCookies() {
  return [clearedCookie(STATE_COOKIE), clearedCookie(NONCE_COOKIE)];
}

export function handleGoogleOAuthStart(request: Request, env: GoogleOAuthEnv) {
  if (request.method !== "GET") return oauthError("Method Not Allowed", 405);
  if (!googleOAuthConfigured(env)) return oauthError("Google authentication is not configured.", 503);

  const state = randomToken();
  const nonce = randomToken();
  const authorization = new URL(GOOGLE_AUTHORIZATION_ENDPOINT);
  authorization.searchParams.set("client_id", text(env.GOOGLE_OAUTH_CLIENT_ID));
  authorization.searchParams.set("redirect_uri", redirectUri(request, env));
  authorization.searchParams.set("response_type", "code");
  authorization.searchParams.set("scope", "openid email profile");
  authorization.searchParams.set("state", state);
  authorization.searchParams.set("nonce", nonce);
  authorization.searchParams.set("prompt", "select_account");

  const headers = new Headers({
    location: authorization.toString(),
    "cache-control": "no-store, private",
    "referrer-policy": "no-referrer",
  });
  headers.append("set-cookie", temporaryCookie(STATE_COOKIE, state));
  headers.append("set-cookie", temporaryCookie(NONCE_COOKIE, nonce));
  return new Response(null, { status: 303, headers });
}

export async function resolveGoogleOAuthCallback(
  request: Request,
  env: GoogleOAuthEnv,
): Promise<GoogleOAuthProfile> {
  if (request.method !== "GET") throw new Error("google_callback_method");
  if (!googleOAuthConfigured(env)) throw new Error("google_oauth_not_configured");

  const url = new URL(request.url);
  if (url.searchParams.get("error")) throw new Error("google_oauth_denied");

  const code = text(url.searchParams.get("code"));
  const state = text(url.searchParams.get("state"));
  const expectedState = cookieValue(request.headers, STATE_COOKIE);
  const expectedNonce = cookieValue(request.headers, NONCE_COOKIE);
  if (!code || !state || !expectedState || !expectedNonce) throw new Error("google_oauth_callback_missing");
  if (!(await secureEqual(state, expectedState))) throw new Error("google_oauth_state");

  const idToken = await exchangeAuthorizationCode(code, request, env);
  return verifyGoogleIdToken(idToken, text(env.GOOGLE_OAUTH_CLIENT_ID), expectedNonce);
}
