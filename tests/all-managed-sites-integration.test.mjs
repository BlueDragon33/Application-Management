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

test("dashboard v2 renders the registry instead of a second hard-coded app allow-list", () => {
  const dashboard = read("app/management-dashboard-v2.tsx");
  assert.match(dashboard, /const activeApps = applicationRegistry;/);
  assert.match(dashboard, /activeApps\.map\(\(app\) => app\.id\)/);
  assert.doesNotMatch(dashboard, /ACTIVE_APP_IDS/);
  for (const id of ["boi-ech", "health-care", "ru-life", "bauman-master-ai", "price-report-tunggiabao", "growup-mychildren"]) {
    assert.match(read("app/application-registry.ts"), new RegExp(`id: "${id}"`));
  }
});

test("server bootstrap connects every registered client and keeps GrowUP admin local-contract backed", () => {
  const operations = read("app/api/operations/route.ts");
  for (const loader of ["loadBoi(actor)", "loadHealth(actor)", "loadRu(actor)", "loadBauman(actor)", "loadPriceReport(actor)", "loadGrowUp(actor)"]) {
    assert.ok(operations.includes(loader), `missing operations loader: ${loader}`);
  }
  assert.match(operations, /probeGrowUpManagementContract/);
  assert.match(operations, /issueGrowUpBrowserBridge/);
  assert.match(operations, /remoteAdminReady: contract\.remoteAdminReady/);
  assert.match(operations, /if \(appId === "growup-mychildren"\)/);
});

test("full local topology composes all six managed clients", () => {
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
