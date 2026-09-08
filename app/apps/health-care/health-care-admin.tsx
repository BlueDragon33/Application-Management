"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  connectHealthCareAdmin,
  roleLabels,
  upstreamJson,
  type AdminAccess,
  type ApplicationBridge,
} from "../../admin-device-client";
import styles from "./health-care-admin.module.css";

type View = "devices" | "access" | "content" | "audit";
type DeviceType = "desktop" | "phone" | "tablet";
type DeviceStatus = "pending" | "approved" | "blocked";

type HealthPolicy = {
  accessEnabled: boolean;
  pendingPollSeconds: number;
  heartbeatSeconds: number;
  sessionTimeoutSeconds: number;
  sessionTtlMinutes: number;
  systemNoticeEnabled: boolean;
  systemNotice: string | null;
  updatedBy: string | null;
  updatedAt: string;
};

type HealthStatus = {
  application: "child-health";
  canonicalApplication: string;
  controlProtocol: string;
  contractVersion: number;
  capabilities: string[];
  boundary: { healthDataInControlPlane: boolean; deviceIdentity: string };
  service: "online" | "paused";
  serverTime: string;
  devices: { total: number; pending: number; approved: number; blocked: number };
  sessions: { total: number; active: number; revoked: number; expired: number };
  policy: HealthPolicy;
  buildRevision?: string | null;
  buildSource?: string | null;
  controlAuth?: { secretScope?: string };
};

type HealthDevice = {
  deviceId: string;
  deviceCode: string;
  status: DeviceStatus;
  deviceType: DeviceType;
  detectedDeviceType: DeviceType;
  deviceTypeOverride: DeviceType | null;
  deviceTypeOverrideBy: string | null;
  environmentChanged: boolean;
  environmentChangeReason: string | null;
  autoLabel: string;
  platform: string | null;
  osName: string | null;
  browser: string | null;
  browserVersion: string | null;
  viewportWidth: number | null;
  viewportHeight: number | null;
  touchPoints: number;
  pwaMode: boolean;
  classificationConfidence: "high" | "medium" | "low";
  classificationReason: string | null;
  label: string | null;
  editEnabled: boolean;
  calendarEnabled: boolean;
  createdAt: string;
  approvedAt: string | null;
  blockedAt: string | null;
  lastSeenAt: string;
  lastActivityAt: string;
  offlineSinceAt: string | null;
  active: boolean;
};

type HealthSession = {
  sessionId: string;
  deviceId: string;
  deviceCode: string;
  deviceLabel: string | null;
  deviceType: DeviceType;
  deviceStatus: DeviceStatus;
  status: "active" | "revoked" | "expired";
  startedAt: string;
  lastSeenAt: string;
  expiresAt: number;
  revokedAt: string | null;
  revokedBy: string | null;
  revokeReason: string | null;
  active: boolean;
};

type HealthAudit = {
  id: string;
  actor: string;
  action: string;
  target: string;
  detail: Record<string, unknown>;
  createdAt: string;
};

type HealthVersion = {
  id: string;
  version_number: number;
  status: string;
  summary: string | null;
  created_by: string;
  edit_scope?: string | null;
  edit_scope_label?: string | null;
  editor_device_code?: string | null;
  created_at: string;
  updated_at: string;
};

function reusableBridge(bridge: ApplicationBridge | null) {
  return bridge && bridge.expiresAt > Date.now() + 30_000 ? bridge : null;
}

type DevicesResponse = { application: string; devices: HealthDevice[]; error?: string };
type SessionsResponse = { application: string; sessions: HealthSession[]; error?: string };
type AuditResponse = { application: string; audit: HealthAudit[]; error?: string };
type ContentResponse = { application: string; versions: HealthVersion[]; error?: string; versionId?: string };
type PolicyResponse = { application: string; policy: HealthPolicy; error?: string };

const deviceTypeLabels: Record<DeviceType, string> = {
  desktop: "Máy tính",
  tablet: "Tablet / iPad",
  phone: "Điện thoại",
};

