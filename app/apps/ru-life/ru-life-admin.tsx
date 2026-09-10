"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
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
type Filter = "all" | DeviceStatus | "online";
type SortOrder = "newest" | "oldest";
type IconName = "apps" | "monitor" | "clock" | "audit" | "sync" | "search" | "filter" | "bell" | "check" | "hourglass" | "lock" | "key" | "copy" | "user" | "tag" | "logout" | "external" | "sort" | "shield";

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

type DeviceResponse = {
  ok?: boolean;
  devices?: RuDevice[];
  sessions?: RuSession[];
  device?: RuDevice | null;
};

type SessionResponse = { ok?: boolean; sessions?: RuSession[] };
type AuditResponse = { ok?: boolean; audit?: RuAudit[] };
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

function reusableBridge(bridge: ApplicationBridge | null) {
  return bridge && bridge.expiresAt > Date.now() + 30_000 ? bridge : null;
}

function formatTime(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(date);
}

function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  const common = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
  if (name === "apps") return <svg {...common}><rect x="3" y="3" width="6" height="6" rx="1"/><rect x="15" y="3" width="6" height="6" rx="1"/><rect x="3" y="15" width="6" height="6" rx="1"/><rect x="15" y="15" width="6" height="6" rx="1"/></svg>;
  if (name === "monitor") return <svg {...common}><rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M10 16v4M14 16v4"/></svg>;
  if (name === "clock") return <svg {...common}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>;
  if (name === "audit") return <svg {...common}><path d="M6 3h8l4 4v14H6z"/><path d="M14 3v5h4M9 12h6M9 16h6"/></svg>;
  if (name === "sync") return <svg {...common}><path d="M20 6v5h-5M4 18v-5h5"/><path d="M18 9a7 7 0 0 0-12-2L4 11M6 15a7 7 0 0 0 12 2l2-4"/></svg>;
  if (name === "search") return <svg {...common}><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>;
  if (name === "filter") return <svg {...common}><path d="M4 5h16l-6 7v6l-4 2v-8L4 5Z"/></svg>;
  if (name === "bell") return <svg {...common}><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></svg>;
  if (name === "check") return <svg {...common}><circle cx="12" cy="12" r="9"/><path d="m8 12 2.5 2.5L16 9"/></svg>;
  if (name === "hourglass") return <svg {...common}><path d="M7 3h10M7 21h10M8 3c0 4 1 6 4 9-3 3-4 5-4 9M16 3c0 4-1 6-4 9 3 3 4 5 4 9"/></svg>;
  if (name === "lock") return <svg {...common}><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>;
  if (name === "key") return <svg {...common}><circle cx="8" cy="15" r="4"/><path d="m11 12 9-9M15 8l3 3M17 6l2 2"/></svg>;
  if (name === "copy") return <svg {...common}><rect x="8" y="8" width="11" height="11" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></svg>;
  if (name === "user") return <svg {...common}><circle cx="12" cy="8" r="3.5"/><path d="M5 21a7 7 0 0 1 14 0"/></svg>;
  if (name === "tag") return <svg {...common}><path d="M20 13 13 20l-9-9V4h7l9 9Z"/><circle cx="8.5" cy="8.5" r="1"/></svg>;
  if (name === "logout") return <svg {...common}><path d="M10 17l5-5-5-5M15 12H3M14 4h5a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-5"/></svg>;
  if (name === "external") return <svg {...common}><path d="M14 4h6v6M20 4l-9 9"/><path d="M18 13v6H5V6h6"/></svg>;
  if (name === "sort") return <svg {...common}><path d="M8 6h10M8 12h7M8 18h4M4 4v16M2 18l2 2 2-2"/></svg>;
  return <svg {...common}><path d="M12 2 4.5 5v6c0 5 3 8.5 7.5 11 4.5-2.5 7.5-6 7.5-11V5L12 2Z"/><path d="m9 12 2 2 4-5"/></svg>;
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

