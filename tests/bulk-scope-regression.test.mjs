import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const hub = fs.readFileSync(new URL("../app/application-hub.tsx", import.meta.url), "utf8");

test("bulk-remove must not silently narrow an all-filter action to the 24 rendered rows", () => {
  const start = hub.indexOf("async function removeVisibleClientDevices");
  const end = hub.indexOf("async function saveAutoApproval", start);
  assert.ok(start >= 0 && end > start);
  const bulk = hub.slice(start, end);
  assert.doesNotMatch(bulk, /filterClientDevices\([^;]+\)\.slice\(0,\s*24\)/s);
});
