import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = fs.readFileSync(new URL("../app/api/operations/route.ts", import.meta.url), "utf8");

test("manage-client-device probes only the requested app contract", () => {
  const start = source.indexOf('if (action === "manage-client-device")');
  assert.ok(start >= 0);
  const block = source.slice(start, source.indexOf('if (appId === "health-care")', start));

  assert.match(block, /probeDynamicManagedApplications\(\[appId\]\)/);
  assert.doesNotMatch(block, /probeDynamicManagedApplications\(\)/);
});

test("bootstrap may still probe the complete dynamic catalog", () => {
  const start = source.indexOf("async function buildBootstrap");
  const end = source.indexOf("export async function POST", start);
  const block = source.slice(start, end);

  assert.match(block, /probeDynamicManagedApplications\(\)/);
});
