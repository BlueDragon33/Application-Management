import assert from "node:assert/strict";
import test from "node:test";
import {readFileSync} from "node:fs";

const dashboard=readFileSync("app/management-dashboard-v2.tsx","utf8");
const editor=readFileSync("app/automatic-device-policies.tsx","utf8");
const contract=readFileSync("app/automation-policy-changes.server.ts","utf8");
const source=dashboard.slice(dashboard.indexOf("async function saveAutomation("),
  dashboard.indexOf("async function manageControlDevice(",dashboard.indexOf("async function saveAutomation(")));

test("staged client mutation is NOT an independent applied receipt",()=>{
  assert.match(contract,/automation_policy_changes/);
  assert.match(source,/await Promise\.allSettled\(executions\)/);
  assert.match(source,/await operationsAction\(\{ action: "read-automation", targetAppIds: changedAppIds \}\)/);
  assert.ok(source.indexOf("await Promise.allSettled(executions)") <
    source.indexOf('await operationsAction({ action: "read-automation", targetAppIds: changedAppIds })'));
});
test("independent authenticated GET must exist and carry verified live field state",()=>{
  assert.match(source,/changedAppIds\.every\(\(appId\) => observedIds\.has\(appId\)\)/);
  assert.match(source,/taskMatchesReadback\(independentSettings, task\)/);
  assert.match(source,/policy\?\.verification\.state === "live"/);
  assert.match(source,/policy\?\.current\.autoApprove === desired/);
  assert.match(source,/policy\?\.current\.autoBlockPending === desired/);
});
test("write-response merge is not used to mark applied policy success",()=>{
  assert.doesNotMatch(source,/taskMatchesReadback\(mergedSettings, task\)/);
  assert.match(source,/for \(const policy of independentSettings\?\.automationPolicies \?\? \[\]\)/);
  assert.match(source,/return mergedSettings;/);
  assert.match(source,/if \(failedFields\.length \|\| !independentSettings\) return null;/);
  assert.match(source,/if \(independentSettings\) setOperations\(/);
  assert.match(source,/return mergedSettings;/);
});
test("unavailable GET is blocked even after successful POST",()=>{
  assert.match(source,/INDEPENDENT_READBACK_UNAVAILABLE/);
  assert.match(source,/independentSettings: OperationsBootstrap\["settings"\] \| null = null/);
  assert.match(source,/catch \{\s*\/\/ No GET receipt;/);
  assert.match(editor,/if \(!readback\) \{/);
});
test("each field has source and exact value readback, including Boi limits",()=>{
  assert.match(source,/task\.appId === "boi-ech"/);
  assert.match(source,/policy\?\.current\.freeAccessDays === selection\.defaultAccessDays/);
  assert.match(source,/policy\?\.current\.freeDeviceLimit === selection\.defaultDeviceLimit/);
  assert.match(source,/policy\?\.current\.pendingBlockAfterHours === selection\.pendingBlockAfterHoursByApp\[task\.appId\]/);
});
test("2FA failure during concurrent tasks stays visible and unconfirmed",()=>{
  assert.match(source,/stepUpDuringSave = true/);
  assert.match(source,/result\.reason\.data\.code === "STEP_UP_REQUIRED"/);
  assert.match(source,/if \(stepUpDuringSave\) setStepUpRequired\(true\)/);
  assert.match(source,/Cần xác minh Google Authenticator/);
});
test("partial readback never overwrites pending user-edited client values",()=>{
  assert.match(editor,/const localIntent = Object\.fromEntries/);
  assert.match(editor,/const intended = \{ \.\.\.saved\?\.drafts, \.\.\.localIntent \}/);
  assert.match(editor,/const stillPending = Object\.entries\(intended\)/);
  assert.match(editor,/writeAutomationDraft\(window\.localStorage/);
  assert.match(editor,/touchedAppIdsRef\.current = new Set\(stillPending\.map/);
  assert.match(editor,/if \(!readback\) \{/);
});
