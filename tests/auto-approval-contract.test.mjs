import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const reader = fs.readFileSync("app/automation-policy-read.server.ts", "utf8");
const settings = fs.readFileSync("app/operations-settings.server.ts", "utf8");
const endpoint = fs.readFileSync("app/api/operations-auto-approval/route.ts", "utf8");
const worker = fs.readFileSync("worker/index.ts", "utf8");

test("Bauman auto approval is promoted only from a live client-owned contract", () => {
  assert.match(reader, /issueBaumanBrowserBridge/);
  assert.match(reader, /capabilities\.deviceAutoApproval !== true/);
  assert.match(reader, /endpoints\.automation !== "\/api\/control\/automation"/);
  assert.match(reader, /readBaumanAutomation/);
  assert.match(settings, /autoApproveSupported\.add\(appId\)/);
  assert.match(settings, /autoApproveSupportedAppIds: effectiveAppIds\.filter/);
  assert.equal(settings.includes("autoApproveSupportedAppIds: [...supportedAppIds]"), false);
});

test("native auto approval endpoint verifies owner and writes through each client contract", () => {
  assert.match(endpoint, /verifyControlProof/);
  assert.match(endpoint, /actor\.role !== "owner"/);
  assert.match(endpoint, /setBoi/);
  assert.match(endpoint, /setHealth/);
  assert.match(endpoint, /setBauman/);
  assert.match(endpoint, /deviceAutoApproval !== true/);
  assert.match(endpoint, /\/api\/control\/automation/);
  assert.match(endpoint, /AUTO_APPROVAL_CONTRACT_NOT_LIVE/);
  assert.match(endpoint, /rememberAutoApproval/);
  assert.match(endpoint, /readAutoApprovalSettings/);
  assert.equal(endpoint.includes("ru-life"), false);
  assert.equal(endpoint.includes("growup-mychildren"), false);
});

test("existing UI action is transparently routed to the native auto approval endpoint", () => {
  assert.match(worker, /routeNativeAutoApproval/);
  assert.match(worker, /url\.pathname !== "\/api\/operations"/);
  assert.match(worker, /payload\?\.action !== "set-auto-approval"/);
  assert.match(worker, /url\.pathname = "\/api\/operations-auto-approval"/);
  assert.match(worker, /request = await routeNativeAutoApproval\(request\)/);
});
