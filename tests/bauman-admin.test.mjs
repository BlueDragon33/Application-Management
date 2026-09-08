import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

function source(path) {
  return fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("Bauman route is a dedicated management hub rather than the generic placeholder", () => {
  const route = source("app/apps/bauman-master-ai/page.tsx");
  const admin = source("app/apps/bauman-master-ai/bauman-admin.tsx");
  assert.match(route, /BaumanAdmin/);
  assert.doesNotMatch(route, /ApplicationWorkspace/);
  assert.match(admin, /Quản trị Bauman Hub/);
  assert.match(admin, /Đây là khu quản trị, không phải nút mở site Bauman/);
});

test("Bauman management surface does not fake operational backend actions", () => {
  const admin = source("app/apps/bauman-master-ai/bauman-admin.tsx");
  assert.match(admin, /Chưa có backend quản trị Bauman/);
  assert.match(admin, /không có nút cấp quyền, publish, sửa bài hay mở site giả/i);
  assert.doesNotMatch(admin, /approve-device|publish-content|open-learning-site|<iframe/i);
});

test("Bauman keeps Math and subject modules under the level-1 hub", () => {
  const registry = source("app/application-registry.ts");
  const admin = source("app/apps/bauman-master-ai/bauman-admin.tsx");
  assert.match(registry, /BlueDragon33\/Math_Bauman/);
  assert.match(registry, /subjects\/programming/);
  assert.match(registry, /subjects\/ai/);
  assert.match(registry, /subjects\/signal/);
  assert.match(registry, /subjects\/systems/);
  assert.match(registry, /subjects\/foundation/);
  assert.match(registry, /subjects\/research/);
  assert.match(registry, /subjects\/russian/);
  assert.match(admin, /LEVEL 2 · SUB-CLIENTS/);
});

test("Bauman readiness requires BM registry gateway admin audit and content review before enabling control", () => {
  const admin = source("app/apps/bauman-master-ai/bauman-admin.tsx");
  for (const label of ["Device registry BM-", "P-256 device gateway", "Admin API", "Audit API", "Content review API"]) {
    assert.match(admin, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.match(admin, /Chỉ sau khi backend \+ test xanh mới bật thao tác/);
});
