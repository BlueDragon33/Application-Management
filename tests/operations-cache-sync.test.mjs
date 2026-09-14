import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

function source(path) {
  return fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("quick sync uses the shared operations cache invalidation helper", () => {
  const quick = source("app/quick-management-actions.tsx");
  const client = source("app/admin-device-client.ts");

  assert.match(quick, /import \{ clearCachedOperations \} from "\.\/admin-device-client"/);
  assert.match(quick, /function syncAll\(\) \{\s*clearCachedOperations\(\);\s*window\.location\.reload\(\);\s*\}/s);
  assert.doesNotMatch(quick, /sessionStorage|application-management:operations:/);

  assert.match(client, /const operationsCacheKey = "application-management:operations:v1"/);
  assert.match(client, /export function clearCachedOperations\(\)/);
  assert.match(client, /sessionStorage\.removeItem\(operationsCacheKey\)/);
});
