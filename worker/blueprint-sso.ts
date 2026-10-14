/** Production-only, authorization-code + PKCE pilot for Blueprint Hub.
 * No wildcard callback, browser-held secrets, implicit role elevation or
 * shared App-Manage cookies. Codes live in D1 and are consumed atomically.
 */
import type { ProductionIdentity } from "./production-auth";

const HUB_CLIENT_ID = "software-blueprint-hub";
const ALLOWED_CALLBACK = "https://software-blueprint-hub-git-main-dinhnam3391-4708.vercel.app/api/sso/callback";
const TTL_SECONDS = 60;
const b64 = (data: Uint8Array) => btoa(String.fromCharCode(...data))
  .replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/g, "");
const toHex = (data: Uint8Array) => [...data].map((b) => b.toString(16).padStart(2, "0")).join("");
async function sha256(input: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input)));
}
const json = (payload: Record<string, unknown>, status = 200) =>
  Response.json(payload, {
    status, headers: { "cache-control": "no-store, private", "referrer-policy": "no-referrer",
      "x-content-type-options": "nosniff", "content-security-policy": "default-src 'none'" }
  });
function validMetadata(client: unknown, redirect: unknown, state: unknown, challenge: unknown) {
  return client === HUB_CLIENT_ID && redirect === ALLOWED_CALLBACK &&
    typeof state === "string" && /^[A-Za-z0-9_-]{32,100}$/.test(state) &&
    typeof challenge === "string" && /^[A-Za-z0-9_-]{43}$/.test(challenge);
}

export interface AppManageSsoEnvironment {
  readonly DB: D1Database;
  readonly CONTROL_OWNER_EMAILS?: string;
}

/** GET occurs only after worker/production-auth verified the live production session. */
export async function authorizeBlueprintSso(
  request: Request,
  env: AppManageSsoEnvironment,
  identity: ProductionIdentity,
  nowSeconds = Math.floor(Date.now() / 1000)
): Promise<Response> {
  if (request.method !== "GET" || identity.mustChangePassword) {
    return json({ error: "sso_session_not_ready" }, 403);
  }
  const url = new URL(request.url);
  const client = url.searchParams.get("client_id");
  const redirect = url.searchParams.get("redirect_uri");
  const state = url.searchParams.get("state");
  const challenge = url.searchParams.get("code_challenge");
  if (!validMetadata(client, redirect, state, challenge) ||
      url.searchParams.get("code_challenge_method") !== "S256" ||
      url.searchParams.get("response_type") !== "code") {
    return json({ error: "invalid_sso_client_or_redirect" }, 400);
  }
  const email = identity.email.trim().toLowerCase();
  // Authorization restricted to known active management accounts. This
  // pilot only grants a SSO identity assertion, NOT Blueprint System Owner.
  const account = await env.DB.prepare(
    "SELECT role,status FROM control_accounts WHERE email=?1 LIMIT 1"
  ).bind(email).first<{ role: string; status: string }>();
  if (!account || account.status !== "active" ||
      !["owner", "reviewer", "viewer"].includes(account.role)) {
    return json({ error: "app_management_account_disabled" }, 403);
  }
  const code = b64(crypto.getRandomValues(new Uint8Array(32)));
  const hash = toHex(await sha256(code));
  await env.DB.prepare(
    "INSERT INTO hub_sso_authorization_codes (code_hash, client_id, redirect_uri, code_challenge, actor_email, expires_at, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)"
  ).bind(hash, client, redirect, challenge, email, nowSeconds + TTL_SECONDS, nowSeconds).run();
  const callback = new URL(ALLOWED_CALLBACK);
  callback.searchParams.set("code", code);
  callback.searchParams.set("state", state!);
  return new Response(null, {
    status: 303,
    headers: {
      location: callback.href, "cache-control": "no-store, private",
      "referrer-policy": "no-referrer", "x-content-type-options": "nosniff",
      "content-security-policy": "default-src 'none'"
    }
  });
}

/** POST is a server-to-server token exchange: PKCE + one-time atomic D1 DELETE. */
export async function exchangeBlueprintSso(
  request: Request,
  env: AppManageSsoEnvironment,
  nowSeconds = Math.floor(Date.now() / 1000)
): Promise<Response> {
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  if ((Number(request.headers.get("content-length")) || 0) > 4096) return json({ error: "too_large" }, 413);
  const body: unknown = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) return json({ error: "invalid_request" }, 400);
  const params = body as Record<string, unknown>;
  const verifier = params.code_verifier, code = params.code;
  if (params.client_id !== HUB_CLIENT_ID || params.redirect_uri !== ALLOWED_CALLBACK ||
      typeof code !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(code) ||
      typeof verifier !== "string" || !/^[A-Za-z0-9_-]{43,128}$/.test(verifier)) {
    return json({ error: "invalid_grant" }, 400);
  }
  const hash = toHex(await sha256(code));
  const challenge = b64(await sha256(verifier));
  const record = await env.DB.prepare(
    "DELETE FROM hub_sso_authorization_codes WHERE code_hash=?1 AND client_id=?2 AND redirect_uri=?3 AND code_challenge=?4 AND expires_at>?5 RETURNING actor_email"
  ).bind(hash, HUB_CLIENT_ID, ALLOWED_CALLBACK, challenge, nowSeconds)
    .first<{ actor_email: string }>();
  if (!record) return json({ error: "invalid_grant" }, 401);
  const account = await env.DB.prepare(
    "SELECT status FROM control_accounts WHERE email=?1 LIMIT 1"
  ).bind(record.actor_email).first<{ status: string }>();
  if (account?.status !== "active") return json({ error: "account_revoked" }, 403);
  return json({
    issuer: new URL(request.url).origin,
    audience: HUB_CLIENT_ID,
    subject: record.actor_email,
    email: record.actor_email,
    expiresAt: nowSeconds + 60
  });
}
