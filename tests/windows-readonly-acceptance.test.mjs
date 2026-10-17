import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";
const src=readFileSync(new URL("../scripts/windows-readonly-acceptance.ps1",import.meta.url),"utf8");
const launcher=readFileSync(new URL("../QA_BAUMANWEB_READONLY.vbs",import.meta.url),"utf8");
test("Windows QA is read-only, localhost-only, never approves D1 or merge",()=>{
  for (const s of ["Get-NetTCPConnection","git -C $Directory rev-parse HEAD",
    "GIT_OPTIONAL_LOCKS","AllowAutoRedirect = $false","UseProxy = $false",
    "D1Shutdown","BLOCKED_NOT_TESTED","NOT_GRANTED","latest.json","latest.txt"]) {
    if (s === "D1Shutdown") continue;
    assert.ok(src.includes(s),s);
  }
  assert.match(src,/d1Shutdown = 'BLOCKED_NOT_TESTED'/);
  assert.match(src,/verdict = 'BLOCKED_NEEDS_HUMAN_REVIEW'/);
  assert.match(src,/\[switch\]\$ProbeHttp/);
  assert.match(src,/if \(-not \$AllowHttp\)/);
  assert.match(src,/SKIPPED_PASSIVE_ONLY/);
  assert.doesNotMatch(launcher,/-ProbeHttp/);
  const executableLines = src.split(/\r?\n/).filter(line => !line.trimStart().startsWith("#")).join("\n");
  assert.doesNotMatch(executableLines,/Stop-Process|taskkill|Start-Process|git checkout|git fetch|git pull|git reset|git merge|wrangler|migrate|Invoke-Expression|ExecutionPolicy Bypass|New-PSSession/);
  assert.doesNotMatch(src,/Bearer |password\s*=|tokenValue|clientSecret|Get-CimInstance.*CommandLine/);
  assert.match(launcher,/-NoProfile -NonInteractive -File/);
  assert.doesNotMatch(launcher,/-ExecutionPolicy Bypass|runas|taskkill/);
});
