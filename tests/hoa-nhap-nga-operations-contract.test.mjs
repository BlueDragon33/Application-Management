import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(path) {
  return readFile(new URL(path, import.meta.url), "utf8");
}

test("Hòa nhập Nga refreshes device state every 60 seconds while preserving the last list on failure", async () => {
  const client = await source("../app/medical-control/medical-control-client.tsx");

  assert.match(client, /60_000/);
  assert.match(client, /document\.visibilityState === "visible"/);
  assert.match(client, /refreshRef\.current\(\{ quiet: true \}\)/);
  assert.match(client, /Danh sách gần nhất vẫn được giữ nguyên/);
  assert.match(client, /ĐÃ ĐỒNG BỘ · 60 GIÂY\/LẦN/);
  assert.doesNotMatch(client, /ĐÃ ĐỒNG BỘ · THỦ CÔNG/);
});

test("Hòa nhập Nga can select and manage devices in batches without bypassing control proof", async () => {
  const client = await source("../app/medical-control/medical-control-client.tsx");
  const route = await source("../app/api/apps/hoa-nhap-nga/control/route.ts");
  const admin = await source("../app/managed-app-device-admin.server.ts");

  assert.match(client, /action: "bulk"/);
  assert.match(client, /Cấp quyền hàng loạt/);
  assert.match(client, /Khóa hàng loạt/);
  assert.match(route, /verifyControlProof/);
  assert.match(route, /requireGrantRole\(actor\.role\)/);
  assert.match(route, /action === "bulk"/);
  assert.match(admin, /slice\(0, 50\)/);
  assert.match(admin, /updateManagedAppDevice/);
});

test("Hòa nhập Nga exposes a device detail drawer with immutable security fingerprint", async () => {
  const client = await source("../app/medical-control/medical-control-client.tsx");
  const styles = await source("../app/medical-control/medical-control-enhancements.css");

  assert.match(client, /CHI TIẾT THIẾT BỊ HN/);
  assert.match(client, /Fingerprint khóa/);
  assert.match(client, /detailDevice\.deviceId/);
  assert.match(client, /Sao chép mã HN/);
  assert.match(client, /LỊCH SỬ THIẾT BỊ/);
  assert.match(styles, /\.russia-detail-backdrop/);
  assert.match(styles, /\.russia-detail-drawer/);
});

test("device access actions have a dedicated HN audit feed", async () => {
  const route = await source("../app/api/apps/hoa-nhap-nga/control/route.ts");
  const admin = await source("../app/managed-app-device-admin.server.ts");
  const client = await source("../app/medical-control/medical-control-client.tsx");

  assert.match(route, /auditLog: \["publisher", "owner"\]/);
  assert.match(admin, /control_audit_log/);
  assert.match(admin, /managed_app_device\.%/);
  assert.match(client, /NHẬT KÝ THIẾT BỊ HN/);
  assert.match(client, /deviceAudit/);
});

test("device registry can be searched, sorted and exported for operational review", async () => {
  const client = await source("../app/medical-control/medical-control-client.tsx");

  assert.match(client, /DeviceSort/);
  assert.match(client, /Ưu tiên xử lý/);
  assert.match(client, /Đăng ký mới nhất/);
  assert.match(client, /Hoạt động gần nhất/);
  assert.match(client, /Xuất CSV/);
  assert.match(client, /Xuất JSON/);
  assert.match(client, /hoa-nhap-nga-thiet-bi-/);
});