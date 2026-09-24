import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(resolve("scripts/run-all.mjs"), "utf8");

test("run:all fails closed when any addon runtime exits unexpectedly", () => {
  assert.match(source, /const addonNames = new Map\(/);
  assert.match(source, /if \(!closing\) \{/);
  assert.match(source, /dừng ngoài dự kiến/);
  assert.doesNotMatch(source, /!closing && code !== 0/);
  assert.match(source, /\[growUpControl, "GrowUP Control"\]/);
  assert.match(source, /\[priceControl, "PriceReport Control"\]/);
  assert.match(source, /\[priceRuntime, "PriceReport Runtime"\]/);
});


test("run:all rejects malformed static runtime URLs instead of crashing", () => {
  assert.match(source, /try \{\s*raw = decodeURIComponent/);
  assert.match(source, /catch \{\s*return null;\s*\}/);
});


test("run:all only declares controlled readiness on successful HTTP responses", () => {
  assert.match(source, /if \(response\.ok\) return response;/);
  assert.doesNotMatch(source, /if \(response\.status < 500\) return response;/);
});


test("run:all preserves a prior failure exit code when core shutdown follows", () => {
  assert.match(source, /const pendingExitCode = typeof process\.exitCode === "number" \? process\.exitCode : 0;/);
  assert.match(source, /process\.exit\(pendingExitCode !== 0 \? pendingExitCode : \(code \?\? 0\)\);/);
  assert.doesNotMatch(source, /process\.exit\(code \?\? 0\);/);
});


test("run:all starts and closes the NC03 static runtime with the rest of the stack", () => {
  assert.match(source, /const NC03_PORT = 3010;/);
  assert.match(source, /nc03Server = await startStaticServer\(join\(nc03Root, "dist"\), NC03_PORT\);/);
  assert.match(source, /nc03Server\?\.close/);
  assert.match(source, /NC03 Control Center : http:\/\/127\.0\.0\.1:3010/);
});
