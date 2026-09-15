import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

function source(path) {
  return fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

const dashboardPath = "app/management-dashboard-v2.tsx";

test("root is the central Application Management dashboard, not the Boi Ech monolith", () => {
  const page = source("app/page.tsx");
  assert.match(page, /ApplicationHub/);
  assert.match(page, /management-dashboard-v2/);
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
  const legacyHub = source("app/application-hub.tsx");
  const workspace = source("app/application-workspace.tsx");
  const docs = source("docs/CONTROL_PLANE_TOPOLOGY.md");
  assert.match(registry, /tier: "client"/);
  assert.match(registry, /childClients: baumanChildren/);
  assert.match(registry, /BlueDragon33\/Math_Bauman/);
  for (const deviceClass of ["desktop", "tablet", "phone"]) assert.match(registry, new RegExp(`id: "${deviceClass}"`));
  assert.match(legacyHub, /LEVEL 0/);
  assert.match(legacyHub, /LEVEL 1/);
  assert.match(legacyHub, /ENDPOINT/);
  assert.match(workspace, /LEVEL 1 · CLIENT/);
  assert.match(workspace, /LEVEL 2 · SUB-CLIENT/);
  assert.match(docs, /Server → Client → Sub-client → Endpoint|SERVER \/ CONTROL PLANE/i);
});

test("central navigation is an operations shell with direct client administration routes", () => {
  const dashboard = source(dashboardPath);
  assert.match(dashboard, /type View = "overview" \| "applications" \| "devices" \| "users" \| "approvals"/);
  assert.match(dashboard, /Yêu cầu chờ duyệt/);
  assert.match(dashboard, /Thiết bị/);
  assert.match(dashboard, /Đồng bộ dữ liệu/);
  assert.match(dashboard, /href=\{application\.href\}/);
  assert.match(dashboard, />Quản trị<\/Link>/);
  assert.doesNotMatch(dashboard, /Mảng Y tế|Mở Site Sức khỏe|Cấp quyền Web App|Vào quản trị Y tế/);
});

test("dashboard supports global search and scalable application and device views", () => {
  const dashboard = source(dashboardPath);
  assert.match(dashboard, /Tìm kiếm ứng dụng, thiết bị, người dùng/);
  assert.match(dashboard, /filteredApps/);
  assert.match(dashboard, /filteredDevices/);
  assert.match(dashboard, /appGridLarge/);
  assert.match(dashboard, /DeviceTable/);
  assert.match(dashboard, /managedApps = \[\.\.\.applicationRegistry\]/);
});

test("current dashboard composition keeps every operational surface interactive", () => {
  const dashboard = source(dashboardPath);
  const css = source("app/management-dashboard.module.css");
  for (const label of [
    "Tổng quan hệ thống",
    "Ứng dụng đang quản lý",
    "Thiết bị chờ duyệt",
    "Thiết bị đã duyệt",
    "Cảnh báo đồng bộ",
    "Hàng đợi duyệt trung tâm",
    "Tình trạng đồng bộ",
    "Kiểm soát vận hành",
  ]) assert.match(dashboard, new RegExp(label));
  assert.match(dashboard, /signout-with-chatgpt/);
  assert.match(dashboard, /centerAdminAction/);
  assert.match(dashboard, /refreshOperations/);
  assert.match(css, /\.sidebar/);
  assert.match(css, /\.topbar/);
  assert.match(css, /\.overviewGrid/);
});

test("requested operations controls are real, grouped, and contract-gated", () => {
  const dashboard = source(dashboardPath);
  const controls = source("app/management-controls.tsx");
  const route = source("app/api/operations/route.ts");
  const settings = source("app/operations-settings.server.ts");
  assert.match(dashboard, /dismiss-notifications/);
  assert.match(dashboard, /Truy cập web/);
  assert.match(dashboard, /manage-client-device/);
  assert.match(dashboard, /Duyệt/);
  assert.match(dashboard, /Loại bỏ/);
  assert.match(controls, /Times New Roman/);
  assert.match(controls, /appearanceBackgrounds/);
  assert.match(controls, /Tự động duyệt theo ứng dụng/);
  assert.match(controls, /Tự động từ chối theo ứng dụng/);
  assert.match(route, /dismiss-notifications/);
  assert.match(route, /set-auto-approval/);
  assert.match(route, /set-auto-reject/);
  assert.match(route, /set-auto-block-pending/);
  assert.match(route, /AUTO_APPROVE_SUPPORTED_APP_IDS/);
  assert.match(settings, /hashWorkItem/);
  assert.doesNotMatch(settings, /deviceCode|userLabel|learner|health/i);
});

test("operations shell paints cached data before a short bounded background refresh", () => {
  const dashboard = source(dashboardPath);
  const client = source("app/admin-device-client.ts");
  assert.match(dashboard, /readCachedOperations/);
  assert.match(client, /sessionStorage/);
  assert.match(client, /approvedSessionPromise/);
  assert.match(client, /OPERATIONS_CACHE_TTL_MS = 60_000/);
  assert.match(client, /clearCachedOperations/);
});

test("central UI reports client-owned devices and never claims central registry ownership", () => {
  const dashboard = source(dashboardPath);
  const operations = source("app/api/operations/route.ts");
  assert.match(dashboard, /registry của từng ứng dụng/);
  assert.match(dashboard, /device\.appName/);
  assert.match(operations, /appId/);
  assert.match(operations, /appName/);
  assert.match(operations, /deviceCode/);
  assert.doesNotMatch(operations, /CREATE TABLE|INSERT INTO|UPDATE .*devices|DELETE FROM/);
});

test("operations summary is signed, asynchronous and bounded per client", () => {
  const route = source("app/api/operations/route.ts");
  const client = source("app/admin-device-client.ts");
  assert.match(route, /verifyControlProof/);
  assert.match(route, /Promise\.all/);
  assert.match(route, /UPSTREAM_TIMEOUT_MS/);
  assert.match(route, /AbortController/);
  assert.match(route, /issueBoiBrowserBridge/);
  assert.match(route, /issueHealthBrowserBridge/);
  assert.match(route, /issueRuLifeBrowserBridge/);
  assert.match(route, /issueBaumanBrowserBridge/);
  assert.match(client, /connectOperationsDashboard/);
  assert.match(client, /secureApi\("\/api\/operations"/);
  assert.match(client, /Tải sau shell chính/);
  assert.match(route, /Client phản hồi quá thời hạn/);
});

test("generic client workspace uses one admin shell and does not embed runtime", () => {
  const workspace = source("app/application-workspace.tsx");
  assert.match(workspace, /QUẢN TRỊ CLIENT/);
  assert.match(workspace, /Thiết bị & quyền/);
  assert.match(workspace, /Nội dung & chỉnh sửa/);
  assert.match(workspace, /Không có “trung tâm quản trị con”/);
  assert.doesNotMatch(workspace, /<iframe/i);
  assert.doesNotMatch(workspace, /Mở Site|Cấp quyền Web App|Vào quản trị Y tế/);
});

test("central UI uses center and operations endpoints instead of the Boi application dashboard", () => {
  const dashboard = source(dashboardPath);
  const client = source("app/admin-device-client.ts");
  assert.match(dashboard, /connectAdminCenter/);
  assert.match(dashboard, /connectOperationsDashboard/);
  assert.doesNotMatch(dashboard, /\/api\/dashboard/);
  assert.match(client, /secureApi\("\/api\/center"/);
  assert.match(client, /secureApi\("\/api\/operations"/);
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

test("Health Care uses its own managed bridge and real client control surfaces", () => {
  const route = source("app/apps/health-care/page.tsx");
  const client = source("app/apps/health-care/health-care-admin.tsx");
  const bridgeRoute = source("app/api/apps/health-care/bridge/route.ts");
  const bridgeServer = source("app/health-care.server.ts");
  const originResolver = source("app/client-origin.server.ts");
  const adminClient = source("app/admin-device-client.ts");
  assert.match(route, /HealthCareAdmin/);
  assert.doesNotMatch(route, /ApplicationWorkspace/);
  assert.match(client, /\/api\/control\/devices/);
  assert.match(client, /\/api\/control\/policy/);
  assert.match(client, /\/api\/control\/sessions/);
  assert.match(client, /\/api\/control\/health-content/);
  assert.match(client, /\/api\/control\/audit/);
  assert.match(client, /Hồ sơ sức khỏe cá nhân không đi vào Application Management/);
  assert.match(bridgeRoute, /verifyControlProof/);
  assert.match(bridgeRoute, /issueHealthBrowserBridge/);
  assert.match(bridgeServer, /HEALTH_CONTROL_SERVICE_SECRET/);
  assert.match(bridgeServer, /resolveClientOrigin\("health-care"\)/);
  assert.match(originResolver, /HEALTH_CARE_BASE_URL/);
  assert.match(originResolver, /HEALTH_CARE_LOCAL_BASE_URL/);
  assert.match(bridgeServer, /application-management/);
  assert.match(bridgeServer, /health-care-control/);
  assert.match(bridgeServer, /local-control/);
  assert.match(bridgeServer, /cloud-control/);
  assert.match(adminClient, /connectHealthCareAdmin/);
  assert.match(adminClient, /\/api\/apps\/health-care\/bridge/);
});

test("unconnected applications do not expose fake device mutations", () => {
  const workspace = source("app/application-workspace.tsx");
  const dashboard = source(dashboardPath);
  assert.match(workspace, /Chưa bật thao tác khi backend chưa đủ/);
  assert.match(workspace, /Không dựng nút cấp quyền, mở Web App, duyệt hay chỉnh sửa giả/);
  assert.match(dashboard, /device\.canApprove/);
  assert.match(dashboard, /device\.canRemove/);
  assert.match(dashboard, /!device\.canApprove && !device\.canRemove/);
});
