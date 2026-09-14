import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

function source(path) {
  return fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("GrowUP control origin and secret are exposed to the local Cloudflare runtime", () => {
  const vite = source("vite.config.ts");
  const runAll = source("scripts/run-all.mjs");

  assert.match(vite, /"GROWUP_BASE_URL"/);
  assert.match(vite, /"GROWUP_CONTROL_BASE_URL"/);
  assert.match(vite, /"GROWUP_CONTROL_LOCAL_BASE_URL"/);
  assert.match(vite, /"GROWUP_CONTROL_SERVICE_SECRET"/);

  assert.match(runAll, /GROWUP_CONTROL_LOCAL_BASE_URL: GROWUP_CONTROL_ORIGIN/);
  assert.match(runAll, /GROWUP_CONTROL_SERVICE_SECRET: growUpSecret/);
});
