import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

function source(path) {
  return fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("local offline smoke covers all five managed clients including GrowUP", () => {
  const smoke = source("scripts/local-offline-smoke.mjs");
  const workflow = source(".github/workflows/local-offline-smoke-ci.yml");

  assert.match(smoke, /launcherPath = join\(root, "scripts", "run-all\.mjs"\)/);
  assert.match(smoke, /GrowUP Runtime.*127\.0\.0\.1:3006\/control\/application-management\.contract\.json/s);
  assert.match(smoke, /GrowUP Control.*127\.0\.0\.1:3007\/health/s);
  assert.match(smoke, /3000–3007/);

  assert.match(workflow, /repository: BlueDragon33\/GrowUP_MyChildren/);
  assert.match(workflow, /ref: integration\/application-management-local-control/);
  assert.match(workflow, /path: GrowUP_MyChildren/);
  assert.match(workflow, /scripts\/run-all\.mjs/);
  for (const repository of ["Health_Care", "RU_LIFE", "Bauman-master-ai-system", "BOIECH_AI", "GrowUP_MyChildren"]) {
    assert.match(workflow, new RegExp(repository.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});
