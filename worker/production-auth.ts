const LOGIN_PATH = "/__login";
const LOGOUT_PATH = "/__logout";
const ACCOUNT_PATH = "/__account";
const SESSION_COOKIE = "__Host-am_prod_session";
const SESSION_TTL_SECONDS = 12 * 60 * 60;
const PASSWORD_ITERATIONS = 310_000;
const MAX_FAILED_ATTEMPTS = 5;
const LOCK_SECONDS = 15 * 60;
const encoder = new TextEncoder();

type ProductionAuthEnv = {
  DB: D1Database;
  CONTROL_OWNER_EMAILS?: string;
  APPLICATION_MANAGEMENT_INITIAL_ADMIN_PASSWORD?: string;
  APPLICATION_MANAGEMENT_PRODUCTION_READBACK_SECRET?: string;
};

export type ProductionIdentity = {
  email: string;
  displayName: string;
  mustChangePassword: boolean;
  sessionHash: string;
};

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeEmail(value: unknown) {
  const email = text(value).toLowerCase();
  return /^[^\s@,]+@[^\s@,]+\.[^\s@,]+$/.test(email) ? email : "";
}

function ownerEmails(value: unknown) {
  return text(value)
    .split(",")
    .map((item) => normalizeEmail(item))
    .filter(Boolean);
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

async function sha256(value: string) {
  return base64Url(new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(value))));
}

async function secureEqual(left: string, right: string) {
  if (!left || !right) return false;
  const [a, b] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(left)),
    crypto.subtle.digest("SHA-256", encoder.encode(right)),
  ]);
  const leftBytes = new Uint8Array(a);
  const rightBytes = new Uint8Array(b);
  let difference = leftBytes.length ^ rightBytes.length;
  const length = Math.max(leftBytes.length, rightBytes.length);
  for (let index = 0; index < length; index += 1) {
    difference |= (leftBytes[index] ?? 0) ^ (rightBytes[index] ?? 0);
  }
  return difference === 0;
}

async function passwordHash(password: string, saltBytes: Uint8Array, iterations = PASSWORD_ITERATIONS) {
  const material = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: saltBytes as BufferSource, iterations },
    material,
    256,
  );
  return base64Url(new Uint8Array(bits));
}

async function newPasswordRecord(password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return {
    salt: base64Url(salt),
    hash: await passwordHash(password, salt),
    iterations: PASSWORD_ITERATIONS,
  };
}

async function passwordMatches(password: string, salt: string, expected: string, iterations: number) {
  try {
    const candidate = await passwordHash(password, base64UrlBytes(salt), iterations);
    return secureEqual(candidate, expected);
  } catch {
    return false;
  }
}

function cookieValue(headers: Headers, name: string) {
  for (const entry of (headers.get("cookie") ?? "").split(";")) {
    const [rawName, ...rest] = entry.trim().split("=");
    if (rawName === name) return rest.join("=");
  }
  return "";
}

