import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { stripTypeScriptTypes } from "node:module";
import { loadTs } from "./helpers/load-ts.mjs";

// Real Central route, live-policy reader, audit and pending-change ledger.
// The external Boi HTTP boundary persists policy in SQLite and can lose only
// its full device inventory while its narrow policy endpoint remains healthy.
function fixture({ inventoryUnavailable = false } = {}) {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec("CREATE TABLE control_audit_log (id INTEGER PRIMARY KEY, actor TEXT, action TEXT, target TEXT, detail_json TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP)");
  sqlite.exec(fs.readFileSync("drizzle/0015_automation_policy_changes.sql", "utf8"));
  sqlite.exec("CREATE TABLE owning_policy (enabled INTEGER, days INTEGER, device_limit INTEGER); INSERT INTO owning_policy VALUES (1,30,25)");
  const requests = [];
  const database = { prepare(sql) {
    let values = [];
    const query = {
      bind(...args) { values = args; return query; },
      async first() { return sqlite.prepare(sql).get(...values) ?? null; },
      async all() { return { results: sqlite.prepare(sql).all(...values) }; },
      async run() { return { meta: { changes: sqlite.prepare(sql).run(...values).changes } }; },
    };
    return query;
  } };
  const control = { getControlDatabase: async () => database, verifyControlProof: async () => ({ role: "owner", email: "owner@example.test" }) };
  const boi = { issueBoiBrowserBridge: async () => ({ baseUrl: "https://boi.test", token: "fixture-only" }) };
  const unavailable = () => { throw new Error("Unrelated app must not block this policy transaction"); };
  const dependencies = {
    "../../control-device.server": control, "./control-device.server": control,
    "../../boi-ech.server": boi, "./boi-ech.server": boi,
    "../../application-registry": { applicationRegistry: [{ id: "boi-ech" }] },
    "../../open-contract.server": { probeDynamicManagedApplications: unavailable, executeUniversalAutomationCommand: unavailable },
    "../../health-care.server": {}, "./health-care.server": {},
    "../../bauman.server": {}, "./bauman.server": {},
    "../../ru-life.server": {}, "./ru-life.server": {},
  };
  const state = () => {
    const row = sqlite.prepare("SELECT * FROM owning_policy").get();
    return { enabled: row.enabled === 1, defaultAccessDays: row.days, defaultDeviceLimit: row.device_limit };
  };
  const http = async (url, init) => {
    const pathname = new URL(url).pathname;
    assert.equal(new URL(url).origin, "https://boi.test");
    requests.push({ pathname, method: init.method });
    if (init.method === "POST") {
      assert.equal(pathname, "/api/control/overview");
      const payload = JSON.parse(init.body);
      assert.equal(payload.action, "update-automation");
      sqlite.prepare("UPDATE owning_policy SET enabled=?,days=?,device_limit=?").run(payload.enabled ? 1 : 0, payload.defaultAccessDays, payload.defaultDeviceLimit);
      return Response.json({ automation: state() });
    }
    if (pathname === "/api/control/overview" && inventoryUnavailable) return Response.json({ error: "Device inventory temporarily unavailable" }, { status: 503 });
    assert.ok(["/api/control/overview", "/api/control/automation"].includes(pathname));
    return Response.json({ automation: state(), ...(pathname.endsWith("overview") ? { devices: [] } : {}) });
  };
  const api = loadTs("app/api/operations-auto-approval/route.ts", dependencies, { fetch: http });
  const settings = loadTs("app/operations-settings.server.ts", dependencies, { fetch: http });
  return { sqlite, requests, state, read: () => settings.readAutoApprovalSettings([], ["boi-ech"], [], ["boi-ech"]), async save(days = 90, deviceLimit = 80) {
    const response = await api.POST(new Request("https://management.test/api/operations-auto-approval", { method: "POST", body: JSON.stringify({ action: "set-auto-approval", appIds: ["boi-ech"], targetAppIds: ["boi-ech"], defaultAccessDays: days, defaultDeviceLimit: deviceLimit }) }));
    return { status: response.status, ...await response.json() };
  } };
}

test("changing only Boi duration and capacity persists both fields and records independent live readback", async () => {
  const f = fixture();
  try {
    const result = await f.save();
    assert.equal(result.status, 200); assert.equal(result.ok, true);
    assert.deepEqual(f.state(), { enabled: true, defaultAccessDays: 90, defaultDeviceLimit: 80 });
    const policy = result.settings.automationPolicies.find(item => item.appId === "boi-ech");
    assert.equal(policy.current.freeAccessDays, 90); assert.equal(policy.current.freeDeviceLimit, 80);
    assert.equal(policy.verification.state, "live");
    const ledger = f.sqlite.prepare("SELECT state,observed_json FROM automation_policy_changes").get();
    assert.equal(ledger.state, "applied");
    assert.deepEqual(JSON.parse(ledger.observed_json), { autoApprove: true, defaultAccessDays: 90, defaultDeviceLimit: 80 });
  } finally { f.sqlite.close(); }
});