export default function RuLifeAdmin({ user, publicUrl }: { user: { displayName: string; email: string }; publicUrl: string }) {
  const [view, setView] = useState<View>("devices");
  const [access, setAccess] = useState<AdminAccess | null>(null);
  const [bridge, setBridge] = useState<ApplicationBridge | null>(null);
  const [devices, setDevices] = useState<RuDevice[]>([]);
  const [sessions, setSessions] = useState<RuSession[]>([]);
  const [audit, setAudit] = useState<RuAudit[]>([]);
  const [bindings, setBindings] = useState<Record<string, BindingDraft>>({});
  const [filter, setFilter] = useState<Filter>("all");
  const [sortOrder, setSortOrder] = useState<SortOrder>("newest");
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(true);
  const [actionBusy, setActionBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const searchRef = useRef<HTMLInputElement | null>(null);

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
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => { window.clearTimeout(timer); window.removeEventListener("keydown", onKeyDown); };
    // Initial control-plane handshake is intentionally tied to the mounted admin shell.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  async function copyDeviceCode(deviceCode: string) {
    try {
      await navigator.clipboard.writeText(deviceCode);
      setNotice(`Đã sao chép ${deviceCode}.`);
    } catch {
      setNotice("Trình duyệt không cho phép sao chép tự động.");
    }
  }

  const visibleDevices = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    return devices.filter((device) => {
      const statusMatch = filter === "all" || (filter === "online" ? device.active : device.status === filter);
      const haystack = `${device.deviceCode} ${device.userName ?? ""} ${device.userCode ?? ""} ${device.label ?? ""} ${device.osName} ${device.browserName}`.toLowerCase();
      return statusMatch && haystack.includes(normalized);
    }).sort((a, b) => {
      const aTime = Date.parse(a.createdAt) || 0;
      const bTime = Date.parse(b.createdAt) || 0;
      return sortOrder === "newest" ? bTime - aTime : aTime - bTime;
    });
  }, [devices, filter, search, sortOrder]);

  if (!access || access.status !== "approved") return <Gate access={access} error={error} retry={() => void load()} busy={busy} />;

  const counts = {
    pending: devices.filter((item) => item.status === "pending").length,
    approved: devices.filter((item) => item.status === "approved").length,
    blocked: devices.filter((item) => item.status === "blocked").length,
    online: devices.filter((item) => item.active).length,
  };
  const filterCount: Record<Filter, number> = { all: devices.length, online: counts.online, pending: counts.pending, approved: counts.approved, blocked: counts.blocked };
  const pageTitle = view === "devices" ? "Thiết bị & quyền Hòa nhập Nga" : view === "sessions" ? "Phiên truy cập Hòa nhập Nga" : "Audit ứng dụng Hòa nhập Nga";
  const pageDescription = view === "devices"
    ? "RU_LIFE tự nhận diện, phân loại và lưu thiết bị. Application Management chỉ gắn người dùng, cấp/khóa quyền qua signed Control API."
    : view === "sessions"
      ? "Phiên do RU_LIFE phát sau challenge P-256; Trung tâm chỉ gửi lệnh thu hồi qua API quản trị."
      : "Nhật ký nằm trong RU_LIFE; Trung tâm chỉ đọc theo quyền reviewer/publisher/owner.";

  return <main className={styles.shell}>
    <aside className={styles.sidebar}>
      <Link href="/" className={styles.serverLink}>
        <span>AM</span><div><strong>Application Management</strong><small>CONTROL PLANE</small></div>
      </Link>
      <div className={styles.clientBlock}>
        <small>CLIENT ĐỘC LẬP</small>
        <div className={styles.brand}><span>HN</span><div><strong>Hòa nhập Nga</strong><small>RU_LIFE</small></div></div>
      </div>
      <nav aria-label="Quản trị Hòa nhập Nga">
        <button data-active={view === "devices"} onClick={() => setView("devices")}><i><Icon name="monitor" size={20}/></i><div><strong>Thiết bị & quyền</strong><small>Registry HN trong RU_LIFE</small></div></button>
        <button data-active={view === "sessions"} onClick={() => setView("sessions")}><i><Icon name="clock" size={20}/></i><div><strong>Phiên truy cập</strong><small>RU_LIFE phát · 15 phút</small></div></button>
        {canReview ? <button data-active={view === "audit"} onClick={() => setView("audit")}><i><Icon name="audit" size={20}/></i><div><strong>Audit Hòa nhập Nga</strong><small>Đọc từ RU_LIFE</small></div></button> : null}
      </nav>
      <div className={styles.boundary}><div><Icon name="shield" size={16}/><strong>RANH GIỚI HỆ THỐNG</strong></div><p>HN- và session ledger thuộc RU_LIFE. Application Management chỉ cấp policy qua vé quản trị ngắn hạn; không lưu thiết bị HN trong DB Trung tâm.</p></div>
      <div className={styles.user}><span>{user.displayName.slice(0, 1).toUpperCase()}</span><div><strong>{user.displayName}</strong><small>{roleLabels[role]}</small><code>{access.deviceCode}</code></div></div>
      <a className={styles.logout} href="/signout-with-chatgpt?return_to=%2F"><Icon name="logout" size={17}/> Đăng xuất</a>
    </aside>

    <section className={styles.main}>
      <header className={styles.topbar}>
        <div className={styles.heading}><span>RU_LIFE / SIGNED REMOTE CONTROL</span><h1>{pageTitle}</h1><p>{pageDescription}</p></div>
        <div className={styles.topActions}>
          <button className={styles.notificationButton} title="Thiết bị đang chờ duyệt" aria-label={`${counts.pending} thiết bị đang chờ duyệt`}><Icon name="bell" size={21}/>{counts.pending ? <b>{counts.pending}</b> : null}</button>
          <a className={styles.clientPicker} href={publicUrl} target="_blank" rel="noreferrer" title="Mở site RU_LIFE độc lập"><span>RU</span><strong>Hòa nhập Nga</strong><Icon name="external" size={14}/></a>
          <button className={styles.syncButton} onClick={() => void load()} disabled={busy}><Icon name="sync" size={18}/><span>{busy ? "Đang đồng bộ…" : "Đồng bộ"}</span><small>Cập nhật từ RU_LIFE</small></button>
        </div>
      </header>
      {error ? <div className={styles.error} role="alert">{error}</div> : null}
      {notice ? <div className={styles.notice} role="status">{notice}</div> : null}

      {view === "devices" ? <>
        <section className={styles.metrics} aria-label="Tổng quan thiết bị HN">
          <button data-tone="blue" onClick={() => setFilter("all")}><i><Icon name="monitor" size={28}/></i><div><span>Tổng HN</span><strong>{devices.length}</strong><small>Đọc từ registry RU_LIFE</small></div><b>›</b></button>
          <button data-tone="amber" onClick={() => setFilter("pending")}><i><Icon name="hourglass" size={28}/></i><div><span>Chờ duyệt</span><strong>{counts.pending}</strong><small>Phải gắn người dùng</small></div><b>›</b></button>
          <button data-tone="green" onClick={() => setFilter("approved")}><i><Icon name="check" size={28}/></i><div><span>Đã cấp quyền</span><strong>{counts.approved}</strong><small>{counts.online} đang online</small></div><b>›</b></button>
          <button data-tone="red" onClick={() => setFilter("blocked")}><i><Icon name="lock" size={28}/></i><div><span>Đã khóa</span><strong>{counts.blocked}</strong><small>Session bị thu hồi tại RU_LIFE</small></div><b>›</b></button>
        </section>

        <section className={styles.toolbar}>
          <div className={styles.filterChips}>{(["all", "online", "pending", "approved", "blocked"] as const).map((item) => <button key={item} data-active={filter === item} data-filter={item} onClick={() => setFilter(item)}><i/>{item === "all" ? "Tất cả" : item === "online" ? "Online" : statusLabel[item]}<b>{filterCount[item]}</b></button>)}</div>
          <div className={styles.searchTools}><label className={styles.searchBox}><Icon name="search" size={19}/><input ref={searchRef} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm mã HN, họ tên, mã người dùng…"/><kbd>Ctrl K</kbd></label><button className={styles.clearFilter} onClick={() => { setFilter("all"); setSearch(""); }} title="Xóa bộ lọc"><Icon name="filter" size={18}/></button></div>
        </section>

        <section className={styles.devicePanel}>
          <header className={styles.listHeader}><div><h2>Danh sách thiết bị</h2><span>{visibleDevices.length} / {devices.length} thiết bị</span></div><label><Icon name="sort" size={17}/><span>Sắp xếp:</span><select value={sortOrder} onChange={(event) => setSortOrder(event.target.value as SortOrder)}><option value="newest">Mới nhất</option><option value="oldest">Cũ nhất</option></select></label></header>
          <div className={styles.deviceList}>
            {visibleDevices.map((device, index) => <article key={device.deviceId} data-status={device.status}>
              <div className={styles.glyph} data-tone={index % 5}><DeviceGlyph type={device.deviceClass}/><i data-online={device.active}/></div>
              <div className={styles.identity}>
                <div className={styles.identityTitle}><strong>{device.userName || device.label || "Thiết bị chưa gắn người dùng"}</strong><code>{device.deviceCode}</code><button onClick={() => void copyDeviceCode(device.deviceCode)} title="Sao chép mã HN"><Icon name="copy" size={14}/></button></div>
                <small>{device.userCode ? `Mã người dùng: ${device.userCode} · ` : ""}{classLabel[device.deviceClass]} · {device.osName} · {device.browserName}</small>
                <small><i data-online={device.active}/>{device.active ? "Online" : `Offline từ ${formatTime(device.offlineSinceAt)}`} · tự nhận diện {classLabel[device.detectedDeviceClass]} ({device.classificationConfidence}%)</small>
                {device.deviceClassOverride ? <em>Đã ghi đè loại thiết bị bởi {device.deviceClassOverrideBy || "quản trị"}</em> : null}
              </div>
              <div className={styles.flags}><span data-state={device.status}>{statusLabel[device.status]}</span><span data-on={device.editEnabled}>Quyền sửa: {device.editEnabled ? "Bật" : "Tắt"}</span></div>
              <div className={styles.actions}>
                {device.status === "pending" && canManage ? <div className={styles.binding}>
                  <label><span><Icon name="user" size={14}/> Họ tên</span><input placeholder="Nhập họ tên…" value={bindings[device.deviceId]?.userName ?? ""} onChange={(event) => setBindings((current) => ({ ...current, [device.deviceId]: { userName: event.target.value, userCode: current[device.deviceId]?.userCode ?? "" } }))}/></label>
                  <label><span><Icon name="user" size={14}/> Mã người dùng</span><input placeholder="Nhập mã người dùng…" value={bindings[device.deviceId]?.userCode ?? ""} onChange={(event) => setBindings((current) => ({ ...current, [device.deviceId]: { userName: current[device.deviceId]?.userName ?? "", userCode: event.target.value } }))}/></label>
                  <label className={styles.classification}><span><Icon name="tag" size={14}/> Phân loại thiết bị</span><select value={device.deviceClassOverride ?? "auto"} onChange={(event) => void manage(device, event.target.value === "auto" ? "clear-device-class" : "set-device-class", event.target.value === "auto" ? {} : { deviceClass: event.target.value })}><option value="auto">Phân loại tự động</option><option value="computer">Máy tính</option><option value="phone">Điện thoại</option><option value="tablet">Tablet / iPad</option><option value="unknown">Chưa xác định</option></select></label>
                  <button className={styles.approveButton} disabled={actionBusy === device.deviceId} onClick={() => void approve(device)}><Icon name="key" size={17}/>{actionBusy === device.deviceId ? "Đang cấp quyền…" : "Gắn & cấp quyền"}</button>
                </div> : null}
                {device.status === "approved" && canManage ? <div className={styles.managedActions}><button disabled={actionBusy === device.deviceId} onClick={() => void manage(device, device.editEnabled ? "disable-edit" : "enable-edit")}>{device.editEnabled ? "Tắt sửa" : "Cho phép sửa"}</button><button className={styles.danger} disabled={actionBusy === device.deviceId} onClick={() => void manage(device, "block")}>Khóa thiết bị</button><select value={device.deviceClassOverride ?? "auto"} onChange={(event) => void manage(device, event.target.value === "auto" ? "clear-device-class" : "set-device-class", event.target.value === "auto" ? {} : { deviceClass: event.target.value })}><option value="auto">Phân loại tự động</option><option value="computer">Máy tính</option><option value="phone">Điện thoại</option><option value="tablet">Tablet / iPad</option><option value="unknown">Chưa xác định</option></select></div> : null}
                {device.status === "blocked" && canManage ? <div className={styles.managedActions}><button disabled={actionBusy === device.deviceId} onClick={() => void manage(device, "unblock")}>Mở khóa</button><select value={device.deviceClassOverride ?? "auto"} onChange={(event) => void manage(device, event.target.value === "auto" ? "clear-device-class" : "set-device-class", event.target.value === "auto" ? {} : { deviceClass: event.target.value })}><option value="auto">Phân loại tự động</option><option value="computer">Máy tính</option><option value="phone">Điện thoại</option><option value="tablet">Tablet / iPad</option><option value="unknown">Chưa xác định</option></select></div> : null}
                {!canManage ? <div className={styles.readOnly}><Icon name="shield" size={17}/><span>Vai trò hiện tại chỉ được xem trạng thái.</span></div> : null}
              </div>
            </article>)}
            {!visibleDevices.length ? <div className={styles.empty}>Không có thiết bị phù hợp với bộ lọc hiện tại.</div> : null}
          </div>
        </section>
      </> : null}

      {view === "sessions" ? <section className={styles.sessionPanel}><header><div><span>RU_LIFE SESSION LEDGER</span><h2>Phiên do RU_LIFE phát cho thiết bị HN</h2><p>Quản trị chỉ thu hồi phiên; khóa và token vẫn thuộc RU_LIFE.</p></div><strong>{sessions.filter((item) => item.active).length} active</strong></header><div className={styles.sessionList}>{sessions.map((session) => <article key={session.sessionId}><div><strong>{session.userName || session.deviceCode}</strong><small>{session.userCode || "Chưa có mã"} · {classLabel[session.deviceClass]} · {session.deviceCode}</small></div><div><span data-active={session.active}>{session.status}</span><small>Hết hạn {formatTime(session.expiresAt)}</small></div><div><small>Phát {formatTime(session.createdAt)}</small><small>Thấy cuối {formatTime(session.lastSeenAt)}</small></div>{canManage && session.active ? <button disabled={actionBusy === session.sessionId} onClick={() => void revoke(session)}>Thu hồi</button> : <span/>}</article>)}{!sessions.length ? <div className={styles.empty}>Chưa có phiên Hòa nhập Nga.</div> : null}</div></section> : null}

      {view === "audit" && canReview ? <section className={styles.auditPanel}><header><span>RU_LIFE AUDIT</span><h2>Nhật ký thay đổi quyền HN trong client</h2><p>Dữ liệu audit được đọc từ RU_LIFE, không sao chép sang registry Trung tâm.</p></header><div>{audit.map((entry) => <article key={entry.id}><time>{formatTime(entry.createdAt)}</time><div><strong>{entry.action}</strong><small>{entry.actor}</small></div><code>{entry.target}</code></article>)}{!audit.length ? <div className={styles.empty}>Chưa có sự kiện audit.</div> : null}</div></section> : null}
    </section>
  </main>;
}
