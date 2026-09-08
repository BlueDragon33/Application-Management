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

test("central API verifies signed control-device proof and owns only central permissions", () => {
  const route = source("app/api/center/route.ts");
  assert.match(route, /verifyControlProof/);
  assert.match(route, /manage-control-device/);
  assert.match(route, /actorDevice\.role !== "owner"/);
  assert.doesNotMatch(route, /payment|learner|health-content|course-content/i);
});

test("application registry explicitly defines independent app boundaries", () => {
  const registry = source("app/application-registry.ts");
  for (const id of ["boi-ech", "health-care", "ru-life", "bauman-master-ai", "growup-mychildren"]) {
    assert.match(registry, new RegExp(`id: "${id}"`));
  }
  assert.match(registry, /desktop\/phone\/tablet-iPad|máy tính, điện thoại, tablet\/iPad/i);
  assert.match(registry, /Không dùng API\/DB Bơi ếch|Không chia sẻ registry Bơi ếch|Không dùng DB ứng dụng khác/);
});

test("central UI uses center endpoint instead of application dashboard", () => {
  const hub = source("app/application-hub.tsx");
  const client = source("app/admin-device-client.ts");
  assert.match(hub, /connectAdminCenter/);
  assert.doesNotMatch(hub, /\/api\/dashboard/);
  assert.match(client, /secureApi\("\/api\/center"/);
});

test("Boi Ech remains a separate app-admin route", () => {
  const route = source("app/apps/boi-ech/page.tsx");
  assert.match(route, /ControlCenter/);
  assert.match(route, /boiBoundary/);
  assert.match(route, /Application Management/);
});

test("unconnected applications do not expose fake operational controls", () => {
  const workspace = source("app/application-workspace.tsx");
  assert.match(workspace, /Chưa bật các thao tác giả lập/);
  assert.match(workspace, /Chỉ khi repository ứng dụng cung cấp API quản trị/);
});
