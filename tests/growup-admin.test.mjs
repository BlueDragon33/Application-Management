import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

function source(path) {
  return fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("GrowUP uses a dedicated privacy-first management workspace", () => {
  const route = source("app/apps/growup-mychildren/page.tsx");
  const admin = source("app/apps/growup-mychildren/growup-admin.tsx");
  assert.match(route, /GrowUpAdmin/);
  assert.doesNotMatch(route, /ApplicationWorkspace/);
  assert.match(admin, /Quản trị GrowUP MyChildren/);
  assert.match(admin, /Không đưa hồ sơ trẻ em vào Application Management/);
});

test("GrowUP control surface explicitly denies child health and private records", () => {
  const admin = source("app/apps/growup-mychildren/growup-admin.tsx");
  for (const phrase of ["Hồ sơ trẻ em", "Nhật ký sức khỏe và dinh dưỡng", "Ghi chú riêng tư dạng free-text", "Portfolio và minh chứng", "Nội dung backup cục bộ"]) {
    assert.match(admin, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.match(admin, /không gửi dữ liệu trẻ lên Trung tâm/i);
});

test("GrowUP does not expose fake remote operations before its backend exists", () => {
  const admin = source("app/apps/growup-mychildren/growup-admin.tsx");
  assert.match(admin, /Không bật các nút quản trị giả/);
  assert.match(admin, /Device registry GU-/);
  assert.match(admin, /P-256 device gateway/);
  assert.match(admin, /Admin API/);
  assert.match(admin, /Remote audit API/);
  assert.match(admin, /Configuration review API/);
  assert.doesNotMatch(admin, /approve-device|publish-content|delete-child-record|health-record-api/);
});


test("GrowUP local control is acknowledged without promoting production readiness", () => {
  const registry = source("app/application-registry.ts");
  const admin = source("app/apps/growup-mychildren/growup-admin.tsx");
  assert.match(registry, /local Control Service privacy-safe/);
  assert.match(registry, /Production remote vẫn chưa được coi là sẵn sàng/);
  assert.match(admin, /Local Control Service đã có registry GU-/);
  assert.match(admin, /production.*fail-closed/i);
});
