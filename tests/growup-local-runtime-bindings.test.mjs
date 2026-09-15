import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

function source(path) {
  return fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("GrowUP control origin and secret are exposed to the local Cloudflare runtime", () => {
  const vite = source("vite.config.ts");
  const runAll = source("scripts/run-all.mjs");
  const devVars = source(".dev.vars.example");

  assert.match(vite, /"GROWUP_BASE_URL"/);
  assert.match(vite, /"GROWUP_CONTROL_BASE_URL"/);
  assert.match(vite, /"GROWUP_CONTROL_LOCAL_BASE_URL"/);
  assert.match(vite, /"GROWUP_CONTROL_SERVICE_SECRET"/);

  assert.match(runAll, /GROWUP_CONTROL_LOCAL_BASE_URL: GROWUP_CONTROL_ORIGIN/);
  assert.match(runAll, /GROWUP_CONTROL_SERVICE_SECRET: growUpSecret/);

  assert.match(devVars, /GROWUP_BASE_URL=http:\/\/127\.0\.0\.1:3006/);
  assert.match(devVars, /GROWUP_CONTROL_LOCAL_BASE_URL=http:\/\/127\.0\.0\.1:3007/);
  assert.match(devVars, /GROWUP_CONTROL_SERVICE_SECRET=local-only-growup-control-secret-change-me-0001/);
});
