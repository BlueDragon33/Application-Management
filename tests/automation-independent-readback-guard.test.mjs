import assert from "node:assert/strict";
import test from "node:test";
import {readFileSync} from "node:fs";

const dashboard=readFileSync("app/management-dashboard-v2.tsx","utf8");
const editor=readFileSync("app/automatic-device-policies.tsx","utf8");
const contract=readFileSync("app/automation-policy-changes.server.ts","utf8");
const endpoint=readFileSync("app/api/operations/route.ts","utf8");
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
  assert.match(source,/if \(independentSettings\) reconcileDashboardPolicies\(independentSettings\.automationPolicies\)/);
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

test("authenticated readback action probes only changed app IDs without reloading devices",()=>{
  const start=endpoint.indexOf('if (action === "read-automation")');
  const stop=endpoint.indexOf('if (action === "launch-client-web")',start);
  assert.ok(start>0&&stop>start);
  const action=endpoint.slice(start,stop);
  assert.match(endpoint,/const actor = await verifyControlProof\(payload/);
  assert.match(action,/targets = \[\.\.\.new Set\(ids as string\[\]\)\]/);
  assert.match(action,/dynamicIds = targets\.filter/);
  assert.match(action,/await probeDynamicManagedApplications\(dynamicIds, \{ automationOnly: true \}\)/);
  assert.match(action,/await readAutoApprovalSettings\(\[\], targets, dynamic, targets\)/);
  assert.match(action,/INVALID_AUTOMATION_READBACK_TARGETS/);
  assert.doesNotMatch(action,/buildBootstrap\(|managedApps\(|manage-client-device/);
});
test("source policy readback cannot fabricate a previously live but unqueried app",()=>{
  assert.match(source,/const observedIds = new Set\(observed\.settings\?\.automationPolicies/);
  assert.match(source,/changedAppIds\.every\(\(appId\) => observedIds\.has\(appId\)\)/);
  assert.match(source,/taskMatchesReadback\(independentSettings, task\)/);
  assert.match(source,/policy\?\.verification\.state === "live"/);
  assert.match(source,/if \(independentSettings\) reconcileDashboardPolicies\(independentSettings\.automationPolicies\)/);
  assert.match(source,/const latest = new Map\(\(previous\.settings\.automationPolicies \?\? \[\]\)/);
  assert.match(source,/settings: settingsFromPolicies\(previous\.settings, \[\.\.\.latest\.values\(\)\]\)/);
});


test("P0 save uses an independent LIVE owner GET before any changed-field POST",()=>{
  const pre=source.indexOf('const beforeWrite = await operationsAction({ action: "read-automation", targetAppIds });');
  const run=source.indexOf('const settled = await Promise.allSettled(executions);');
  const post=source.indexOf('const observed = await operationsAction({ action: "read-automation", targetAppIds: changedAppIds });');
  assert.ok(pre>=0 && run>pre && post>run);
  assert.match(source,/policy\.verification\.state !== "live"/);
  assert.match(source,/const currentMap = new Map/);
  assert.match(source,/for \(const policy of livePolicies\) currentMap\.set\(policy\.appId, policy\)/);
  assert.match(source,/settingsFromPolicies\(current, automationPolicies\)/);
  assert.match(source,/if \(!changedAppIds\.length\) \{/);
  assert.match(source,/Không cần ghi thêm: cấu hình đã khớp policy LIVE/);
});
test("P0 updates only explicitly changed app fields and never turns unselected apps off",()=>{
  assert.match(editor,/approvalTargetAppIds: string\[\]/);
  assert.match(editor,/blockTargetAppIds: string\[\]/);
  assert.match(source,/const approvalScope = new Set\(selection\.approvalTargetAppIds\)/);
  assert.match(source,/const blockScope = new Set\(selection\.blockTargetAppIds\)/);
  assert.match(source,/!approvalScope\.has\(policy\.appId\) \|\| !policy\.mutation\.autoApprove/);
  assert.match(source,/!blockScope\.has\(policy\.appId\) \|\| !policy\.mutation\.autoBlockPending/);
  assert.match(source,/approvalScope\.has\(appId\) && !policy\.mutation\.autoApprove/);
  assert.match(source,/blockScope\.has\(appId\) && !policy\.mutation\.autoBlockPending/);
  assert.match(source,/targetAppIds\.some\(\(appId\) => !approvalScope\.has\(appId\) && !blockScope\.has\(appId\)\)/);
});
test("localStorage failure cannot report applied and cannot suppress owner write",()=>{
  const apply=editor.slice(editor.indexOf("async function submit()"),editor.indexOf("return <div className={styles.scrim}"));
  assert.match(apply,/const readback = await save\(/);
  assert.match(apply,/persisted\.saved/);
  assert.doesNotMatch(apply,/if \(!persisted\.saved\) \{[\s\S]*?return;/);
  assert.match(apply,/if \(!readback\) \{/);
  assert.match(apply,/Kho bản nháp trình duyệt không khả dụng/);
});

test("a concurrent dashboard refresh is not overwritten by an older automation snapshot",()=>{
  assert.match(source,/function reconcileDashboardPolicies\(/);
  assert.match(source,/setOperations\(\(previous\) => \{/);
  assert.match(source,/const latest = new Map\(\(previous\.settings\.automationPolicies \?\? \[\]\)/);
  assert.match(source,/for \(const policy of observedPolicies \?\? \[\]\) \{\s*if \(policy\.verification\.state === "live"\) latest\.set\(policy\.appId, policy\)/);
  assert.match(source,/reconcileDashboardPolicies\(livePolicies\)/);
  assert.match(source,/reconcileDashboardPolicies\(independentSettings\.automationPolicies\)/);
});
