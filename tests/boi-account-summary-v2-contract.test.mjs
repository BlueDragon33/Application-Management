import assert from "node:assert/strict";
import test from "node:test";
import { loadTs } from "./helpers/load-ts.mjs";

const goodCounts = { totalAccounts: 5, pending: 1, active: 1, suspended: 1, expired: 1, unverified: 2 };
const goodPayload = { contract: "boi-account-summary.v2", verified: true, asOf: "2026-11-09T08:00:00.000Z", counts: goodCounts };

function fixture({ upstreamStatus = 200, upstream = goodPayload } = {}) {
  const requests = [];
  const api = loadTs("app/api/apps/boi-ech/access/route.ts", {
    "../../../../control-device.server": {
      verifyControlProof: async input => ({ role: input.testRole || "owner", email: "manager@example.test" }),
      controlErrorResponse: error => Response.json({ error: error.message }, { status: 500 }),
    },
    "../../../../boi-ech.server": {
      issueBoiBrowserBridge: async () => ({ baseUrl: "https://boi.example.test", token: "scope-limited-test-ticket" }),
    },
  }, {
    fetch: async (url, init) => {
      requests.push({ url, init });
      return Response.json(upstream, { status: upstreamStatus });
    },
  });
  return { requests, async post(body = {}) {
    const response = await api.POST(new Request("https://management.example.test/api/apps/boi-ech/access", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "bootstrap", ...body }),
    }));
    return { status: response.status, payload: await response.json() };
  } };
}

test("App bootstrap consumes exactly V2 aggregate-only GET and never carries personal rows", async () => {
  for (const role of ["owner", "publisher"]) {
    const f = fixture();
    const { status, payload } = await f.post({ testRole: role });
    assert.equal(status, 200);
    assert.equal(payload.ok, true);
    assert.equal(payload.verified, true);
    assert.equal(payload.contract, "boi-account-summary.v2");
    assert.deepEqual(payload.summary, goodCounts);
    assert.deepEqual(payload.devices, []);
    assert.equal(payload.counts, null, "account totals must not impersonate legacy device/payment counts");
    assert.equal(payload.generatedAt, goodPayload.asOf);
    assert.deepEqual(f.requests.map(x => x.url), ["https://boi.example.test/api/control/v2/account-summary"]);
    assert.equal(f.requests[0].init.method, "GET");
    assert.doesNotMatch(JSON.stringify(payload), /learnerName|phone|personCode|accountId|paymentStatus/);
  }
});

test("viewer/reviewer blocked before bridge, upstream 401/403/409 propagated, no misleading zero", async () => {
  for (const role of ["viewer", "reviewer"]) {
    const f = fixture();
    const { status, payload } = await f.post({ testRole: role });
    assert.equal(status, 403);
    assert.equal(payload.code, "ACCOUNT_SUMMARY_FORBIDDEN");
    assert.equal(f.requests.length, 0);
  }
  for (const status of [401, 403, 409]) {
    const f = fixture({ upstreamStatus: status, upstream: { error: "Denied", code: "ACCOUNT_V2_REQUIRED" } });
    const result = await f.post();
    assert.equal(result.status, status);
    assert.equal(result.payload.summary, undefined);
  }
});

test("V2 version/schema mismatches and extra personal fields fail closed", async () => {
  const candidates = [
    { ...goodPayload, contract: "boi-account-summary.v3" },
    { ...goodPayload, verified: false },
    { ...goodPayload, accounts: [{ name: "private" }] },
    { ...goodPayload, counts: { ...goodCounts, learnerName: "private" } },
    { ...goodPayload, counts: { ...goodCounts, active: -1 } },
    { ...goodPayload, counts: { ...goodCounts, pending: 100 } },
    { ...goodPayload, asOf: "invalid" },
  ];
  for (const payload of candidates) {
    const f = fixture({ upstream: payload });
    const response = await f.post();
    assert.equal(response.status, 502);
    assert.equal(response.payload.code, "BOI_ACCOUNT_SUMMARY_CONTRACT_MISMATCH");
    assert.equal(response.payload.verified, false);
    assert.equal(response.payload.summary, undefined);
  }
});
