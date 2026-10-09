import assert from "node:assert/strict";
import fs from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import test from "node:test";

const source = fs.readFileSync(new URL("../app/open-contract.server.ts", import.meta.url), "utf8");
// Execute the real reader with an isolated HTTP boundary. D1 and credential
// writes are outside discovery and are never invoked.
const javascript = stripTypeScriptTypes(source)
  .replace(/^import .*;$/gm, "")
  .replace(/^export /gm, "");
const reader = new Function("fetch", "contractCategoryProfiles", javascript + "\nreturn discoverContract;");

function catalog(index) {
  return {
    id: "app-" + index, name: "App " + index, short_name: "App " + index,
    category: "Học tập", origin: "https://app-" + index + ".test",
    public_url: "https://app-" + index + ".test/client", repository: null,
    contract_path: "/api/application-management/contract", enabled: 1,
    credential_ciphertext: null, credential_iv: null,
    created_by: "fixture", created_at: "2026-10-08", updated_at: "2026-10-08",
  };
}

function manifest(id, version = "preferred") {
  return {
    schema: "application-management.contract/v1",
    application: { id, name: id, category: "Học tập", version },
    capabilities: { deviceAutoApproval: true },
    endpoints: { automation: "/api/control/automation" },
  };
}

test("valid configured contracts leave Worker subrequests for independent automation readback", async () => {
  let calls = 0;
  const http = async (raw, init) => {
    assert.equal(init.method, "GET");
    if (++calls > 50) throw new Error("Too many subrequests by single Worker invocation.");
    const url = new URL(raw);
    return Response.json(url.pathname === "/api/control/automation"
      ? { automation: { autoApproveDevices: true } }
      : manifest(url.hostname.split(".")[0]));
  };
  const discover = reader(http, { "Học tập": {} });
  const entries = Array.from({ length: 9 }, (_, index) => catalog(index));
  const contracts = await Promise.all(entries.map(row => discover(row, "fixture-credential", "Học tập")));
  assert.equal(contracts.length, 9);
  const policies = await Promise.all(entries.map(row => http(row.origin + "/api/control/automation", { method: "GET" }).then(r => r.json())));
  assert.ok(policies.every(p => p.automation.autoApproveDevices === true));
  assert.equal(calls, 18, "one configured contract and one independent readback per app");
});

test("an unavailable app does not exhaust readbacks for healthy apps", async () => {
  let calls = 0;
  const http = async raw => {
    if (++calls > 50) throw new Error("Too many subrequests by single Worker invocation.");
    const url = new URL(raw);
    if (url.hostname === "app-0.test") return Response.json({}, { status: 503 });
    return Response.json(url.pathname === "/api/control/automation"
      ? { automation: { autoApproveDevices: false } }
      : manifest(url.hostname.split(".")[0]));
  };
  const discover = reader(http, { "Học tập": {} });
  const entries = Array.from({ length: 9 }, (_, index) => catalog(index));
  const contracts = await Promise.allSettled(entries.map(row => discover(row, "fixture-credential", "Học tập")));
  assert.equal(contracts[0].status, "rejected");
  assert.ok(contracts.slice(1).every(result => result.status === "fulfilled"));
  const policies = await Promise.all(entries.slice(1).map(row => http(row.origin + "/api/control/automation").then(r => r.json())));
  assert.ok(policies.every(p => p.automation.autoApproveDevices === false));
  assert.ok(calls < 50);
});

test("failed configured paths retain parallel fallback discovery and deterministic priority", async () => {
  const row = catalog(0);
  row.contract_path = "/obsolete.json";
  const releases = new Map();
  const http = async raw => {
    const path = new URL(raw).pathname;
    if (path === "/obsolete.json") return Response.json({}, { status: 404 });
    return new Promise(resolve => releases.set(path, resolve));
  };
  const discover = reader(http, { "Học tập": {} });
  const pending = discover(row, "", "Học tập");
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(releases.size, 9, "all fallback paths start before any fallback completes");
  releases.get("/control/application-management.contract.json")(Response.json(manifest(row.id, "later")));
  releases.get("/api/application-management/contract")(Response.json(manifest(row.id, "canonical")));
  for (const [path, release] of releases) {
    if (path !== "/control/application-management.contract.json" && path !== "/api/application-management/contract") release(Response.json({}, { status: 404 }));
  }
  const result = await pending;
  assert.equal(result.application.version, "canonical");
  assert.equal(result.discoveredVia, "/api/application-management/contract");
});

test("invalid contract identity and rejected credentials remain fail-closed", async () => {
  const row = catalog(0);
  const discover = reader(async raw => {
    const path = new URL(raw).pathname;
    return path === row.contract_path
      ? Response.json(manifest("another-app"))
      : Response.json({}, { status: 403 });
  }, { "Học tập": {} });
  await assert.rejects(discover(row, "invalid-ticket", "Học tập"), /application\.id không khớp catalog.*HTTP_403/);
});

test("unreachable configured and fallback paths finish with a bounded timeout error", async t => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const discover = reader(async (raw, init) => new Promise((resolve, reject) => {
    init.signal.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
  }), { "Học tập": {} });
  const pending = assert.rejects(discover(catalog(0), "", "Học tập"), /Contract phản hồi quá 5 giây/);
  await new Promise(resolve => setImmediate(resolve));
  t.mock.timers.tick(5_000);
  await new Promise(resolve => setImmediate(resolve));
  t.mock.timers.tick(5_000);
  await pending;
});

test("device and automation reads run concurrently after manifest discovery", () => {
  const start = source.indexOf("export async function probeManagedCatalogEntry");
  const end = source.indexOf("export async function probeDynamicManagedApplications", start);
  const block = source.slice(start, end);
  assert.match(block, /const deviceRead =/);
  assert.match(block, /const automationRead =/);
  assert.match(block, /await Promise\.all\(\[deviceRead, automationRead\]\)/);
});

