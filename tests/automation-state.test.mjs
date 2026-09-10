import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

function source(path) {
  return fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("automation state is read from the owning clients before central audit fallback", () => {
  const reader = source("app/automation-policy-read.server.ts");
  const settings = source("app/operations-settings.server.ts");

  assert.match(reader, /issueBoiBrowserBridge/);
  assert.match(reader, /\/api\/control\/overview\?activityDays=0/);
  assert.match(reader, /record\(payload\.automation\)\.enabled === true/);
  assert.match(reader, /issueHealthBrowserBridge/);
  assert.match(reader, /probeHealthManagementContract/);
  assert.match(reader, /\/api\/control\/automation/);
  assert.match(reader, /automation\.autoApproveDevices === true/);
  assert.match(reader, /contract\.capabilities\.includes\("device-auto-block-pending"\)/);
  assert.match(reader, /automation\.autoBlockPendingDevices === true/);
  assert.match(reader, /\[24, 168, 720\]\.includes\(rawHours\)/);
  assert.match(reader, /method: "GET"/);
  assert.doesNotMatch(reader, /method: "POST"|manage-client-device|update-automation/);

  assert.match(settings, /readClientAutoApprovalStates/);
  assert.match(settings, /auditAutoApprovalFallback/);
  assert.match(settings, /probe\.status === "fulfilled"/);
  assert.match(settings, /fallback\.has\(appId\)/);
  assert.match(settings, /autoBlockPendingSupportedAppIds/);
  assert.match(settings, /pendingBlockAfterHoursByApp/);
  assert.doesNotMatch(settings, /autoBlockSupported\.add\(appId\)[\s\S]*fallback\.has\(appId\)/);
});

test("automation policy reader uses a bounded read-only service identity", () => {
  const reader = source("app/automation-policy-read.server.ts");
  assert.match(reader, /AUTOMATION_READ_TIMEOUT_MS = 4_500/);
  assert.match(reader, /AbortController/);
  assert.match(reader, /"viewer"/);
  assert.match(reader, /automation-state@application-management\.local/);
  assert.match(reader, /"0"\.repeat\(64\)/);
});

test("central auto-block mutation is owner-only and requires live Health capability", () => {
  const route = source("app/api/operations/route.ts");
  const start = route.indexOf('if (action === "set-auto-block-pending")');
  const end = route.indexOf('if (action === "manage-client-device")', start);
  assert.ok(start >= 0 && end > start);
  const block = route.slice(start, end);
  assert.match(block, /actor\.role !== "owner"/);
  assert.match(block, /appId !== "health-care"/);
  assert.match(block, /autoBlockPendingSupportedAppIds\.includes\(appId\)/);
  assert.match(block, /\[24, 168, 720\]\.includes\(pendingBlockAfterHours\)/);
  assert.match(block, /\/api\/control\/automation/);
  assert.match(block, /AUTO_BLOCK_READBACK_MISMATCH/);
  assert.match(block, /rememberAutoBlockPending/);
});
