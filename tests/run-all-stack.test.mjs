import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

function source(path) {
  return fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

const packageJson = JSON.parse(source("package.json"));
const runAll = source("scripts/run-all.mjs");

test("run all exposes one command for the complete managed local stack", () => {
  assert.equal(packageJson.scripts["run:all"], "node scripts/run-all.mjs");
  assert.match(runAll, /GrowUP_MyChildren/);
  assert.match(runAll, /GROWUP_PORT = 3006/);
  assert.match(runAll, /GROWUP_BASE_URL: GROWUP_ORIGIN/);
  assert.match(runAll, /run-local-system\.mjs/);
  assert.match(runAll, /control\/application-management\.contract\.json/);
});

test("run all validates GrowUP identity before starting the central control plane", () => {
  assert.match(runAll, /growup-mychildren/);
  assert.match(runAll, /BlueDragon33\/GrowUP_MyChildren/);
  assert.match(runAll, /verifyGrowUpContract/);
  assert.match(runAll, /Not found/);
});
