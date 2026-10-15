import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const account = readFileSync(new URL("../worker/production-auth.ts", import.meta.url), "utf8");
const sso = readFileSync(new URL("../worker/blueprint-sso.ts", import.meta.url), "utf8");

test("security UI is opt-in and no bootstrap reset wall is rendered on opening Settings", () => {
  assert.match(account,/Bảo mật hai lớp \(2FA\)/);
  assert.match(account,/Đang tắt · có thể bật trong Cài đặt/);
  assert.match(account,/<details>\s*<summary>Tùy chọn khôi phục nâng cao/);
  assert.match(account,/Đổi mật khẩu khôi phục/);
  assert.doesNotMatch(account,/Cần hoàn tất bảo mật tài khoản trước khi mở Blueprint Hub/);
  assert.doesNotMatch(account,/Bước bắt buộc: đổi mật khẩu khởi tạo/);
  assert.match(account,/return !state\.enabled \|\| stepUpFresh\(identity\)/);
  assert.match(account,/if \(!state\.enabled \|\| stepUpFresh\(identity\)\) return null/);
});

test("recovery password not being rotated never auto-elevates an unverified password session to SSO", () => {
  assert.match(sso,/identity\.mustChangePassword && identity\.authMethod !== "google"/);
  assert.match(sso,/SELECT role,status FROM control_accounts/);
  assert.match(sso,/hub_sso_authorization_codes/);
  assert.match(account,/Tiếp tục bằng Google/);
  assert.match(account,/Đang dùng phiên\s+mật khẩu khởi tạo/);
});
