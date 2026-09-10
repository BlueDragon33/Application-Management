import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const css = fs.readFileSync("app/apps/health-care/health-care-admin-pixel-match.module.css", "utf8");
const page = fs.readFileSync("app/apps/health-care/page.tsx", "utf8");

test("Health admin applies the approved reference-match layer", () => {
  for (const token of [
    "grid-template-columns:338px minmax(0,1fr)!important",
    "min-height:170px!important",
    "Vì sức khỏe\\A     cộng đồng tốt hơn",
    "font-size:45px!important",
    "min-width:116px!important",
    "grid-template-columns:78px 1fr!important",
    "article:nth-child(1)::before",
    "article:nth-child(2)::before",
    "article:nth-child(3)::before",
    "article:nth-child(4)::before",
    "min-height:78px!important",
    "min-width:420px!important",
    "min-height:92px!important",
    "border:1px dashed",
    "min-height:42px!important",
    "@media(max-height:850px)",
    "@media(prefers-reduced-motion:reduce)",
  ]) assert.ok(css.includes(token), `missing reference-match token: ${token}`);
});

test("Health admin page scopes the visual override without changing client control logic", () => {
  assert.ok(page.includes('import reference from "./health-care-admin-pixel-match.module.css"'));
  assert.ok(page.includes("className={reference.scope}"));
  assert.ok(page.includes("<HealthCareAdmin"));
  assert.equal(/iframe/i.test(page), false);
});
