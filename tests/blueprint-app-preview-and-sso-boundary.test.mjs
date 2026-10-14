import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const registry = read("app/application-registry.ts");
const workspace = read("app/application-workspace.tsx");
const dashboard = read("app/management-dashboard-v2.tsx");
const ssoContract = read("docs/APPMANAGE_SINGLE_SIGN_ON_CONTRACT.md");
const start = registry.indexOf('id: "software-blueprint-hub"');
const end = registry.indexOf("\n  },", start);
const blueprint = registry.slice(start, end);

test("Blueprint launch uses the verified latest development Preview without overwriting Production", () => {
  assert.ok(start > 0);
  assert.match(blueprint, /publicUrl: "https:\/\/software-blueprint-hub\.vercel\.app\/"/);
  assert.match(blueprint, /previewUrl: "https:\/\/software-blueprint-hub-git-main-dinhnam3391-4708\.vercel\.app\/"/);
  assert.match(workspace, /Mở giao diện mới \(Preview\)/);
  assert.match(workspace, /Mở Production/);
  assert.match(dashboard, /app\?\.previewUrl \?\? summary\?\.webHref \?\? fallback/);
  assert.match(dashboard, /if \(summary\?\.webAccessPolicy === "deny"\)/);
  assert.match(dashboard, /if \(summary\?\.managedWebLaunch && approvalGateEnabled\)/);
});

test("App-Manage launch is not yet falsely presented as completed cross-domain SSO", () => {
  assert.match(ssoContract, /OIDC Authorization Code \+ PKCE/);
  assert.match(ssoContract, /đăng nhập một lần/);
  assert.match(ssoContract, /Chưa kết nối đăng nhập một lần/);
  assert.match(ssoContract, /Không được làm/);
  assert.match(ssoContract, /chống replay/);
  assert.doesNotMatch(blueprint, /browserSso: true|managedWebLaunch: true/);
});
