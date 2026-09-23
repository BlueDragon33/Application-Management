import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

function source(path) {
  return fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("CAD CAM 3D is a first-level managed application", () => {
  const registry = source("app/application-registry.ts");
  assert.match(registry, /id: "cad-cam-3d"/);
  assert.match(registry, /repository: "BlueDragon33\/CAD_CAM_3D"/);
  assert.match(registry, /Registry CAD-/);
  assert.match(registry, /Không sao chép CAD project vào Trung tâm/);
});

test("CAD admin uses the central approved-device gate and management shell", () => {
  const route = source("app/apps/cad-cam-3d/page.tsx");
  const client = source("app/apps/cad-cam-3d/cad-admin.tsx");
  assert.match(route, /requireChatGPTUser/);
  assert.match(route, /getApplicationConfig\("cad-cam-3d"\)/);
  assert.match(client, /connectAdminCenter/);
  assert.match(client, /Quản lý giao diện CAD/);
  assert.match(client, /Registry CAD- độc lập/);
  assert.match(client, /Không mô phỏng thao tác quản trị/);
  assert.doesNotMatch(client, /<iframe/i);
});

test("CAD project and manufacturing payloads remain outside the control-plane", () => {
  const client = source("app/apps/cad-cam-3d/cad-admin.tsx");
  assert.match(client, /Project\/Geometry/);
  assert.match(client, /geometry, mesh, STL\/STEP\/3MF/);
  assert.match(client, /Remote operations[\s\S]*Đang khóa/);
});
