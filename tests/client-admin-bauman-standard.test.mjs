import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

function read(path) {
  return fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("Bauman remains the client-admin hierarchy reference", () => {
  const bauman = read("app/apps/bauman-master-ai/bauman-admin.tsx");
  const shared = read("app/application-admin.module.css");
  assert.match(bauman, /useState<View>\("overview"\)/);
  for (const label of ["Tổng quan", "Thiết bị & truy cập", "Sub-client", "Contract"]) {
    assert.match(bauman, new RegExp(label));
  }
  assert.match(bauman, /application-admin\.module\.css/);
  assert.match(shared, /\.workspaceShell/);
  assert.match(shared, /\.clientSidebar/);
  assert.match(shared, /\.workspaceTopbar/);
});

test("Health admin removes legacy pixel wrappers and follows Bauman hierarchy", () => {
  const page = read("app/apps/health-care/page.tsx");
  const admin = read("app/apps/health-care/health-care-admin.tsx");
  const css = read("app/apps/health-care/health-care-admin.module.css");
  assert.doesNotMatch(page, /pixel-match|admin-complete/);
  assert.match(admin, /type View = "overview" \| "devices" \| "access" \| "content" \| "audit"/);
  assert.match(admin, /useState<View>\("overview"\)/);
  assert.match(admin, /Health_Care chưa trả bridge quản trị hợp lệ\. Không bật thao tác giả/);
  assert.match(admin, /visibilitychange/);
  assert.match(css, /BAUMAN ADMIN STANDARD OVERRIDES/);
  assert.match(css, /background:#f3f6fa/);
});

test("RU admin has functional pending navigation and no fabricated public URL fallback", () => {
  const page = read("app/apps/ru-life/page.tsx");
  const admin = read("app/apps/ru-life/ru-life-admin.tsx");
  const css = read("app/apps/ru-life/ru-life-admin.module.css");
  assert.doesNotMatch(page, /hoa-nhap-nga\.dinhnam3391\.chatgpt\.site/);
  assert.match(admin, /type View = "overview" \| "devices" \| "sessions" \| "audit"/);
  assert.match(admin, /useState<View>\("overview"\)/);
  assert.match(admin, /setFilter\("pending"\); setView\("devices"\)/);
  assert.match(admin, /RU_LIFE chưa trả bridge quản trị hợp lệ\. Không bật thao tác giả/);
  assert.match(admin, /visibilitychange/);
  assert.match(css, /BAUMAN ADMIN STANDARD OVERRIDES/);
});

test("Boi Ech uses one internal admin shell with overview and real drill-down actions", () => {
  const page = read("app/apps/boi-ech/page.tsx");
  const admin = read("app/apps/boi-ech/boi-ech-control-center.tsx");
  const css = read("app/apps/boi-ech/boi-ech-shell.module.css");
  assert.doesNotMatch(page, /boiBack|Application Management<\/Link>/);
  assert.match(admin, /useState<"overview" \| "devices" \| "ai" \| "content">\("overview"\)/);
  assert.match(admin, /control-back-link/);
  assert.match(admin, /setFilter\("payment"\); setTab\("devices"\)/);
  assert.match(admin, /setFilter\("expired"\); setTab\("devices"\)/);
  assert.match(css, /Bauman Hub is the visual\/admin-shell reference/);
  assert.match(css, /\.control-back-link/);
});

test("GrowUP refreshes verified contract state and never infers remote admin from web access", () => {
  const admin = read("app/apps/growup-mychildren/growup-admin.tsx");
  const operations = read("app/api/operations/route.ts");
  const client = read("app/admin-device-client.ts");
  assert.match(admin, /connectOperationsDashboard/);
  assert.match(admin, /item\.appId === "growup-mychildren"/);
  assert.match(admin, /remoteAdminReady: summary\.remoteAdminReady === true/);
  assert.match(admin, /visibilitychange/);
  assert.match(operations, /remoteAdminReady: contract\.remoteAdminReady/);
  assert.match(client, /remoteAdminReady\?: boolean/);
  assert.doesNotMatch(admin, /remoteAdminReady:\s*Boolean\(summary\.webHref\)/);
});

test("all client-admin mutations remain owned by their real client backends", () => {
  const health = read("app/apps/health-care/health-care-admin.tsx");
  const ru = read("app/apps/ru-life/ru-life-admin.tsx");
  const boi = read("app/apps/boi-ech/boi-ech-control-center.tsx");
  const bauman = read("app/apps/bauman-master-ai/bauman-admin.tsx");
  assert.match(health, /upstreamJson<DevicesResponse>\(token, "\/api\/control\/devices"/);
  assert.match(ru, /upstreamJson<DeviceResponse>\(currentBridge, "\/api\/control\/devices"/);
  assert.match(boi, /boiApi\(dashboard\.boiBridge, "\/api\/control\/overview"/);
  assert.match(bauman, /action: "manage-client-device"/);
  assert.match(bauman, /expectedStatus: device\.status/);
});
