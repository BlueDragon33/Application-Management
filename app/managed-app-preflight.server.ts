import type { ManagedAppDeviceWithProfile } from "./managed-app-device-profile.server";
import type { RuLifeIntegrationHealth } from "./ru-life-integration-health.server";

export type ManagedAppPreflightCheck = {
  key: string;
  label: string;
  status: "pass" | "warn" | "fail";
  blocking: boolean;
  message: string;
};

export type ManagedAppPreflightReport = {
  deviceId: string;
  deviceCode: string;
  ready: boolean;
  checks: ManagedAppPreflightCheck[];
};

export const HN_CLASSIFICATION_REVIEW_THRESHOLD = 60;

function check(key: string, label: string, status: ManagedAppPreflightCheck["status"], blocking: boolean, message: string): ManagedAppPreflightCheck {
  return { key, label, status, blocking, message };
}

export function evaluateManagedAppPreflight(
  device: ManagedAppDeviceWithProfile,
  integration: RuLifeIntegrationHealth,
  now = Date.now(),
): ManagedAppPreflightReport {
  const profileOk = Boolean(device.profile?.personName?.trim() && device.profile?.personCode?.trim());
  const classOk = device.deviceClassOverride
    ? device.deviceClassOverride !== "unknown"
    : device.autoDeviceClass !== "unknown" && device.classificationConfidence >= HN_CLASSIFICATION_REVIEW_THRESHOLD;
  const lastSeen = Date.parse(device.lastSeenAt);
  const recent = Number.isFinite(lastSeen) && now - lastSeen <= 15 * 60 * 1000;
  const integrationOk = integration.overall === "healthy"
    && integration.reachable
    && integration.secretHandshake === "ok"
    && integration.originMatches
    && integration.protocol === "ru-life-control-health-v1";

  const checks: ManagedAppPreflightCheck[] = [
    check(
      "integration",
      "Kết nối RU_LIFE",
      integrationOk ? "pass" : "fail",
      true,
      integrationOk ? "Runtime, origin và shared secret đã xác minh hai chiều." : `Kết nối chưa sẵn sàng: ${integration.code}. ${integration.message}`,
    ),
    check(
      "user-profile",
      "Hồ sơ người sử dụng",
      profileOk ? "pass" : "fail",
      true,
      profileOk ? "Đã có Họ tên và Mã người dùng." : "Thiếu Họ tên hoặc Mã người dùng.",
    ),
    check(
      "device-classification",
      "Phân loại thiết bị",
      classOk ? "pass" : "fail",
      true,
      classOk
        ? `Đã xác định: ${device.deviceClass}${device.deviceClassOverride ? " (quản trị xác nhận)" : ` · ${device.classificationConfidence}%`}.`
        : `Chưa đủ chắc chắn để duyệt. Cần xác minh computer / phone / tablet (ngưỡng ${HN_CLASSIFICATION_REVIEW_THRESHOLD}%).`,
    ),
    check(
      "device-status",
      "Trạng thái registry",
      device.status === "blocked" ? "fail" : "pass",
      device.status === "blocked",
      device.status === "blocked" ? "Thiết bị đang bị khóa; cần bỏ khóa trước khi cấp quyền." : `Registry hiện ở trạng thái ${device.status}.`,
    ),
    check(
      "recent-heartbeat",
      "Hoạt động gần đây",
      recent ? "pass" : "warn",
      false,
      recent ? "Thiết bị đã liên hệ Trung tâm trong 15 phút gần đây." : "Thiết bị không liên hệ trong 15 phút gần đây. Có thể vẫn duyệt nhưng nên xác nhận người dùng đang giữ đúng thiết bị.",
    ),
  ];

  return {
    deviceId: device.deviceId,
    deviceCode: device.deviceCode,
    ready: !checks.some((item) => item.blocking && item.status === "fail"),
    checks,
  };
}
