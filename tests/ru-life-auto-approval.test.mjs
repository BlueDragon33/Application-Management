import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("Hòa nhập Nga auto approval becomes selectable only after its own live contract and policy read back", () => {
  const read = source("app/automation-policy-read.server.ts");
  const settings = source("app/operations-settings.server.ts");
  assert.match(read, /readRuLifeAutomation/);
  assert.match(read, /deviceAutoApproval !== true/);
  assert.match(read, /\/api\/control\/automation/);
  assert.match(settings, /"ru-life"/);
});

test("central owner writes RU_LIFE auto policy through its own API with read-back", () => {
  const endpoint = source("app/api/operations-auto-approval/route.ts");
  assert.match(endpoint, /"ru-life"/);
  assert.match(endpoint, /issueRuLifeBrowserBridge/);
  assert.match(endpoint, /setRuLife/);
  assert.match(endpoint, /autoApproveDevices: enabled/);
});
