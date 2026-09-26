import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

function read(path) {
  return fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("operations dashboard does not hide managed clients on the browser", () => {
  const client = read("app/admin-device-client.ts");
  assert.doesNotMatch(client, /focusOperationsBootstrap/);
  assert.doesNotMatch(client, /focusedOperationsAppIds/);
  assert.match(client, /const reconciledDeviceActionAppIds = new Set\(\["boi-ech", "bauman-master-ai"\]\)/);
  assert.match(client, /const bootstrap = await secureApi\("\/api\/operations"/);
  assert.match(client, /return parsed;/);
});

test("dashboard v2 renders the static registry plus D1 catalog instead of a second hard-coded app allow-list", () => {
  const dashboard = read("app/management-dashboard-v2.tsx");
  assert.match(dashboard, /const staticApps = applicationRegistry;/);
  assert.match(dashboard, /operations\?\.managedApps \?\? \[\]/);
  assert.match(dashboard, /new Map<string, ApplicationConfig>/);
  assert.match(dashboard, /new Set\(activeApps\.map\(\(app\) => app\.id\)\)/);
  assert.doesNotMatch(dashboard, /ACTIVE_APP_IDS/);
  for (const id of ["boi-ech", "health-care", "ru-life", "bauman-master-ai", "price-report-tunggiabao", "growup-mychildren", "nc03-modem"]) {
    assert.match(read("app/application-registry.ts"), new RegExp(`id: "${id}"`));
  }
});

test("server bootstrap connects every registered client and keeps GrowUP admin local-contract backed", () => {
  const operations = read("app/api/operations/route.ts");
  for (const loader of ["loadBoi(actor)", "loadHealth(actor)", "loadRu(actor)", "loadBauman(actor)", "loadPriceReport(actor)", "loadGrowUp(actor)", "loadNc03Runtime()"]) {
    assert.ok(operations.includes(loader), `missing operations loader: ${loader}`);
  }
  assert.match(operations, /probeGrowUpManagementContract/);
  assert.match(operations, /issueGrowUpBrowserBridge/);
  assert.match(operations, /remoteAdminReady: contract\.remoteAdminReady/);
  assert.match(operations, /if \(appId === "growup-mychildren"\)/);
});

test("full local topology composes six managed control clients plus NC03 local runtime", () => {
  const launcher = read("scripts/run-local-system.mjs");
  const runAll = read("scripts/run-all.mjs");
  for (const token of [
    'Health_Care',
    'RU_LIFE',
    '127.0.0.1:3001',
    '127.0.0.1:3002',
    'HEALTH_CONTROL_SERVICE_SECRET',
    'RU_LIFE_CONTROL_SERVICE_SECRET',
  ]) {
    assert.ok(launcher.includes(token), `core launcher missing: ${token}`);
  }
  for (const token of [
    'GROWUP_PORT = 3006',
    'GROWUP_CONTROL_PORT = 3007',
    'PRICE_PORT = 3008',
    'PRICE_CONTROL_PORT = 3009',
    'GROWUP_CONTROL_SERVICE_SECRET',
    'PRICE_REPORT_CONTROL_SERVICE_SECRET',
    'price-report-tunggiabao',
    'NC03_Modem',
    'NC03_PORT = 3010',
    'nc03-modem',
  ]) {
    assert.ok(runAll.includes(token), `run-all missing: ${token}`);
  }
});

test("Boi and Bauman keep focused mutation routing while Health, RU and PriceReport use verified generic adapters", () => {
  const client = read("app/admin-device-client.ts");
  const focused = read("app/api/focused-device-operation/route.ts");
  const operations = read("app/api/operations/route.ts");
  assert.match(client, /reconciledDeviceActionAppIds\.has\(appId\)/);
  assert.match(focused, /appId === "boi-ech"/);
  assert.match(focused, /appId === "bauman-master-ai"/);
  assert.match(operations, /appId === "health-care"/);
  assert.match(operations, /appId === "ru-life"/);
  assert.match(operations, /appId === "price-report-tunggiabao"/);
});


test("NC03 is reachable from Application Management through the authenticated local launcher", () => {
  const registry = read("app/application-registry.ts");
  const launcher = read("app/api/local-web-launch/route.ts");
  const dashboard = read("app/management-dashboard-v2.tsx");
  const workspace = read("app/application-workspace.tsx");
  assert.match(registry, /localUrl: "\/api\/local-web-launch\?app=nc03-modem"/);
  assert.match(launcher, /"nc03-modem": \{ label: "NC03 Control Center", url: "http:\/\/127\.0\.0\.1:3010\/" \}/);
  assert.match(dashboard, /localRuntime && app\.localUrl/);
  assert.match(workspace, /Mở Website ↗/);
});


test("NC03 local runtime is contract-connected without proxying modem credentials", () => {
  const operations = read("app/api/operations/route.ts");
  const network = read("app/client-network-registry.ts");
  assert.match(network, /"nc03-runtime"/);
  assert.match(network, /applicationId: "nc03-modem"/);
  assert.match(operations, /resolveClientOrigin\("nc03-runtime"\)/);
  assert.match(operations, /\/api\/application-management\/contract/);
  assert.match(operations, /policy\.modemSecretsInControlPlane !== false/);
  assert.match(operations, /policy\.modemCommandsFromCloud !== false/);
  assert.match(operations, /managementMode: "local-first"/);
  assert.match(operations, /remoteAdminReady: false/);
});
