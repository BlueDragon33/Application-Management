import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

const healthBridge = fs.readFileSync("app/health-care.server.ts", "utf8");
const operations = fs.readFileSync("app/api/operations/route.ts", "utf8");
const registry = fs.readFileSync("app/application-registry.ts", "utf8");
const hub = fs.readFileSync("app/application-hub.tsx", "utf8");

function mustContain(source, snippets) {
  for (const snippet of snippets) assert.ok(source.includes(snippet), `Missing: ${snippet}`);
}

test("Health bridge verifies management contract v3 before issuing tickets", () => {
  mustContain(healthBridge, [
    'const TOKEN_ISSUER = "application-management"',
    'const TOKEN_AUDIENCE = "health-care-control"',
    'const TOKEN_APP = "health-care"',
    'const CONTROL_PROTOCOL = "application-management-health-control-v1"',
    'HEALTH_CONTROL_SERVICE_SECRET',
    'HEALTH_CARE_BASE_URL',
    'probeHealthManagementContract',
    '/api/control/contract',
    'contractVersion >= 3',
    'Number(auth.webLaunchTtlSeconds) === 60',
    'endpoints.automation === "/api/control/automation"',
    'webLaunchTarget === "/suc-khoe-tre"',
    'capabilities.includes("device-auto-approval")',
    'capabilities.includes("control-web-launch")',
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
    'action: operation === "approve" ? "approve" : "block"',
    'approvalRequiresRegistrationComplete: false',
    'remove: canManage',
  ]);
});

test("central Health device actions are constrained to the client contract and verified", () => {
  assert.match(operations, /if \(appId === "health-care"\)[\s\S]*operation === "approve" \? "approve" : "block"/);
  assert.match(operations, /actor\.role !== "publisher" && actor\.role !== "owner"/);
  assert.match(operations, /issueHealthBrowserBridge\(actor\.email, actor\.role, actor\.deviceId\)/);
  assert.match(operations, /verifyDeviceStatus\(bridge, "\/api\/control\/devices", deviceId, expected\)/);
  assert.equal(/delete-spam-device[\s\S]*health-care/.test(operations), false, "Health must not inherit Boi Ech permanent delete semantics");
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

test("Health direct web launch uses a purpose-scoped 60 second ticket", () => {
  mustContain(healthBridge, [
    'purpose: "control" | "web-launch"',
    'issueHealthWebLaunch',
    'Date.now() + 60_000',
    '"web-launch"',
    'chatgpt-sites-fragment',
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
