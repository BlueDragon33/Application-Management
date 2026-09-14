import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

function source(path) {
  return fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

const api = source("app/api/apps/boi-ech/access/route.ts");
const client = source("app/boi-access-client.ts");
const view = source("app/access-management.tsx");
const dashboard = source("app/management-dashboard-v2.tsx");

test("Boi Ech payment/access API is proof-gated and verifies live state", () => {
  assert.match(api, /verifyControlProof\(payload, undefined, previewRequest\)/);
  assert.match(api, /expectedPaymentStatus/);
  assert.match(api, /expectedAccessGroup/);
  assert.match(api, /PAYMENT_STATE_CONFLICT/);
  assert.match(api, /ACCESS_STATE_CONFLICT/);
  assert.match(api, /readbackMatches\(operation, updated\)/);
  assert.match(api, /ACCESS_READBACK_MISMATCH/);
  assert.match(api, /\["grant-free", "require-payment", "renew-access"\]/);
});

test("Boi Ech access transitions do not overwrite submitted proof or renew unassigned accounts", () => {
  assert.match(api, /operation === "require-payment" && \(currentAccessGroup !== "unassigned" \|\| currentPaymentStatus !== "unassigned"\)/);
  assert.match(api, /operation === "renew-access" && currentAccessGroup === "unassigned"/);
  assert.match(api, /operation === "grant-free" && currentPaymentStatus === "paid_verified"/);
  assert.match(view, /device\.accessGroup === "unassigned" && device\.paymentStatus === "unassigned"/);
  assert.match(view, /device\.paymentStatus !== "proof_submitted"/);
  assert.match(view, /device\.accessGroup !== "unassigned"/);
});

test("payment client signs requests with the approved QT device", () => {
  assert.match(client, /connectAdminCenter/);
  assert.match(client, /ECDSA/);
  assert.match(client, /SHA-256/);
  assert.match(client, /learning-control:/);
  assert.match(client, /expectedPaymentStatus: device\.paymentStatus/);
  assert.match(client, /expectedAccessGroup: device\.accessGroup/);
});

test("central access UI uses real Boi states and does not blindly verify payment", () => {
  assert.match(view, /paymentStatus/);
  assert.match(view, /Có ảnh chờ xác minh/);
  assert.match(view, /Đối chiếu ảnh/);
  assert.match(view, /không cho xác minh chuyển khoản chỉ dựa vào trạng thái/);
  assert.doesNotMatch(view, /manageBoiAccess\(device, "verify-payment"\)/);
  assert.match(view, /Không có mô hình thanh toán chung được Trung tâm tự suy diễn/);
  assert.match(dashboard, /<AccessManagement query=\{normalizedSearch\}\/>/);
  assert.doesNotMatch(dashboard, /Thanh toán & Quyền theo ứng dụng/);
});
