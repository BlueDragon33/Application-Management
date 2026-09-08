"use client";

/* eslint-disable @next/next/no-html-link-for-pages -- full reload keeps the supervised HTTP preview stable. */

import { useEffect, useState } from "react";
import { signedControlPost, type ControlAccess } from "../control-device.client";
import { integrationRussiaSiteUrl } from "../site-links";

type MedicalBootstrap = {
  actor: ControlAccess;
  stats: { total: number; pending: number; needsDocuments: number; resolved: number };
  rules: { id: string; enabled: boolean; level: number }[];
  reviews: { id: string; status: string; createdAt: string }[];
  meta: { version: string; updatedAt: string; jurisdiction: string };
  auditLog: { id: number; action: string; actor: string; createdAt: string }[];
  error?: string;
};

type ManagedDevice = {
  appId: "hoa-nhap-nga";
  deviceId: string;
  deviceCode: string;
  status: "pending" | "approved" | "blocked";
  label: string | null;
  deviceClass: "computer" | "phone" | "tablet" | "unknown";
  osName: string;
  browserName: string;
  modelHint: string | null;
  screen: string | null;
  createdAt: string;
  approvedAt: string | null;
  blockedAt: string | null;
  lastSeenAt: string;
  approvedBy: string | null;
  active: boolean;
};

type DeviceBootstrap = {
  actor: ControlAccess;
  app: { id: "hoa-nhap-nga"; name: string };
  devices: ManagedDevice[];
  error?: string;
};

type DeviceActionResult = { ok?: boolean; device?: ManagedDevice; devices?: ManagedDevice[]; error?: string };

const roleLabel = {
  viewer: "Chỉ xem",
  reviewer: "Kiểm duyệt viên",
  publisher: "Người xuất bản",
  owner: "Chủ hệ thống",
} as const;

const deviceClassLabel = {
  computer: "Máy tính",
  phone: "Điện thoại",
  tablet: "Máy tính bảng",
  unknown: "Thiết bị khác",
} as const;

const statusLabel = {
  pending: "Chờ duyệt",
  approved: "Đã cấp quyền",
  blocked: "Đã khóa",
} as const;

