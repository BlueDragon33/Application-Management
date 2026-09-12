const LOGIN_PATH = "/__preview-login";
const LOGOUT_PATH = "/__preview-logout";
const SESSION_COOKIE = "am_preview_session";
const SESSION_TTL_SECONDS = 12 * 60 * 60;
const SESSION_CONTEXT = "application-management-preview-session-v1";
const encoder = new TextEncoder();

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function previewAccessConfigured(secret: unknown) {
  return text(secret).length >= 32;
}

function base64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/g, "");
}

async function hmac(secret: string, value: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(value));
  return base64Url(new Uint8Array(signature));
}

async function secureEqual(left: string, right: string) {
  if (!left || !right) return false;
  const [leftDigest, rightDigest] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(left)),
    crypto.subtle.digest("SHA-256", encoder.encode(right)),
  ]);
  const leftBytes = new Uint8Array(leftDigest);
  const rightBytes = new Uint8Array(rightDigest);
  if (leftBytes.length !== rightBytes.length) return false;
  let difference = 0;
  for (let index = 0; index < leftBytes.length; index += 1) difference |= leftBytes[index] ^ rightBytes[index];
  return difference === 0;
}

function cookieValue(headers: Headers, name: string) {
  const cookie = headers.get("cookie") ?? "";
  for (const entry of cookie.split(";")) {
    const [rawName, ...rest] = entry.trim().split("=");
    if (rawName === name) return rest.join("=");
  }
  return "";
}

async function sessionToken(secret: string, expiresAt: number) {
  const body = `${SESSION_CONTEXT}:${expiresAt}`;
  return `${expiresAt}.${await hmac(secret, body)}`;
}

async function validSession(token: string, secret: string) {
  const [expiresText, signature, ...extra] = token.split(".");
  if (extra.length || !/^\d{10,13}$/.test(expiresText ?? "") || !signature) return false;
  const expiresAt = Number(expiresText);
  const now = Math.floor(Date.now() / 1000);
  if (!Number.isSafeInteger(expiresAt) || expiresAt <= now || expiresAt > now + SESSION_TTL_SECONDS + 60) return false;
  const expected = await hmac(secret, `${SESSION_CONTEXT}:${expiresAt}`);
  return secureEqual(signature, expected);
}

export async function previewRequestAuthorized(request: Request, secretValue: unknown) {
  const secret = text(secretValue);
  if (!previewAccessConfigured(secret)) return false;

  const authorization = request.headers.get("authorization")?.trim() ?? "";
  if (/^Bearer\s+/i.test(authorization)) {
    const candidate = authorization.replace(/^Bearer\s+/i, "").trim();
    if (await secureEqual(candidate, secret)) return true;
  }

  const session = cookieValue(request.headers, SESSION_COOKIE);
  return session ? validSession(session, secret) : false;
}

function securityHeaders(contentType = "text/html; charset=utf-8") {
  return {
    "cache-control": "no-store, private",
    "content-type": contentType,
    "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
    "referrer-policy": "no-referrer",
    "x-content-type-options": "nosniff",
    "x-frame-options": "DENY",
  };
}

function loginPage(error = "") {
  const errorBlock = error ? `<p class="error">${error}</p>` : "";
  return `<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Application Management Preview</title>
<style>
:root{color-scheme:dark;font-family:Inter,system-ui,sans-serif;background:#0b1020;color:#eef2ff}body{min-height:100vh;margin:0;display:grid;place-items:center;padding:24px}.card{width:min(440px,100%);box-sizing:border-box;background:#11182c;border:1px solid #27324f;border-radius:18px;padding:28px;box-shadow:0 20px 70px #0008}h1{font-size:22px;margin:0 0 8px}p{color:#b9c3df;line-height:1.5}label{display:block;font-weight:650;margin:22px 0 8px}input{width:100%;box-sizing:border-box;padding:13px 14px;border-radius:10px;border:1px solid #34405f;background:#0a1020;color:#fff}button{width:100%;margin-top:14px;padding:13px;border:0;border-radius:10px;font-weight:750;cursor:pointer}.error{color:#ffb4b4}.note{font-size:13px;color:#8793b6}</style>
</head>
<body><main class="card"><h1>Application Management · Preview</h1><p>Nhập preview access secret để mở môi trường kiểm thử.</p>${errorBlock}<form method="post" action="${LOGIN_PATH}"><label for="secret">Preview access secret</label><input id="secret" name="secret" type="password" autocomplete="off" required minlength="32"><button type="submit">Mở preview</button></form><p class="note">Secret chỉ được kiểm tra tại Worker và không được lưu trong URL.</p></main></body>
</html>`;
}

