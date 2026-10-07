import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = fs.readFileSync(new URL("../app/open-contract.server.ts", import.meta.url), "utf8");

test("contract discovery probes candidate paths concurrently while preserving priority", () => {
  const start = source.indexOf("async function discoverContract");
  const end = source.indexOf("function deviceType", start);
  const block = source.slice(start, end);

  assert.match(block, /const attempts = await Promise\.all\(candidates\.map/);
  assert.match(block, /sort\(\(left, right\) => left\.index - right\.index\)/);
  assert.doesNotMatch(block, /for \(const candidate of candidates\)/);
});

test("device and automation reads run concurrently after manifest discovery", () => {
  const start = source.indexOf("export async function probeManagedCatalogEntry");
  const end = source.indexOf("export async function probeDynamicManagedApplications", start);
  const block = source.slice(start, end);

  assert.match(block, /const deviceRead =/);
  assert.match(block, /const automationRead =/);
  assert.match(block, /await Promise\.all\(\[deviceRead, automationRead\]\)/);
});