export default function MedicalControlClient({ user }: { user: { displayName: string; email: string } }) {
  const [data, setData] = useState<MedicalBootstrap | null>(null);
  const [devices, setDevices] = useState<ManagedDevice[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function refresh() {
    setBusy(true);
    setError("");
    try {
      const [medical, appDevices] = await Promise.all([
        signedControlPost<MedicalBootstrap>("/api/medicine/control", { action: "bootstrap" }),
        signedControlPost<DeviceBootstrap>("/api/apps/hoa-nhap-nga/control", { action: "bootstrap" }),
      ]);
      setData(medical);
      setDevices(appDevices.devices || []);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể tải mảng Y tế.");
    } finally {
      setBusy(false);
    }
  }

  async function changeDevice(deviceId: string, action: "approve" | "block" | "pending") {
    setBusy(true);
    setError("");
    try {
      const next = await signedControlPost<DeviceActionResult>("/api/apps/hoa-nhap-nga/control", { action, deviceId });
      if (next.devices) setDevices(next.devices);
      else await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể cập nhật quyền thiết bị.");
    } finally {
      setBusy(false);
    }
  }

  async function renameDevice(device: ManagedDevice) {
    const label = window.prompt("Tên gợi nhớ cho thiết bị", device.label || "");
    if (label === null) return;
    setBusy(true);
    setError("");
    try {
      const next = await signedControlPost<DeviceActionResult>("/api/apps/hoa-nhap-nga/control", { action: "label", deviceId: device.deviceId, label });
      if (next.devices) setDevices(next.devices);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể đổi tên thiết bị.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(timer);
  }, []);

  if (!data) return <main className="medical-loading"><div><span>Y TẾ</span><h1>{error || "Đang xác thực mảng Y tế…"}</h1><a href="/">← QUẢN TRỊ ỨNG DỤNG</a></div></main>;

  const enabledRules = data.rules.filter((rule) => rule.enabled).length;
  const highRiskRules = data.rules.filter((rule) => rule.enabled && rule.level >= 4).length;
  const canGrant = ["publisher", "owner"].includes(data.actor.role);
  const pendingDevices = devices.filter((device) => device.status === "pending").length;
  const approvedDevices = devices.filter((device) => device.status === "approved").length;

  return <main className="medical-shell">
    <header className="medical-topbar">
      <a className="medical-brand" href="/"><span>YT</span><div><small>QUẢN TRỊ ỨNG DỤNG</small><strong>Y tế</strong></div></a>
      <div className="medical-user"><div><strong>{user.displayName}</strong><small>{roleLabel[data.actor.role]}</small></div><button onClick={() => void refresh()} disabled={busy}>{busy ? "Đang cập nhật…" : "Cập nhật"}</button><a href="/system-control">Hệ thống</a></div>
    </header>

    <section className="medical-hero">
      <div><span>MEDICAL DOMAIN · MODULAR</span><h1>Mảng Y tế của QUẢN TRỊ ỨNG DỤNG.</h1><p>Hòa nhập Nga là một Web App độc lập. Trung tâm này chỉ quản lý quyền thiết bị, kiểm duyệt và dữ liệu điều hành; không chứa giao diện người dùng của Hòa nhập Nga.</p></div>
      <aside><small>Bộ dữ liệu hiện tại</small><strong>{data.meta.version}</strong><span>{data.meta.jurisdiction} · cập nhật {data.meta.updatedAt}</span></aside>
    </section>

    {error ? <div className="medical-alert">{error}</div> : null}

    <section className="medical-metrics">
      <article><span>Thiết bị Hòa nhập Nga</span><strong>{devices.length}</strong><small>{pendingDevices} chờ duyệt · {approvedDevices} đã cấp</small></article>
      <article><span>Ca kiểm duyệt</span><strong>{data.stats.total}</strong><small>{data.stats.pending} đang chờ</small></article>
      <article><span>Quy tắc đang bật</span><strong>{enabledRules}</strong><small>{highRiskRules} quy tắc cấp 4–5</small></article>
      <article><span>Đã xử lý</span><strong>{data.stats.resolved}</strong><small>Qua Trung tâm kiểm duyệt</small></article>
    </section>

    <section className="medical-modules">
      <article className="primary"><header><span>01</span><b>ĐANG HOẠT ĐỘNG</b></header><h2>Hòa nhập Nga</h2><p>Site người dùng hoạt động riêng. Khi một thiết bị mở site lần đầu, thiết bị tự tạo khóa định danh, gửi yêu cầu về đây và chỉ được vào sau khi trạng thái chuyển sang “Đã cấp quyền”.</p><div><a className="medical-main-link" href={integrationRussiaSiteUrl} target="_blank" rel="noreferrer">Mở site độc lập ↗</a><a href="/medicine-control">Vào kiểm duyệt</a></div></article>
      <article className="future"><header><span>+</span><b>SẴN SÀNG MỞ RỘNG</b></header><h2>Module Y tế mới</h2><p>Mỗi Web App mới sẽ có thiết bị, dữ liệu và quyền riêng; Trung tâm chỉ đóng vai trò quản trị.</p><div className="medical-placeholder">Chưa gắn module</div></article>
    </section>

    <section className="medical-device-registry">
      <div className="medical-device-registry-head"><div><span>THIẾT BỊ TRUY CẬP · HÒA NHẬP NGA</span><h2>Duyệt theo đúng thiết bị sử dụng</h2><p>Mã HN là định danh bằng khóa thiết bị. Thông tin loại máy/OS/trình duyệt chỉ dùng để nhận diện và phân loại, không thay thế khóa định danh.</p></div><b>{pendingDevices ? `${pendingDevices} yêu cầu mới` : "Không có yêu cầu mới"}</b></div>
      <div className="medical-device-list">
        {devices.length ? devices.map((device) => <article key={device.deviceId} className={`status-${device.status}`}>
          <div className="medical-device-main"><div className="medical-device-code"><strong>{device.deviceCode}</strong><span>{statusLabel[device.status]}</span></div><h3>{device.label || `${deviceClassLabel[device.deviceClass]} · ${device.osName}`}</h3><p>{deviceClassLabel[device.deviceClass]} · {device.osName} · {device.browserName}{device.modelHint ? ` · ${device.modelHint}` : ""}{device.screen ? ` · ${device.screen}` : ""}</p><small>{device.active ? "Đang hoạt động" : `Lần cuối: ${new Date(device.lastSeenAt).toLocaleString("vi-VN")}`}</small></div>
          <div className="medical-device-actions"><button onClick={() => void renameDevice(device)} disabled={busy || !canGrant}>Đặt tên</button>{device.status !== "approved" ? <button className="approve" onClick={() => void changeDevice(device.deviceId, "approve")} disabled={busy || !canGrant}>Cấp quyền</button> : <button onClick={() => void changeDevice(device.deviceId, "pending")} disabled={busy || !canGrant}>Thu hồi tạm</button>}{device.status !== "blocked" ? <button className="block" onClick={() => void changeDevice(device.deviceId, "block")} disabled={busy || !canGrant}>Khóa</button> : <button onClick={() => void changeDevice(device.deviceId, "pending")} disabled={busy || !canGrant}>Bỏ khóa</button>}</div>
        </article>) : <div className="medical-device-empty">Chưa có thiết bị nào gửi yêu cầu từ site Hòa nhập Nga.</div>}
      </div>
      {!canGrant ? <p className="medical-device-role-note">Tài khoản hiện tại chỉ được xem. Cấp/thu hồi quyền thiết bị cần Publisher hoặc Owner.</p> : null}
    </section>

    <section className="medical-boundary"><strong>Ranh giới bắt buộc</strong><p>`control_devices` chỉ là thiết bị được phép vào Site Quản trị. Thiết bị của Hòa nhập Nga nằm trong registry riêng `managed_app_devices`; hai loại không được dùng thay cho nhau.</p><a href="/">← Quay lại QUẢN TRỊ ỨNG DỤNG</a></section>
  </main>;
}