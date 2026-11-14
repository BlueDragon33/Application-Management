import assert from "node:assert/strict";
import test from "node:test";
import { loadTs } from "./helpers/load-ts.mjs";

// Production mismatch: BOI accounts.revision is NOT NULL DEFAULT 0 (0018).
// Owner's read-only list must accept canonical zero-based revisions without
// weakening the signed Owner bridge or existing fail-closed field validators.
const id = "acc_" + "a".repeat(64);
const firstAccount = {
  accountId: id, accountRevision: 0, name: null,
  role: "learner", deviceStatus: "pending",
  onboardingStage: "requested", entitlement: null,
};
const activeAccount = {
  ...firstAccount, accountRevision: 0, name: "Test Learner",
  deviceStatus: "approved", onboardingStage: "active",
  entitlement: {
    state: "active", activatedAt: "2026-11-14T00:00:00.000Z",
    expiresAt: "2026-11-22T00:00:00.000Z", revision: 1, active: true,
  },
};

function fixture({ role = "owner", status = 200, payload = { accounts: [firstAccount] } } = {}) {
  const calls = [];
  const route = loadTs("app/api/apps/boi-ech/account-entitlements/route.ts", {
    "../../../../control-device.server": {
      verifyControlProof: async () => ({ role, email: "owner@example.invalid" }),
      controlErrorResponse: (error) => Response.json({ error: error.message }, { status: 500 }),
    },
    "../../../../boi-ech.server": {
      issueBoiBrowserBridge: async () => ({ baseUrl: "https://boi.example.invalid", token: "fixture-ticket" }),
    },
  }, {
    fetch: async (url, init) => {
      calls.push({ url, method: init.method, redirect: init.redirect, body: JSON.parse(init.body) });
      return Response.json(payload, { status });
    },
  });

  return {
    calls,
    async post(action = "list") {
      const response = await route.POST(new Request("https://app.example.invalid/api/apps/boi-ech/account-entitlements", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ action }),
      }));
      return { status: response.status, body: await response.json() };
    },
  };
}

test("canonical newly registered account revision 0 remains Owner-readable, not a 502", async () => {
  const f = fixture();
  const { status, body } = await f.post();
  assert.equal(status, 200);
  assert.equal(body.verified, true);
  assert.equal(body.accounts.length, 1);
  assert.equal(body.accounts[0].accountRevision, 0);
  assert.deepEqual(f.calls.map(x => x.body), [{ action: "list-entitlements" }]);
  assert.equal(f.calls[0].url, "https://boi.example.invalid/api/control/accounts");
  assert.equal(f.calls[0].method, "POST");
  assert.equal(f.calls[0].redirect, "manual");
});

test("zero-revision active entitlement is accepted without claiming authorization from its revision", async () => {
  const f = fixture({ payload: { accounts: [activeAccount] } });
  const { status, body } = await f.post();
  assert.equal(status, 200);
  assert.equal(body.verified, true);
  assert.equal(body.accounts[0].entitlement.revision, 1);
});

test("negative, noninteger and malformed account revisions still fail closed", async () => {
  for (const revision of [-1, -2, 0.5, "0", null, undefined]) {
    const f = fixture({ payload: { accounts: [{ ...firstAccount, accountRevision: revision }] } });
    const { status, body } = await f.post();
    assert.equal(status, 502, String(revision));
    assert.equal(body.verified, false);
    assert.equal(body.code, "BOI_ACCOUNT_DURATION_UNVERIFIED");
    assert.equal(body.accounts, undefined);
  }
});

test("malformed identity, role, entitlement or explicit upstream refusal still deny all rows", async () => {
  const rejected = [
    { ...firstAccount, accountId: "wrong" },
    { ...firstAccount, role: "owner" },
    { ...firstAccount, deviceStatus: null },
    { ...firstAccount, entitlement: { ...activeAccount.entitlement, expiresAt: null } },
    { ...firstAccount, entitlement: { ...activeAccount.entitlement, revision: -1 } },
  ];
  for (const row of rejected) {
    const f = fixture({ payload: { accounts: [row] } });
    const { status, body } = await f.post();
    assert.equal(status, 502);
    assert.equal(body.verified, false);
    assert.equal(body.accounts, undefined);
  }
  const f = fixture({ payload: { verified: false, accounts: [firstAccount] } });
  const result = await f.post();
  assert.equal(result.status, 502);
});

test("unverified Owner cannot reach the BOI bridge even for a zero-revision account", async () => {
  for (const role of ["viewer", "reviewer", "publisher"]) {
    const f = fixture({ role });
    const { status, body } = await f.post();
    assert.equal(status, 403);
    assert.equal(body.code, "OWNER_REQUIRED");
    assert.equal(f.calls.length, 0);
  }
});

test("Owner policy read remains exact three-role contract, independent of account revisions", async () => {
  const policies = [
    { role: "manager", defaultDays: 3, revision: 2, updatedAt: "2026-11-13 00:00:00" },
    { role: "teacher", defaultDays: 8, revision: 2, updatedAt: "2026-11-13 00:00:00" },
    { role: "learner", defaultDays: 8, revision: 2, updatedAt: "2026-11-13 00:00:00" },
  ];
  const f = fixture({ payload: { policies } });
  const { status, body } = await f.post("policy");
  assert.equal(status, 200);
  assert.equal(body.verified, true);
  assert.deepEqual(body.policies, policies);
  assert.deepEqual(f.calls.map(x => x.body), [{ action: "entitlement-policy" }]);
});
