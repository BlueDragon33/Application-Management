import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("operations bootstrap publishes a per-app policy snapshot for the merged managed inventory", () => {
  const operations = source("app/api/operations/route.ts");
  const settings = source("app/operations-settings.server.ts");
  const client = source("app/admin-device-client.ts");
  assert.match(operations, /readAutoApprovalSettings\([\s\S]*AUTO_APPROVE_SUPPORTED_APP_IDS[\s\S]*dynamicSnapshots/);
  assert.match(settings, /automationPolicies/);
  assert.match(settings, /state: "live"/);
  assert.match(settings, /state: hasFallback \? "fallback" : "unavailable"/);
  assert.match(settings, /state: "unsupported"/);
  assert.match(client, /export type OperationsAutomationPolicy/);
  assert.match(client, /automationPolicies\?: OperationsAutomationPolicy\[\]/);
});

test("fallback audit stores the exact Boi policy rather than hard-coded defaults", () => {
  const settings = source("app/operations-settings.server.ts");
  const endpoint = source("app/api/operations-auto-approval/route.ts");
  assert.match(settings, /policy\?: \{ defaultAccessDays\?: number; defaultDeviceLimit\?: number \}/);
  assert.match(settings, /policy\?\.defaultAccessDays/);
  assert.match(settings, /policy\?\.defaultDeviceLimit/);
  assert.doesNotMatch(settings, /defaultAccessDays: 60, defaultDeviceLimit: 100/);
  assert.match(endpoint, /rememberAutoApproval\(actor\.email, appId, desired, \{ defaultAccessDays, defaultDeviceLimit \}\)/);
});

test("fallback never masquerades as live mutation readiness", () => {
  const settings = source("app/operations-settings.server.ts");
  assert.match(settings, /state: hasFallback \? "fallback" : "unavailable"/);
  assert.match(settings, /autoApprove: false/);
  assert.match(settings, /autoBlockPending: false/);
  assert.match(settings, /Không đọc được contract automation live/);
});

test("policy editor keeps unsupported managed apps visible but read-only", () => {
  const editor = source("app/automatic-device-policies.tsx");
  assert.match(editor, /apps\.map/);
  assert.match(editor, /READ-ONLY/);
  assert.match(editor, /Không hỗ trợ/);
  assert.match(editor, /disabled=\{locked \|\| !approveWritable\}/);
  assert.match(editor, /disabled=\{locked \|\| !blockWritable\}/);
});


test("dynamic automation snapshots override read-only inventory only after live readback", () => {
  const settings = source("app/operations-settings.server.ts");
  assert.match(settings, /for \(const snapshot of dynamicSnapshots\)/);
  assert.match(settings, /manifest\.capabilities\.deviceAutoApproval === true/);
  assert.match(settings, /manifest\.capabilities\.deviceAutoBlockPending === true/);
  assert.match(settings, /snapshot\.automation/);
  assert.match(settings, /Universal Contract \$\{manifest\.endpoints\.automation\}/);
  assert.match(settings, /automationIdempotentCommands === true/);
  assert.match(settings, /automationOptimisticConcurrency === true/);
  assert.match(settings, /không cho phép ghi mù/);
});
