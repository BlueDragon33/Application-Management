import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = fs.readFileSync(new URL("../scripts/run-local-offline-v2.mjs", import.meta.url), "utf8");

test("offline runner can auto-detect the BaumanWeb workspace beside a root-level central checkout", () => {
  assert.match(source, /function resolveAppsRoot/);
  assert.match(source, /join\(requestedRoot, "BaumanWeb"\)/);
  assert.match(source, /Bauman-master-ai-system/);
  assert.match(source, /BOIECH_AI/);
});

test("an explicit apps-root remains authoritative", () => {
  assert.match(source, /explicitAppsRoot: false/);
  assert.match(source, /options\.explicitAppsRoot = true/);
  assert.match(source, /if \(explicitRoot\) return requestedRoot/);
});

test("detected workspace is forwarded unchanged to the local system launcher", () => {
  assert.match(source, /"--apps-root", options\.appsRoot/);
  assert.match(source, /Workspace ứng dụng:/);
});
