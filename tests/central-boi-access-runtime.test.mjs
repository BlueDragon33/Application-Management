import assert from "node:assert/strict";
import test from "node:test";
import { loadTs } from "./helpers/load-ts.mjs";

const deviceId = "a".repeat(64);
function fixture({ role = "owner", status = "approved", payment = "paid_verified", group = "paid", ignoreWrite = false, failReadback = false } = {}) {
  let row = { deviceId, deviceCode: "BE-AAAA-AAAA-AAAA-AAAA", learnerName: "Test teacher", registrationComplete: true,
    status, paymentStatus: payment, accessGroup: group, accessExpiresAt: "2000-01-01T00:00:00Z", accessExpired: true, accessDaysRemaining: 0 };
  const commands = [];
  const api = loadTs("app/api/apps/boi-ech/access/route.ts", {
    "../../../../control-device.server": {
      verifyControlProof: async () => ({ role, email: "owner@example.test" }),
      controlErrorResponse: error => Response.json({ error: error.message }, { status: 500 }),
    },
    "../../../../boi-ech.server": { issueBoiBrowserBridge: async () => ({ baseUrl: "https://boi.test", token: "test-only" }) },
  }, { fetch: async (url, init) => {
    assert.ok(url.startsWith("https://boi.test/api/control/overview"));
    if (failReadback && commands.length && init.method !== "POST") return Response.json({ error: "Temporary outage" }, { status: 503 });
    if (init.method === "POST") {
      const command = JSON.parse(init.body); commands.push(command);
      if (!ignoreWrite) row = { ...row, status: command.action === "block" ? "blocked" : ["free_approved", "paid_verified"].includes(row.paymentStatus) ? "approved" : "pending" };
    }
    return Response.json({ devices: [row] });
  } });
  return { commands, get row() { return row; }, async post(operation, extra = {}) {
    const response = await api.POST(new Request("https://management.test/api/apps/boi-ech/access", { method: "POST", body: JSON.stringify({ action: "manage-access", operation, deviceId,
      expectedStatus: status, expectedPaymentStatus: payment, expectedAccessGroup: group, ...extra }) }));
    return { status: response.status, ...await response.json() };
  } };
}

test("central block writes the owner app and independently confirms blocked state without changing paid expiry", async () => {
  const f = fixture(); const result = await f.post("block");
  assert.equal(result.status, 200); assert.equal(result.verified, true);
  assert.equal(result.device.status, "blocked"); assert.equal(result.device.paymentStatus, "paid_verified");
  assert.equal(result.device.accessExpiresAt, "2000-01-01T00:00:00Z");
  assert.deepEqual(f.commands, [{ action: "block", deviceId, expectedStatus: "approved", expectedPaymentStatus: "paid_verified", expectedAccessGroup: "paid" }]);
});

test("central unblock preserves expired paid approval and never renews or converts it to free", async () => {
  const f = fixture({ status: "blocked" }); const result = await f.post("unblock");
  assert.equal(result.status, 200); assert.equal(result.device.status, "approved");
  assert.equal(result.device.accessExpired, true); assert.equal(result.device.accessGroup, "paid");
  assert.equal(result.device.accessExpiresAt, "2000-01-01T00:00:00Z");
});

test("unblock returns unclassified devices to pending without granting access", async () => {
  const result = await fixture({ status: "blocked", payment: "unassigned", group: "unassigned" }).post("unblock");
  assert.equal(result.status, 200); assert.equal(result.device.status, "pending");
});

test("stale or missing status expectation prevents a central write", async () => {
  for (const expectedStatus of ["pending", undefined]) {
    const f = fixture(); const result = await f.post("block", { expectedStatus });
    assert.equal(result.status, expectedStatus ? 409 : 400); assert.equal(f.commands.length, 0);
  }
});

test("central access cannot unblock through free/paid approval or renew a blocked record", async () => {
  for (const operation of ["grant-free", "require-payment", "renew-access"]) {
    const f = fixture({ status: "blocked", payment: "unassigned", group: "unassigned" });
    assert.equal((await f.post(operation)).status, 409); assert.equal(f.commands.length, 0);
  }
});

test("readback failure reports unverified write instead of success", async () => {
  const result = await fixture({ ignoreWrite: true }).post("block");
  assert.equal(result.status, 502); assert.equal(result.code, "ACCESS_READBACK_MISMATCH");
  assert.notEqual(result.verified, true);
});

test("reviewer cannot use the central panel to grant or revoke app access", async () => {
  const f = fixture({ role: "reviewer" });
  assert.equal((await f.post("block")).status, 403); assert.equal(f.commands.length, 0);
});

test("a write followed by a read outage is explicitly unverified and must not be retried blindly", async () => {
  const result = await fixture({ failReadback: true }).post("block");
  assert.equal(result.status, 502); assert.equal(result.code, "ACCESS_READBACK_UNAVAILABLE");
  assert.equal(result.applied, true); assert.equal(result.verified, false);
});
