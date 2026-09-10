import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const doctor = fs.readFileSync("scripts/local-system-doctor.mjs", "utf8");
const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
const bat = fs.readFileSync("CHECK_LOCAL_SYSTEM.bat", "utf8");

test("local doctor is read-only and cannot deploy or migrate data", () => {
  assert.doesNotMatch(doctor, /writeFile|appendFile|unlink|rmSync|mkdirSync/);
  assert.doesNotMatch(doctor, /\bexecSync\b|\bexecFile\b|\bspawn\(/);
  assert.equal((doctor.match(/spawnSync\(/g) ?? []).length, 1, "doctor may only spawn node --check");
  assert.match(doctor, /spawnSync\(process\.execPath, \["--check", path\]/);
  assert.ok(doctor.includes(`!launcher.includes('"--remote"')`), "doctor must inspect launcher for forbidden remote D1 usage");
  assert.match(doctor, /Doctor chỉ đọc\/kiểm tra/);
});

test("local doctor checks all independent runtimes and standard ports", () => {
  for (const token of ["Application Management", "Health_Care", "RU_LIFE", "Bauman-master-ai-system", "BOIECH_AI"]) {
    assert.ok(doctor.includes(token), `missing runtime token: ${token}`);
  }
  for (const port of [3000, 3001, 3002, 3003, 3004, 3005]) assert.ok(doctor.includes(String(port)), `missing port ${port}`);
  assert.match(doctor, /client-origin\.server\.ts/);
  assert.match(doctor, /HEALTH_CONTROL_SERVICE_SECRET/);
  assert.match(doctor, /RU_LIFE_CONTROL_SERVICE_SECRET/);
  assert.match(doctor, /CONTROL_SERVICE_SECRET/);
  assert.match(doctor, /BAUMAN_APP_ORIGIN/);
  assert.match(doctor, /serve-local-runtime\.mjs/);
  assert.match(doctor, /device-access-gate\.js/);
  assert.match(doctor, /Bauman Device Gate contract/);
});

test("doctor exposes human and JSON modes with optional strict port gate", () => {
  assert.match(doctor, /--json/);
  assert.match(doctor, /--strict-ports/);
  assert.match(doctor, /JSON\.stringify/);
  assert.match(doctor, /process\.exitCode = failures\.length === 0 \? 0 : 1/);
});

test("package and Windows launcher expose doctor before full-system launch", () => {
  assert.equal(pkg.scripts["local:doctor"], "node scripts/local-system-doctor.mjs");
  assert.equal(pkg.scripts["local:doctor:strict"], "node scripts/local-system-doctor.mjs --strict-ports");
  assert.match(bat, /scripts\\local-system-doctor\.mjs --strict-ports/);
  assert.match(bat, /RUN_LOCAL_SYSTEM\.bat/);
});
