import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
const read = (p) => readFileSync(new URL("../" + p, import.meta.url), "utf8");
const builder = read("app/components/client-developer-support.tsx");
const shell = read("app/components/client-admin-shell.tsx");
const css = read("app/components/client-admin-shell.module.css");
const bauman = read("app/apps/bauman-master-ai/bauman-admin.tsx");
const price = read("app/apps/price-report-tunggiabao/price-report-admin.tsx");

test("developer support is a separate gated admin-shell tool, not a learner FAB", () => {
  assert.match(shell, /import \{ ClientDeveloperSupport \}/);
  assert.match(shell, /<ClientDeveloperSupport/);
  assert.match(builder, /Hỗ trợ người làm app/);
  assert.match(builder, /data-client-developer-support="read-only-v1"/);
  assert.match(bauman, /if \(!access \|\| access\.status !== "approved"\)/);
  assert.match(price, /if \(!access \|\| access\.status !== "approved"\)/);
});
test("builder button has real contextual diagnostics and safe, manual handoff", () => {
  assert.match(builder, /aria-expanded=\{expanded\}/);
  assert.match(builder, /aria-controls=\{panelId\}/);
  assert.match(builder, /event\.key !== "Escape"/);
  assert.match(builder, /triggerRef\.current\?\.focus\(\)/);
  assert.match(builder, /navigator\.clipboard\?\.writeText/);
  assert.match(builder, /<textarea[^>]*readOnly/);
  assert.match(builder, /tools\/contract-diagnostics/);
  assert.match(builder, /UNVERIFIED/);
  assert.match(builder, /NOT_GRANTED_BY_THIS_REPORT/);
  assert.match(css, /\.developerSupportPanel\[hidden\]/);
  assert.match(css, /:focus-visible/);
});
test("presentation-only builder support cannot bypass production or collect secrets", () => {
  assert.doesNotMatch(builder, /fetch\s*\(|operationsAction|secureApi|manage-client-device|localStorage|sessionStorage|document\.cookie|setInterval/);
  assert.doesNotMatch(builder, /deviceCode|accessToken|bearer|apiKey|user\.email/);
  assert.doesNotMatch(builder, /git push|mergePull|deployProduction|approved=true/);
  assert.match(builder, /Chưa kết nối AI sửa mã/);
});
