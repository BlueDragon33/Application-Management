import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = (path) =>
  fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("desktop agent gateway is outbound-only and typed", () => {
  const contract = source("app/api/desktop-agent/contract/route.ts");
  const server = source("app/desktop-agent.server.ts");

  assert.match(contract, /client-outbound-only/);
  assert.match(contract, /inboundPortRequired:\s*false/);
  assert.match(server, /CHECK_UPDATE/);
  assert.match(server, /RUN_HEALTH_SCAN/);
  assert.match(server, /REFRESH_DEVICE_STATUS/);
  assert.match(server, /DISABLE_LICENSE/);
  assert.doesNotMatch(server, /child_process|exec\(|spawn\(|powershell|cmd\.exe/i);
});

test("desktop agent proof is P-256 challenge based and one-time", () => {
  const server = source("app/desktop-agent.server.ts");

  assert.match(server, /crv !== "P-256"/);
  assert.match(server, /desktop_agent_challenges/);
  assert.match(server, /DELETE FROM desktop_agent_challenges WHERE nonce = \? AND device_id = \?/);
  assert.match(server, /ECDSA/);
  assert.match(server, /pc-manager-agent\/v1/);
});

test("desktop agent commands are approval gated and replay bounded", () => {
  const server = source("app/desktop-agent.server.ts");

  assert.match(server, /device\.status !== "approved"/);
  assert.match(server, /delivery_count < 5/);
  assert.match(server, /status IN \('queued','delivered'\)/);
  assert.match(server, /command\.status === "completed" \|\| command\.status === "failed"/);
});

test("desktop agent database schema never stores a private key", () => {
  const migration = source("drizzle/0014_desktop_agent_gateway.sql");

  assert.match(migration, /public_key_jwk/);
  assert.doesNotMatch(migration, /private_key|private_jwk|secret_key/i);
  assert.match(migration, /entitlement_state/);
  assert.match(migration, /update_policy_json/);
});
