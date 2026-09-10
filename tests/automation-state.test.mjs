import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

function source(path) {
  return fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("auto-approval state is read from the owning clients before central audit fallback", () => {
  const reader = source("app/automation-policy-read.server.ts");
  const settings = source("app/operations-settings.server.ts");

  assert.match(reader, /issueBoiBrowserBridge/);
  assert.match(reader, /\/api\/control\/overview\?activityDays=0/);
  assert.match(reader, /record\(payload\.automation\)\.enabled === true/);
  assert.match(reader, /issueHealthBrowserBridge/);
  assert.match(reader, /\/api\/control\/automation/);
  assert.match(reader, /record\(payload\.automation\)\.autoApproveDevices === true/);
  assert.match(reader, /method: "GET"/);
  assert.doesNotMatch(reader, /method: "POST"|manage-client-device|update-automation/);

  assert.match(settings, /readClientAutoApprovalStates/);
  assert.match(settings, /auditAutoApprovalFallback/);
  assert.match(settings, /probe\.status === "fulfilled"/);
  assert.match(settings, /fallback\.has\(appId\)/);
  assert.doesNotMatch(settings, /SELECT target, detail_json[\s\S]*return \{ autoApproveAppIds: \[\.\.\.enabled\]/);
});

test("automation policy reader uses a bounded read-only service identity", () => {
  const reader = source("app/automation-policy-read.server.ts");
  assert.match(reader, /AUTOMATION_READ_TIMEOUT_MS = 4_500/);
  assert.match(reader, /AbortController/);
  assert.match(reader, /"viewer"/);
  assert.match(reader, /automation-state@application-management\.local/);
  assert.match(reader, /"0"\.repeat\(64\)/);
});
