import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

const boiClientPath = "app/apps/boi-ech/boi-ech-control-center.tsx";

test("binds every central admin device to P-256 and a one-time challenge", async () => {
  const client = await source("app/admin-device-client.ts");
  const server = await source("app/control-device.server.ts");

  assert.match(client, /namedCurve: "P-256"/);
  assert.match(client, /false,\s*\["sign"\]/);
  assert.match(client, /learning-control:\$\{access\.deviceId\}:\$\{challenge\.challenge\}/);
  assert.match(server, /ORDER BY rowid DESC LIMIT 8/);
  assert.match(server, /DELETE FROM control_challenges WHERE nonce = \? AND device_id = \?/);
  assert.match(server, /crypto\.subtle\.verify/);
  assert.match(server, /DEVICE_MISMATCH/);
  assert.match(server, /DEVICE_USER_MISMATCH/);
});

test("keeps central device and member management exclusively in api center", async () => {
  const center = await source("app/api/center/route.ts");
  const dashboard = await source("app/api/dashboard/route.ts");
  const boiClient = await source(boiClientPath);

  assert.match(center, /action === "manage-control-device"/);
  assert.match(center, /actorDevice\.role !== "owner"/);
  assert.match(center, /OWNER_DEVICE_PROTECTED/);
  assert.match(center, /operation === "approve"/);
  assert.match(center, /operation === "block"/);
  assert.match(center, /operation === "deactivate-member"/);
  assert.match(center, /operation === "delete-member"/);
  assert.match(center, /UPDATE control_members SET status = 'inactive'/);
  assert.match(center, /DELETE FROM control_members WHERE email = \? AND status = 'inactive'/);

  assert.doesNotMatch(dashboard, /getControlDatabase|controlDevices\(|localAuditRows\(|UPDATE control_members|DELETE FROM control_members|manage-control-device/);
  assert.doesNotMatch(boiClient, /controlDevices|manage-control-device|roleCapabilities/);
});

test("keeps central audit in api center rather than the Boi Ech client", async () => {
  const center = await source("app/api/center/route.ts");
  const dashboard = await source("app/api/dashboard/route.ts");
  const boiClient = await source(boiClientPath);

  assert.match(center, /FROM control_audit_log ORDER BY id DESC LIMIT 100/);
  assert.match(center, /control_device_approved/);
  assert.match(center, /control_device_blocked/);
  assert.match(center, /control_member_deactivated/);
  assert.match(center, /control_member_deleted/);
  assert.doesNotMatch(dashboard, /FROM control_audit_log|INSERT INTO control_audit_log|auditLog/);
  assert.doesNotMatch(boiClient, /audit-layout|Nhật ký hệ thống|exportAudit|actionLabels/);
});

test("keeps Boi Ech dashboard as a signed short-lived bridge only", async () => {
  const dashboard = await source("app/api/dashboard/route.ts");
  const bridge = await source("app/boi-ech.server.ts");

  assert.match(dashboard, /verifyControlProof/);
  assert.match(dashboard, /issueBoiBrowserBridge\(actorDevice\.email, actorDevice\.role\)/);
  assert.match(dashboard, /application: \{ id: "boi-ech"/);
  assert.match(dashboard, /learningDevices: \[\]/);
  assert.doesNotMatch(dashboard, /controlDevices|auditLog|applications:\s*\[/);
  assert.doesNotMatch(dashboard, /bauman-master-ai|health-care|ru-life|growup-mychildren/);
  assert.match(bridge, /name: "HMAC", hash: "SHA-256"/);
  assert.match(bridge, /Date\.now\(\) \+ 5 \* 60 \* 1000/);
});

test("keeps every management API behind an approved signed central device", async () => {
  const center = await source("app/api/center/route.ts");
  const dashboard = await source("app/api/dashboard/route.ts");
  const content = await source("app/api/content/route.ts");

  assert.match(center, /verifyControlProof/);
  assert.match(dashboard, /verifyControlProof/);
  assert.match(content, /verifyControlProof/);
  assert.match(content, /CONTENT_REVIEW_ROLE_REQUIRED/);
});

test("keeps central admin roles separate from Boi Ech lesson editing", async () => {
  const client = await source(boiClientPath);
  const migration = await source("drizzle/0001_wild_joystick.sql");

  assert.doesNotMatch(client, /role: "editor"/);
  assert.match(client, /reviewer/);
  assert.match(client, /publisher/);
  assert.match(migration, /CASE WHEN "role" = 'editor' THEN 'reviewer'/);
});

test("keeps Boi Ech editing on the client and only review decisions in administration", async () => {
  const client = await source(boiClientPath);
  const styles = await source("app/globals.css");

  assert.match(client, /action: "approve-edit"/);
  assert.match(client, /action: "deny-edit"/);
  assert.match(client, /action: "request-changes"/);
  assert.match(client, /action: "cancel"/);
  assert.match(client, /boiApi\(bridge, "\/api\/control\/content"/);
  assert.doesNotMatch(client, /action: "save-draft"|action: "create-draft"|action: "submit-review"/);
  assert.match(client, /không sửa trực tiếp bài học/);
  assert.match(client, /SectionDiffReview/);
  assert.match(styles, /review-value\.field\.changed/);
  assert.doesNotMatch(client, /function ContentStudio/);
});

test("loads Boi Ech directly in the browser and keeps signed device polling bounded", async () => {
  const dashboard = await source("app/api/dashboard/route.ts");
  const bridge = await source("app/boi-ech.server.ts");
  const client = await source(boiClientPath);

  assert.doesNotMatch(dashboard, /callBoiEch/);
  assert.doesNotMatch(bridge, /fetch\(`\$\{baseUrl\}/);
  assert.match(client, /mode: "cors"/);
  assert.match(client, /credentials: "omit"/);
  assert.match(client, /60_000/);
  assert.doesNotMatch(client, /15_000/);
});

test("keeps Boi Ech device cards stable and only discovers new devices on demand", async () => {
  const client = await source(boiClientPath);

  assert.match(client, /function mergeLearningDevices/);
  assert.match(client, /mergeLearningDevices\(currentDevices, incomingDevices, discoverNew, !discoverNew\)/);
  assert.match(client, /discoverNew: false, quiet: true/);
  assert.match(client, /deviceCodes=/);
  assert.match(client, /discoverNew: true/);
  assert.match(client, /Cập nhật thiết bị/);
});

test("keeps Boi Ech registration payment and activity controls in the Boi client", async () => {
  const client = await source(boiClientPath);

  assert.match(client, /accessGroup: "unassigned" \| "free" \| "paid"/);
  assert.match(client, /\/api\/control\/payment-proof/);
  assert.match(client, /Xem ảnh chuyển khoản/);
  assert.match(client, /grant-free/);
  assert.match(client, /require-payment/);
  assert.match(client, /verify-payment/);
  assert.match(client, /Biểu đồ 30 ngày gần nhất/);
  assert.match(client, /activityDays=30/);
});

test("uses exact central and Boi device namespaces without sharing registries", async () => {
  const controlServer = await source("app/control-device.server.ts");
  const client = await source(boiClientPath);
  const registry = await source("app/application-registry.ts");

  assert.match(controlServer, /`QT-\$\{deviceId\.slice/);
  assert.match(client, /\^BE-/);
  assert.match(client, /normalized\.startsWith\("QT-"\)/);
  assert.match(client, /QT-….*Application Management/);
  assert.match(registry, /Không dùng chung registry thiết bị với site khác|Không chia sẻ registry Bơi ếch|registry và dữ liệu phải thuộc riêng GrowUP/);
});

test("tracks central online presence only for central admin devices", async () => {
  const center = await source("app/api/center/route.ts");
  const deviceServer = await source("app/control-device.server.ts");
  const hub = await source("app/application-hub.tsx");

  assert.match(center, /CONTROL_PRESENCE_TIMEOUT_MS = 150_000/);
  assert.match(center, /offlineSinceAt/);
  assert.match(deviceServer, /UPDATE control_devices SET last_seen_at = CURRENT_TIMESTAMP/);
  assert.match(hub, /Đây chỉ là thiết bị quản trị Application Management/);
});

test("physically removes legacy central rights and audit surfaces from Boi route", async () => {
  const route = await source("app/apps/boi-ech/page.tsx");
  const client = await source(boiClientPath);

  assert.match(route, /BoiEchControlCenter/);
  assert.doesNotMatch(route, /boiBoundary|control-center/);
  assert.doesNotMatch(client, /approval-layout|audit-layout|Quyền quản trị|Nhật ký hệ thống|manage-control-device/);
  assert.match(client, /Quyền QT và audit Trung tâm nằm ở Application Management/);
});

test("keeps client operations recoverable and owner-only destructive deletion guarded", async () => {
  const client = await source(boiClientPath);

  assert.match(client, /reject-payment/);
  assert.match(client, /unblock/);
  assert.match(client, /reset-progress/);
  assert.match(client, /delete-spam-device/);
  assert.match(client, /confirmDeviceCode: deleteConfirmation/);
  assert.match(client, /restore-deleted-device/);
});

test("keeps PWA exports and offline shell privacy-safe", async () => {
  const client = await source(boiClientPath);
  const layout = await source("app/layout.tsx");
  const serviceWorker = await source("public/sw.js");
  const offline = await source("public/offline.html");
  const manifest = JSON.parse(await source("public/manifest.webmanifest"));

  assert.match(client, /exportDevices/);
  assert.match(client, /navigator\.serviceWorker\.register\("\/sw\.js"\)/);
  assert.match(layout, /manifest: "\/manifest\.webmanifest"/);
  assert.match(serviceWorker, /offline\.html/);
  assert.doesNotMatch(serviceWorker, /\/api\/center|\/api\/dashboard/);
  assert.match(offline, /offline|ngoại tuyến/i);
  assert.ok(manifest.name || manifest.short_name);
});
