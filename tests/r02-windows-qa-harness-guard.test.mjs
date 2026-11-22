import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const harnessPath = path.join(here, "..", "scripts", "r02-windows-instrumented-qa.mjs");
const source = fs.readFileSync(harnessPath, "utf8");
const launcher = fs.readFileSync(path.join(here, "..", "scripts", "r02-windows-qa-package.ps1"), "utf8");

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
  assert.match(source, /UNVERIFIED_DEVTOOLS_HOOK_UNAVAILABLE/);
});

test("R0.2 single package is bounded, pinned, fail-closed and self-reports", () => {
  assert.match(launcher, /ExpectedBundleSha/);
  assert.match(launcher, /PR414_BUNDLE_SHA_CHANGED_STOP/);
  assert.match(launcher, /MAIN_HEAD_CHANGED_STOP/);
  assert.match(launcher, /PR417_HEAD_CHANGED_STOP/);
  assert.match(launcher, /LIVE_SHA_ATTESTATION_ONCE/);
  assert.match(launcher, /-Tries 3/);
  assert.match(launcher, /FETCH_MISSING_PINNED_COMMITS/);
  assert.match(launcher, /R02_PACKAGE_SUMMARY=/);
  assert.match(launcher, /R02_PACKAGE_ZIP=/);
  assert.match(launcher, /Compress-Archive/);
  assert.match(launcher, /RUNNER_EVIDENCE_OUTSIDE_QA_ROOT/);
  assert.match(launcher, /R02_PACKAGE_RESULT=/);
  assert.match(launcher, /G05_UNVERIFIED/);
  assert.doesNotMatch(launcher, /gh (?:workflow|pr merge|api -X)/);
  assert.doesNotMatch(launcher, /git.exe.*(?:push|reset --hard)/);
  assert.doesNotMatch(launcher, /NODE_TLS_REJECT_UNAUTHORIZED|GIT_SSL_NO_VERIFY/);
});
test("R0.2 runner captures root-cause logs at failing npm stage without running extra interactive probes", () => {
  assert.match(source, /R02_STAGE=/);
  assert.match(source, /FULL_LOG=/);
  assert.match(source, /npmDiagnostics/);
  assert.match(source, /recoveredFailures/);
  assert.match(source, /_npm_cache/);
  assert.match(source, /npm-debug-/);
  assert.match(source, /preserveNpmDebug/);
  assert.match(source, /ONE_BOUNDED_NPM_RETRY/);
  assert.match(source, /NPM_CI_/);
  assert.match(source, /command-.*padStart/);
  assert.match(source, /(?:EPERM|EACCES)/);
});


// CI runs on Linux: reject the exact multiline-quote corruption that swallowed
// the catch/finally block. Native Windows PowerShell parsing remains mandatory.
function assertPowerShellLexicalClosure(code) {
  const brackets = new Map([["(", ")"], ["{", "}"], ["[", "]"]]);
  const stack = [];
  let quote = null;
  let comment = false;
  for (let i = 0; i < code.length; i++) {
    const c = code[i];
    const next = code[i + 1];
    if (comment) {
      if (c === "\n") comment = false;
      continue;
    }
    if (quote === "'") {
      if (c === "'") {
        if (next === "'") i += 1;
        else quote = null;
      }
      continue;
    }
    if (quote === '"') {
      if (c.charCodeAt(0) === 96) { i += 1; continue; }
      if (c === '"') {
        if (next === '"') i += 1;
        else quote = null;
      }
      continue;
    }
    if (c === "#") { comment = true; continue; }
    if (c === "'" || c === '"') { quote = c; continue; }
    if (c.charCodeAt(0) === 96) { i += 1; continue; }
    if (brackets.has(c)) {
      stack.push({ opener: c, offset: i });
      continue;
    }
    if ([")", "}", "]"].includes(c)) {
      const previous = stack.pop();
      assert.ok(previous && brackets.get(previous.opener) === c,
        "PowerShell unmatched bracket " + c + " at offset " + i);
    }
  }
  assert.equal(quote, null, "Unterminated PowerShell quoted string");
  assert.equal(stack.length, 0, "PowerShell unclosed brackets: " + JSON.stringify(stack.slice(-3)));
}
test("R0.2 PowerShell launcher closes quoted strings and braces through final result", () => {
  assertPowerShellLexicalClosure(launcher);
  assert.equal((launcher.match(/R02_PACKAGE_RESULT=/g) || []).length, 1, "Duplicate package result");
  assert.equal((launcher.match(/R02_EVIDENCE=/g) || []).length, 1, "Broken or duplicate evidence capture");
});
test("R0.2 guard rejects original truncated regex and duplicated tail", () => {
  const truncated = launcher.replace(
    "if ($message -match '^R02_EVIDENCE=(.+\\.json)$')",
    "if ($message -match '^R02_EVIDENCE=(.+\\.json)"
  );
  assert.notEqual(truncated, launcher, "Broken string fixture did not match");
  assert.throws(() => assertPowerShellLexicalClosure(truncated));
  assert.throws(() => assertPowerShellLexicalClosure(launcher + ")\n"));
});

test("R0.2 Windows package displays stage progress and bounded heartbeat instead of buffering all output", () => {
  assert.match(launcher, /Start-Process -FilePath \$nodeExecutable/);
  assert.match(launcher, /runner-stdout\.log/);
  assert.match(launcher, /runner-stderr\.log/);
  assert.match(launcher, /R02_PACKAGE_HEARTBEAT=/);
  assert.match(launcher, /R02_STAGE=/);
  assert.match(launcher, /R02_RUNNER_FAILED_STAGE=/);
  assert.doesNotMatch(launcher, /\$runnerLines\s*=\s*@\(& node\.exe/);
  assertPowerShellLexicalClosure(launcher);
});

test("R0.2 focused runner uses only proven 50 mobile and 200 three-viewport cohorts", () => {
  assert.match(source, /R02_FOCUSED/);
  assert.match(source, /FOCUSED \? \[50, 200\] : \[10, 50, 200\]/);
  assert.match(source, /FOCUSED && count === 50/);
  assert.match(source, /FOCUSED \? 5 : 3/);
  assert.match(source, /apiNetworkMs/);
  assert.match(source, /response\.request\(\)\.timing\(\)/);
  assert.match(source, /visualPaintReadyMs/);
  assert.match(source, /UI_SYNTHETIC_CARD_COUNT_NOT_RENDERED/);
  assert.match(source, /bootstrapReadyMs: readyMs/);
  assert.match(source, /browserRendererTaskStartupMs/);
  assert.match(source, /serverMainPidCpuSecondsDelta/);
  assert.match(source, /processCpuTotal: "UNVERIFIED_NOT_CAPTURED"/);
  assert.match(source, /BROWSER_FILTER_INPUT_TO_TWO_RAF/);
  assert.match(source, /UNVERIFIED_INPUT_PROBE_FAILED/);
  assert.match(source, /UNVERIFIED_COMPOSITED_BACKGROUND/);
  assert.match(source, /UNVERIFIED_DEVTOOLS_HOOK_UNAVAILABLE/);
  assert.match(launcher, /\[switch\]\$Focused/);
  assert.match(launcher, /\$env:R02_FOCUSED = '1'/);
  assert.match(launcher, /'R02_FOCUSED'/);
});
