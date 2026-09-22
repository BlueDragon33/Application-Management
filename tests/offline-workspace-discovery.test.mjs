import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = fs.readFileSync(new URL("../scripts/run-local-offline-v2.mjs", import.meta.url), "utf8");

test("offline runner requires the canonical BaumanWeb workspace with all real managed clients", () => {
  assert.match(source, /function ensureCanonicalCentralWorkspace/);
  assert.match(source, /workspaceName === "baumanweb"/);
  for (const token of ["Health_Care", "RU_LIFE", "Bauman-master-ai-system", "BOIECH_AI"]) {
    assert.match(source, new RegExp(token));
  }
});

test("an explicit apps-root remains authoritative", () => {
  assert.match(source, /explicitAppsRoot: false/);
  assert.match(source, /options\.explicitAppsRoot = true/);
  assert.match(source, /if \(explicitRoot\) return requestedRoot/);
});

test("resolved workspace is forwarded unchanged to the full local launcher", () => {
  assert.match(source, /"--apps-root", options\.appsRoot/);
  assert.match(source, /Workspace chuẩn:/);
});
