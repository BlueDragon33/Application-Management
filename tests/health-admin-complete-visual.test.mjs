import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const css = fs.readFileSync("app/apps/health-care/health-care-admin.module.css", "utf8");
const page = fs.readFileSync("app/apps/health-care/page.tsx", "utf8");
const ui = fs.readFileSync("app/apps/health-care/health-care-admin.tsx", "utf8");

test("Health admin uses one Bauman-standard visual source without stacked legacy wrappers", () => {
  assert.ok(page.includes("<HealthCareAdmin"));
  assert.equal(page.includes("health-care-admin-complete.module.css"), false);
  assert.equal(page.includes("health-care-admin-pixel-match.module.css"), false);
  assert.ok(css.includes("BAUMAN ADMIN STANDARD OVERRIDES"));
  assert.ok(css.includes("background:#f3f6fa"));
  assert.ok(css.includes("grid-template-columns:300px minmax(0,1fr)"));
});

test("all Health admin views remain styled and reachable in the unified shell", () => {
  for (const token of [
    'type View = "overview" | "devices" | "access" | "content" | "audit"',
    'Tổng quan',
    'Thiết bị & quyền',
    'Policy & phiên',
    'Duyệt nội dung',
    'Audit ứng dụng',
    'className={styles.metrics}',
    'className={styles.accessGrid}',
    'className={styles.contentPanel}',
    'className={styles.auditPanel}',
  ]) assert.ok(ui.includes(token), `missing Health admin shell token: ${token}`);
  for (const token of [".policyCard", ".sessionCard", ".contentPanel", ".auditPanel", "@media(max-width:860px)", "@media(max-width:560px)"]) {
    assert.ok(css.includes(token), `missing Health admin style token: ${token}`);
  }
});

test("visual standardization does not change the Health client boundary or management actions", () => {
  for (const token of [
    '"/api/control/status"',
    '"/api/control/devices"',
    '"/api/control/sessions"',
    '"/api/control/audit"',
    '"/api/control/health-content"',
    '"/api/control/policy"',
    'Health_Care tự sở hữu runtime, D1, thiết bị SK, session và audit',
    'Hồ sơ sức khỏe cá nhân không đi vào Application Management',
  ]) assert.ok(ui.includes(token), `missing management/boundary token: ${token}`);

  assert.equal(/<iframe\b/i.test(ui), false);
  assert.equal(/suc-khoe-tre\.boiech-ai\.workers\.dev|boi-ech\.dinhnam3391/.test(ui), false);
});
