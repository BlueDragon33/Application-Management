"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  connectRuLifeAdmin,
  roleLabels,
  upstreamJson,
  type AdminAccess,
  type ApplicationBridge,
} from "../../admin-device-client";
import styles from "./ru-life-admin.module.css";

type View = "devices" | "sessions" | "audit";
type DeviceStatus = "pending" | "approved" | "blocked";
type DeviceClass = "computer" | "phone" | "tablet" | "unknown";

type RuDevice = {
  appId: "hoa-nhap-nga";
  deviceId: string;
  deviceCode: string;
  status: DeviceStatus;
  userName: string | null;
  userCode: string | null;
  label: string | null;
  deviceClass: DeviceClass;
  detectedDeviceClass: DeviceClass;
  deviceClassOverride: DeviceClass | null;
  deviceClassOverrideBy: string | null;
  classificationConfidence: number;
  classificationSource: string | null;
  osName: string;
  browserName: string;
  modelHint: string | null;
  screen: string | null;
  editEnabled: boolean;
  createdAt: string;
  approvedAt: string | null;
  blockedAt: string | null;
  lastSeenAt: string;
  approvedBy: string | null;
  active: boolean;
  offlineSinceAt: string | null;
};

type RuSession = {
  sessionId: string;
  deviceId: string;
  deviceCode: string;
  userName: string | null;
  userCode: string | null;
  deviceClass: DeviceClass;
  status: "active" | "revoked" | "expired";
  expiresAt: number;
  createdAt: string;
  lastSeenAt: string;
  revokedAt: string | null;
  revokedBy: string | null;
  revokeReason: string | null;
  active: boolean;
};

type RuAudit = {
  id: string;
  actor: string;
  action: string;
  target: string;
  detail: Record<string, unknown>;
  createdAt: string;
};

function reusableBridge(bridge: ApplicationBridge | null) {
  return bridge && bridge.expiresAt > Date.now() + 30_000 ? bridge : null;
}

type DeviceResponse = {
  ok?: boolean;
  devices?: RuDevice[];
  sessions?: RuSession[];
  device?: RuDevice | null;
};

type SessionResponse = {
  ok?: boolean;
  sessions?: RuSession[];
};

type AuditResponse = {
  ok?: boolean;
  audit?: RuAudit[];
};

type BindingDraft = { userName: string; userCode: string };

const classLabel: Record<DeviceClass, string> = {
  computer: "Máy tính",
  phone: "Điện thoại",
  tablet: "Tablet / iPad",
  unknown: "Chưa xác định",
};

const statusLabel: Record<DeviceStatus, string> = {
  pending: "Chờ duyệt",
  approved: "Đã cấp quyền",
  blocked: "Đã khóa",
};

function formatTime(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(date);
}

function DeviceGlyph({ type }: { type: DeviceClass }) {
  if (type === "phone") return <svg viewBox="0 0 24 24"><rect x="7" y="2.5" width="10" height="19" rx="2.2"/><path d="M10 5h4M11 18.5h2"/></svg>;
  if (type === "tablet") return <svg viewBox="0 0 24 24"><rect x="4" y="2.5" width="16" height="19" rx="2.2"/><path d="M10.5 18.5h3"/></svg>;
  if (type === "computer") return <svg viewBox="0 0 24 24"><rect x="2.5" y="3.5" width="19" height="13" rx="2"/><path d="M8 20.5h8M10 16.5v4M14 16.5v4"/></svg>;
  return <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M9.8 9a2.3 2.3 0 1 1 3.8 1.8c-1 .7-1.6 1.1-1.6 2.4M12 17h.01"/></svg>;
}

function Gate({ access, error, retry, busy }: { access: AdminAccess | null; error: string; retry: () => void; busy: boolean }) {
  return <main className={styles.gate}><section>
    <div className={styles.gateMark}>RU</div>
    <span>RU LIFE · CLIENT ADMIN</span>
    <h1>{access?.status === "pending" ? "Thiết bị quản trị đang chờ cấp quyền." : access?.status === "blocked" ? "Thiết bị quản trị đã bị khóa." : "Đang xác thực khu quản trị Hòa nhập Nga…"}</h1>
    <p>{error || "Chỉ thiết bị quản trị đã được Application Management phê duyệt mới được nhận vé ngắn hạn để quản trị registry HN nằm trong RU_LIFE."}</p>
    {access?.deviceCode ? <div><small>Mã thiết bị quản trị</small><strong>{access.deviceCode}</strong></div> : null}
    <button onClick={retry} disabled={busy}>{busy ? "Đang kiểm tra…" : "Kiểm tra lại"}</button>
  </section></main>;
}

