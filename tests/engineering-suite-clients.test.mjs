import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

function source(path) {
  return fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("ECAD and CAE are registered as separate level-1 engineering clients", () => {
  const registry = source("app/application-registry.ts");

  assert.match(registry, /id: "ecad-design"/);
  assert.match(registry, /repository: "BlueDragon33\/ECAD_Design"/);
  assert.match(registry, /Registry ECAD-/);
  assert.match(registry, /Không sao chép schematic\/netlist\/PCB project vào Trung tâm/);

  assert.match(registry, /id: "cae-simulation"/);
  assert.match(registry, /repository: "BlueDragon33\/CAE_Simulation"/);
  assert.match(registry, /Registry CAE-/);
  assert.match(registry, /Không sao chép study\/mesh\/solver result fields vào Trung tâm/);
});

test("ECAD and CAE foundation routes use the central approved-device workspace", () => {
  const ecad = source("app/apps/ecad-design/page.tsx");
  const cae = source("app/apps/cae-simulation/page.tsx");

  assert.match(ecad, /requireChatGPTUser\("\/apps\/ecad-design"\)/);
  assert.match(ecad, /getApplicationConfig\("ecad-design"\)/);
  assert.match(ecad, /ApplicationWorkspace/);

  assert.match(cae, /requireChatGPTUser\("\/apps\/cae-simulation"\)/);
  assert.match(cae, /getApplicationConfig\("cae-simulation"\)/);
  assert.match(cae, /ApplicationWorkspace/);
});

test("engineering suite management entries stay foundation-only and fail closed", () => {
  const registry = source("app/application-registry.ts");
  const ecadStart = registry.indexOf('id: "ecad-design"');
  const caeStart = registry.indexOf('id: "cae-simulation"');
  const growStart = registry.indexOf('id: "growup-mychildren"');
  assert.ok(ecadStart >= 0 && caeStart > ecadStart && growStart > caeStart);

  const ecad = registry.slice(ecadStart, caeStart);
  const cae = registry.slice(caeStart, growStart);

  for (const block of [ecad, cae]) {
    assert.match(block, /status: "planned"/);
    assert.match(block, /contractState: "pending"/);
    assert.doesNotMatch(block, /contractState: "connected"/);
  }

  assert.doesNotMatch(ecad, /Gerber.*control-plane.*allow/i);
  assert.doesNotMatch(cae, /result fields.*control-plane.*allow/i);
});
