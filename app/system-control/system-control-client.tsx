"use client";

/* eslint-disable @next/next/no-html-link-for-pages -- full reload keeps the supervised HTTP preview stable. */

import { useEffect, useMemo, useState } from "react";
import { signedControlPost, type ControlAccess, type ControlRole } from "../control-device.client";

type ControlDevice = {
  deviceId: string;
  deviceCode: string;
  email: string;
  displayName: string;
  status: "pending" | "approved" | "blocked";
  role: ControlRole;
  memberStatus: "active" | "inactive" | "unregistered";
  label: string | null;
  createdAt: string;
  approvedAt: string | null;
  blockedAt: string | null;
  lastSeenAt: string;
  offlineSinceAt: string | null;
  active: boolean;
  owner: boolean;
};

type AuditEntry = {
  id: string;
  source: string;
  actor: string;
  action: string;
  target: string;
  detail: Record<string, unknown>;
  createdAt: string;
};

type Bootstrap = {
  actor: ControlAccess;
  controlDevices: ControlDevice[];
  auditLog: AuditEntry[];
  error?: string;
};

type ManageResult = { controlDevices?: ControlDevice[]; error?: string };

const roleLabels: Record<ControlRole, string> = {
  viewer: "Chỉ xem",
  reviewer: "Kiểm duyệt viên",
  publisher: "Người xuất bản",
  owner: "Chủ hệ thống",
};

const actionLabels: Record<string, string> = {
  control_device_approved: "Cấp hoặc đổi quyền thiết bị quản trị",
  control_device_blocked: "Khóa thiết bị quản trị",
  control_member_deactivated: "Thu hồi toàn bộ quyền tài khoản quản trị",
  control_member_deleted: "Xóa vĩnh viễn tài khoản quản trị",
};

function formatDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(date) : "—";
}

