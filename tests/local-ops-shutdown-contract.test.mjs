import assert from "node:assert/strict";
import test from "node:test";
import { REQUIRED_SHUTDOWN_UNITS, SHUTDOWN_PROTOCOL, unsupportedFullStack,
  validateStopPreflight } from "../scripts/local-ops-shutdown-contract.mjs";
import { readFileSync } from "node:fs";

function verified() {
  return { protocol: SHUTDOWN_PROTOCOL, supported: true,
    units: REQUIRED_SHUTDOWN_UNITS.map(id => ({
      id, supported: true, ownedProcess: true, d1Drained: true, gracefulExitSupported: true,
    })) };
}
test("all managed units require process ownership, D1 drain and graceful exit ACK", () => {
  const valid = verified();
  assert.equal(REQUIRED_SHUTDOWN_UNITS.length, 13);
  assert.equal(validateStopPreflight(valid), true);
  assert.equal(validateStopPreflight({ ...valid, supported: false }), false);
  assert.equal(validateStopPreflight({ ...valid, protocol: "legacy" }), false);
  assert.equal(validateStopPreflight({ ...valid, units: valid.units.slice(1) }), false);
  assert.equal(validateStopPreflight({ ...valid, units: [...valid.units.slice(1), valid.units[1]] }), false);
  for (const property of ["ownedProcess", "d1Drained", "gracefulExitSupported", "supported"]) {
    const units = valid.units.map((x, i) => i === 4 ? { ...x, [property]: false } : x);
    assert.equal(validateStopPreflight({ ...valid, units }), false, "denied missing " + property);
  }
});

test("production full stack explicitly reports unsupported; no auto kill or fake D1 flush", () => {
  const unsupported = unsupportedFullStack();
  assert.equal(validateStopPreflight(unsupported), false);
  assert.deepEqual(unsupported.missingUnits, REQUIRED_SHUTDOWN_UNITS);
  for (const file of ["scripts/run-all.mjs", "scripts/run-local-system.mjs"]) {
    const code = readFileSync(new URL("../" + file, import.meta.url), "utf8");
    assert.match(code, /unsupportedFullStack\(\)/);
  }
  const daemon = readFileSync(new URL("../scripts/local-ops-daemon.mjs", import.meta.url), "utf8");
  assert.match(daemon, /requestChildReply/);
  assert.match(daemon, /validateStopPreflight/);
  assert.doesNotMatch(daemon, /taskkill\.exe|process\.kill\(|\bexec\s*\(\s*["']taskkill/i);
});

test("no restart-auto without bearer token on local-only helper", async () => {
  const { createLocalOpsServer } = await import("../scripts/local-ops-daemon.mjs");
  const server = createLocalOpsServer();
  await new Promise(r => server.listen(0, "127.0.0.1", r));
  try {
    const base = "http://127.0.0.1:" + server.address().port;
    const wrong = await fetch(base + "/restart-auto", { method: "POST",
      headers: { origin: "http://127.0.0.1:3000", authorization: "Bearer invalid" } });
    assert.equal(wrong.status, 401);
    const noOrigin = await fetch(base + "/restart-auto", { method: "POST" });
    assert.equal(noOrigin.status, 403);
  } finally { await new Promise(r => server.close(r)); }
});
