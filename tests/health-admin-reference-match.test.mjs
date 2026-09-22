import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const css = fs.readFileSync("app/apps/health-care/health-care-admin.module.css", "utf8");
const page = fs.readFileSync("app/apps/health-care/page.tsx", "utf8");

test("Health admin matches the Bauman shell instead of a one-off pixel-match layer", () => {
  for (const token of [
    "BAUMAN ADMIN STANDARD OVERRIDES",
    "grid-template-columns:300px minmax(0,1fr)",
    "background:#f3f6fa",
    "background:#fff",
    "border-right:1px solid #e1e7ef",
    "box-shadow:8px 0 28px rgba(18,38,63,.04)",
    "@media(max-width:860px)",
  ]) assert.ok(css.includes(token), `missing Bauman-standard Health token: ${token}`);
});

test("Health admin page renders the client admin directly with no legacy visual wrapper", () => {
  assert.ok(page.includes("<HealthCareAdmin"));
  assert.equal(page.includes("health-care-admin-pixel-match.module.css"), false);
  assert.equal(page.includes("health-care-admin-complete.module.css"), false);
  assert.equal(/iframe/i.test(page), false);
});