function downloadJson(entries: AuditEntry[]) {
  const url = URL.createObjectURL(new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), entries }, null, 2)], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `nhat-ky-he-thong-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

export default function SystemControlClient({ user }: { user: { displayName: string; email: string } }) {
  const [data, setData] = useState<Bootstrap | null>(null);
  const [tab, setTab] = useState<"access" | "audit">("access");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function refresh() {
    setBusy(true);
    setError("");
    try {
      const next = await signedControlPost<Bootstrap>("/api/system/control", { action: "bootstrap" });
      setData(next);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể tải mảng Hệ thống.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(timer);
  }, []);

  async function manage(device: ControlDevice, operation: "approve" | "block" | "deactivate-member" | "delete-member", role?: "reviewer" | "publisher") {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const next = await signedControlPost<ManageResult>("/api/system/control", {
        action: "manage-control-device",
        operation,
        targetDeviceId: device.deviceId,
        role,
        displayName: device.displayName,
      });
      setData((current) => current ? { ...current, controlDevices: next.controlDevices ?? current.controlDevices } : current);
      setNotice(operation === "approve" ? `Đã cấp quyền ${role === "publisher" ? "Người xuất bản" : "Kiểm duyệt viên"}.` : operation === "block" ? "Đã khóa riêng thiết bị quản trị." : operation === "deactivate-member" ? "Đã thu hồi toàn bộ quyền của tài khoản." : "Đã xóa tài khoản quản trị đã thu hồi.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể cập nhật quyền quản trị.");
    } finally {
      setBusy(false);
    }
  }

  const actor = data?.actor;
  const canManage = actor?.role === "owner";
  const canAudit = actor ? ["publisher", "owner"].includes(actor.role) : false;
  const counts = useMemo(() => ({
    total: data?.controlDevices.length ?? 0,
    pending: data?.controlDevices.filter((item) => item.status === "pending").length ?? 0,
    active: data?.controlDevices.filter((item) => item.active).length ?? 0,
    blocked: data?.controlDevices.filter((item) => item.status === "blocked" || item.memberStatus === "inactive").length ?? 0,
  }), [data?.controlDevices]);

  if (!data) {
    return <main className="system-loading"><div><span>HỆ THỐNG</span><h1>{error || "Đang xác thực thiết bị quản trị…"}</h1><a href="/">← QUẢN TRỊ ỨNG DỤNG</a></div></main>;
  }

  return <main className="system-shell">
    <aside className="system-sidebar">
      <a className="system-brand" href="/"><span>QT</span><div><small>QUẢN TRỊ ỨNG DỤNG</small><strong>Hệ thống</strong></div></a>
      <nav>
        <button className={tab === "access" ? "active" : ""} onClick={() => setTab("access")}><span>01</span>Quyền & thiết bị</button>
        {canAudit ? <button className={tab === "audit" ? "active" : ""} onClick={() => setTab("audit")}><span>02</span>Nhật ký hệ thống</button> : null}
      </nav>
      <div className="system-crosslinks"><a href="/learning-control">Học tập</a><a href="/medical-control">Y tế</a></div>
      <div className="system-user"><strong>{user.displayName}</strong><span>{actor ? roleLabels[actor.role] : "—"}</span><small>{user.email}</small></div>
    </aside>

    <section className="system-main">
      <header className="system-topbar"><div><span>SYSTEM CONTROL PLANE</span><h1>{tab === "access" ? "Quyền và thiết bị quản trị" : "Nhật ký hệ thống"}</h1><p>Phần dùng chung cho toàn bộ Trung tâm, không thuộc riêng Học tập hay Y tế.</p></div><button onClick={() => void refresh()} disabled={busy}>{busy ? "Đang cập nhật…" : "Cập nhật"}</button></header>
      {error ? <div className="system-alert error">{error}</div> : null}
      {notice ? <div className="system-alert success">{notice}</div> : null}

      <section className="system-metrics"><article><span>Vai trò hiện tại</span><strong>{roleLabels[actor.role]}</strong><small>{actor.deviceCode}</small></article><article><span>Thiết bị quản trị</span><strong>{canManage ? counts.total : "—"}</strong><small>{canManage ? `${counts.active} đang online` : "Chỉ Owner xem danh sách"}</small></article><article><span>Chờ cấp quyền</span><strong>{canManage ? counts.pending : "—"}</strong><small>Thiết bị mới</small></article><article><span>Bị khóa/thu hồi</span><strong>{canManage ? counts.blocked : "—"}</strong><small>Kiểm soát tập trung</small></article></section>

      {tab === "access" ? <section className="system-panel">
        <header><div><span>ACCESS CONTROL</span><h2>Danh sách thiết bị quản trị</h2><p>Khóa thiết bị chỉ chặn một máy. Thu hồi tài khoản chặn toàn bộ thiết bị dùng cùng email.</p></div></header>
        {!canManage ? <div className="system-readonly"><strong>Chỉ Owner được quản lý tài khoản/thiết bị quản trị.</strong><span>Vai trò hiện tại vẫn có thể sử dụng các module được cấp quyền.</span></div> : null}
        {canManage ? <div className="system-device-list">{data.controlDevices.map((device) => <article key={device.deviceId}>
          <div className={`system-device-state ${device.active ? "online" : "offline"}`}><i /><span>{device.active ? "Online" : "Offline"}</span></div>
          <div className="system-device-copy"><strong>{device.displayName}</strong><span>{device.email}</span><small>{device.deviceCode} · {roleLabels[device.role]} · {device.memberStatus === "inactive" ? "Tài khoản đã thu hồi" : device.status === "pending" ? "Chờ duyệt" : device.status === "blocked" ? "Đã khóa" : "Đã cấp quyền"}</small><small>Tín hiệu cuối: {formatDate(device.lastSeenAt)}</small></div>
          {!device.owner ? <div className="system-device-actions"><button onClick={() => void manage(device, "approve", "reviewer")} disabled={busy || (device.status === "approved" && device.role === "reviewer" && device.memberStatus === "active")}>Kiểm duyệt viên</button><button onClick={() => void manage(device, "approve", "publisher")} disabled={busy || (device.status === "approved" && device.role === "publisher" && device.memberStatus === "active")}>Người xuất bản</button>{device.status !== "blocked" ? <button className="danger" onClick={() => void manage(device, "block")} disabled={busy}>Khóa máy</button> : null}{device.memberStatus === "active" ? <button className="danger" onClick={() => { if (window.confirm(`Thu hồi toàn bộ quyền quản trị của ${device.email}?`)) void manage(device, "deactivate-member"); }} disabled={busy}>Thu hồi tài khoản</button> : null}{device.memberStatus === "inactive" ? <button className="danger strong" onClick={() => { const confirmation = window.prompt(`Nhập chính xác email để xác nhận: ${device.email}`); if (confirmation?.trim().toLowerCase() === device.email.toLowerCase()) void manage(device, "delete-member"); }} disabled={busy}>Xóa tài khoản</button> : null}</div> : <span className="system-owner-chip">Owner</span>}
        </article>)}{data.controlDevices.length === 0 ? <div className="system-empty">Chưa có thiết bị quản trị nào khác.</div> : null}</div> : null}
      </section> : null}

      {tab === "audit" && canAudit ? <section className="system-panel">
        <header className="system-panel-actions"><div><span>AUDIT TRAIL</span><h2>Dấu vết kiểm soát dùng chung</h2><p>Nhật ký trung tâm lưu người thực hiện, hành động, đối tượng và thời điểm.</p></div><button onClick={() => downloadJson(data.auditLog)}>Xuất JSON</button></header>
        <div className="system-audit-list">{data.auditLog.map((entry) => <article key={entry.id}><div>QT</div><section><strong>{actionLabels[entry.action] ?? entry.action}</strong><span>{entry.actor}</span><small>{formatDate(entry.createdAt)} · {entry.target}</small></section></article>)}{data.auditLog.length === 0 ? <div className="system-empty">Chưa có nhật ký hệ thống hoặc vai trò hiện tại không có quyền đọc.</div> : null}</div>
      </section> : null}
    </section>
  </main>;
}
