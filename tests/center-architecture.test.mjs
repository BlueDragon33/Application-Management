import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

function source(path) {
  return fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}


test("root mounts the authenticated persistent management v2 shell, not the Boi Ech monolith", () => {
  const page = source("app/page.tsx");
  const entry = source("app/management-entry.tsx");
  assert.match(page, /ManagementEntry/);
  assert.match(entry, /ManagementDashboardV2/);
  assert.doesNotMatch(page, /ControlCenter|BoiEchControlCenter/);
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
  for (const id of ["boi-ech", "health-care", "ru-life", "bauman-master-ai", "growup-mychildren", "nc03-modem"]) {
    const matches = registry.match(new RegExp(`id: "${id}"`, "g")) ?? [];
    assert.equal(matches.length, 1, `${id} must exist exactly once in the top-level registry`);
  }
  assert.match(sourceText, /desktop\/phone\/tablet-iPad|máy tính, điện thoại, tablet\/iPad/i);
  assert.match(sourceText, /Không dùng API\/DB Bơi ếch|Không chia sẻ registry Bơi ếch|Không dùng DB ứng dụng khác/);
});

test("NC03 route has a matching pending registry entry and no fake remote control", () => {
  const sourceText = source("app/application-registry.ts");
  const route = source("app/apps/nc03-modem/page.tsx");
  const start = sourceText.indexOf('id: "nc03-modem", name: "NC03 Control Center"');
  const end = sourceText.indexOf("\n  },", start);
  const block = sourceText.slice(start, end);
  assert.ok(start >= 0, "NC03 registry entry must exist");
  assert.match(block, /contractState: "pending"/);
  assert.match(block, /BlueDragon33\/NC03_Modem/);
  assert.match(block, /Không lưu hoặc proxy mật khẩu admin NC03/);
  assert.match(block, /NC03 Control Center v\d+\.\d+\.\d+/);
  assert.match(block, /firmware 8\.00\.42/i);
  assert.match(block, /localUrl: "\/api\/local-web-launch\?app=nc03-modem"/);
  assert.match(block, /Offline\/PWA self-refresh/);
  assert.match(block, /Báo cáo chẩn đoán A4/);
  assert.match(block, /Privacy-safe report allow-list/);
  assert.match(route, /getApplicationConfig\("nc03-modem"\)/);
  assert.doesNotMatch(block, /contractState: "connected"/);
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
  for (const deviceClass of ["desktop", "tablet", "phone"]) assert.match(registry, new RegExp(`id: "${deviceClass}"`));
  assert.match(hub, /LEVEL 0/);
  assert.match(hub, /LEVEL 1/);
  assert.match(hub, /ENDPOINT/);
  assert.match(workspace, /LEVEL 1 · CLIENT/);
  assert.match(workspace, /LEVEL 2 · SUB-CLIENT/);
  assert.doesNotMatch(hub, /function ApplicationCard|function TopologyMap/);
  assert.match(docs, /Server → Client → Sub-client → Endpoint|SERVER \/ CONTROL PLANE/i);
});


test("central navigation is a persistent operations shell with direct client routes", () => {
  const dashboard = source("app/management-dashboard-v2.tsx");
  for (const label of ["Tổng quan", "Hộp việc", "Ứng dụng", "Thiết bị mới", "Cảnh báo", "Nhật ký", "Cấu hình"]) {
    assert.match(dashboard, new RegExp(label));
  }
  assert.match(dashboard, /window\.history\.pushState/);
  assert.match(dashboard, /href=\{app\.href\}/);
  assert.match(dashboard, /Truy cập web/);
});


test("dashboard v2 supports shared search, app filtering and compact application rows", () => {
  const dashboard = source("app/management-dashboard-v2.tsx");
  assert.match(dashboard, /const \[search, setSearch\]/);
  assert.match(dashboard, /const \[appFilter, setAppFilter\]/);
  assert.match(dashboard, /const filteredApps = activeApps\.filter/);
  assert.match(dashboard, /const filteredDevices = devices\.filter/);
  assert.match(dashboard, /className="amv2-app-row"/);
  assert.match(dashboard, /className="amv2-search"/);
});


test("dashboard v2 composition keeps every operational surface interactive", () => {
  const dashboard = source("app/management-dashboard-v2.tsx");
  const css = source("app/management-dashboard-v2-final.css");
  for (const label of [
    "Bảng điều phối quản trị ứng dụng",
    "Tổng ứng dụng",
    "Thiết bị mới chờ duyệt",
    "Cảnh báo hôm nay",
    "Ca kiểm duyệt cần xử lý",
    "Hộp việc ưu tiên",
    "Ứng dụng đang quản lý",
    "Cảnh báo nhanh",
    "Thiết bị mới theo ứng dụng",
  ]) assert.match(dashboard, new RegExp(label));
  assert.match(dashboard, /refreshOperations/);
  assert.match(dashboard, /operationsAction/);
  assert.match(css, /\.amv2-overview-grid/);
  assert.match(css, /\.amv2-apps-panel/);
});


