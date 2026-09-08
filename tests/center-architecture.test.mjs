import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

function source(path) {
  return fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("root is a central ApplicationHub, not the Boi Ech monolith", () => {
  const page = source("app/page.tsx");
  assert.match(page, /ApplicationHub/);
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

test("application registry has exactly one top-level entry per client", () => {
  const sourceText = source("app/application-registry.ts");
  const registry = sourceText.slice(sourceText.indexOf("export const applicationRegistry"));
  for (const id of ["boi-ech", "health-care", "ru-life", "bauman-master-ai", "growup-mychildren"]) {
    const matches = registry.match(new RegExp(`id: "${id}"`, "g")) ?? [];
    assert.equal(matches.length, 1, `${id} must exist exactly once in the top-level registry`);
  }
  assert.match(sourceText, /desktop\/phone\/tablet-iPad|máy tính, điện thoại, tablet\/iPad/i);
  assert.match(sourceText, /Không dùng API\/DB Bơi ếch|Không chia sẻ registry Bơi ếch|Không dùng DB ứng dụng khác/);
});

test("Health Care and RU LIFE stay separate top-level clients", () => {
  const sourceText = source("app/application-registry.ts");
  const registry = sourceText.slice(sourceText.indexOf("export const applicationRegistry"));
  const healthStart = registry.indexOf('id: "health-care"');
  const ruStart = registry.indexOf('id: "ru-life"');
  assert.ok(healthStart >= 0 && ruStart > healthStart);
  const healthBlock = registry.slice(healthStart, ruStart);
  assert.doesNotMatch(healthBlock, /Hòa nhập Nga|RU_LIFE/);
});

test("topology stays Server to Client to Sub-client to Endpoint without duplicate topology screens", () => {
  const registry = source("app/application-registry.ts");
  const hub = source("app/application-hub.tsx");
  const workspace = source("app/application-workspace.tsx");
  const docs = source("docs/CONTROL_PLANE_TOPOLOGY.md");
  assert.match(registry, /tier: "client"/);
  assert.match(registry, /childClients: baumanChildren/);
  assert.match(registry, /BlueDragon33\/Math_Bauman/);
  for (const deviceClass of ["desktop", "tablet", "phone"]) {
    assert.match(registry, new RegExp(`id: "${deviceClass}"`));
  }
  assert.match(hub, /Một server → nhiều client → thiết bị/);
  assert.match(hub, /ENDPOINT/);
  assert.match(workspace, /LEVEL 1 · CLIENT/);
  assert.match(workspace, /LEVEL 2 · SUB-CLIENT/);
  assert.doesNotMatch(hub, /function ApplicationCard|function TopologyMap/);
  assert.match(docs, /Server → Client → Sub-client → Endpoint|SERVER \/ CONTROL PLANE/i);
});

test("central navigation is compact and clients link directly to their admin routes", () => {
  const hub = source("app/application-hub.tsx");
  assert.match(hub, /type CenterView = "overview" \| "devices" \| "audit"/);
  assert.match(hub, /CLIENT/);
  assert.match(hub, /href=\{application\.href\}/);
  assert.doesNotMatch(hub, /Mảng Y tế|Mở Site Sức khỏe|Cấp quyền Web App|Vào quản trị Y tế/);
});

test("central UI makes admin devices distinct from client endpoints", () => {
  const hub = source("app/application-hub.tsx");
  assert.match(hub, /Đây chỉ là thiết bị quản trị Application Management/);
  assert.match(hub, /Thiết bị được phân loại và lưu trong registry của client sở hữu nó/);
  assert.match(hub, /Thiết bị người dùng của từng client phải quản lý trong khu quản trị của client đó/);
});

test("client workspace uses one admin shell and does not embed runtime", () => {
  const workspace = source("app/application-workspace.tsx");
  assert.match(workspace, /QUẢN TRỊ CLIENT/);
  assert.match(workspace, /Thiết bị & quyền/);
  assert.match(workspace, /Nội dung & chỉnh sửa/);
  assert.match(workspace, /Không có “trung tâm quản trị con”/);
  assert.doesNotMatch(workspace, /<iframe/i);
  assert.doesNotMatch(workspace, /Mở Site|Cấp quyền Web App|Vào quản trị Y tế/);
});

test("central UI uses center endpoint instead of application dashboard", () => {
  const hub = source("app/application-hub.tsx");
  const client = source("app/admin-device-client.ts");
  assert.match(hub, /connectAdminCenter/);
  assert.doesNotMatch(hub, /\/api\/dashboard/);
  assert.match(client, /secureApi\("\/api\/center"/);
});

test("Boi Ech has a physically isolated client control center", () => {
  const route = source("app/apps/boi-ech/page.tsx");
  const client = source("app/apps/boi-ech/boi-ech-control-center.tsx");
  assert.match(route, /BoiEchControlCenter/);
  assert.match(route, /Application Management/);
  assert.doesNotMatch(route, /boiBoundary|\.\.\/\.\.\/control-center/);
  assert.match(client, /type Dashboard =/);
  assert.match(client, /"devices" \| "ai" \| "content"/);
  assert.doesNotMatch(client, /"approvals"|"audit"|manage-control-device|controlDevices|application-list|roleCapabilities/);
  assert.match(client, /Quyền QT và audit Trung tâm nằm ở Application Management/);
});

test("Boi Ech dashboard bootstrap cannot own central device or audit state", () => {
  const dashboard = source("app/api/dashboard/route.ts");
  assert.match(dashboard, /issueBoiBrowserBridge/);
  assert.match(dashboard, /verifyControlProof/);
  assert.doesNotMatch(dashboard, /controlDevices|auditLog|applications:\s*\[/);
  assert.doesNotMatch(dashboard, /manage-control-device|CENTER_ACTION_MOVED/);
  assert.match(dashboard, /INVALID_BOI_DASHBOARD_ACTION/);
});

test("unconnected applications do not expose fake operational controls", () => {
  const workspace = source("app/application-workspace.tsx");
  assert.match(workspace, /Chưa bật thao tác khi backend chưa đủ/);
  assert.match(workspace, /Không dựng nút cấp quyền, mở Web App, duyệt hay chỉnh sửa giả/);
});
