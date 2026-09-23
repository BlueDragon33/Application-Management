import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

function source(path) {
  return fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

const api = source("app/api/apps/boi-ech/access/route.ts");
const client = source("app/boi-access-client.ts");
const view = source("app/boi-access-view.tsx");
const dashboard = source("app/management-dashboard-v2.tsx");

test("Boi payment/access API is proof-gated, concurrency-safe and read-back verified", () => {
  assert.match(api, /verifyControlProof\(payload/);
  assert.match(api, /expectedPaymentStatus/);
  assert.match(api, /expectedAccessGroup/);
  assert.match(api, /PAYMENT_STATE_CONFLICT/);
  assert.match(api, /ACCESS_STATE_CONFLICT/);
  assert.match(api, /readbackMatches\(operation, updated\)/);
  assert.match(api, /ACCESS_READBACK_MISMATCH/);
  assert.match(api, /\["grant-free", "require-payment", "renew-access", "verify-payment", "reject-payment"\]/);
});

test("Boi payment transitions keep real backend invariants", () => {
  assert.match(api, /operation === "require-payment" && \(currentAccessGroup !== "unassigned" \|\| currentPaymentStatus !== "unassigned"\)/);
  assert.match(api, /operation === "renew-access" && \(text\(current\.status\) !== "approved" \|\| !\["free_approved", "paid_verified"\]\.includes\(currentPaymentStatus\)\)/);
  assert.match(api, /operation === "grant-free" && \["proof_submitted", "paid_verified"\]\.includes\(currentPaymentStatus\)/);
  assert.match(view, /device\.accessGroup === "unassigned" && device\.paymentStatus === "unassigned"/);
  assert.match(view, /device\.accessGroup !== "unassigned"/);
  assert.match(view, /device\.paymentProofAvailable && device\.paymentStatus === "proof_submitted"/);
});

test("payment client signs with the approved central P-256 device and sends expected state", () => {
  assert.match(client, /connectAdminCenter/);
  assert.match(client, /ECDSA/);
  assert.match(client, /SHA-256/);
  assert.match(client, /learning-control:/);
  assert.match(client, /expectedPaymentStatus: device\.paymentStatus/);
  assert.match(client, /expectedAccessGroup: device\.accessGroup/);
});

test("current dashboard exposes real Boi access controls without inventing payment controls for other apps", () => {
  assert.match(dashboard, /type View = [^;]*"access"/);
  assert.match(dashboard, /label: "Thanh toán & Quyền"/);
  assert.match(dashboard, /<BoiAccessView query=\{search\}\/>/);
  assert.match(view, /loadBoiPaymentProof\(device\)/);
  assert.match(view, /reviewProof\("verify-payment"\)/);
  assert.match(view, /reviewProof\("reject-payment"\)/);
  assert.match(view, /Chưa công bố payment\/access contract cho Trung tâm/);
  assert.doesNotMatch(view, /health-care[^\n]*(grant-free|require-payment|verify-payment)/i);
  assert.doesNotMatch(view, /ru-life[^\n]*(grant-free|require-payment|verify-payment)/i);
  assert.doesNotMatch(view, /growup-mychildren[^\n]*(grant-free|require-payment|verify-payment)/i);
  assert.doesNotMatch(view, /price-report-tunggiabao[^\n]*(grant-free|require-payment|verify-payment)/i);
  assert.match(dashboard, /device\.appId === "boi-ech"[\s\S]*switchView\("access"\)/);
  assert.match(dashboard, /device\.appId === "boi-ech" \? "Phân quyền" : "Duyệt"/);
});

test("generic device approval cannot bypass Boi payment/access classification", () => {
  const operations = source("app/api/operations/route.ts");
  assert.match(operations, /BOI_ACCESS_FLOW_REQUIRED/);
  assert.match(operations, /không duyệt mặc định thành miễn phí/);
  assert.doesNotMatch(operations, /operation === "approve"[\s\S]{0,700}action: "grant-free"/);
});

test("renewal is exposed only for finalized Boi access", () => {
  assert.match(view, /device\.status === "approved"/);
  assert.match(view, /device\.paymentStatus === "free_approved" \|\| device\.paymentStatus === "paid_verified"/);
});


test("generic auto approval excludes Boi so payment classification cannot be bypassed", () => {
  const operations = source("app/api/operations/route.ts");
  const nativeAutomation = source("app/api/operations-auto-approval/route.ts");
  assert.match(dashboard, /autoApproveSupportedAppIds \?\? \[\]\)\.filter\(\(id\) => id !== "boi-ech"\)/);
  assert.match(operations, /BOI_AUTO_APPROVAL_DISABLED_FOR_ACCESS_CLASSIFICATION/);
  assert.match(nativeAutomation, /BOI_AUTO_APPROVAL_DISABLED_FOR_ACCESS_CLASSIFICATION/);
  assert.match(nativeAutomation, /await setBoi\(actor, false\)/);
});