function dashboardWriter(settings, action, confirm = true, appIds = ["boi-ech"]) {
  const source = fs.readFileSync("app/management-dashboard-v2.tsx", "utf8");
  const start = source.indexOf("  async function saveAutomation(");
  const end = source.indexOf("\n  async function manageControlDevice", start);
  assert.ok(start > 0 && end > start);
  const client = loadTs("app/admin-device-client.ts");
  let current = { settings }; let stepUp = false;
  const busy = []; const notices = [];
  const values = { automationSaveLockRef: { current: false }, automationSnapshotVerified: true,
    setNotice: message => notices.push(message), setActionBusy: value => busy.push(value),
    operations: current, activeApps: [{ id: "boi-ech", shortName: "Bơi Ếch" }],
    operationsAction: body => action(body, client.AdminApiError),
    refreshOperations: async () => { throw new Error("A policy save cannot wait for a full dashboard refresh"); },
    window: { confirm: () => confirm, setTimeout: () => 1 },
    setOperations: update => { current = update(current); },
    setAutomationStepUpRequired: value => { stepUp = value; }, AdminApiError: client.AdminApiError,
  };
  const write = new Function(...Object.keys(values), `${stripTypeScriptTypes(source.slice(start, end))}; return saveAutomation;`)(...Object.values(values));
  return { write: authenticate => write({ appIds, autoBlockAppIds: [], pendingBlockAfterHoursByApp: {}, defaultAccessDays: 90, defaultDeviceLimit: 80 }, authenticate),
    busy, notices, get settings() { return current.settings; }, get stepUp() { return stepUp; } };
}

test("cancelling policy confirmation keeps the edited draft without writing the owning app", async () => {
  const f = fixture();
  try {
    const writer = dashboardWriter(await f.read(), async () => { throw new Error("Cancellation must not dispatch a write"); }, false);
    assert.equal(await writer.write(), null);
    assert.deepEqual(f.state(), { enabled: true, defaultAccessDays: 30, defaultDeviceLimit: 25 });
    assert.equal(writer.busy.at(-1), "");
  } finally { f.sqlite.close(); }
});

test("failed duration save preserves the user's draft and exposes the required authentication step", async () => {
  const f = fixture();
  try {
    const { productionStepUpGate } = loadTs("worker/production-auth.ts");
    const response = await productionStepUpGate(new Request("https://management.test/api/operations-auto-approval", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "set-auto-approval" }) }),
      { APPLICATION_MANAGEMENT_MFA_ENCRYPTION_KEY: "A".repeat(43), DB: { prepare: () => ({ bind() { return this; }, first: async () => ({ account_email: "owner@example.test", factor_type: "totp", secret_ciphertext: "opaque", secret_iv: "opaque", enabled: 1, verified_at: 1 }) }) } }, { email: "owner@example.test", stepUpAt: null });
    assert.equal(response.status, 403);
    const rejection = await response.json();
    let authenticated = false;
    const writer = dashboardWriter(await f.read(), async (body, AdminApiError) => {
      if (!authenticated) throw new AdminApiError(rejection.error, rejection);
      return f.save(body.defaultAccessDays, body.defaultDeviceLimit);
    });
    assert.equal(await writer.write(), null, "a failed save must not be returned as a successful old-value readback");
    assert.equal(writer.settings.freeAccessDaysByApp["boi-ech"], 30);
    assert.equal(writer.stepUp, true);
    assert.equal(writer.busy.at(-1), "");
    assert.match(writer.notices.at(-1), /Authenticator/);
    assert.equal(f.requests.filter(request => request.method === "POST").length, 0);
    const allowed = await productionStepUpGate(new Request("https://management.test/api/operations-auto-approval", { method: "POST" }),
      { APPLICATION_MANAGEMENT_MFA_ENCRYPTION_KEY: "A".repeat(43), DB: { prepare: () => ({ bind() { return this; }, first: async () => ({ enabled: 1 }) }) } },
      { email: "owner@example.test", stepUpAt: Math.floor(Date.now() / 1000) });
    assert.equal(allowed, null, "a fresh authenticated step-up permits the intended retry");
    authenticated = true;
    const confirmed = await writer.write();
    assert.equal(confirmed.freeAccessDaysByApp["boi-ech"], 90); assert.equal(confirmed.freeDeviceLimitByApp["boi-ech"], 80);
    assert.equal(writer.stepUp, false); assert.equal(writer.busy.at(-1), "");
  } finally { f.sqlite.close(); }
});

