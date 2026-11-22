import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const harnessPath = path.join(here, "..", "scripts", "r02-windows-instrumented-qa.mjs");
const source = fs.readFileSync(harnessPath, "utf8");

test("R0.2 Windows harness parses as an ESM source file without executing its Windows actions", () => {
  const result = spawnSync(process.execPath, ["--check", harnessPath], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr || result.stdout);
});
test("R0.2 has no branch mutation, Production action, or self-certified G05", () => {
  assert.match(source, /G05_UNVERIFIED/);
  assert.match(source, /MEASURED_NOT_ACCEPTED/);
  assert.doesNotMatch(source, /git\(\s*\[\s*"push"/);
  assert.doesNotMatch(source, /--remote/);
  assert.doesNotMatch(source, /DEPLOY_PRODUCTION/);
  assert.doesNotMatch(source, /R02_PASS/);
});
test("R0.2 uses pinned main/candidate revisions, owned preflight and independent fixture matrix", () => {
  assert.match(source, /const MAIN = "89a89ce2d3d8ed634ee9562c52744a99223a2b2a"/);
  assert.match(source, /const CANDIDATE = "92f7fbf6e3b1664d2431694fc5aeaef5b27df5c6"/);
  assert.ok(source.indexOf("await preflight();") < source.indexOf("checkLive();"));
  assert.match(source, /\[10, 50, 200\]/);
  assert.match(source, /1440, height: 900/);
  assert.match(source, /800, height: 900/);
  assert.match(source, /390, height: 844/);
  assert.match(source, /D1_CATALOG_LIVE_READBACK_COUNT_MISMATCH/);
  assert.match(source, /QA_LISTENER_PID_NOT_OWNED/);
});
test("R0.2 reuses one fresh remote attestation and never performs redundant Git network probes", () => {
  assert.match(source, /R02_ATTESTED_AT/);
  assert.match(source, /R02_ATTEST_MAIN/);
  assert.match(source, /R02_ATTEST_PR414/);
  assert.match(source, /R02_ATTEST_PR417/);
  assert.match(source, /R02_REMOTE_ATTESTATION_MISSING_OR_EXPIRED/);
  assert.match(source, /PR414_HARNESS_CHANGED_STOP/);
  assert.match(source, /R02_SOURCE_REMOTE_NOT_CANONICAL/);
  assert.doesNotMatch(source, /git\(\["ls-remote"/);
  assert.doesNotMatch(source, /git\(\["fetch"/);
});
test("R0.2 owns and cleans only its session; retains evidence on failures", () => {
  assert.match(source, /QA_OWNERSHIP\.json/);
  assert.match(source, /"_r02_reports"/);
  assert.match(source, /"worktree", "remove", "--force", "--", folder/);
  assert.match(source, /R02_EVIDENCE=/);
  assert.match(source, /QA_CLEANUP_INCOMPLETE_USE_OWNERSHIP_MARKER/);
  assert.match(source, /reactCommits: "UNVERIFIED_NOT_INSTRUMENTED"/);
});
