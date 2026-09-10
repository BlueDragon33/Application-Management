import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const css = fs.readFileSync("app/apps/health-care/health-care-admin-complete.module.css", "utf8");
const page = fs.readFileSync("app/apps/health-care/page.tsx", "utf8");
const ui = fs.readFileSync("app/apps/health-care/health-care-admin.tsx", "utf8");

test("Health admin applies the complete visual layer on top of the approved reference", () => {
  for (const token of [
    'import complete from "./health-care-admin-complete.module.css"',
    '${reference.scope} ${complete.scope}',
  ]) assert.ok(page.includes(token), `missing complete visual integration: ${token}`);
});

test("all four Health admin views share the premium visual system", () => {
  for (const token of [
    'section[class*="accessGrid"]',
    'article[class*="policyCard"]',
    'article[class*="sessionCard"]',
    'section[class*="contentPanel"]',
    'section[class*="auditPanel"]',
    'footer[class*="contractFooter"]',
    'label[class*="toggleRow"] input[type="checkbox"]:checked',
    'div[class*="numberGrid"]',
    'data-status="permission_requested"',
    'data-status="review"',
    'data-status="published"',
    '@media(max-width:1320px)',
    '@media(max-width:860px)',
    '@media(max-width:560px)',
    '@media(prefers-reduced-motion:reduce)',
  ]) assert.ok(css.includes(token), `missing complete Health admin style token: ${token}`);
});

test("visual completion does not change the Health client boundary or management actions", () => {
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

  assert.equal(/<iframe\b/i.test(ui), false, "Health_Care must remain an independent client without iframe embedding");
  assert.equal(/suc-khoe-tre\.boiech-ai\.workers\.dev|boi-ech\.dinhnam3391/.test(ui), false, "legacy Bơi Ếch / Worker runtime must not return");
});
