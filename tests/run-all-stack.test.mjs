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
  assert.match(runAll, /GROWUP_CONTROL_PORT = 3007/);
  assert.match(runAll, /GROWUP_BASE_URL: GROWUP_ORIGIN/);
  assert.match(runAll, /GROWUP_CONTROL_LOCAL_BASE_URL: GROWUP_CONTROL_ORIGIN/);
  assert.match(runAll, /GROWUP_CONTROL_SERVICE_SECRET: growUpSecret/);
  assert.match(runAll, /control-service["'], ["']local-control\.mjs/);
  assert.match(runAll, /run-local-system\.mjs/);
  assert.match(runAll, /control["'], ["']application-management\.contract\.json/);
});

test("run all validates GrowUP runtime and control service before starting the central control plane", () => {
  assert.match(runAll, /growup-mychildren/);
  assert.match(runAll, /BlueDragon33\/GrowUP_MyChildren/);
  assert.match(runAll, /verifyGrowUpContract/);
  assert.match(runAll, /GROWUP_CONTROL_ORIGIN.*health/);
  assert.match(runAll, /local-device-gateway\.js/);
  assert.match(runAll, /randomBytes\(48\)/);
});

test("run all tears down GrowUP processes when startup validation fails", () => {
  assert.match(runAll, /try \{[\s\S]*await waitFor\(`\$\{GROWUP_CONTROL_ORIGIN\}\/health`\)[\s\S]*await verifyGrowUpContract\(\)[\s\S]*\} catch \(error\) \{\s*close\(\);\s*throw error;\s*\}/);
  assert.match(runAll, /kill\(controlChild, signal\)/);
  assert.match(runAll, /growUpServer\?\.close/);
});