test("an unavailable full device inventory cannot fail a successfully persisted Boi policy save", async () => {
  const f = fixture({ inventoryUnavailable: true });
  try {
    const result = await f.save();
    assert.deepEqual(f.state(), { enabled: true, defaultAccessDays: 90, defaultDeviceLimit: 80 });
    assert.equal(result.status, 200, result.error);
    assert.equal(result.settings.freeAccessDaysByApp["boi-ech"], 90);
    assert.equal(result.settings.freeDeviceLimitByApp["boi-ech"], 80);
    assert.equal(f.requests.filter(request => request.method === "POST").length, 1);
  } finally { f.sqlite.close(); }
});


test("a required step-up resumes the pending exact policy save without a second confirmation", async () => {
  const f = fixture();
  try {
    let authenticated = false; let prompts = 0; let attempts = 0;
    const writer = dashboardWriter(await f.read(), async (body, AdminApiError) => {
      attempts++;
      if (!authenticated) throw new AdminApiError("Authenticator required", { code: "STEP_UP_REQUIRED" });
      return f.save(body.defaultAccessDays, body.defaultDeviceLimit);
    });
    const result = await writer.write(async () => { prompts++; authenticated = true; return true; });
    assert.equal(prompts, 1); assert.equal(attempts, 2);
    assert.equal(result.freeAccessDaysByApp["boi-ech"], 90);
    assert.deepEqual(f.state(), { enabled: true, defaultAccessDays: 90, defaultDeviceLimit: 80 });
    assert.equal(f.requests.filter(item => item.method === "POST").length, 1);
    assert.equal(writer.busy.at(-1), "");
  } finally { f.sqlite.close(); }
});

test("cancelled authentication preserves the draft and repeated gate rejection never loops", async () => {
  const f = fixture();
  try {
    for (const approved of [false, true]) {
      let prompts = 0; let attempts = 0;
      const writer = dashboardWriter(await f.read(), async (_body, AdminApiError) => {
        attempts++;
        throw new AdminApiError("Authenticator required", { code: "STEP_UP_REQUIRED" });
      });
      assert.equal(await writer.write(async () => { prompts++; return approved; }), null);
      assert.equal(prompts, 1); assert.equal(attempts, approved ? 2 : 1);
      assert.equal(writer.busy.at(-1), "");
      assert.deepEqual(f.state(), { enabled: true, defaultAccessDays: 30, defaultDeviceLimit: 25 });
    }
  } finally { f.sqlite.close(); }
});

test("uncertain transport failures are never replayed or sent to Authenticator", async () => {
  const f = fixture();
  try {
    let attempts = 0; let prompts = 0;
    const writer = dashboardWriter(await f.read(), async () => { attempts++; throw new Error("Connection lost"); });
    assert.equal(await writer.write(async () => { prompts++; return true; }), null);
    assert.equal(attempts, 1); assert.equal(prompts, 0);
  } finally { f.sqlite.close(); }
});


test("concurrent policy gates share one confirmation and retry only rejected tasks", async () => {
  const f = fixture();
  try {
    const settings = await f.read();
    const healthPolicy = { appId: "health-care", support: { autoApprove: true, autoBlockPending: false }, current: { autoApprove: false }, mutation: { autoApprove: true }, verification: { state: "live" } };
    settings.automationPolicies.push(healthPolicy);
    let authenticated = false; let prompts = 0; let attempts = 0; let accept;
    const waiting = new Promise(resolve => { accept = resolve; });
    const writer = dashboardWriter(settings, async (body, AdminApiError) => {
      attempts++;
      if (!authenticated) throw new AdminApiError("Authenticator required", { code: "STEP_UP_REQUIRED" });
      if (body.targetAppIds[0] === "boi-ech") return f.save(body.defaultAccessDays, body.defaultDeviceLimit);
      return { settings: { ...settings, automationPolicies: [{ ...healthPolicy, current: { autoApprove: true } }] } };
    }, true, ["boi-ech", "health-care"]);
    const running = writer.write(() => { prompts++; return waiting; });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(prompts, 1); assert.equal(attempts, 2);
    authenticated = true; accept(true);
    const result = await running;
    assert.equal(attempts, 4);
    assert.equal(result.freeAccessDaysByApp["boi-ech"], 90);
    assert.ok(result.autoApproveAppIds.includes("health-care"));
  } finally { f.sqlite.close(); }
});
