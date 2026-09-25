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


test("free auto mode is explicit and paid access still requires verified proof and a term", () => {
  const operations = source("app/api/operations/route.ts");
  const nativeAutomation = source("app/api/operations-auto-approval/route.ts");
  const editor = source("app/automatic-device-policies.tsx");
  assert.match(dashboard, /window\.confirm\("Bật tự động MIỄN PHÍ/);
  assert.match(operations, /BOI_AUTO_APPROVAL_DISABLED_FOR_ACCESS_CLASSIFICATION/);
  assert.match(nativeAutomation, /await setBoi\(actor, desired, defaultAccessDays, defaultDeviceLimit\)/);
  assert.match(editor, /Chỉ mở trả phí sau khi xác minh thanh toán/);
  assert.match(api, /paymentReviewReady\(current\)/);
  assert.match(api, /Number\(updated\.accessDaysRemaining\) !== paidAccessDays/);
});


test("payment proof proxy bounds streamed body size and keeps timeout active through body read", () => {
  assert.match(api, /MAX_PAYMENT_PROOF_BYTES = 8 \* 1024 \* 1024/);
  assert.match(api, /Number\(response\.headers\.get\("content-length"\)\)/);
  assert.match(api, /response\.body\.getReader\(\)/);
  assert.match(api, /totalBytes \+= value\.byteLength/);
  assert.match(api, /if \(totalBytes > MAX_PAYMENT_PROOF_BYTES\)/);
  assert.match(api, /await reader\.cancel\(\)/);
  assert.doesNotMatch(api, /await response\.arrayBuffer\(\)/);
  assert.match(api, /PAYMENT_PROOF_TOO_LARGE/);
  assert.match(api, /PAYMENT_PROOF_EMPTY/);
});


test("paid metric counts only verified payments", () => {
  assert.match(api, /paid: devices\.filter\(\(device\) => device\.paymentStatus === "paid_verified"\)\.length/);
  assert.doesNotMatch(api, /paid: devices\.filter\(\(device\) => device\.accessGroup === "paid"\)\.length/);
});


test("legacy Boi drawer cannot bypass finalized payment state", () => {
  const controlCenter = source("app/apps/boi-ech/boi-ech-control-center.tsx");
  assert.match(controlCenter, /const accessFinalized = device\.status === "approved"/);
  assert.match(controlCenter, /device\.paymentStatus === "free_approved" \|\| device\.paymentStatus === "paid_verified"/);
  assert.match(controlCenter, /const canGrantFree = device\.registrationComplete[\s\S]{0,180}device\.accessGroup === "unassigned"[\s\S]{0,120}device\.paymentStatus === "unassigned"/);
  assert.match(controlCenter, /const paidEditBlocked = device\.accessGroup === "paid" && device\.paymentStatus !== "paid_verified"/);
  assert.match(controlCenter, /disabled=\{paidEditBlocked\}/);
  assert.match(controlCenter, /device\.registrationComplete && accessFinalized \? <button/);
  assert.match(controlCenter, />Duyệt lại · gia hạn<\/button>/);
  assert.match(controlCenter, /\{canGrantFree \? <button/);
  assert.match(controlCenter, />Duyệt miễn phí<\/button>/);
});


test("Boi access keeps the control proof identity separate from the target device", () => {
  assert.match(client, /controlDeviceId: access\.deviceId/);
  assert.doesNotMatch(client, /return \{ deviceId: access\.deviceId, challenge:/);
  assert.match(api, /const controlDeviceId = text\(payload\.controlDeviceId\)/);
  assert.match(api, /controlProofPayload = controlDeviceId \? \{ \.\.\.payload, deviceId: controlDeviceId \} : payload/);
  assert.match(api, /verifyControlProof\(controlProofPayload/);
  assert.match(api, /const deviceId = text\(payload\.deviceId\)\.toLowerCase\(\)/);
});


test("Boi access honors Production account session without IndexedDB challenge", () => {
  assert.match(client, /access\.deviceId\.startsWith\("production-session:"\)/);
  assert.match(client, /return \{ controlDeviceId: access\.deviceId \};/);
  assert.match(client, /const credential = await readCredential\(\)/);
});
