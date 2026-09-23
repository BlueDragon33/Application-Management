import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

function read(path) {
  return fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("Boi bridge rejects stale published runtimes before issuing an admin token", () => {
  const server = read("app/boi-ech.server.ts");
  assert.match(server, /\/api\/control\/runtime/);
  assert.match(server, /applicationId: "boi-ech"/);
  assert.match(server, /repository: "BlueDragon33\/BOIECH_AI"/);
  assert.match(server, /controlContract: "application-management"/);
  assert.match(server, /controlGeneration: 2/);
  assert.match(server, /sourceTrack: "main"/);
  assert.match(server, /BOI_ECH_STALE_PUBLISH/);
  assert.match(server, /await verifyBoiRuntimeIdentity\(origin\.baseUrl\)/);
  assert.match(server, /Application Management đã ngừng quản trị bản này/);
});

test("Boi local/hybrid discovery probes runtime identity rather than an old operational endpoint", () => {
  const origin = read("app/client-origin.server.ts");
  const boiStart = origin.indexOf('"boi-ech": {');
  const priceStart = origin.indexOf('"price-report-control": {', boiStart);
  const boiBlock = origin.slice(boiStart, priceStart);
  assert.match(boiBlock, /probePath: "\/api\/control\/runtime"/);
  assert.doesNotMatch(boiBlock, /overview\?activityDays=0/);
});

test("local startup and smoke require the current Boi runtime identity endpoint", () => {
  for (const path of ["scripts/run-local-system.mjs", "scripts/local-offline-smoke.mjs"]) {
    const source = read(path);
    assert.match(source, /http:\/\/127\.0\.0\.1:3004\/api\/control\/runtime/);
    assert.doesNotMatch(source, /http:\/\/127\.0\.0\.1:3004\/api\/control\/overview\?activityDays=0/);
  }
});

test("Boi operational data is still read only after the runtime gate passes", () => {
  const operations = read("app/api/operations/route.ts");
  assert.match(operations, /const bridge = await issueBoiBrowserBridge\(actor\.email, actor\.role\)/);
  assert.match(operations, /bridgeJson\(bridge, "\/api\/control\/overview\?activityDays=0"\)/);
});
