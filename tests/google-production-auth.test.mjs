import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const google = fs.readFileSync("worker/google-oauth.ts", "utf8");
const production = fs.readFileSync("worker/production-auth.ts", "utf8");
const worker = fs.readFileSync("worker/index.ts", "utf8");
const migration = fs.readFileSync("drizzle/0012_google_auth_identities.sql", "utf8");

test("Google production sign-in uses server-side OIDC with CSRF and nonce protection", () => {
  assert.match(google, /accounts\.google\.com\/o\/oauth2\/v2\/auth/);
  assert.match(google, /oauth2\.googleapis\.com\/token/);
  assert.match(google, /www\.googleapis\.com\/oauth2\/v3\/certs/);
  assert.match(google, /scope", "openid email profile"/);
  assert.match(google, /searchParams\.set\("state"/);
  assert.match(google, /searchParams\.set\("nonce"/);
  assert.match(google, /__Host-am_google_state/);
  assert.match(google, /__Host-am_google_nonce/);
  assert.match(google, /SameSite=Lax/);
});

test("Google ID tokens are cryptographically verified before account linking", () => {
  assert.match(google, /RSASSA-PKCS1-v1_5/);
  assert.match(google, /alg !== "RS256"/);
  assert.match(google, /issuer !== "https:\/\/accounts\.google\.com"/);
  assert.match(google, /audienceOk/);
  assert.match(google, /google_id_token_expired/);
  assert.match(google, /google_id_token_nonce/);
  assert.match(google, /email_verified/);
  assert.match(google, /subject/);
});

test("Google subject is the stable identity and email only links into Application Management authority", () => {
  assert.match(migration, /provider_subject/);
  assert.match(migration, /PRIMARY KEY \(`provider`, `provider_subject`\)/);
  assert.match(migration, /account_email/);
  assert.match(migration, /REFERENCES `control_accounts`\(`email`\)/);
  assert.match(production, /WHERE provider='google' AND provider_subject=\?1/);
  assert.match(production, /ownerEmails\(env\.CONTROL_OWNER_EMAILS\)\.includes\(profile\.email\)/);
  assert.match(production, /Tài khoản Google này chưa được cấp quyền quản trị/);
});

test("Google is primary while password remains a bounded recovery path during migration", () => {
  assert.match(production, /Tiếp tục với Google/);
  assert.match(production, /tài khoản khôi phục/);
  assert.match(production, /Đăng nhập khôi phục/);
  assert.match(production, /Google chỉ dùng để xác thực danh tính/);
  assert.match(production, /Quyền Owner\/Reviewer\/Viewer vẫn do Application Management quyết định/);
});

test("production worker routes OAuth endpoints before requiring an existing session", () => {
  const start = worker.indexOf("productionGoogleStartPath()");
  const callback = worker.indexOf("productionGoogleCallbackPath()");
  const identity = worker.indexOf("productionIdentity(request, env)");
  assert.ok(start >= 0 && callback >= 0 && identity >= 0);
  assert.ok(start < identity);
  assert.ok(callback < identity);
  assert.match(worker, /googleAuthConfigured/);
  assert.match(worker, /google-oauth\+account-session/);
});


test("Google OAuth session cookie survives the cross-site callback redirect", () => {
  assert.match(production, /authMethod === "google" \? "Lax" : "Strict"/);
  assert.match(production, /SameSite=\$\{sameSite\}/);
  assert.match(production, /HttpOnly; Secure/);
});
