import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

const healthBridge = fs.readFileSync("app/health-care.server.ts", "utf8");
const networkRegistry = fs.readFileSync("app/client-network-registry.ts", "utf8");
const operations = fs.readFileSync("app/api/operations/route.ts", "utf8");
const registry = fs.readFileSync("app/application-registry.ts", "utf8");
const hub = fs.readFileSync("app/application-hub.tsx", "utf8");

function mustContain(source, snippets) {
  for (const snippet of snippets) assert.ok(source.includes(snippet), `Missing: ${snippet}`);
}

test("Health bridge verifies management contract v3 with idempotent device commands before issuing tickets", () => {
  mustContain(healthBridge, [
    'const TOKEN_ISSUER = "application-management"',
    'const TOKEN_AUDIENCE = "health-care-control"',
    'const TOKEN_APP = "health-care"',
    'const CONTROL_PROTOCOL = "application-management-health-control-v1"',
    'HEALTH_CONTROL_SERVICE_SECRET',
    'resolveClientOrigin("health-care")',
    'probeHealthManagementContract',
    '/api/control/contract',
    'contractVersion >= 3',
    'Number(auth.webLaunchTtlSeconds) === 60',
    'deviceCommandsTarget === "/api/control/device-commands"',
    'endpoints.automation === "/api/control/automation"',
    'webLaunchTarget === "/suc-khoe-tre"',
    'capabilities.includes("device-idempotent-commands")',
    'capabilities.includes("device-auto-approval")',
    'capabilities.includes("control-web-launch")',
    'boundary.healthDataInControlPlane === false',
    'boundary.profileDataInControlPlane === false',
    'registry.namespace === "SK-"',
  ]);
  mustContain(networkRegistry, [
    'productionEnv: "HEALTH_CARE_BASE_URL"',
    'localEnv: "HEALTH_CARE_LOCAL_BASE_URL"',
    'localDefault: "http://127.0.0.1:3001"',
  ]);
  assert.equal(/(?<!HEALTH_)CONTROL_SERVICE_SECRET/.test(healthBridge), false, "Health bridge must not fall back to the shared legacy secret");
});

test("Health remains a separate managed client and operations uses its own bridge", () => {
  mustContain(registry, [
    'id: "health-care"',
    'repository: "BlueDragon33/Health_Care"',
    'Không chứa hồ sơ sức khỏe cá nhân',
    'Không dùng API/DB Bơi ếch',
  ]);
  mustContain(operations, [
    'issueHealthBrowserBridge',
    'loadHealth',
    '"/api/control/devices"',
    'appId === "health-care"',
    'bridge.deviceCommandsTarget',
    'operation: operation === "approve" ? "approve" : "block"',
    'approvalRequiresRegistrationComplete: false',
    'remove: canManage',
  ]);
});

test("central Health device actions use commandId expectedStatus retry-safe mutation and read-back verification", () => {
  const healthStart = operations.indexOf('if (appId === "health-care")');
  const ruStart = operations.indexOf('if (appId === "ru-life")', healthStart);
  assert.ok(healthStart >= 0 && ruStart > healthStart, "Health action block boundaries must be detectable");
  const healthActionBlock = operations.slice(healthStart, ruStart);

  assert.match(healthActionBlock, /bridgeCommandJson/);
  assert.match(healthActionBlock, /actor\.role !== "publisher" && actor\.role !== "owner"/);
  assert.match(healthActionBlock, /issueHealthBrowserBridge\(actor\.email, actor\.role, actor\.deviceId\)/);
  assert.match(healthActionBlock, /const commandId = suppliedCommandId \|\| crypto\.randomUUID\(\)/);
  assert.match(healthActionBlock, /expectedStatus,/);
  assert.match(healthActionBlock, /bridge\.deviceCommandsTarget/);
  assert.match(healthActionBlock, /DEVICE_COMMAND_READBACK_MISMATCH/);
  assert.match(healthActionBlock, /verifyDeviceStatus\(bridge, "\/api\/control\/devices", deviceId, expected\)/);
  assert.match(operations, /error instanceof TypeError[\s\S]*Client phản hồi quá thời hạn/);
  assert.equal(/bridgeJson\(bridge, "\/api\/control\/devices", \{ method: "POST"/.test(healthActionBlock), false, "Health central mutation must not use legacy direct device POST");
  assert.equal(/delete-spam-device/.test(healthActionBlock), false, "Health must not inherit Boi Ech permanent delete semantics");
});

test("global auto-approval dialog can safely control Health_Care", () => {
  mustContain(operations, [
    'const AUTO_APPROVE_SUPPORTED_APP_IDS = ["boi-ech", "health-care"] as const',
    'appIds.includes("health-care")',
    '"/api/control/automation"',
    'autoApproveDevices: healthEnabled',
    'rememberAutoApproval(actor.email, "health-care", healthEnabled)',
  ]);
  assert.match(operations, /if \(actor\.role !== "owner"\).*OWNER_REQUIRED/);
  assert.match(operations, /enabledBefore\.has\("health-care"\) !== healthEnabled/);
});

test("Health direct web launch uses a purpose-scoped 60 second ticket in local or cloud transport", () => {
  mustContain(healthBridge, [
    'purpose: "control" | "web-launch"',
    'issueHealthWebLaunch',
    'Date.now() + 60_000',
    '"web-launch"',
    'local-fragment',
    'cloud-fragment',
    '#control-launch=',
  ]);
  mustContain(operations, [
    'action === "launch-client-web"',
    'appId !== "health-care"',
    'issueHealthWebLaunch(actor.email, actor.role, actor.deviceId)',
    'managedWebLaunch: true',
    'webHref: bridge.baseUrl',
  ]);
  assert.match(operations, /if \(appId !== "health-care"\).*WEB_LAUNCH_CONTRACT_MISSING/);
});

test("application table opens Health runtime instead of the internal admin route", () => {
  mustContain(hub, [
    'launchClientWeb',
    'summary?.webHref',
    'summary.managedWebLaunch',
    'action: "launch-client-web", appId',
    'window.open("about:blank", "_blank")',
    'popup.location.replace(result.launchUrl)',
  ]);
  assert.equal(/summary\?\.directWebAccess \? <Link href=\{application\.href\} target="_blank"/.test(hub), false, "Direct web access must not point to internal /apps route");
});
