import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("background operations refreshes are deduplicated instead of stacking on focus", () => {
  const dashboard = source("app/management-dashboard-v2.tsx");
  assert.match(dashboard, /operationsRefreshPromiseRef = useRef<Promise<OperationsBootstrap \| null> \| null>\(null\)/);
  assert.match(dashboard, /if \(!operationsRefreshPromiseRef\.current\)/);
  assert.match(dashboard, /operationsRefreshPromiseRef\.current = \(async \(\) =>/);
  assert.match(dashboard, /return await operationsRefreshPromiseRef\.current/);
  assert.match(dashboard, /operationsRefreshPromiseRef\.current = null/);
});

test("legacy adapters and Dynamic Catalog probes start in the same bootstrap phase", () => {
  const operations = source("app/api/operations/route.ts");
  const start = operations.indexOf("async function buildBootstrap");
  const end = operations.indexOf("export async function POST", start);
  const block = operations.slice(start, end);
  assert.match(block, /const \[settled, dynamicSnapshots\] = await Promise\.all\(\[/);
  assert.match(block, /Promise\.all\(loaders\.map/);
  assert.match(block, /probeDynamicManagedApplications\(\)/);
  assert.doesNotMatch(block, /const dynamicSnapshots = await probeDynamicManagedApplications\(\)/);
});
