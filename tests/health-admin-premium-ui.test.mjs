import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const css = fs.readFileSync("app/apps/health-care/health-care-admin.module.css", "utf8");
const ui = fs.readFileSync("app/apps/health-care/health-care-admin.tsx", "utf8");

test("Health admin matches the dark teal client-control visual system", () => {
  for (const token of [
    "grid-template-columns:332px minmax(0,1fr)",
    "linear-gradient(135deg,#032027",
    "--mint:#52ead5",
    "--cyan:#38c8ee",
    "--amber:#f5ba38",
    "--green:#41d58a",
    "--red:#ff5d72",
    ".sidebar nav button[data-active=true]",
    "box-shadow:inset 4px 0 0 var(--mint)",
    ".metrics article:nth-child(1)::before",
    ".metrics article:nth-child(2)::before",
    ".metrics article:nth-child(3)::before",
    ".metrics article:nth-child(4)::before",
    ".toolbar button[data-active=true]",
    ".empty::before",
    "@media(max-width:860px)",
    "@media(max-width:560px)",
    "@media(prefers-reduced-motion:reduce)",
  ]) assert.ok(css.includes(token), `missing premium UI token: ${token}`);
});

test("Health admin keeps real management behavior and client boundary", () => {
  for (const token of [
    'connectHealthCareAdmin',
    'upstreamJson<HealthStatus>',
    '"/api/control/devices"',
    '"/api/control/sessions"',
    '"/api/control/audit"',
    '"/api/control/health-content"',
    'Health_Care tự sở hữu runtime, D1, thiết bị SK, session và audit',
    'Health data in control-plane:',
  ]) assert.ok(ui.includes(token), `missing Health control boundary token: ${token}`);

  assert.equal(/<iframe\b/i.test(ui), false, "Health admin must not iframe the independent client");
  assert.equal(/boi-ech\.dinhnam3391|suc-khoe-tre\.boiech-ai\.workers\.dev/.test(ui), false, "Health admin must not hard-code legacy client runtimes");
});
