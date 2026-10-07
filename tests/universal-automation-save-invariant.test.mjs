import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("Universal Contract automation waits for independent readback convergence before success", () => {
  const universal = source("app/open-contract.server.ts");
  const start = universal.indexOf("export async function executeUniversalAutomationCommand");
  const end = universal.indexOf("export async function executeUniversalDeviceCommand", start);
  const block = universal.slice(start, end);

  assert.match(block, /const delays = \[0, 120, 280, 600, 1_000\] as const/);
  assert.match(block, /desiredMatches/);
  assert.match(block, /await fetchJson\(row\.origin, manifest\.endpoints\.automation, credential\)/);
  assert.match(block, /AUTOMATION_READBACK_MISMATCH_/);
  assert.match(block, /return \{ ok: true, commandReplayed: data\.replayed === true, automation: readback \}/);
});

test("auto-block follows write-response plus independent readback invariant too", () => {
  const operations = source("app/api/operations/route.ts");
  const start = operations.indexOf('if (action === "set-auto-block-pending")');
  const end = operations.indexOf('if (action === "manage-client-device")', start);
  const block = operations.slice(start, end);

  assert.match(operations, /async function waitForAutomationReadback/);
  assert.match(operations, /const delays = \[0, 120, 280, 600, 1_000\] as const/);
  assert.match(block, /bridgeCommandJson\(bridge, "\/api\/control\/automation"/);
  assert.match(block, /AUTO_BLOCK_WRITE_RESPONSE_MISMATCH/);
  assert.match(block, /waitForAutomationReadback/);
  assert.match(block, /AUTO_BLOCK_READBACK_MISMATCH/);
});

test("explicit Save has one targeted readback invariant for static and dynamic apps", () => {
  const dashboard = source("app/management-dashboard-v2.tsx");
  const start = dashboard.indexOf("async function saveAutomation");
  const end = dashboard.indexOf("async function manageControlDevice", start);
  const block = dashboard.slice(start, end);

  assert.match(block, /Promise\.allSettled/);
  assert.match(block, /const chains = new Map/);
  assert.match(block, /responseSettings/);
  assert.match(block, /taskMatchesReadback/);
  assert.match(block, /return mergedSettings/);
  assert.doesNotMatch(block, /return synced\.settings/);
  assert.doesNotMatch(block, /for \(const delay of \[180, 360, 720\]\)/);
});
