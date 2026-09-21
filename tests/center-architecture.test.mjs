import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

function source(path) {
  return fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("root mounts the authenticated persistent ManagementEntry shell", () => {
  const page = source("app/page.tsx");
  const entry = source("app/management-entry.tsx");
  assert.match(page, /requireChatGPTUser\("\/"\)/);
  assert.match(page, /ManagementEntry/);
  assert.match(entry, /ManagementDashboardV2/);
  assert.doesNotMatch(page, /ControlCenter/);
});

test("legacy Boi admin monolith and CSS hiding hacks stay deleted", () => {
  assert.equal(fs.existsSync(new URL("../app/control-center.tsx", import.meta.url)), false);
  assert.equal(fs.existsSync(new URL("../app/boi-admin-boundary.module.css", import.meta.url)), false);
  assert.equal(fs.existsSync(new URL("../app/api/content/route.ts", import.meta.url)), false);
});

test("central API verifies signed control-device proof and owns only central permissions", () => {
  const route = source("app/api/center/route.ts");
  assert.match(route, /verifyControlProof/);
  assert.match(route, /manage-control-device/);
  assert.match(route, /actorDevice\.role !== "owner"/);
  assert.doesNotMatch(route, /payment|learner|health-content|course-content/i);
});

test("application registry keeps one top-level entry per client", () => {
  const text = source("app/application-registry.ts");
  const registry = text.slice(text.indexOf("export const applicationRegistry"));
  for (const id of ["boi-ech", "health-care", "ru-life", "bauman-master-ai", "growup-mychildren"]) {
    assert.equal((registry.match(new RegExp(`id: "${id}"`, "g")) ?? []).length, 1);
  }
  assert.match(text, /childClients: baumanChildren/);
  assert.match(text, /BlueDragon33\/Math_Bauman/);
});

test("current dashboard exposes one persistent operations shell", () => {
  const dashboard = source("app/management-dashboard-v2.tsx");
  assert.match(dashboard, /type View = "overview" \| "approvals" \| "applications" \| "devices" \| "alerts" \| "audit" \| "settings"/);
  for (const label of ["Tổng quan", "Hộp việc", "Ứng dụng", "Thiết bị mới", "Cảnh báo", "Nhật ký", "Cấu hình"]) {
    assert.match(dashboard, new RegExp(label));
  }
  assert.match(dashboard, /window\.history\.pushState/);
  assert.doesNotMatch(dashboard, /window\.location\.assign\(nextUrl\)/);
});

test("dashboard search and filtering operate on real client data", () => {
  const dashboard = source("app/management-dashboard-v2.tsx");
  assert.match(dashboard, /const \[search, setSearch\]/);
  assert.match(dashboard, /const \[appFilter, setAppFilter\]/);
  assert.match(dashboard, /filteredApps/);
  assert.match(dashboard, /filteredDevices/);
  assert.match(dashboard, /filteredWork/);
  assert.match(dashboard, /connectOperationsDashboard/);
});

test("dashboard reads cached operations before bounded live refresh", () => {
  const dashboard = source("app/management-dashboard-v2.tsx");
  const client = source("app/admin-device-client.ts");
  assert.match(dashboard, /readCachedOperations/);
  assert.match(dashboard, /refreshOperations/);
  assert.match(client, /sessionStorage/);
  assert.match(client, /approvedSessionPromise/);
  assert.match(client, /10 \* 60_000/);
});

test("client device mutations are verified through the owning client", () => {
  const dashboard = source("app/management-dashboard-v2.tsx");
  const operations = source("app/api/operations/route.ts");
  const focused = source("app/api/focused-device-operation/route.ts");
  assert.match(dashboard, /await operationsAction/);
  assert.match(dashboard, /await refreshOperations\(true\)/);
  assert.match(operations, /verifyControlProof/);
  assert.match(focused, /DEVICE_COMMAND_READBACK_MISMATCH/);
  assert.doesNotMatch(operations, /CREATE TABLE|INSERT INTO|UPDATE .*devices|DELETE FROM/);
});

test("Bauman stays a level-1 client with independent subject children", () => {
  const registry = source("app/application-registry.ts");
  const bauman = source("app/apps/bauman-master-ai/bauman-admin.tsx");
  assert.match(registry, /id: "bauman-master-ai"/);
  assert.match(registry, /childClients: baumanChildren/);
  assert.match(bauman, /CLIENT CẤP 1/);
  assert.match(bauman, /LEVEL 2 · SUB-CLIENTS/);
  assert.doesNotMatch(bauman, /<iframe/i);
});

test("Boi Ech remains a physically isolated client control center", () => {
  const route = source("app/apps/boi-ech/page.tsx");
  const client = source("app/apps/boi-ech/boi-ech-control-center.tsx");
  assert.match(route, /BoiEchControlCenter/);
  assert.doesNotMatch(route, /boiBoundary|\.\.\/\.\.\/control-center/);
  assert.doesNotMatch(client, /manage-control-device|controlDevices|roleCapabilities/);
});

test("Health Care and RU LIFE use dedicated bridges", () => {
  const health = source("app/health-care.server.ts");
  const ru = source("app/ru-life.server.ts");
  assert.match(health, /resolveClientOrigin\("health-care"\)/);
  assert.match(ru, /resolveClientOrigin\("ru-life"\)/);
  assert.doesNotMatch(health, /dinhnam3391\.chatgpt\.site/);
  assert.doesNotMatch(ru, /dinhnam3391\.chatgpt\.site/);
});

test("unconnected clients remain capability-gated rather than receiving fake live state", () => {
  const dashboard = source("app/management-dashboard-v2.tsx");
  const route = source("app/api/operations/route.ts");
  assert.match(dashboard, /Chờ contract/);
  assert.match(route, /config\.contractState !== "connected"/);
  assert.match(route, /connection = config\.contractState === "pending" \? "pending" : "warning"/);
});
