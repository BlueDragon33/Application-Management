import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const totp = fs.readFileSync("worker/totp.ts", "utf8");
const auth = fs.readFileSync("worker/production-auth.ts", "utf8");
const migration = fs.readFileSync("drizzle/0013_totp_step_up.sql", "utf8");
const workflow = fs.readFileSync(".github/workflows/deploy-application-management-production.yml", "utf8");

test("Authenticator secrets are encrypted at rest with a dedicated AES-256-GCM key", () => {
  assert.match(totp, /AES-GCM/);
  assert.match(totp, /APPLICATION_MANAGEMENT_MFA_ENCRYPTION_KEY/);
  assert.match(totp, /new Uint8Array\(12\)/);
  assert.match(migration, /secret_ciphertext/);
  assert.match(migration, /secret_iv/);
  assert.doesNotMatch(migration, /secret_plaintext/);
  assert.match(workflow, /APPLICATION_MANAGEMENT_MFA_ENCRYPTION_KEY/);
  assert.match(workflow, /randomBytes\(32\)\.toString\('base64url'\)/);
});

test("TOTP follows six-digit 30-second RFC 6238 compatible parameters", () => {
  assert.match(totp, /TOTP_PERIOD_SECONDS = 30/);
  assert.match(totp, /TOTP_DIGITS = 6/);
  assert.match(totp, /TOTP_WINDOW = 1/);
  assert.match(totp, /HMAC", hash: "SHA-1"/);
  assert.match(totp, /otpauth:\/\/totp/);
  assert.match(totp, /period/);
});

test("step-up is session-scoped and expires after fifteen minutes", () => {
  assert.match(migration, /step_up_at/);
  assert.match(migration, /auth_method/);
  assert.match(auth, /STEP_UP_TTL_SECONDS = 15 \* 60/);
  assert.match(auth, /UPDATE control_sessions SET step_up_at=\?2 WHERE session_id_hash=\?1/);
  assert.match(auth, /Xác minh trong 15 phút/);
});

test("sensitive account mutations require recent step-up once TOTP is enabled", () => {
  assert.match(auth, /requireAccountStepUp/);
  assert.match(auth, /mfa\/step-up/);
  assert.match(auth, /mfa\/disable/);
  assert.match(auth, /Hãy xác minh Authenticator trước khi đổi email quyền nội bộ/);
  assert.match(auth, /Hãy xác minh Authenticator trước khi đổi mật khẩu khôi phục/);
});

test("Google remains primary and password recovery is visually demoted", () => {
  assert.match(auth, /Tiếp tục với Google/);
  assert.match(auth, /Tùy chọn khôi phục nâng cao/);
  assert.match(auth, /Đổi mật khẩu khôi phục/);
  assert.match(auth, /Đăng nhập chính/);
  assert.match(auth, /Google ·/);
});


test("production Worker blocks sensitive central mutations until recent step-up", () => {
  const worker = fs.readFileSync("worker/index.ts", "utf8");
  assert.match(auth, /sensitiveProductionMutation/);
  assert.match(auth, /\/api\/center/);
  assert.match(auth, /manage-control-device/);
  assert.match(auth, /\/api\/focused-device-operation/);
  assert.match(auth, /\/api\/managed-apps/);
  assert.match(auth, /\/api\/deploy-ops/);
  assert.match(auth, /safe-publish/);
  assert.match(auth, /STEP_UP_REQUIRED/);
  assert.match(auth, /stepUpPath: ACCOUNT_PATH/);
  assert.match(worker, /productionStepUpGate\(request, env, identity\)/);
});

test("first Google identity link is restricted to configured Owner email", () => {
  assert.match(auth, /const configuredOwner = ownerEmails\(env\.CONTROL_OWNER_EMAILS\)\.includes\(profile\.email\)/);
  assert.match(auth, /if \(!configuredOwner\) return null/);
  assert.match(auth, /account\.role !== "owner"/);
});
