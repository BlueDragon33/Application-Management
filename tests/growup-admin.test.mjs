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
  assert.match(admin, /Không đưa lên control-plane|Không đưa hồ sơ trẻ em\/sức khỏe về Application Management/i);
});

test("GrowUP exposes real local device operations without pretending production is ready", () => {
  const admin = source("app/apps/growup-mychildren/growup-admin.tsx");
  const api = source("app/api/apps/growup-mychildren/control/route.ts");
  assert.match(admin, /Local registry GU-/);
  assert.match(admin, /P-256 device gateway local/);
  assert.match(admin, /Admin API local/);
  assert.match(admin, /Production remote admin/);
  assert.match(admin, /Không đánh dấu xanh từ local test/);
  assert.match(admin, />Duyệt</);
  assert.match(admin, />Khóa</);
  assert.match(api, /verifyControlProof/);
  assert.match(api, /DEVICE_COMMAND_READBACK_MISMATCH/);
  assert.doesNotMatch(admin, /delete-child-record|health-record-api/);
});