const deviceStatusLabels: Record<DeviceStatus, string> = {
  pending: "Chờ duyệt",
  approved: "Đã cấp quyền",
  blocked: "Đã khóa",
};

const contentStatusLabels: Record<string, string> = {
  permission_requested: "Xin quyền sửa",
  draft: "Đang chỉnh sửa",
  review: "Chờ kiểm duyệt",
  published: "Đã xuất bản",
  changes_requested: "Yêu cầu sửa lại",
  denied: "Đã từ chối",
  cancelled: "Đã hủy",
  archived: "Phiên bản cũ",
};

function formatTime(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") return "—";
  const date = typeof value === "number" ? new Date(value) : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(date);
}

function DeviceIcon({ type }: { type: DeviceType }) {
  if (type === "phone") return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="7" y="2.5" width="10" height="19" rx="2.3" /><path d="M10.3 5h3.4M11.1 18.7h1.8" /></svg>;
  if (type === "tablet") return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="2.5" width="16" height="19" rx="2.3" /><path d="M10.5 18.6h3" /></svg>;
  return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2.5" y="3.5" width="19" height="13" rx="2" /><path d="M8 20.5h8M10 16.5v4M14 16.5v4" /></svg>;
}

function Gate({ access, error, busy, retry }: { access: AdminAccess | null; error: string; busy: boolean; retry: () => void }) {
  return <main className={styles.gate}><section>
    <div className={styles.gateMark}>YT</div>
    <span>HEALTH CARE · CLIENT ADMIN</span>
    <h1>{access?.status === "pending" ? "Thiết bị QT đang chờ cấp quyền." : access?.status === "blocked" ? "Thiết bị QT đã bị khóa." : "Đang xác thực quản trị Sức khỏe Y tế…"}</h1>
    <p>{error || "Khu quản trị Health_Care dùng quyền thiết bị của Application Management nhưng vận hành trên Control API và dữ liệu riêng của Health_Care."}</p>
    {access?.deviceCode ? <div><small>Mã thiết bị quản trị</small><strong>{access.deviceCode}</strong></div> : null}
    <button onClick={retry} disabled={busy}>{busy ? "Đang kiểm tra…" : "Kiểm tra lại"}</button>
  </section></main>;
}

