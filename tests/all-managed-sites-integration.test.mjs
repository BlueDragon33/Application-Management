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

test("server bootstrap connects every registered level-1 client and only promotes GrowUP through its real local control contract", () => {
  const operations = read("app/api/operations/route.ts");
  for (const loader of ["loadBoi(actor)", "loadHealth(actor)", "loadRu(actor)", "loadBauman(actor)", "loadPriceReport(actor)", "loadGrowUp(actor)"]) {
    assert.ok(operations.includes(loader), `missing operations loader: ${loader}`);
  }
  assert.match(operations, /probeGrowUpManagementContract/);
  assert.match(operations, /issueGrowUpBrowserBridge/);
  assert.match(operations, /if \(appId === "growup-mychildren"\)/);
  assert.match(operations, /remoteAdminReady/);
});

test("base local topology stays compatible while run:all adds GrowUP control", () => {
  const launcher = read("scripts/run-local-system.mjs");
  const bootstrap = read("scripts/run-local-offline-v2.mjs");
  const runAll = read("scripts/run-all.mjs");
  for (const token of [
    'Health_Care',
    'RU_LIFE',
    '127.0.0.1:3001',
    '127.0.0.1:3002',
    'HEALTH_CONTROL_SERVICE_SECRET',
    'RU_LIFE_CONTROL_SERVICE_SECRET',
    'boi-ech,health-care,ru-life,bauman-master-ai',
  ]) {
    assert.ok(launcher.includes(token), `launcher missing: ${token}`);
  }
  assert.ok(bootstrap.includes('existsSync(join(root, "Health_Care"))'));
  assert.ok(bootstrap.includes('existsSync(join(root, "RU_LIFE"))'));
  assert.match(runAll, /GrowUP_MyChildren/);
  assert.match(runAll, /GROWUP_CONTROL_SERVICE_SECRET/);
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