function secureHeaders(contentType = "text/html; charset=utf-8") {
  return {
    "cache-control": "no-store, private",
    "content-type": contentType,
    "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
    "referrer-policy": "no-referrer",
    "x-content-type-options": "nosniff",
    "x-frame-options": "DENY",
  };
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function sameOriginPost(request: Request) {
  if (request.method !== "POST") return true;
  const origin = request.headers.get("origin");
  if (!origin) return true;
  return origin === new URL(request.url).origin;
}

function shell(title: string, body: string) {
  return `<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)} · Application Management</title>
<style>
:root{color-scheme:dark;font-family:Inter,system-ui,sans-serif;background:#07120f;color:#effaf6}*{box-sizing:border-box}body{min-height:100vh;margin:0;display:grid;place-items:center;padding:20px;background:radial-gradient(circle at 20% 0,#123e32 0,transparent 36%),#07120f}.card{width:min(560px,100%);background:#0b211b;border:1px solid #1f5748;border-radius:18px;padding:26px;box-shadow:0 28px 80px #0009}h1{font-size:24px;margin:0 0 8px}h2{font-size:16px;margin:24px 0 8px}p{color:#a8c8bd;line-height:1.55}label{display:block;margin:14px 0 6px;font-size:13px;font-weight:700}input{width:100%;padding:12px 13px;border:1px solid #2c6857;border-radius:9px;background:#071812;color:#fff}button,.button{display:inline-flex;align-items:center;justify-content:center;min-height:42px;margin-top:14px;padding:0 16px;border:1px solid #37a480;border-radius:9px;background:#167258;color:#fff;font-weight:800;text-decoration:none;cursor:pointer}.secondary{background:#102f27;border-color:#2b6857}.row{display:flex;gap:9px;flex-wrap:wrap}.error{padding:10px 12px;border:1px solid #9e4242;border-radius:9px;background:#401d1d;color:#ffd5d5}.success{padding:10px 12px;border:1px solid #29815f;border-radius:9px;background:#123d30;color:#caffec}.note{font-size:12px;color:#779d90}.field{padding:10px 12px;border:1px solid #244f43;border-radius:9px;background:#0a1915}.field span,.field strong{display:block}.field span{font-size:11px;color:#7ea596}.field strong{margin-top:4px;overflow-wrap:anywhere}</style>
</head>
<body><main class="card">${body}</main></body>
</html>`;
}

function loginPage(message = "", email = "") {
  const notice = message ? `<p class="error">${escapeHtml(message)}</p>` : "";
  return shell("Đăng nhập", `
    <h1>Application Management</h1>
    <p>Đăng nhập quản trị Production. Đây là tài khoản riêng của Application Management, không phải Preview secret.</p>
    ${notice}
    <form method="post" action="${LOGIN_PATH}">
      <label for="email">Email quản trị</label>
      <input id="email" name="email" type="email" autocomplete="username" required value="${escapeHtml(email)}">
      <label for="password">Mật khẩu</label>
      <input id="password" name="password" type="password" autocomplete="current-password" required minlength="12">
      <button type="submit">Đăng nhập</button>
    </form>
    <p class="note">Phiên đăng nhập dùng cookie HttpOnly + Secure + SameSite=Strict. Mật khẩu không được lưu dạng rõ.</p>
  `);
}

function accountPage(identity: ProductionIdentity, profile: { phone?: string | null }, notice = "") {
  const message = notice
    ? `<p class="${notice.startsWith("Lỗi:") ? "error" : "success"}">${escapeHtml(notice)}</p>`
    : "";
  return shell("Tài khoản & bảo mật", `
    <h1>Tài khoản & bảo mật</h1>
    <p>Quản lý trực tiếp tài khoản Production của Application Management.</p>
    ${message}
    ${identity.mustChangePassword ? '<p class="error">Mật khẩu bootstrap chỉ dùng lần đầu. Hãy đổi mật khẩu trước khi tiếp tục sử dụng lâu dài.</p>' : ""}
    <div class="field"><span>Email đăng nhập</span><strong>${escapeHtml(identity.email)}</strong></div>
    <form method="post" action="${ACCOUNT_PATH}/profile">
      <h2>Thông tin tài khoản</h2>
      <label for="displayName">Tên hiển thị</label>
      <input id="displayName" name="displayName" maxlength="80" required value="${escapeHtml(identity.displayName)}">
      <label for="phone">Số điện thoại</label>
      <input id="phone" name="phone" maxlength="32" inputmode="tel" value="${escapeHtml(profile.phone ?? "")}">
      <button type="submit">Lưu thông tin</button>
    </form>
    <form method="post" action="${ACCOUNT_PATH}/email">
      <h2>Đổi email đăng nhập</h2>
      <label for="newEmail">Email mới</label>
      <input id="newEmail" name="newEmail" type="email" autocomplete="email" required>
      <label for="emailPassword">Mật khẩu hiện tại</label>
      <input id="emailPassword" name="currentPassword" type="password" autocomplete="current-password" required>
      <button type="submit">Đổi email và đăng nhập lại</button>
      <p class="note">Quyền Owner được giữ trong D1 và sẽ được chuyển cùng tài khoản; các phiên hiện tại sẽ bị thu hồi.</p>
    </form>
    <form method="post" action="${ACCOUNT_PATH}/password">
      <h2>Đổi mật khẩu</h2>
      <label for="currentPassword">Mật khẩu hiện tại</label>
      <input id="currentPassword" name="currentPassword" type="password" autocomplete="current-password" required>
      <label for="newPassword">Mật khẩu mới</label>
      <input id="newPassword" name="newPassword" type="password" autocomplete="new-password" minlength="12" required>
      <label for="confirmPassword">Nhập lại mật khẩu mới</label>
      <input id="confirmPassword" name="confirmPassword" type="password" autocomplete="new-password" minlength="12" required>
      <button type="submit">Đổi mật khẩu</button>
    </form>
    <div class="row"><a class="button secondary" href="/">Về Application Management</a><form method="post" action="${LOGOUT_PATH}"><button class="secondary" type="submit">Đăng xuất</button></form></div>
  `);
}

function responseHtml(html: string, status = 200) {
  return new Response(html, { status, headers: secureHeaders() });
}

function redirect(path: string, cookie?: string) {
  const headers = new Headers(secureHeaders("text/plain; charset=utf-8"));
  headers.set("location", path);
  if (cookie) headers.append("set-cookie", cookie);
  return new Response("Redirecting", { status: 303, headers });
}

async function createSession(env: ProductionAuthEnv, email: string) {
  const token = base64Url(crypto.getRandomValues(new Uint8Array(32)));
  const sessionHash = await sha256(token);
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = now + SESSION_TTL_SECONDS;
  await env.DB.prepare(
    "INSERT INTO control_sessions (session_id_hash,email,expires_at,created_at,last_seen_at) VALUES (?1,?2,?3,?4,?4)",
  ).bind(sessionHash, email, expiresAt, now).run();
  return {
    token,
    sessionHash,
    cookie: `${SESSION_COOKIE}=${token}; Max-Age=${SESSION_TTL_SECONDS}; Path=/; HttpOnly; Secure; SameSite=Strict`,
  };
}

async function accountByEmail(env: ProductionAuthEnv, email: string) {
  return env.DB.prepare(
    "SELECT email,display_name,phone,role,password_salt,password_hash,password_iterations,must_change_password,failed_attempts,locked_until,status FROM control_accounts WHERE email=?1 LIMIT 1",
  ).bind(email).first<{
    email: string;
    display_name: string | null;
    phone: string | null;
    role: string;
    password_salt: string;
    password_hash: string;
    password_iterations: number;
    must_change_password: number;
    failed_attempts: number;
    locked_until: number | null;
    status: string;
  }>();
}

async function bootstrapOwner(env: ProductionAuthEnv, email: string, password: string) {
  const owners = ownerEmails(env.CONTROL_OWNER_EMAILS);
  const bootstrapPassword = text(env.APPLICATION_MANAGEMENT_INITIAL_ADMIN_PASSWORD);
  if (!owners.length || email !== owners[0] || bootstrapPassword.length < 14) return null;
  if (!(await secureEqual(password, bootstrapPassword))) return null;
  const record = await newPasswordRecord(password);
  const displayName = email.split("@")[0] || "Administrator";
  await env.DB.prepare(
    "INSERT OR IGNORE INTO control_accounts (email,display_name,phone,role,password_salt,password_hash,password_iterations,must_change_password,failed_attempts,locked_until,status,created_at,updated_at) VALUES (?1,?2,NULL,'owner',?3,?4,?5,1,0,NULL,'active',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)",
  ).bind(email, displayName, record.salt, record.hash, record.iterations).run();
  return accountByEmail(env, email);
}

async function markFailedLogin(env: ProductionAuthEnv, email: string, failedAttempts: number) {
  const next = failedAttempts + 1;
  const lockedUntil = next >= MAX_FAILED_ATTEMPTS ? Math.floor(Date.now() / 1000) + LOCK_SECONDS : null;
  await env.DB.prepare(
    "UPDATE control_accounts SET failed_attempts=?2,locked_until=?3,updated_at=CURRENT_TIMESTAMP WHERE email=?1",
  ).bind(email, next, lockedUntil).run();
}

export async function productionIdentity(request: Request, env: ProductionAuthEnv): Promise<ProductionIdentity | null> {
  const token = cookieValue(request.headers, SESSION_COOKIE);
  if (!token) return null;
  const sessionHash = await sha256(token);
  const now = Math.floor(Date.now() / 1000);
  const row = await env.DB.prepare(
    "SELECT s.email,s.expires_at,a.display_name,a.must_change_password,a.status FROM control_sessions s JOIN control_accounts a ON a.email=s.email WHERE s.session_id_hash=?1 LIMIT 1",
  ).bind(sessionHash).first<{
    email: string;
    expires_at: number;
    display_name: string | null;
    must_change_password: number;
    status: string;
  }>();
  if (!row || row.status !== "active" || row.expires_at <= now) {
    if (row) await env.DB.prepare("DELETE FROM control_sessions WHERE session_id_hash=?1").bind(sessionHash).run();
    return null;
  }
  await env.DB.prepare("UPDATE control_sessions SET last_seen_at=?2 WHERE session_id_hash=?1").bind(sessionHash, now).run();
  return {
    email: row.email,
    displayName: row.display_name?.trim() || row.email.split("@")[0] || "Administrator",
    mustChangePassword: row.must_change_password === 1,
    sessionHash,
  };
}

export async function handleProductionLogin(request: Request, env: ProductionAuthEnv) {
  if (request.method === "GET") {
    const changed = new URL(request.url).searchParams.get("changed");
    return responseHtml(loginPage(changed === "email" ? "Email đăng nhập đã đổi. Hãy đăng nhập lại bằng email mới." : ""));
  }
  if (request.method !== "POST") return new Response("Method Not Allowed", { status: 405, headers: secureHeaders("text/plain; charset=utf-8") });
  if (!sameOriginPost(request)) return new Response("Forbidden", { status: 403, headers: secureHeaders("text/plain; charset=utf-8") });

  const form = await request.formData();
  const email = normalizeEmail(form.get("email"));
  const password = text(form.get("password"));
  if (!email || password.length < 12 || password.length > 256) return responseHtml(loginPage("Email hoặc mật khẩu không hợp lệ.", email), 400);

  let account = await accountByEmail(env, email);
  if (!account) account = await bootstrapOwner(env, email, password);
  if (!account || account.status !== "active") return responseHtml(loginPage("Email hoặc mật khẩu không đúng.", email), 401);

  const now = Math.floor(Date.now() / 1000);
  if (account.locked_until && account.locked_until > now) {
    return responseHtml(loginPage("Tài khoản đang tạm khóa do đăng nhập sai nhiều lần. Hãy thử lại sau.", email), 429);
  }

  const ok = await passwordMatches(password, account.password_salt, account.password_hash, account.password_iterations);
  if (!ok) {
    await markFailedLogin(env, email, account.failed_attempts);
    return responseHtml(loginPage("Email hoặc mật khẩu không đúng.", email), 401);
  }

  await env.DB.prepare(
    "UPDATE control_accounts SET failed_attempts=0,locked_until=NULL,updated_at=CURRENT_TIMESTAMP WHERE email=?1",
  ).bind(email).run();
  const session = await createSession(env, email);
  return redirect(account.must_change_password === 1 ? ACCOUNT_PATH : "/", session.cookie);
}

export async function handleProductionLogout(request: Request, env: ProductionAuthEnv) {
  if (request.method !== "POST" || !sameOriginPost(request)) return new Response("Method Not Allowed", { status: 405, headers: secureHeaders("text/plain; charset=utf-8") });
  const token = cookieValue(request.headers, SESSION_COOKIE);
  if (token) {
    const hash = await sha256(token);
    await env.DB.prepare("DELETE FROM control_sessions WHERE session_id_hash=?1").bind(hash).run();
  }
  return redirect(LOGIN_PATH, `${SESSION_COOKIE}=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Strict`);
}

export async function handleProductionAccount(request: Request, env: ProductionAuthEnv, identity: ProductionIdentity) {
  const url = new URL(request.url);
  if (request.method === "GET" && url.pathname === ACCOUNT_PATH) {
    const profile = await env.DB.prepare("SELECT phone FROM control_accounts WHERE email=?1").bind(identity.email).first<{ phone: string | null }>();
    return responseHtml(accountPage(identity, profile ?? {}));
  }
  if (request.method !== "POST" || !sameOriginPost(request)) return new Response("Method Not Allowed", { status: 405, headers: secureHeaders("text/plain; charset=utf-8") });

  const form = await request.formData();
  if (url.pathname === `${ACCOUNT_PATH}/profile`) {
    const displayName = text(form.get("displayName")).slice(0, 80);
    const phone = text(form.get("phone")).slice(0, 32);
    if (!displayName) return responseHtml(accountPage(identity, { phone }, "Lỗi: Tên hiển thị không được để trống."), 400);
    if (phone && !/^[+0-9().\-\s]{6,32}$/.test(phone)) return responseHtml(accountPage(identity, { phone }, "Lỗi: Số điện thoại không hợp lệ."), 400);
    await env.DB.prepare(
      "UPDATE control_accounts SET display_name=?2,phone=?3,updated_at=CURRENT_TIMESTAMP WHERE email=?1",
    ).bind(identity.email, displayName, phone || null).run();
    return responseHtml(accountPage({ ...identity, displayName }, { phone }, "Đã lưu thông tin tài khoản."));
  }

  if (url.pathname === `${ACCOUNT_PATH}/email`) {
    const newEmail = normalizeEmail(form.get("newEmail"));
    const currentPassword = text(form.get("currentPassword"));
    const profile = await env.DB.prepare("SELECT phone FROM control_accounts WHERE email=?1").bind(identity.email).first<{ phone: string | null }>();
    if (!newEmail) return responseHtml(accountPage(identity, profile ?? {}, "Lỗi: Email mới không hợp lệ."), 400);
    if (newEmail === identity.email) return responseHtml(accountPage(identity, profile ?? {}, "Lỗi: Email mới đang trùng email hiện tại."), 400);
    const account = await accountByEmail(env, identity.email);
    if (!account || !(await passwordMatches(currentPassword, account.password_salt, account.password_hash, account.password_iterations))) {
      return responseHtml(accountPage(identity, profile ?? {}, "Lỗi: Mật khẩu hiện tại không đúng."), 401);
    }
    const existing = await accountByEmail(env, newEmail);
    if (existing) return responseHtml(accountPage(identity, profile ?? {}, "Lỗi: Email mới đã được sử dụng."), 409);
    const memberConflict = await env.DB.prepare("SELECT email FROM control_members WHERE email=?1 LIMIT 1").bind(newEmail).first<{ email: string }>();
    if (memberConflict) return responseHtml(accountPage(identity, profile ?? {}, "Lỗi: Email mới đã tồn tại trong danh sách quản trị."), 409);

    await env.DB.batch([
      env.DB.prepare("UPDATE control_devices SET email=?2 WHERE email=?1").bind(identity.email, newEmail),
      env.DB.prepare("UPDATE control_members SET email=?2,updated_at=CURRENT_TIMESTAMP WHERE email=?1").bind(identity.email, newEmail),
      env.DB.prepare("UPDATE control_accounts SET email=?2,updated_at=CURRENT_TIMESTAMP WHERE email=?1").bind(identity.email, newEmail),
      env.DB.prepare("DELETE FROM control_sessions WHERE email=?1").bind(newEmail),
    ]);
    return redirect(`${LOGIN_PATH}?changed=email`, `${SESSION_COOKIE}=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Strict`);
  }

  if (url.pathname === `${ACCOUNT_PATH}/password`) {
    const currentPassword = text(form.get("currentPassword"));
    const newPassword = text(form.get("newPassword"));
    const confirmPassword = text(form.get("confirmPassword"));
    const profile = await env.DB.prepare("SELECT phone FROM control_accounts WHERE email=?1").bind(identity.email).first<{ phone: string | null }>();
    if (newPassword.length < 12 || newPassword.length > 256) return responseHtml(accountPage(identity, profile ?? {}, "Lỗi: Mật khẩu mới phải từ 12 đến 256 ký tự."), 400);
    if (newPassword !== confirmPassword) return responseHtml(accountPage(identity, profile ?? {}, "Lỗi: Hai lần nhập mật khẩu mới không khớp."), 400);
    const account = await accountByEmail(env, identity.email);
    if (!account || !(await passwordMatches(currentPassword, account.password_salt, account.password_hash, account.password_iterations))) {
      return responseHtml(accountPage(identity, profile ?? {}, "Lỗi: Mật khẩu hiện tại không đúng."), 401);
    }
    const record = await newPasswordRecord(newPassword);
    await env.DB.prepare(
      "UPDATE control_accounts SET password_salt=?2,password_hash=?3,password_iterations=?4,must_change_password=0,failed_attempts=0,locked_until=NULL,updated_at=CURRENT_TIMESTAMP WHERE email=?1",
    ).bind(identity.email, record.salt, record.hash, record.iterations).run();
    await env.DB.prepare("DELETE FROM control_sessions WHERE email=?1 AND session_id_hash<>?2").bind(identity.email, identity.sessionHash).run();
    return responseHtml(accountPage({ ...identity, mustChangePassword: false }, profile ?? {}, "Đã đổi mật khẩu. Các phiên đăng nhập khác đã bị thu hồi."));
  }

  return new Response("Not Found", { status: 404, headers: secureHeaders("text/plain; charset=utf-8") });
}

export function productionUnauthorized(request: Request) {
  const acceptsHtml = (request.headers.get("accept") ?? "").includes("text/html");
  if (request.method === "GET" && acceptsHtml) return Response.redirect(new URL(LOGIN_PATH, request.url), 303);
  return Response.json(
    { ok: false, error: "production_auth_required" },
    {
      status: 401,
      headers: {
        "cache-control": "no-store, private",
        "content-security-policy": "default-src 'none'; frame-ancestors 'none'",
        "x-content-type-options": "nosniff",
      },
    },
  );
}

export function withProductionIdentity(request: Request, identity: ProductionIdentity) {
  const headers = new Headers(request.headers);
  for (const name of [
    "oai-authenticated-user-id",
    "oai-authenticated-user-email",
    "oai-authenticated-user-full-name",
    "oai-authenticated-user-full-name-encoding",
  ]) headers.delete(name);
  headers.set("oai-authenticated-user-id", `production:${identity.email}`);
  headers.set("oai-authenticated-user-email", identity.email);
  headers.set("oai-authenticated-user-full-name", encodeURIComponent(identity.displayName));
  headers.set("oai-authenticated-user-full-name-encoding", "percent-encoded-utf-8");
  return new Request(request, { headers });
}

export async function productionReadbackAuthorized(request: Request, secretValue: unknown) {
  const secret = text(secretValue);
  if (secret.length < 32) return false;
  const authorization = request.headers.get("authorization")?.trim() ?? "";
  if (!/^Bearer\s+/i.test(authorization)) return false;
  return secureEqual(authorization.replace(/^Bearer\s+/i, "").trim(), secret);
}

export function productionLoginPath() {
  return LOGIN_PATH;
}

export function productionLogoutPath() {
  return LOGOUT_PATH;
}

export function productionAccountPath() {
  return ACCOUNT_PATH;
}

export const PRODUCTION_AUTH_GUARDRAILS = {
  sessionCookie: SESSION_COOKIE,
  sessionTtlSeconds: SESSION_TTL_SECONDS,
  passwordKdf: "PBKDF2-SHA-256",
  passwordIterations: PASSWORD_ITERATIONS,
  lockAfterFailures: MAX_FAILED_ATTEMPTS,
  lockSeconds: LOCK_SECONDS,
  sameSite: "Strict",
  httpOnly: true,
} as const;
