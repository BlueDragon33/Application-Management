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

test("offline smoke proves authenticated operations connectivity instead of port health only", () => {
  const smoke = source("scripts/local-offline-smoke.mjs");

  assert.match(smoke, /crypto\.subtle\.generateKey/);
  assert.match(smoke, /action: "register"/);
  assert.match(smoke, /action: "challenge"/);
  assert.match(smoke, /learning-control:\$\{deviceId\}:\$\{challenge\}/);
  assert.match(smoke, /crypto\.subtle\.sign/);
  assert.match(smoke, /requestJson\(\s*"\/api\/operations"/s);
  assert.match(smoke, /summary\.connection !== "connected"/);
  for (const appId of ["boi-ech", "health-care", "ru-life", "bauman-master-ai", "growup-mychildren"]) {
    assert.match(smoke, new RegExp(`"${appId}"`));
  }
});

test("offline smoke proves the real Boi payment and access bridge is signed and readable", () => {
  const smoke = source("scripts/local-offline-smoke.mjs");

  assert.match(smoke, /async function signedControlBody/);
  assert.match(smoke, /requestJson\(\s*"\/api\/apps\/boi-ech\/access"/s);
  assert.match(smoke, /action: "bootstrap"/);
  assert.match(smoke, /boiAccess\?\.application !== "boi-ech"/);
  assert.match(smoke, /boiAccess\.counts\.total !== boiAccess\.devices\.length/);
  assert.match(smoke, /PASS Thanh toán & Quyền Bơi ếch · signed bootstrap/);
});