export default function RuLifeAdmin({ user }: { user: { displayName: string; email: string } }) {
  const [view, setView] = useState<View>("devices");
  const [access, setAccess] = useState<AdminAccess | null>(null);
  const [bridge, setBridge] = useState<ApplicationBridge | null>(null);
  const [devices, setDevices] = useState<RuDevice[]>([]);
  const [sessions, setSessions] = useState<RuSession[]>([]);
  const [audit, setAudit] = useState<RuAudit[]>([]);
  const [bindings, setBindings] = useState<Record<string, BindingDraft>>({});
  const [filter, setFilter] = useState<"all" | DeviceStatus | "online">("all");
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(true);
  const [actionBusy, setActionBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const role = access?.role ?? "viewer";
  const canManage = role === "publisher" || role === "owner";
  const canReview = role === "reviewer" || canManage;

  async function freshBridge() {
    const cached = reusableBridge(bridge);
    if (cached) return cached;
    const result = await connectRuLifeAdmin();
    setAccess(result.access);
    if (!result.bootstrap?.bridge) throw new Error("Không thể nhận vé quản trị Hòa nhập Nga.");
    setBridge(result.bootstrap.bridge);
    return result.bootstrap.bridge;
  }

  async function load() {
    setBusy(true);
    setError("");
    try {
      const result = await connectRuLifeAdmin();
      setAccess(result.access);
      if (!result.bootstrap?.bridge) return;
      const currentBridge = result.bootstrap.bridge;
      setBridge(currentBridge);
      const mayReadAudit = ["reviewer", "publisher", "owner"].includes(result.access.role);
      const [deviceData, sessionData, auditData] = await Promise.all([
        upstreamJson<DeviceResponse>(currentBridge, "/api/control/devices"),
        upstreamJson<SessionResponse>(currentBridge, "/api/control/sessions"),
        mayReadAudit ? upstreamJson<AuditResponse>(currentBridge, "/api/control/audit") : Promise.resolve({ audit: [] }),
      ]);
      const nextDevices = deviceData.devices ?? [];
      setDevices(nextDevices);
      setSessions(sessionData.sessions ?? []);
      setAudit(auditData.audit ?? []);
      setBindings(Object.fromEntries(nextDevices.filter((item) => item.status === "pending").map((item) => [item.deviceId, {
        userName: item.userName ?? "",
        userCode: item.userCode ?? "",
      }])));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không thể tải quản trị Hòa nhập Nga.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  async function refreshAudit(currentBridge: ApplicationBridge) {
    if (!canReview) return;
    try {
      const result = await upstreamJson<AuditResponse>(currentBridge, "/api/control/audit");
      setAudit(result.audit ?? []);
    } catch {
      // Operational mutation already succeeded; a transient audit refresh must not roll it back in the UI.
    }
  }

  async function manage(device: RuDevice, operation: string, extra: Record<string, unknown> = {}) {
    if (!canManage) return;
    setActionBusy(device.deviceId);
    setNotice("");
    try {
      const currentBridge = await freshBridge();
      const result = await upstreamJson<DeviceResponse>(currentBridge, "/api/control/devices", {
        method: "POST",
        body: { operation, targetDeviceId: device.deviceId, ...extra },
      });
      if (result.devices) setDevices(result.devices);
      if (result.sessions) setSessions(result.sessions);
      await refreshAudit(currentBridge);
      setNotice("Đã cập nhật policy thiết bị trong RU_LIFE.");
    } catch (caught) {
      setNotice(caught instanceof Error ? caught.message : "Không thể cập nhật thiết bị Hòa nhập Nga.");
    } finally {
      setActionBusy("");
    }
  }

  async function approve(device: RuDevice) {
    const draft = bindings[device.deviceId] ?? { userName: "", userCode: "" };
    if (!draft.userName.trim() || !draft.userCode.trim()) {
      setNotice("Phải nhập Họ tên và Mã người dùng trước khi cấp quyền.");
      return;
    }
    await manage(device, "approve", { userName: draft.userName.trim(), userCode: draft.userCode.trim() });
  }

  async function revoke(session: RuSession) {
    if (!canManage || !session.active) return;
    if (!window.confirm(`Thu hồi phiên ${session.deviceCode}?`)) return;
    setActionBusy(session.sessionId);
    try {
      const currentBridge = await freshBridge();
      const result = await upstreamJson<SessionResponse>(currentBridge, "/api/control/sessions", {
        method: "POST",
        body: { sessionId: session.sessionId },
      });
      if (result.sessions) setSessions(result.sessions);
      await refreshAudit(currentBridge);
      setNotice("Đã thu hồi phiên trong session ledger của RU_LIFE.");
    } catch (caught) {
      setNotice(caught instanceof Error ? caught.message : "Không thể thu hồi phiên.");
    } finally {
      setActionBusy("");
    }
  }

  const visibleDevices = useMemo(() => devices.filter((device) => {
    const statusMatch = filter === "all" || (filter === "online" ? device.active : device.status === filter);
    const haystack = `${device.deviceCode} ${device.userName ?? ""} ${device.userCode ?? ""} ${device.label ?? ""} ${device.osName} ${device.browserName}`.toLowerCase();
    return statusMatch && haystack.includes(search.trim().toLowerCase());
  }), [devices, filter, search]);

  if (!access || access.status !== "approved") return <Gate access={access} error={error} retry={() => void load()} busy={busy} />;

  const counts = {
    pending: devices.filter((item) => item.status === "pending").length,
    approved: devices.filter((item) => item.status === "approved").length,
    blocked: devices.filter((item) => item.status === "blocked").length,
    online: devices.filter((item) => item.active).length,
  };

  return <main className={styles.shell}>
    <aside className={styles.sidebar}>
      <Link href="/" className={styles.serverLink}><span>AM</span><div><small>CONTROL PLANE</small><strong>Application Management</strong></div></Link>
      <div className={styles.brand}><span>RU</span><div><small>CLIENT ĐỘC LẬP</small><strong>Hòa nhập Nga</strong></div></div>
      <nav>
        <button data-active={view === "devices"} onClick={() => setView("devices")}><b>01</b><div><strong>Thiết bị & quyền</strong><small>Registry HN trong RU_LIFE</small></div></button>
        <button data-active={view === "sessions"} onClick={() => setView("sessions")}><b>02</b><div><strong>Phiên truy cập</strong><small>RU_LIFE phát · 15 phút</small></div></button>
        {canReview ? <button data-active={view === "audit"} onClick={() => setView("audit")}><b>03</b><div><strong>Audit Hòa nhập Nga</strong><small>Đọc từ RU_LIFE</small></div></button> : null}
      </nav>
      <div className={styles.boundary}><strong>RANH GIỚI</strong><p>HN- và session ledger thuộc RU_LIFE. Application Management chỉ cấp policy qua vé quản trị ngắn hạn; không lưu thiết bị HN trong DB Trung tâm.</p></div>
      <div className={styles.user}><span>{user.displayName.slice(0, 1).toUpperCase()}</span><div><strong>{user.displayName}</strong><small>{roleLabels[role]} · {access.deviceCode}</small></div></div>
    </aside>

    <section className={styles.main}>
      <header className={styles.topbar}><div><span>RU LIFE / SIGNED REMOTE CONTROL</span><h1>{view === "devices" ? "Thiết bị & quyền Hòa nhập Nga" : view === "sessions" ? "Phiên truy cập Hòa nhập Nga" : "Audit ứng dụng Hòa nhập Nga"}</h1><p>{view === "devices" ? "RU_LIFE tự nhận diện, phân loại và lưu thiết bị. Application Management chỉ gắn người dùng, cấp/khóa quyền qua signed Control API." : view === "sessions" ? "Phiên do RU_LIFE phát sau challenge P-256; Trung tâm chỉ gửi lệnh thu hồi qua API quản trị." : "Nhật ký nằm trong RU_LIFE; Trung tâm chỉ đọc theo quyền reviewer/publisher/owner."}</p></div><button onClick={() => void load()} disabled={busy}>{busy ? "Đang đồng bộ…" : "Đồng bộ"}</button></header>
      {error ? <div className={styles.error}>{error}</div> : null}
      {notice ? <div className={styles.notice}>{notice}</div> : null}

      {view === "devices" ? <>
        <section className={styles.metrics}>
          <article><span>Tổng HN</span><strong>{devices.length}</strong><small>Đọc từ registry RU_LIFE</small></article>
          <article data-alert={counts.pending > 0}><span>Chờ duyệt</span><strong>{counts.pending}</strong><small>Phải gắn người dùng</small></article>
          <article><span>Đã cấp quyền</span><strong>{counts.approved}</strong><small>{counts.online} đang online</small></article>
          <article data-alert={counts.blocked > 0}><span>Đã khóa</span><strong>{counts.blocked}</strong><small>Session bị thu hồi tại RU_LIFE</small></article>
        </section>
        <section className={styles.toolbar}><div>{(["all", "online", "pending", "approved", "blocked"] as const).map((item) => <button key={item} data-active={filter === item} onClick={() => setFilter(item)}>{item === "all" ? "Tất cả" : item === "online" ? "Online" : statusLabel[item]}</button>)}</div><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm mã HN, họ tên, mã người dùng…" /></section>
        <section className={styles.deviceList}>
          {visibleDevices.map((device) => <article key={device.deviceId} data-status={device.status}>
            <div className={styles.glyph}><DeviceGlyph type={device.deviceClass}/><i data-online={device.active}/></div>
            <div className={styles.identity}><div><strong>{device.userName || device.label || "Thiết bị chưa gắn người dùng"}</strong><span>{device.deviceCode}</span></div><small>{device.userCode ? `Mã người dùng: ${device.userCode} · ` : ""}{classLabel[device.deviceClass]} · {device.osName} · {device.browserName}</small><small>{device.active ? "Online" : `Offline từ ${formatTime(device.offlineSinceAt)}`} · tự nhận diện {classLabel[device.detectedDeviceClass]} ({device.classificationConfidence}%)</small>{device.deviceClassOverride ? <em>Đã ghi đè loại thiết bị bởi {device.deviceClassOverrideBy || "quản trị"}</em> : null}</div>
            <div className={styles.flags}><span data-state={device.status}>{statusLabel[device.status]}</span><span data-on={device.editEnabled}>Quyền sửa: {device.editEnabled ? "Bật" : "Tắt"}</span></div>
            <div className={styles.actions}>
              {device.status === "pending" && canManage ? <div className={styles.binding}><input placeholder="Họ tên" value={bindings[device.deviceId]?.userName ?? ""} onChange={(event) => setBindings((current) => ({ ...current, [device.deviceId]: { userName: event.target.value, userCode: current[device.deviceId]?.userCode ?? "" } }))}/><input placeholder="Mã người dùng" value={bindings[device.deviceId]?.userCode ?? ""} onChange={(event) => setBindings((current) => ({ ...current, [device.deviceId]: { userName: current[device.deviceId]?.userName ?? "", userCode: event.target.value } }))}/><button disabled={actionBusy === device.deviceId} onClick={() => void approve(device)}>Gắn & cấp quyền</button></div> : null}
              {device.status === "approved" && canManage ? <><button disabled={actionBusy === device.deviceId} onClick={() => void manage(device, device.editEnabled ? "disable-edit" : "enable-edit")}>{device.editEnabled ? "Tắt sửa" : "Cho phép sửa"}</button><button className={styles.danger} disabled={actionBusy === device.deviceId} onClick={() => void manage(device, "block")}>Khóa</button></> : null}
              {device.status === "blocked" && canManage ? <button disabled={actionBusy === device.deviceId} onClick={() => void manage(device, "unblock")}>Mở khóa</button> : null}
              {canManage ? <select value={device.deviceClassOverride ?? "auto"} onChange={(event) => void manage(device, event.target.value === "auto" ? "clear-device-class" : "set-device-class", event.target.value === "auto" ? {} : { deviceClass: event.target.value })}><option value="auto">Phân loại tự động</option><option value="computer">Máy tính</option><option value="phone">Điện thoại</option><option value="tablet">Tablet / iPad</option><option value="unknown">Chưa xác định</option></select> : null}
            </div>
          </article>)}
          {!visibleDevices.length ? <div className={styles.empty}>Không có thiết bị phù hợp.</div> : null}
        </section>
      </> : null}

      {view === "sessions" ? <section className={styles.sessionPanel}><header><div><span>RU_LIFE SESSION LEDGER</span><h2>Phiên do RU_LIFE phát cho thiết bị HN</h2></div><strong>{sessions.filter((item) => item.active).length} active</strong></header><div className={styles.sessionList}>{sessions.map((session) => <article key={session.sessionId}><div><strong>{session.userName || session.deviceCode}</strong><small>{session.userCode || "Chưa có mã"} · {classLabel[session.deviceClass]} · {session.deviceCode}</small></div><div><span data-active={session.active}>{session.status}</span><small>Hết hạn {formatTime(session.expiresAt)}</small></div><div><small>Phát {formatTime(session.createdAt)}</small><small>Thấy cuối {formatTime(session.lastSeenAt)}</small></div>{canManage && session.active ? <button disabled={actionBusy === session.sessionId} onClick={() => void revoke(session)}>Thu hồi</button> : <span/>}</article>)}{!sessions.length ? <div className={styles.empty}>Chưa có phiên Hòa nhập Nga.</div> : null}</div></section> : null}

      {view === "audit" && canReview ? <section className={styles.auditPanel}><header><span>RU_LIFE AUDIT</span><h2>Nhật ký thay đổi quyền HN trong client</h2></header><div>{audit.map((entry) => <article key={entry.id}><time>{formatTime(entry.createdAt)}</time><div><strong>{entry.action}</strong><small>{entry.actor}</small></div><code>{entry.target}</code></article>)}{!audit.length ? <div className={styles.empty}>Chưa có sự kiện audit.</div> : null}</div></section> : null}
    </section>
  </main>;
}