export async function handlePreviewLogin(request: Request, secretValue: unknown) {
  const secret = text(secretValue);
  if (!previewAccessConfigured(secret)) {
    return new Response("Preview access is not configured.", { status: 503, headers: securityHeaders("text/plain; charset=utf-8") });
  }
  if (request.method === "GET") return new Response(loginPage(), { status: 200, headers: securityHeaders() });
  if (request.method !== "POST") return new Response("Method Not Allowed", { status: 405, headers: securityHeaders("text/plain; charset=utf-8") });

  const form = await request.formData();
  const candidate = text(form.get("secret"));
  if (!(await secureEqual(candidate, secret))) {
    return new Response(loginPage("Secret không đúng."), { status: 401, headers: securityHeaders() });
  }

  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const session = await sessionToken(secret, expiresAt);
  const headers = new Headers(securityHeaders("text/plain; charset=utf-8"));
  headers.set("location", "/");
  headers.append("set-cookie", `${SESSION_COOKIE}=${session}; Max-Age=${SESSION_TTL_SECONDS}; Path=/; HttpOnly; Secure; SameSite=Strict`);
  return new Response("Authenticated", { status: 303, headers });
}

export function handlePreviewLogout() {
  const headers = new Headers(securityHeaders("text/plain; charset=utf-8"));
  headers.set("location", LOGIN_PATH);
  headers.append("set-cookie", `${SESSION_COOKIE}=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Strict`);
  return new Response("Signed out", { status: 303, headers });
}

export function previewLoginPath() {
  return LOGIN_PATH;
}

export function previewLogoutPath() {
  return LOGOUT_PATH;
}

function firstOwnerEmail(value: unknown) {
  const candidate = text(value).split(",").map((item) => item.trim().toLowerCase()).find(Boolean) ?? "";
  return /^[^\s@,]+@[^\s@,]+\.[^\s@,]+$/.test(candidate) ? candidate : "";
}

export function withPreviewOwnerIdentity(request: Request, ownerEmails: unknown) {
  const email = firstOwnerEmail(ownerEmails);
  if (!email) return null;
  const headers = new Headers(request.headers);
  for (const name of [
    "oai-authenticated-user-id",
    "oai-authenticated-user-email",
    "oai-authenticated-user-full-name",
    "oai-authenticated-user-full-name-encoding",
  ]) headers.delete(name);
  headers.set("oai-authenticated-user-id", `preview-owner:${email}`);
  headers.set("oai-authenticated-user-email", email);
  headers.set("oai-authenticated-user-full-name", encodeURIComponent("Preview Owner"));
  headers.set("oai-authenticated-user-full-name-encoding", "percent-encoded-utf-8");
  return new Request(request, { headers });
}

export const PREVIEW_ACCESS_GUARDRAILS = {
  authHeader: "Authorization: Bearer <preview-secret>",
  sessionCookie: SESSION_COOKIE,
  sessionTtlSeconds: SESSION_TTL_SECONDS,
  loginPath: LOGIN_PATH,
  logoutPath: LOGOUT_PATH,
  hmac: "HMAC-SHA-256",
  secretMinLength: 32,
  secretNeverInUrl: true,
} as const;