export default function HealthCareAdmin({ user }: { user: { displayName: string; email: string } }) {
  const [view, setView] = useState<View>("devices");
  const [access, setAccess] = useState<AdminAccess | null>(null);
  const [bridge, setBridge] = useState<ApplicationBridge | null>(null);
  const [status, setStatus] = useState<HealthStatus | null>(null);
  const [devices, setDevices] = useState<HealthDevice[]>([]);
  const [sessions, setSessions] = useState<HealthSession[]>([]);
  const [audit, setAudit] = useState<HealthAudit[]>([]);
  const [versions, setVersions] = useState<HealthVersion[]>([]);
  const [policyDraft, setPolicyDraft] = useState<HealthPolicy | null>(null);
  const [search, setSearch] = useState("");
  const [deviceFilter, setDeviceFilter] = useState<"all" | DeviceStatus | "online" | "environment">("all");
  const [busy, setBusy] = useState(true);
  const [actionBusy, setActionBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const role = access?.role ?? "viewer";
  const canManage = role === "publisher" || role === "owner";
  const canReview = role === "reviewer" || canManage;
  const canOwn = role === "owner";

  async function freshBridge() {
    const cached = reusableBridge(bridge);
    if (cached) return cached;
    const result = await connectHealthCareAdmin();
    setAccess(result.access);
    if (!result.bootstrap) throw new Error("Thiết bị quản trị chưa được cấp quyền cho Application Management.");
    setBridge(result.bootstrap.bridge);
    return result.bootstrap.bridge;
  }

  async function loadAll() {
    setBusy(true);
    setError("");
    try {
      const result = await connectHealthCareAdmin();
      setAccess(result.access);
      if (!result.bootstrap) {
        setBridge(null);
        return;
      }
      const nextBridge = result.bootstrap.bridge;
      setBridge(nextBridge);
      const [statusData, deviceData, sessionData] = await Promise.all([
        upstreamJson<HealthStatus>(nextBridge, "/api/control/status"),
        upstreamJson<DevicesResponse>(nextBridge, "/api/control/devices"),
        upstreamJson<SessionsResponse>(nextBridge, "/api/control/sessions"),
      ]);
      setStatus(statusData);
      setPolicyDraft(statusData.policy);
      setDevices(deviceData.devices ?? []);
      setSessions(sessionData.sessions ?? []);
      if (["reviewer", "publisher", "owner"].includes(result.access.role)) {
        const [auditData, contentData] = await Promise.all([
          upstreamJson<AuditResponse>(nextBridge, "/api/control/audit"),
          upstreamJson<ContentResponse>(nextBridge, "/api/control/health-content"),
        ]);
        setAudit(auditData.audit ?? []);
        setVersions(contentData.versions ?? []);
      } else {
        setAudit([]);
        setVersions([]);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không thể kết nối Control API Sức khỏe Y tế.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadAll(); }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  async function refreshLight() {
    try {
      const token = await freshBridge();
      const [statusData, deviceData, sessionData] = await Promise.all([
        upstreamJson<HealthStatus>(token, "/api/control/status"),
        upstreamJson<DevicesResponse>(token, "/api/control/devices"),
        upstreamJson<SessionsResponse>(token, "/api/control/sessions"),
      ]);
      setStatus(statusData);
      setPolicyDraft(statusData.policy);
      setDevices(deviceData.devices ?? []);
      setSessions(sessionData.sessions ?? []);
      if (canReview) {
        const auditData = await upstreamJson<AuditResponse>(token, "/api/control/audit");
        setAudit(auditData.audit ?? []);
      }
    } catch (caught) {
      setNotice(caught instanceof Error ? caught.message : "Không thể đồng bộ Health_Care.");
    }
  }

  async function deviceAction(device: HealthDevice, action: string, extra: Record<string, unknown> = {}) {
    if (!canManage) return;
    setActionBusy(device.deviceId);
    setNotice("");
    try {
      const token = await freshBridge();
      const result = await upstreamJson<DevicesResponse>(token, "/api/control/devices", {
        method: "POST",
        body: { action, deviceId: device.deviceId, ...extra },
      });
      setDevices(result.devices ?? []);
      setNotice("Đã cập nhật thiết bị Sức khỏe Y tế.");
      await refreshLight();
    } catch (caught) {
      setNotice(caught instanceof Error ? caught.message : "Không thể cập nhật thiết bị.");
    } finally {
      setActionBusy("");
    }
  }

  async function savePolicy() {
    if (!canOwn || !policyDraft) return;
    setActionBusy("policy");
    setNotice("");
    try {
      const token = await freshBridge();
      const result = await upstreamJson<PolicyResponse>(token, "/api/control/policy", {
        method: "POST",
        body: policyDraft,
      });
      setPolicyDraft(result.policy);
      setStatus((current) => current ? { ...current, policy: result.policy, service: result.policy.accessEnabled ? "online" : "paused" } : current);
      setNotice("Đã cập nhật policy truy cập Health_Care và ghi audit tại client.");
    } catch (caught) {
      setNotice(caught instanceof Error ? caught.message : "Không thể lưu policy.");
    } finally {
      setActionBusy("");
    }
  }

  async function revokeSession(session: HealthSession) {
    if (!canManage || session.status !== "active") return;
    if (!window.confirm(`Thu hồi phiên ${session.deviceCode}?`)) return;
    setActionBusy(session.sessionId);
    try {
      const token = await freshBridge();
      const result = await upstreamJson<SessionsResponse>(token, "/api/control/sessions", {
        method: "POST",
        body: { action: "revoke-session", sessionId: session.sessionId, reason: "Thu hồi từ khu quản trị Health_Care" },
      });
      setSessions(result.sessions ?? []);
      setNotice("Đã thu hồi phiên truy cập Health_Care.");
      if (canReview) {
        const auditData = await upstreamJson<AuditResponse>(token, "/api/control/audit");
        setAudit(auditData.audit ?? []);
      }
    } catch (caught) {
      setNotice(caught instanceof Error ? caught.message : "Không thể thu hồi phiên.");
    } finally {
      setActionBusy("");
    }
  }

  async function contentAction(version: HealthVersion, action: string) {
    if (!canReview) return;
    const note = action === "approve-publish" ? "" : window.prompt("Ghi chú kiểm duyệt (có thể để trống):", "") ?? null;
    if (note === null) return;
    setActionBusy(version.id);
    try {
      const token = await freshBridge();
      const result = await upstreamJson<ContentResponse>(token, "/api/control/health-content", {
        method: "POST",
        body: { action, versionId: version.id, note },
      });
      setVersions(result.versions ?? []);
      setNotice("Đã cập nhật luồng kiểm duyệt nội dung Health_Care.");
      const auditData = await upstreamJson<AuditResponse>(token, "/api/control/audit");
      setAudit(auditData.audit ?? []);
    } catch (caught) {
      setNotice(caught instanceof Error ? caught.message : "Không thể xử lý phiên bản nội dung.");
    } finally {
      setActionBusy("");
    }
  }

  const visibleDevices = useMemo(() => devices.filter((device) => {
    const filterMatch = deviceFilter === "all"
      || (deviceFilter === "online" ? device.active
        : deviceFilter === "environment" ? device.environmentChanged
          : device.status === deviceFilter);
    const text = `${device.deviceCode} ${device.label ?? ""} ${device.autoLabel} ${device.osName ?? ""} ${device.browser ?? ""}`.toLowerCase();
    return filterMatch && text.includes(search.trim().toLowerCase());
  }), [devices, deviceFilter, search]);

  if (!access || access.status !== "approved" || !bridge) {
    return <Gate access={access} error={error} busy={busy} retry={() => void loadAll()} />;
  }

  return <main className={styles.shell}>
    <aside className={styles.sidebar}>
      <Link href="/" className={styles.serverLink}><span>AM</span><div><small>CONTROL PLANE</small><strong>Application Management</strong></div></Link>
      <div className={styles.appBrand}><span>YT</span><div><small>CLIENT ĐỘC LẬP</small><strong>Sức khỏe Y tế</strong></div></div>
      <nav>
        <button data-active={view === "devices"} onClick={() => setView("devices")}><b>01</b><div><strong>Thiết bị & quyền</strong><small>SK registry của Health</small></div></button>
        <button data-active={view === "access"} onClick={() => setView("access")}><b>02</b><div><strong>Policy & phiên</strong><small>Truy cập và session</small></div></button>
        {canReview ? <button data-active={view === "content"} onClick={() => setView("content")}><b>03</b><div><strong>Duyệt nội dung</strong><small>Health content only</small></div></button> : null}
        {canReview ? <button data-active={view === "audit"} onClick={() => setView("audit")}><b>04</b><div><strong>Audit ứng dụng</strong><small>Không phải audit Trung tâm</small></div></button> : null}
      </nav>
      <div className={styles.boundary}><strong>RANH GIỚI CLIENT</strong><p>Health_Care tự sở hữu runtime, D1, thiết bị SK, session và audit. Hồ sơ sức khỏe cá nhân không đi vào Application Management.</p></div>
      <div className={styles.user}><span>{user.displayName.slice(0,1).toUpperCase()}</span><div><strong>{user.displayName}</strong><small>{roleLabels[role]} · {access.deviceCode}</small></div></div>
    </aside>

    <section className={styles.main}>
      <header className={styles.topbar}>
        <div><span>HEALTH CARE / CLIENT CONTROL</span><h1>{view === "devices" ? "Thiết bị & quyền truy cập" : view === "access" ? "Policy & phiên truy cập" : view === "content" ? "Duyệt nội dung Sức khỏe Y tế" : "Audit ứng dụng Health_Care"}</h1><p>{view === "devices" ? "Quản lý đúng registry SK của Health_Care, không dùng thiết bị Bơi ếch hay QT làm thiết bị người dùng." : view === "access" ? "Policy và session được lưu, thực thi và audit tại Health_Care." : view === "content" ? "Chỉ xử lý phiên bản nội dung do Health_Care gửi lên quy trình kiểm duyệt." : "Đây là nhật ký nghiệp vụ Health_Care; nhật ký quyền QT vẫn ở Application Management."}</p></div>
        <button onClick={() => void loadAll()} disabled={busy}>{busy ? "Đang đồng bộ…" : "Đồng bộ"}</button>
      </header>

      {error ? <div className={styles.error}>{error}</div> : null}
      {notice ? <div className={styles.notice}>{notice}</div> : null}

      {view === "devices" ? <>
        <section className={styles.metrics}>
          <article><span>Tổng thiết bị SK</span><strong>{status?.devices.total ?? devices.length}</strong><small>Registry Health_Care</small></article>
          <article data-alert={(status?.devices.pending ?? 0) > 0}><span>Chờ duyệt</span><strong>{status?.devices.pending ?? 0}</strong><small>Cần quyết định truy cập</small></article>
          <article><span>Đã cấp quyền</span><strong>{status?.devices.approved ?? 0}</strong><small>{devices.filter((item) => item.active).length} đang online</small></article>
          <article data-alert={(status?.devices.blocked ?? 0) > 0}><span>Đã khóa</span><strong>{status?.devices.blocked ?? 0}</strong><small>Không thể tạo phiên</small></article>
        </section>
        <section className={styles.toolbar}>
          <div>{(["all", "online", "pending", "approved", "blocked", "environment"] as const).map((item) => <button key={item} data-active={deviceFilter === item} onClick={() => setDeviceFilter(item)}>{item === "all" ? "Tất cả" : item === "online" ? "Online" : item === "pending" ? "Chờ duyệt" : item === "approved" ? "Đã duyệt" : item === "blocked" ? "Đã khóa" : "Môi trường đổi"}</button>)}</div>
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm mã SK, nhãn, hệ điều hành, trình duyệt…" />
        </section>
        <section className={styles.deviceList}>
          {visibleDevices.map((device) => <article key={device.deviceId} data-status={device.status}>
            <div className={styles.deviceIcon}><DeviceIcon type={device.deviceType} /><i data-online={device.active} /></div>
            <div className={styles.deviceIdentity}><div><strong>{device.label || device.autoLabel}</strong><span>{device.deviceCode}</span></div><small>{deviceTypeLabels[device.deviceType]} · {device.osName || device.platform || "Nền tảng chưa rõ"} · {device.browser || "Trình duyệt chưa rõ"}{device.browserVersion ? ` ${device.browserVersion}` : ""}</small><small>{device.active ? "Online" : `Offline từ ${formatTime(device.offlineSinceAt)}`} · viewport {device.viewportWidth ?? "?"}×{device.viewportHeight ?? "?"}</small>{device.environmentChanged ? <em>{device.environmentChangeReason || "Môi trường thiết bị vừa thay đổi"}</em> : null}</div>
            <div className={styles.deviceFlags}><span data-state={device.status}>{deviceStatusLabels[device.status]}</span><span data-on={device.editEnabled}>Sửa: {device.editEnabled ? "Bật" : "Tắt"}</span><span data-on={device.calendarEnabled}>Calendar: {device.calendarEnabled ? "Bật" : "Tắt"}</span></div>
            <div className={styles.deviceActions}>
              {canManage && device.status === "pending" ? <button disabled={actionBusy === device.deviceId} onClick={() => void deviceAction(device, "approve")}>Cấp quyền</button> : null}
              {canManage && device.status === "blocked" ? <button disabled={actionBusy === device.deviceId} onClick={() => void deviceAction(device, "unblock")}>Mở khóa</button> : null}
              {canManage && device.status === "approved" ? <button className={styles.danger} disabled={actionBusy === device.deviceId} onClick={() => void deviceAction(device, "block")}>Khóa</button> : null}
              {canManage && device.status === "approved" ? <button disabled={actionBusy === device.deviceId} onClick={() => void deviceAction(device, device.editEnabled ? "disable-edit" : "enable-edit")}>{device.editEnabled ? "Tắt sửa" : "Cho phép sửa"}</button> : null}
              {canManage && device.status === "approved" ? <button disabled={actionBusy === device.deviceId} onClick={() => void deviceAction(device, device.calendarEnabled ? "disable-calendar" : "enable-calendar")}>{device.calendarEnabled ? "Tắt Calendar" : "Bật Calendar"}</button> : null}
              {canManage && device.environmentChanged ? <button disabled={actionBusy === device.deviceId} onClick={() => void deviceAction(device, "ack-environment")}>Đã kiểm tra</button> : null}
            </div>
          </article>)}
          {!visibleDevices.length ? <div className={styles.empty}>Không có thiết bị phù hợp bộ lọc.</div> : null}
        </section>
      </> : null}

      {view === "access" ? <section className={styles.accessGrid}>
        <article className={styles.policyCard}>
          <header><div><span>ACCESS POLICY</span><h2>Chính sách truy cập Health_Care</h2></div><b data-online={status?.service === "online"}>{status?.service === "online" ? "Đang mở" : "Đang tạm dừng"}</b></header>
          {policyDraft ? <div className={styles.policyForm}>
            <label className={styles.toggleRow}><div><strong>Cho phép truy cập Web App</strong><small>Tắt sẽ ngăn tạo/duy trì phiên người dùng.</small></div><input type="checkbox" checked={policyDraft.accessEnabled} disabled={!canOwn} onChange={(event) => setPolicyDraft({ ...policyDraft, accessEnabled: event.target.checked })} /></label>
            <div className={styles.numberGrid}><label><span>Heartbeat</span><input type="number" min={30} max={300} value={policyDraft.heartbeatSeconds} disabled={!canOwn} onChange={(event) => setPolicyDraft({ ...policyDraft, heartbeatSeconds: Number(event.target.value) || 60 })} /><small>giây</small></label><label><span>Timeout online</span><input type="number" min={60} max={1800} value={policyDraft.sessionTimeoutSeconds} disabled={!canOwn} onChange={(event) => setPolicyDraft({ ...policyDraft, sessionTimeoutSeconds: Number(event.target.value) || 180 })} /><small>giây</small></label><label><span>TTL phiên</span><input type="number" min={30} max={10080} value={policyDraft.sessionTtlMinutes} disabled={!canOwn} onChange={(event) => setPolicyDraft({ ...policyDraft, sessionTtlMinutes: Number(event.target.value) || 720 })} /><small>phút</small></label><label><span>Poll chờ duyệt</span><input type="number" min={15} max={300} value={policyDraft.pendingPollSeconds} disabled={!canOwn} onChange={(event) => setPolicyDraft({ ...policyDraft, pendingPollSeconds: Number(event.target.value) || 60 })} /><small>giây</small></label></div>
            <label className={styles.toggleRow}><div><strong>Thông báo hệ thống</strong><small>Hiện thông báo vận hành ở client mà không đưa dữ liệu sức khỏe về Trung tâm.</small></div><input type="checkbox" checked={policyDraft.systemNoticeEnabled} disabled={!canOwn} onChange={(event) => setPolicyDraft({ ...policyDraft, systemNoticeEnabled: event.target.checked })} /></label>
            <textarea maxLength={280} disabled={!canOwn} value={policyDraft.systemNotice ?? ""} onChange={(event) => setPolicyDraft({ ...policyDraft, systemNotice: event.target.value })} placeholder="Thông báo hệ thống…" />
            {canOwn ? <button onClick={() => void savePolicy()} disabled={actionBusy === "policy"}>{actionBusy === "policy" ? "Đang lưu…" : "Lưu policy"}</button> : <small>Chỉ Chủ hệ thống được thay đổi policy.</small>}
          </div> : null}
        </article>
        <article className={styles.sessionCard}><header><div><span>ACCESS SESSIONS</span><h2>Phiên truy cập</h2></div><b>{status?.sessions.active ?? 0} active</b></header><div>{sessions.map((session) => <section key={session.sessionId} data-active={session.active}><div><strong>{session.deviceLabel || session.deviceCode}</strong><span>{session.deviceCode} · {deviceTypeLabels[session.deviceType]}</span><small>Bắt đầu {formatTime(session.startedAt)} · tín hiệu {formatTime(session.lastSeenAt)}</small></div><span>{session.status}</span>{canManage && session.status === "active" ? <button disabled={actionBusy === session.sessionId} onClick={() => void revokeSession(session)}>Thu hồi phiên</button> : null}</section>)}{!sessions.length ? <div className={styles.empty}>Chưa có phiên truy cập.</div> : null}</div></article>
      </section> : null}

      {view === "content" && canReview ? <section className={styles.contentPanel}>
        <header><div><span>HEALTH CONTENT REVIEW</span><h2>Một hàng đợi kiểm duyệt của Health_Care</h2><p>Không sửa bài tại Trung tâm. Chỉ quyết định đối với bản mà Health_Care gửi lên.</p></div><strong>{versions.filter((item) => item.status === "permission_requested" || item.status === "review").length} cần xử lý</strong></header>
        <div>{versions.map((version) => <article key={version.id} data-status={version.status}><div><span>V{version.version_number} · {contentStatusLabels[version.status] ?? version.status}</span><strong>{version.edit_scope_label || version.summary || "Phiên bản Sức khỏe Y tế"}</strong><small>{version.created_by} · {formatTime(version.created_at)}{version.editor_device_code ? ` · ${version.editor_device_code}` : ""}</small></div><div>{version.status === "permission_requested" ? <><button disabled={actionBusy === version.id} onClick={() => void contentAction(version, "approve-edit")}>Cho phép sửa</button><button className={styles.danger} disabled={actionBusy === version.id} onClick={() => void contentAction(version, "deny-edit")}>Từ chối</button></> : null}{version.status === "review" ? <><button disabled={actionBusy === version.id} onClick={() => void contentAction(version, "request-changes")}>Yêu cầu sửa lại</button>{canManage ? <button className={styles.primary} disabled={actionBusy === version.id} onClick={() => void contentAction(version, "approve-publish")}>Đồng ý cập nhật</button> : null}</> : null}</div></article>)}{!versions.length ? <div className={styles.empty}>Chưa có phiên bản nội dung gửi kiểm duyệt.</div> : null}</div>
      </section> : null}

      {view === "audit" && canReview ? <section className={styles.auditPanel}>
        <header><div><span>HEALTH CLIENT AUDIT</span><h2>Nhật ký riêng của Health_Care</h2><p>Thiết bị SK, session, policy và kiểm duyệt nội dung. Không lặp lại audit thiết bị QT.</p></div><strong>{audit.length} sự kiện gần nhất</strong></header>
        <div>{audit.map((entry) => <article key={entry.id}><span>YT</span><div><strong>{entry.action}</strong><small>{entry.actor} · {formatTime(entry.createdAt)}</small><p>{entry.target}</p></div></article>)}{!audit.length ? <div className={styles.empty}>Chưa có sự kiện audit hoặc vai trò hiện tại không có quyền xem.</div> : null}</div>
      </section> : null}

      <footer className={styles.contractFooter}><span>Contract v{status?.contractVersion ?? "—"}</span><span>{status?.buildSource || "BlueDragon33/Health_Care"}</span><span>Secret scope: {status?.controlAuth?.secretScope ?? "—"}</span><strong>Health data in control-plane: {status?.boundary.healthDataInControlPlane ? "Có" : "Không"}</strong></footer>
    </section>
  </main>;
}
