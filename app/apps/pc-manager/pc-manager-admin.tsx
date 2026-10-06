"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  desktopAgentAdminAction,
  type DesktopAgentDevice,
} from "../../admin-device-client";
import styles from "./pc-manager-admin.module.css";

type CommandType =
  | "CHECK_UPDATE"
  | "RUN_HEALTH_SCAN"
  | "REFRESH_DEVICE_STATUS"
  | "DISABLE_LICENSE";

export default function PcManagerAdmin({
  user,
}: {
  user: { displayName: string; email: string };
}) {
  const [devices, setDevices] = useState<DesktopAgentDevice[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function refresh() {
    setBusy(true);
    setError("");
    try {
      const response = await desktopAgentAdminAction({ action: "list" });
      setDevices(response.devices ?? []);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Không thể đọc thiết bị PC Manager.",
      );
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refresh();
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  async function setStatus(
    device: DesktopAgentDevice,
    status: "approved" | "blocked",
  ) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await desktopAgentAdminAction({
        action: "set-status",
        targetDeviceId: device.deviceId,
        status,
      });
      setNotice(
        status === "approved"
          ? `Đã duyệt ${device.deviceCode}.`
          : `Đã khóa ${device.deviceCode}.`,
      );
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không thể đổi trạng thái.");
      setBusy(false);
    }
  }

  async function queueCommand(
    device: DesktopAgentDevice,
    commandType: CommandType,
  ) {
    if (
      commandType === "DISABLE_LICENSE" &&
      !window.confirm(
        `Tắt entitlement của ${device.deviceCode}? Lệnh này không được phép chạy shell hay xóa dữ liệu.`,
      )
    ) {
      return;
    }

    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await desktopAgentAdminAction({
        action: "queue-command",
        targetDeviceId: device.deviceId,
        commandType,
        commandPayload:
          commandType === "DISABLE_LICENSE"
            ? { reason: "Disabled from Application Management" }
            : {},
      });
      setNotice(
        response.command
          ? `${commandType} đã vào hàng đợi typed command.`
          : "Đã gửi yêu cầu.",
      );
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không thể tạo typed command.");
      setBusy(false);
    }
  }

  return (
    <main className={styles.shell}>
      <header className={styles.header}>
        <div>
          <p>APPLICATION MANAGEMENT · P8 DESKTOP AGENT</p>
          <h1>PC Manager Desktop</h1>
          <span>
            Gateway chỉ nhận kết nối HTTPS outbound từ máy Windows. Không có
            remote shell, PowerShell tùy ý hoặc cổng inbound trên PC.
          </span>
        </div>
        <div className={styles.actions}>
          <Link href="/">← Hệ thống</Link>
          <button disabled={busy} onClick={() => void refresh()}>
            {busy ? "Đang cập nhật…" : "Cập nhật"}
          </button>
        </div>
      </header>

      <section className={styles.summary}>
        <article>
          <span>Thiết bị</span>
          <strong>{devices.length}</strong>
        </article>
        <article>
          <span>Online</span>
          <strong>{devices.filter((device) => device.online).length}</strong>
        </article>
        <article>
          <span>Chờ duyệt</span>
          <strong>
            {devices.filter((device) => device.status === "pending").length}
          </strong>
        </article>
        <article>
          <span>Người quản trị</span>
          <strong>{user.displayName}</strong>
        </article>
      </section>

      {error ? <div className={styles.error}>{error}</div> : null}
      {notice ? <div className={styles.notice}>{notice}</div> : null}

      <section className={styles.boundary}>
        <strong>Typed command allow-list</strong>
        <span>
          CHECK_UPDATE · RUN_HEALTH_SCAN · REFRESH_DEVICE_STATUS ·
          DISABLE_LICENSE
        </span>
        <small>
          Server không thể biến các lệnh này thành arbitrary process,
          registry mutation, file execution hoặc download-and-run.
        </small>
      </section>

      <section className={styles.list}>
        {devices.length === 0 && !busy ? (
          <div className={styles.empty}>
            <strong>Chưa có PC Manager nào đăng ký.</strong>
            <span>
              Khi PC Manager được cấu hình gateway, thiết bị sẽ tự đăng ký ở
              trạng thái pending.
            </span>
          </div>
        ) : null}

        {devices.map((device) => (
          <article className={styles.device} key={device.deviceId}>
            <div className={styles.deviceTitle}>
              <div>
                <small>WINDOWS · DESKTOP-NATIVE</small>
                <h2>{device.deviceCode}</h2>
                <span>
                  v{device.appVersion} · {device.releaseChannel}
                </span>
              </div>
              <div className={styles.badges}>
                <b data-state={device.online ? "online" : "offline"}>
                  {device.online ? "Online" : "Offline"}
                </b>
                <b data-state={device.status}>{device.status}</b>
                <b>{device.entitlementState}</b>
              </div>
            </div>

            <dl className={styles.meta}>
              <div>
                <dt>Last seen</dt>
                <dd>{device.lastSeenAt ?? "Chưa heartbeat"}</dd>
              </div>
              <div>
                <dt>Update policy</dt>
                <dd>
                  {device.updatePolicy.channel ?? device.releaseChannel} ·
                  auto-check {device.updatePolicy.autoCheck === false ? "off" : "on"}
                </dd>
              </div>
              <div>
                <dt>Device ID</dt>
                <dd title={device.deviceId}>{device.deviceId.slice(0, 16)}…</dd>
              </div>
            </dl>

            <div className={styles.commandRow}>
              {device.status !== "approved" ? (
                <button
                  disabled={busy}
                  onClick={() => void setStatus(device, "approved")}
                >
                  Duyệt thiết bị
                </button>
              ) : (
                <button
                  className={styles.danger}
                  disabled={busy}
                  onClick={() => void setStatus(device, "blocked")}
                >
                  Khóa thiết bị
                </button>
              )}
              <button
                disabled={busy || device.status !== "approved"}
                onClick={() => void queueCommand(device, "REFRESH_DEVICE_STATUS")}
              >
                Refresh status
              </button>
              <button
                disabled={busy || device.status !== "approved"}
                onClick={() => void queueCommand(device, "RUN_HEALTH_SCAN")}
              >
                Health scan
              </button>
              <button
                disabled={busy || device.status !== "approved"}
                onClick={() => void queueCommand(device, "CHECK_UPDATE")}
              >
                Check update
              </button>
              <button
                className={styles.danger}
                disabled={
                  busy ||
                  device.status !== "approved" ||
                  device.entitlementState === "disabled"
                }
                onClick={() => void queueCommand(device, "DISABLE_LICENSE")}
              >
                Disable license
              </button>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
