import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("P8 desktop gateway is outbound-only and P-256 challenge authenticated", () => {
  const gateway = source("app/desktop-agent-gateway.server.ts");
  const route = source("app/api/desktop-agent/route.ts");
  const worker = source("worker/index.ts");

  assert.match(gateway, /pc-manager-agent\/v1/);
  assert.match(gateway, /namedCurve: "P-256"/);
  assert.match(gateway, /crypto\.subtle\.verify/);
  assert.match(gateway, /DELETE FROM desktop_agent_challenges WHERE nonce=/);
  assert.match(route, /action === "heartbeat"/);
  assert.match(worker, /isPublicDesktopAgentRequest/);
  assert.match(worker, /url\.pathname !== "\/api\/desktop-agent"/);
});

test("P8 remote commands are a closed typed allow-list with no arbitrary execution primitive", () => {
  const gateway = source("app/desktop-agent-gateway.server.ts");

  for (const command of [
    "CHECK_UPDATE",
    "RUN_HEALTH_SCAN",
    "REFRESH_DEVICE_STATUS",
    "DISABLE_LICENSE",
  ]) {
    assert.match(gateway, new RegExp(`"${command}"`));
  }

  assert.match(gateway, /const ALLOWED_COMMANDS = new Set<DesktopAgentCommandType>/);
  assert.doesNotMatch(gateway, /child_process|exec\(|spawn\(|powershell\.exe|cmd\.exe/);
  assert.match(gateway, /AGENT_COMMAND_NOT_ALLOWED/);
});

test("P8 admin mutations stay behind central approved-device proof and owner role", () => {
  const route = source("app/api/desktop-agent-admin/route.ts");
  const gateway = source("app/desktop-agent-gateway.server.ts");

  assert.match(route, /verifyControlProof/);
  assert.match(gateway, /actor\.role !== "owner"/);
  assert.match(gateway, /OWNER_REQUIRED/);
  assert.match(gateway, /agent_command_queued/);
});

test("P8 database migration separates device identity challenges commands and audit", () => {
  const migration = source("drizzle/0014_pc_manager_desktop_agent.sql");
  assert.match(migration, /desktop_agent_devices/);
  assert.match(migration, /desktop_agent_challenges/);
  assert.match(migration, /desktop_agent_commands/);
  assert.match(migration, /desktop_agent_audit/);
  assert.match(migration, /entitlement_state/);
  assert.match(migration, /update_policy/);
});


test("registration does not claim online presence before signed heartbeat proof", () => {
  const gateway = source("app/desktop-agent-gateway.server.ts");
  const registerStart = gateway.indexOf("export async function registerDesktopAgent");
  const challengeStart = gateway.indexOf("export async function createDesktopAgentChallenge");
  const register = gateway.slice(registerStart, challengeStart);
  const heartbeatStart = gateway.indexOf("export async function heartbeatDesktopAgent");
  const ackStart = gateway.indexOf("export async function acknowledgeDesktopAgentCommand");
  const heartbeat = gateway.slice(heartbeatStart, ackStart);

  assert.doesNotMatch(register, /last_seen_at=CURRENT_TIMESTAMP/);
  assert.match(heartbeat, /last_seen_at=CURRENT_TIMESTAMP/);
  assert.match(heartbeat, /verifyAgentProof\(payload, "heartbeat"\)/);
});
