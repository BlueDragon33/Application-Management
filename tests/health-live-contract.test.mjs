import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

const healthBridge = fs.readFileSync("app/health-care.server.ts", "utf8");
const operations = fs.readFileSync("app/api/operations/route.ts", "utf8");
const registry = fs.readFileSync("app/application-registry.ts", "utf8");

function mustContain(source, snippets) {
  for (const snippet of snippets) assert.ok(source.includes(snippet), `Missing: ${snippet}`);
}

test("Health bridge verifies management contract v2 before issuing tickets", () => {
  mustContain(healthBridge, [
    'const TOKEN_ISSUER = "application-management"',
    'const TOKEN_AUDIENCE = "health-care-control"',
    'const TOKEN_APP = "health-care"',
    'const CONTROL_PROTOCOL = "application-management-health-control-v1"',
    'HEALTH_CONTROL_SERVICE_SECRET',
    'HEALTH_CARE_BASE_URL',
    'probeHealthManagementContract',
    '/api/control/contract',
    'contractVersion >= 2',
    'endpoints.automation === "/api/control/automation"',
    'capabilities.includes("device-auto-approval")',
    'boundary.healthDataInControlPlane === false',
    'boundary.profileDataInControlPlane === false',
    'registry.namespace === "SK-"',
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
    'action: "approve", deviceId',
    'approvalRequiresRegistrationComplete: false',
  ]);
});

test("central Health approval is constrained to the client contract", () => {
  assert.match(operations, /if \(appId === "health-care"\)[\s\S]*operation !== "approve"/);
  assert.match(operations, /actor\.role !== "publisher" && actor\.role !== "owner"/);
  assert.match(operations, /issueHealthBrowserBridge\(actor\.email, actor\.role, actor\.deviceId\)/);
  assert.match(operations, /bridgeJson\(bridge, "\/api\/control\/devices", \{ method: "POST", body: \{ action: "approve", deviceId \} \}\)/);
  assert.equal(/delete-spam-device[\s\S]*health-care/.test(operations), false, "Health must not inherit Boi Ech delete semantics");
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
