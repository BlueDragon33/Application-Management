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

test("upstream HTTP redirect is refused before any impersonated V2 aggregate can be accepted", async () => {
  const f = fixture({ upstreamStatus: 302, upstream: goodPayload });
  const result = await f.post();
  assert.equal(result.status, 502);
  assert.equal(result.payload.code, "BOI_CONTROL_REDIRECT_FORBIDDEN");
  assert.equal(result.payload.summary, undefined);
  assert.equal(f.requests.length, 1);
  assert.equal(f.requests[0].init.redirect, "manual", "never auto-follow another origin");
});

test("Owner registry uses the signed BOI read endpoint and fails closed on an invalid upstream response", async () => {
  const deviceId = "d".repeat(64);
  const registry = { ok: true, application: "boi-ech", contract: "boi-device-registry.v2", readOnly: true,
    devices: [{ deviceId, status: "pending" }], counts: { total: 1 } };
  const requestCalls = [];
  let upstream = Response.json(registry);
  const route = loadTs("app/api/apps/boi-ech/access/route.ts", {
    "./client-origin.server": {
      resolveClientBridge: async () => ({ baseUrl: "https://boi.example.test", secret: "fixture-bridge-secret-for-device-readback", source: "fixture" }),
    },
    "../../../../control-device.server": {
      verifyControlProof: async input => ({ role: input.testRole, email: "owner@example.test" }),
      controlErrorResponse: () => Response.json({}, { status: 500 }),
    },
  }, {
    fetch: async (url, init) => {
      requestCalls.push({ url, init });
      if (url.endsWith("/api/control/runtime")) return Response.json({ applicationId: "boi-ech",
        repository: "BlueDragon33/BOIECH_AI", runtime: "boi-ech", controlContract: "application-management", controlGeneration: 2, sourceTrack: "main" });
      return upstream.clone();
    },
  });
  const read = testRole => route.POST(new Request("https://management.example.test/api/apps/boi-ech/access", {
    method: "POST", body: JSON.stringify({ action: "device-registry", testRole }),
  }));
  assert.equal((await read("publisher")).status, 403);
  assert.equal(requestCalls.length, 0);
  const success = await read("owner");
  assert.equal(success.status, 200);
  assert.deepEqual(await success.json(), registry);
  assert.equal(requestCalls[1].url, "https://boi.example.test/api/control/v2/device-registry");
  assert.equal(requestCalls[1].init.method, "GET");
  assert.match(requestCalls[1].init.headers.authorization, /^Bearer v1\./);
  for (const candidate of [
    Response.json({ ...registry, counts: { total: 0 } }),
    Response.json({ ...registry, devices: [{ deviceId, status: "pending", accountId: "PRIVATE" }] }),
    Response.json({ code: "CONTROL_TICKET_FORBIDDEN" }, { status: 403 }),
    new Response(null, { status: 302 }),
  ]) {
    upstream = candidate;
    const rejected = await read("owner");
    assert.equal(rejected.status, 502);
    assert.equal((await rejected.json()).counts, undefined);
  }
});