test("requested operations controls are real, grouped, and contract-gated", () => {
  const dashboard = source("app/management-dashboard-v2.tsx");
  const route = source("app/api/operations/route.ts");
  const settings = source("app/operations-settings.server.ts");
  for (const label of ["Xóa hết thông báo", "Truy cập web", "Duyệt tự động", "Duyệt thiết bị", "Đồng bộ dữ liệu"]) {
    assert.match(dashboard, new RegExp(label));
  }
  assert.match(dashboard, /action: "manage-client-device"/);
  assert.match(route, /dismiss-notifications/);
  assert.match(route, /set-auto-approval/);
  assert.match(route, /delete-spam-device/);
  assert.match(route, /BOI_ACCESS_FLOW_REQUIRED/);
  assert.doesNotMatch(route, /operation === "approve"[\s\S]{0,700}action: "grant-free"/);
  assert.match(route, /AUTO_APPROVE_SUPPORTED_APP_IDS/);
  assert.match(settings, /hashWorkItem/);
  assert.doesNotMatch(settings, /deviceCode|userLabel|learner|health/i);
});

test("operations shell paints cached data before bounded background refresh", () => {
  const hub = source("app/application-hub.tsx");
  const client = source("app/admin-device-client.ts");
  assert.match(hub, /readCachedOperations/);
  assert.match(client, /sessionStorage/);
  assert.match(client, /approvedSessionPromise/);
  assert.match(client, /10 \* 60_000/);
});

test("central UI reports new devices with the owning application and never claims central ownership", () => {
  const hub = source("app/application-hub.tsx");
  const operations = source("app/api/operations/route.ts");
  assert.match(hub, /Thiết bị mới theo ứng dụng/);
  assert.match(hub, /Đây chỉ là thiết bị quản trị Application Management/);
  assert.match(hub, /Registry vẫn thuộc client|registry của client/);
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
  assert.match(route, /config\.contractState !== "connected"/);
  assert.match(route, /Client phản hồi quá thời hạn/);
});

test("Health and RU operational domains are visibly separate", () => {
  const hub = source("app/application-hub.tsx");
  assert.match(hub, /Kiểm duyệt y tế · quy tắc y khoa · audit y tế/);
  assert.match(hub, /Kiểm duyệt Nga · OCR thuốc · thiết bị HN · audit Nga/);
  assert.match(hub, /Không quản trị OCR hoặc ca Hòa nhập Nga/);
  assert.match(hub, /Không xử lý hồ sơ y tế tổng quát/);
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

test("central UI uses center and operations endpoints instead of Boi application dashboard", () => {
  const hub = source("app/application-hub.tsx");
  const client = source("app/admin-device-client.ts");
  assert.match(hub, /connectAdminCenter/);
  assert.match(hub, /connectOperationsDashboard/);
  assert.doesNotMatch(hub, /\/api\/dashboard/);
  assert.match(client, /secureApi\("\/api\/center"/);
  assert.match(client, /secureApi\("\/api\/operations"/);
});

test("Boi Ech has a physically isolated client control center", () => {
  const route = source("app/apps/boi-ech/page.tsx");
  const client = source("app/apps/boi-ech/boi-ech-control-center.tsx");
  assert.match(route, /BoiEchControlCenter/);
  assert.doesNotMatch(route, /boiBoundary|\.\.\/\.\.\/control-center/);
  assert.match(client, /Application Management/);
  assert.match(client, /type Dashboard =/);
  assert.match(client, /"overview" \| "devices" \| "ai" \| "content"/);
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
  const networkRegistry = source("app/client-network-registry.ts");
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
  assert.match(networkRegistry, /HEALTH_CARE_BASE_URL/);
  assert.match(networkRegistry, /HEALTH_CARE_LOCAL_BASE_URL/);
  assert.match(bridgeServer, /application-management/);
  assert.match(bridgeServer, /health-care-control/);
  assert.match(bridgeServer, /local-control/);
  assert.match(bridgeServer, /cloud-control/);
  assert.match(bridgeServer, /app:\s*TOKEN_APP/);
  assert.doesNotMatch(bridgeServer, /suc-khoe-tre\.boiech-ai\.workers\.dev/);
  assert.doesNotMatch(bridgeServer, /const TOKEN_ISSUER = "quan-ly-hoc-tap"/);
  assert.doesNotMatch(bridgeServer, /values\.CONTROL_SERVICE_SECRET\b/);
  assert.match(adminClient, /connectHealthCareAdmin/);
  assert.match(adminClient, /\/api\/apps\/health-care\/bridge/);
});


test("migrating applications distinguish verified local control from production readiness", () => {
  const workspace = source("app/application-workspace.tsx");
  const dashboard = source("app/management-dashboard-v2.tsx");
  const registry = source("app/application-registry.ts");
  assert.match(workspace, /Chưa bật thao tác khi backend chưa đủ/);
  assert.match(workspace, /Không dựng nút cấp quyền, mở Web App, duyệt hay chỉnh sửa giả/);
  assert.match(dashboard, /Không hiển thị dữ liệu giả/);
  assert.match(registry, /GrowUP đã có runtime\/PWA/);
  assert.match(registry, /local Control Service privacy-safe/);
  assert.match(registry, /Production remote vẫn chưa được coi là sẵn sàng/);
});