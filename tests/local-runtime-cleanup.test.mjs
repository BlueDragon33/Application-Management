import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

function read(path) {
  return fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("RUN_LOCAL_SYSTEM cleans stale local runtimes before launching", () => {
  const bat = read("RUN_LOCAL_SYSTEM.bat");
  const cleanup = bat.indexOf("cleanup-local-runtime.mjs");
  const launch = bat.indexOf("run-local-offline-v2.mjs");
  assert.ok(cleanup >= 0, "cleanup hook is missing");
  assert.ok(launch > cleanup, "cleanup must run before local bootstrap");
});

test("cleanup only auto-stops listeners recognized as BaumanWeb stack", () => {
  const cleanup = read("scripts/cleanup-local-runtime.mjs");
  assert.match(cleanup, /belongsToLocalStack/);
  assert.match(cleanup, /application-management/);
  assert.match(cleanup, /boi-ech/);
  assert.match(cleanup, /bauman-master-ai-system/);
  assert.match(cleanup, /Không tự dừng tiến trình không thuộc BaumanWeb/);
});

test("cleanup covers all reserved local control-plane ports", () => {
  const cleanup = read("scripts/cleanup-local-runtime.mjs");
  for (const port of [3000, 3003, 3004, 3005]) {
    assert.match(cleanup, new RegExp(String(port)));
  }
});
