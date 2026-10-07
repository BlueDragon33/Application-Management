import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("Universal Contract starter publishes automation as disabled-by-default capability", () => {
  const profiles = source("app/contract-category-profiles.ts");
  for (const key of [
    "deviceAutoApproval",
    "deviceAutoBlockPending",
    "automationIdempotentCommands",
    "automationOptimisticConcurrency",
  ]) assert.match(profiles, new RegExp(`"${key}"`));
  assert.match(profiles, /automation: "\/api\/control\/automation"/);
  assert.match(profiles, /Object\.fromEntries\(universalContractCapabilityKeys\.map\(\(key\) => \[key, false\]\)\)/);
});

test("Universal automation read failure is isolated from the rest of the app contract", () => {
  const contract = source("app/open-contract.server.ts");
  assert.match(contract, /let automation: UniversalAutomationPolicy \| null = null/);
  assert.match(contract, /let automationError: string \| undefined/);
  assert.match(contract, /automation = automationPolicyFromPayload/);
  assert.match(contract, /automationError = error instanceof Error/);
  assert.match(contract, /automation,/);
  assert.match(contract, /automation: null/);
});

test("Universal automation mutation requires dedicated idempotency and concurrency capabilities", () => {
  const contract = source("app/open-contract.server.ts");
  const start = contract.indexOf("export async function executeUniversalAutomationCommand");
  const end = contract.indexOf("export async function executeUniversalDeviceCommand", start);
  assert.ok(start >= 0 && end > start);
  const block = contract.slice(start, end);
  assert.match(block, /actor\.role !== "owner"/);
  assert.match(block, /automationIdempotentCommands/);
  assert.match(block, /automationOptimisticConcurrency/);
  assert.match(block, /operation: "set-device-automation"/);
  assert.match(block, /expected: input\.expected/);
  assert.match(block, /desired: input\.desired/);
  assert.match(block, /automationPolicyFromPayload/);
  assert.match(block, /AUTOMATION_READBACK_MISMATCH_/);
});

test("generic automation never absorbs Boi free-paid domain semantics", () => {
  const endpoint = source("app/api/operations-auto-approval/route.ts");
  assert.match(endpoint, /genericReady = appId !== "boi-ech"/);
  assert.match(endpoint, /Bơi ếch keeps its domain-specific Free\/Paid policy/);
  assert.match(endpoint, /await setBoi\(actor, desired, defaultAccessDays, defaultDeviceLimit\)/);
});
