import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = fs.readFileSync(new URL("../app/management-dashboard-v2.tsx", import.meta.url), "utf8");

test("dashboard owns synchronous ref locks for repeat-click protection", () => {
  assert.match(source, /actionLocksRef = useRef<Set<string>>\(new Set\(\)\)/);
  assert.match(source, /function acquireActionLock\(key: string\)/);
  assert.match(source, /if \(actionLocksRef\.current\.has\(key\)\) return false/);
  assert.match(source, /function releaseActionLock\(key: string\)/);
});

test("device, bulk, web, notification and control mutations acquire ref locks before async work", () => {
  const expected = [
    /const actionKey = `device:\$\{device\.appId\}:\$\{device\.deviceId\}`;/,
    /const actionKey = "bulk-pending";/,
    /const actionKey = `web:\$\{appId\}`;/,
    /const actionKey = "clear-notifications";/,
    /const actionKey = `control:\$\{device\.deviceId\}`;/,
  ];
  for (const pattern of expected) assert.match(source, pattern);
  assert.ok((source.match(/if \(!acquireActionLock\(actionKey\)\) return;/g) ?? []).length >= 5);
  assert.ok((source.match(/releaseActionLock\(actionKey\)/g) ?? []).length >= 5);
});
