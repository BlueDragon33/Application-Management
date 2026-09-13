"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { applicationRegistry, type ApplicationConfig } from "./application-registry";
import {
  centerAdminAction,
  connectAdminCenter,
  connectOperationsDashboard,
  operationsAction,
  readCachedOperations,
  roleLabels,
  type AdminAccess,
  type CenterBootstrap,
  type ControlAdminDevice,
  type OperationsBootstrap,
  type OperationsDevice,
  type OperationsSummary,
  type OperationsWorkItem,
} from "./admin-device-client";
import styles from "./management-dashboard.module.css";

type View = "overview" | "applications" | "devices" | "users" | "approvals" | "access" | "audit" | "sync" | "settings";

type UserRow = {
  key: string;
  appId: string;
  appName: string;
  userLabel: string;
  devices: number;
  online: number;
  pending: number;
  href: string;
};

const PRIMARY_APP_IDS = ["bauman-master-ai", "boi-ech", "health-care", "ru-life"] as const;
const primaryIdSet = new Set<string>(PRIMARY_APP_IDS);
const primaryApps = applicationRegistry.filter((application) => primaryIdSet.has(application.id));

const navItems: Array<{ view: View; label: string; icon: string }> = [
  { view: "overview", label: "Tổng quan", icon: "⌂" },
  { view: "applications", label: "Ứng dụng", icon: "▦" },
  { view: "devices", label: "Thiết bị", icon: "▣" },
  { view: "users", label: "Người dùng", icon: "●" },
  { view: "approvals", label: "Yêu cầu chờ duyệt", icon: "✓" },
  { view: "access", label: "Thanh toán & Quyền", icon: "▤" },
  { view: "audit", label: "Nhật ký hệ thống", icon: "≣" },
  { view: "sync", label: "Đồng bộ dữ liệu", icon: "↻" },
  { view: "settings", label: "Cài đặt", icon: "⚙" },
];

const viewTitle: Record<View, { title: string; subtitle: string }> = {
  overview: { title: "Tổng quan hệ thống", subtitle: "Theo dõi 4 ứng dụng, hàng đợi kiểm duyệt và trạng thái đồng bộ trong một màn hình." },
  applications: { title: "Ứng dụng đang quản lý", subtitle: "Quản trị từng client độc lập và mở đúng website sử dụng của ứng dụng." },
  devices: { title: "Thiết bị", subtitle: "Thiết bị được đọc từ registry của từng ứng dụng; thao tác được chuyển tới backend sở hữu dữ liệu." },
  users: { title: "Người dùng", subtitle: "Tổng hợp người dùng xuất hiện trong dữ liệu thiết bị đã đồng bộ từ các ứng dụng." },
  approvals: { title: "Yêu cầu chờ duyệt", subtitle: "Hàng đợi tập trung cho thiết bị và các sự kiện cần xử lý từ 4 ứng dụng." },
  access: { title: "Thanh toán & Quyền", subtitle: "Theo dõi năng lực quản trị mà từng ứng dụng công bố; nghiệp vụ chi tiết vẫn thuộc client." },
  audit: { title: "Nhật ký hệ thống", subtitle: "Nhật ký bảo mật và thay đổi quyền của control-plane Application Management." },
  sync: { title: "Đồng bộ dữ liệu", subtitle: "Theo dõi kết nối, lần đồng bộ và cảnh báo giữa Trung tâm với từng client." },
  settings: { title: "Cài đặt", subtitle: "Thiết bị quản trị Trung tâm, vai trò và các ranh giới an toàn của hệ thống." },
};

function appIcon(application: ApplicationConfig) {
  if (application.id === "bauman-master-ai") return "🎓";
  if (application.id === "boi-ech") return "≋";
  if (application.id === "health-care") return "♥";
  return "●●";
}

function statusLabel(connection: OperationsSummary["connection"] | undefined) {
  if (connection === "connected") return "Đã đồng bộ";
  if (connection === "unavailable") return "Mất kết nối";
  if (connection === "warning") return "Cần cập nhật";
  return "Đang hoàn thiện";
}

function statusTone(connection: OperationsSummary["connection"] | undefined) {
  if (connection === "connected") return "ok";
  if (connection === "unavailable") return "bad";
  return "warn";
}

function relativeTime(value: string | null | undefined) {
  if (!value) return "Chưa có thời gian";
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return "Chưa có thời gian";
  const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60_000));
  if (minutes < 1) return "Vừa xong";
  if (minutes < 60) return `${minutes} phút trước`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} giờ trước`;
  return `${Math.floor(hours / 24)} ngày trước`;
}

function appFor(appId: string) {
  return primaryApps.find((application) => application.id === appId);
}

function connectionFor(application: ApplicationConfig, summary?: OperationsSummary): OperationsSummary["connection"] {
  if (summary?.connection) return summary.connection;
  if (application.contractState === "pending") return "pending";
  return "warning";
}

function initials(value: string) {
  const words = value.trim().split(/\s+/).filter(Boolean);
  return (words.slice(0, 2).map((word) => word[0]?.toUpperCase()).join("") || "ND").slice(0, 2);
}

function Gate({ busy, error, access, retry }: { busy: boolean; error: string; access: AdminAccess | null; retry: () => void }) {
  return <main className={styles.gate}>
    <div className={styles.gateCard}>
      <div className={styles.gateLogo}>QT</div>
      <h1>Quản trị Ứng dụng</h1>
      <p>{busy ? "Đang xác minh thiết bị quản trị…" : error || (access?.status === "pending" ? "Thiết bị này đang chờ Chủ hệ thống cấp quyền." : access?.status === "blocked" ? "Thiết bị quản trị đã bị khóa." : "Không thể mở Trung tâm quản trị.")}</p>
      {!busy ? <button onClick={retry}>Kiểm tra lại</button> : <span className={styles.spinner}/>} 
    </div>
  </main>;
}

function SectionTitle({ title, action }: { title: string; action?: React.ReactNode }) {
  return <header className={styles.sectionTitle}><h2>{title}</h2>{action}</header>;
}

function AppMark({ application }: { application: ApplicationConfig }) {
  return <span className={styles.appMark} data-app={application.id}>{appIcon(application)}</span>;
}

function SyncBadge({ connection }: { connection: OperationsSummary["connection"] | undefined }) {
  return <span className={styles.syncBadge} data-tone={statusTone(connection)}><i/>{statusLabel(connection)}</span>;
}

export default function ManagementDashboard({ user }: { user: { displayName: string; email: string } }) {
  const [access, setAccess] = useState<AdminAccess | null>(null);
  const [center, setCenter] = useState<CenterBootstrap | null>(null);
  const [operations, setOperations] = useState<OperationsBootstrap | null>(null);
  const [view, setView] = useState<View>("overview");
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [actionBusy, setActionBusy] = useState("");
  const [webBusy, setWebBusy] = useState("");
  const [error, setError] = useState("");
  const [syncError, setSyncError] = useState("");
  const [notice, setNotice] = useState("");
  const [clock, setClock] = useState<Date | null>(null);

  async function refreshOperations() {
    setSyncing(true);
    setSyncError("");
    try {
      const result = await connectOperationsDashboard();
      if (result.bootstrap) setOperations(result.bootstrap);
      return result.bootstrap ?? null;
    } catch (caught) {
      setSyncError(caught instanceof Error ? caught.message : "Không thể đồng bộ dữ liệu các ứng dụng.");
      return null;
    } finally {
      setSyncing(false);
    }
  }

  async function initialize() {
    setBusy(true);
    setError("");
    try {
      const result = await connectAdminCenter();
      setAccess(result.access);
      setCenter(result.bootstrap);
      if (result.bootstrap) void refreshOperations();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không thể mở Trung tâm quản trị.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    const cached = readCachedOperations();
    if (cached) setOperations(cached);
    setClock(new Date());
    void initialize();
    const timer = window.setInterval(() => setClock(new Date()), 1_000);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let last = 0;
    const resync = () => {
      if (document.visibilityState !== "visible" || Date.now() - last < 1_500) return;
      last = Date.now();
      void refreshOperations();
    };
    window.addEventListener("focus", resync);
    document.addEventListener("visibilitychange", resync);
    return () => {
      window.removeEventListener("focus", resync);
      document.removeEventListener("visibilitychange", resync);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const summaries = useMemo(() => (operations?.summaries ?? []).filter((item) => primaryIdSet.has(item.appId)), [operations]);
  const summaryMap = useMemo(() => new Map(summaries.map((item) => [item.appId, item])), [summaries]);
  const devices = useMemo(() => (operations?.devices ?? []).filter((item) => primaryIdSet.has(item.appId)), [operations]);
  const workItems = useMemo(() => (operations?.workItems ?? []).filter((item) => primaryIdSet.has(item.appId)), [operations]);
  const normalizedSearch = search.trim().toLowerCase();
  const filteredDevices = useMemo(() => devices.filter((device) => {
    if (!normalizedSearch) return true;
    return `${device.appName} ${device.userLabel} ${device.deviceCode} ${device.deviceTypeLabel}`.toLowerCase().includes(normalizedSearch);
  }), [devices, normalizedSearch]);
  const pendingDevices = devices.filter((device) => device.status === "pending");
  const approvedDevices = devices.filter((device) => device.status === "approved");
  const syncWarnings = primaryApps.filter((application) => connectionFor(application, summaryMap.get(application.id)) !== "connected").length;
  const notificationCount = workItems.length + pendingDevices.length;

  const users = useMemo(() => {
    const map = new Map<string, UserRow>();
    for (const device of devices) {
      const application = appFor(device.appId);
      const key = `${device.appId}:${device.userLabel}`;
      const current = map.get(key) ?? {
        key,
        appId: device.appId,
        appName: device.appName,
        userLabel: device.userLabel,
        devices: 0,
        online: 0,
        pending: 0,
        href: application?.href ?? device.href,
      };
      current.devices += 1;
      if (device.active) current.online += 1;
      if (device.status === "pending") current.pending += 1;
      map.set(key, current);
    }
    return [...map.values()].filter((row) => !normalizedSearch || `${row.userLabel} ${row.appName}`.toLowerCase().includes(normalizedSearch));
  }, [devices, normalizedSearch]);

  const recentActivities = useMemo(() => {
    const audit = (center?.auditLog ?? []).map((entry) => ({
      id: `audit:${entry.id}`,
      title: entry.action.replaceAll("_", " "),
      detail: entry.target,
      at: entry.createdAt,
      appId: "audit",
    }));
    const work = workItems.map((item) => ({ id: `work:${item.id}`, title: item.title, detail: item.detail, at: item.occurredAt ?? "", appId: item.appId }));
    return [...audit, ...work].sort((a, b) => Date.parse(b.at || "0") - Date.parse(a.at || "0")).slice(0, 6);
  }, [center?.auditLog, workItems]);

  async function manageClientDevice(device: OperationsDevice, operation: "approve" | "remove") {
    if (operation === "remove") {
      const destructive = device.appId === "boi-ech";
      const message = destructive
        ? `Xóa vĩnh viễn thiết bị ${device.deviceCode} khỏi registry Bơi ếch?`
        : `Khóa thiết bị ${device.deviceCode} của ${device.appName} và thu hồi quyền/phiên truy cập?`;
      if (!window.confirm(message)) return;
    }
    setActionBusy(`${device.appId}:${device.deviceId}`);
    setNotice("");
    try {
      await operationsAction({ action: "manage-client-device", operation, appId: device.appId, deviceId: device.deviceId, deviceCode: device.deviceCode });
      const synced = await refreshOperations();
      setNotice(synced ? (operation === "approve" ? `Đã duyệt và đồng bộ ${device.deviceCode}.` : `Đã xử lý và đồng bộ ${device.deviceCode}.`) : `Backend đã xử lý ${device.deviceCode}, nhưng Trung tâm chưa đọc lại được trạng thái. Hãy bấm Đồng bộ.`);
    } catch (caught) {
      setNotice(caught instanceof Error ? caught.message : "Không thể cập nhật thiết bị.");
    } finally {
      setActionBusy("");
    }
  }

  async function launchClientWeb(appId: string) {
    const summary = summaryMap.get(appId);
    const application = appFor(appId);
    const fallback = application?.publicUrl;
    if (!summary?.webHref && !fallback) {
      setNotice("Ứng dụng chưa công bố URL website production hợp lệ.");
      return;
    }
    if (!summary?.managedWebLaunch) {
      window.open(summary?.webHref ?? fallback, "_blank", "noopener,noreferrer");
      return;
    }
    const popup = window.open("about:blank", "_blank");
    if (popup) popup.opener = null;
    setWebBusy(appId);
    setNotice("");
    try {
      const result = await operationsAction({ action: "launch-client-web", appId });
      if (!result.launchUrl) throw new Error(result.error ?? "Không lấy được vé mở website client.");
      if (popup) popup.location.replace(result.launchUrl);
      else window.location.assign(result.launchUrl);
    } catch (caught) {
      popup?.close();
      setNotice(caught instanceof Error ? caught.message : "Không thể mở website client.");
    } finally {
      setWebBusy("");
    }
  }

  async function manageControlDevice(device: ControlAdminDevice, operation: "approve" | "block") {
    if (!access || access.role !== "owner" || device.owner || device.deviceId === access.deviceId) return;
    if (operation === "block" && !window.confirm(`Khóa thiết bị quản trị ${device.deviceCode}?`)) return;
    setActionBusy(`control:${device.deviceId}`);
    setNotice("");
    try {
      const result = await centerAdminAction({ action: "manage-control-device", operation, targetDeviceId: device.deviceId, role: "reviewer", displayName: device.displayName });
      setCenter((current) => current ? { ...current, controlDevices: result.controlDevices ?? current.controlDevices, auditLog: result.auditLog ?? current.auditLog } : current);
      setNotice("Đã cập nhật thiết bị quản trị.");
    } catch (caught) {
      setNotice(caught instanceof Error ? caught.message : "Không thể cập nhật thiết bị quản trị.");
    } finally {
      setActionBusy("");
    }
  }

  function switchView(next: View) {
    setView(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (!access || access.status !== "approved" || !center) {
    return <Gate busy={busy} error={error} access={access} retry={() => void initialize()}/>;
  }

  const queueDevices = filteredDevices.filter((device) => device.status === "pending" || device.attention !== "none");
  const queueWork = workItems.filter((item) => !normalizedSearch || `${item.appName} ${item.title} ${item.detail}`.toLowerCase().includes(normalizedSearch));
  const title = viewTitle[view];

  return <main className={styles.shell}>
    <aside className={styles.sidebar}>
      <div className={styles.brandMarkWrap}><div className={styles.brandMark}>◆</div></div>
      <nav className={styles.nav} aria-label="Điều hướng quản trị">
        {navItems.map((item) => <button key={item.view} data-active={view === item.view} onClick={() => switchView(item.view)}>
          <span className={styles.navIcon}>{item.icon}</span><span>{item.label}</span>
          {item.view === "approvals" && notificationCount > 0 ? <b>{notificationCount}</b> : null}
        </button>)}
      </nav>
      <div className={styles.sidebarFooter}><div className={styles.footerCube}>◆</div><p>Kết nối · Quản trị · Phát triển</p><small>Vì những ứng dụng tốt hơn</small></div>
    </aside>

    <section className={styles.workspace}>
      <header className={styles.topbar}>
        <div className={styles.productTitle}><span className={styles.productLogo}>◆</span><div><strong>Quản trị Ứng dụng</strong><small>Trung tâm quản lý và điều phối các ứng dụng</small></div></div>
        <label className={styles.searchBox}><span>⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm kiếm ứng dụng, thiết bị, người dùng…"/></label>
        <span className={styles.production}><i/>Production</span>
        <button className={styles.bell} onClick={() => switchView("approvals")} aria-label="Mở yêu cầu chờ duyệt">♟{notificationCount > 0 ? <b>{notificationCount}</b> : null}</button>
        <details className={styles.account}><summary><span>{initials(user.displayName)}</span><div><strong>{user.displayName}</strong><small>{roleLabels[access.role]}</small></div><b>⌄</b></summary><div><small>{user.email}</small><button onClick={() => switchView("settings")}>Cài đặt quản trị</button><a href="/signout-with-chatgpt?return_to=%2F">Đăng xuất</a></div></details>
      </header>

      <div className={styles.page}>
        <header className={styles.pageHeading}><div><h1>{title.title}</h1><p>{title.subtitle}</p></div><button className={styles.syncButton} disabled={syncing} onClick={() => void refreshOperations()}>{syncing ? "Đang đồng bộ…" : "↻ Đồng bộ"}</button></header>
        {syncError ? <div className={styles.warning}><strong>Cảnh báo đồng bộ:</strong> {syncError}</div> : null}
        {notice ? <div className={styles.notice}>{notice}</div> : null}

        {view === "overview" ? <Overview
          operations={operations}
          summaryMap={summaryMap}
          devices={devices}
          pendingDevices={pendingDevices}
          approvedDevices={approvedDevices}
          syncWarnings={syncWarnings}
          queueDevices={queueDevices}
          queueWork={queueWork}
          recentActivities={recentActivities}
          actionBusy={actionBusy}
          webBusy={webBusy}
          switchView={switchView}
          manageClientDevice={manageClientDevice}
          launchClientWeb={launchClientWeb}
        /> : null}

        {view === "applications" ? <section className={styles.fullPanel}><SectionTitle title="Các ứng dụng đang quản lý"/><div className={styles.appGridLarge}>{primaryApps.map((application) => <ApplicationCard key={application.id} application={application} summary={summaryMap.get(application.id)} pendingFallback={devices.filter((d) => d.appId === application.id && d.status === "pending").length} webBusy={webBusy} launchClientWeb={launchClientWeb}/>)}</div></section> : null}

        {view === "devices" ? <section className={styles.fullPanel}><SectionTitle title="Thiết bị từ các ứng dụng" action={<span className={styles.muted}>{filteredDevices.length} thiết bị trong dữ liệu hiện tại</span>}/><DeviceTable devices={filteredDevices} actionBusy={actionBusy} manage={manageClientDevice}/></section> : null}

        {view === "users" ? <section className={styles.fullPanel}><SectionTitle title="Người dùng đã đồng bộ" action={<span className={styles.muted}>{users.length} người dùng/định danh</span>}/><div className={styles.userTable}><div className={styles.tableHead}><span>Người dùng</span><span>Ứng dụng</span><span>Thiết bị</span><span>Online</span><span>Chờ duyệt</span><span>Thao tác</span></div>{users.map((row) => <div className={styles.tableRow} key={row.key}><div className={styles.userIdentity}><b>{initials(row.userLabel)}</b><strong>{row.userLabel}</strong></div><span>{row.appName}</span><strong>{row.devices}</strong><strong>{row.online}</strong><strong>{row.pending}</strong><Link href={row.href}>Quản lý →</Link></div>)}{!users.length ? <Empty text="Chưa có người dùng phù hợp dữ liệu đang đồng bộ."/> : null}</div></section> : null}

        {view === "approvals" ? <section className={styles.fullPanel}><SectionTitle title="Hàng đợi duyệt trung tâm" action={<span className={styles.muted}>{queueDevices.length + queueWork.length} mục cần chú ý</span>}/><ApprovalQueue devices={queueDevices} workItems={queueWork} actionBusy={actionBusy} manage={manageClientDevice}/></section> : null}

        {view === "access" ? <section className={styles.fullPanel}><SectionTitle title="Thanh toán & Quyền theo ứng dụng"/><div className={styles.accessGrid}>{primaryApps.map((application) => <article key={application.id} className={styles.accessCard}><div><AppMark application={application}/><div><h3>{application.shortName}</h3><p>{application.scope}</p></div></div><h4>Năng lực đã công bố</h4><ul>{application.capabilities.map((capability) => <li key={capability}>✓ {capability}</li>)}</ul><div className={styles.cardActions}><Link href={application.href} className={styles.primaryAction}>Quản trị</Link><button onClick={() => void launchClientWeb(application.id)} disabled={webBusy === application.id}>{webBusy === application.id ? "Đang mở…" : "Truy cập web ↗"}</button></div></article>)}</div><p className={styles.boundaryNote}>Trung tâm không tạo trạng thái thanh toán giả. Chi tiết thanh toán, thời hạn và quyền nghiệp vụ chỉ hiển thị khi client tương ứng công bố contract dữ liệu thật.</p></section> : null}

        {view === "audit" ? <section className={styles.fullPanel}><SectionTitle title="Nhật ký hệ thống" action={<span className={styles.muted}>{center.auditLog.length} sự kiện gần nhất</span>}/><div className={styles.auditList}>{center.auditLog.map((entry) => <article key={entry.id}><time>{new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(new Date(entry.createdAt))}</time><div><strong>{entry.action.replaceAll("_", " ")}</strong><small>{entry.actor}</small></div><code>{entry.target}</code></article>)}{!center.auditLog.length ? <Empty text="Chưa có sự kiện audit Trung tâm."/> : null}</div></section> : null}

        {view === "sync" ? <section className={styles.fullPanel}><SectionTitle title="Tình trạng đồng bộ" action={<button className={styles.linkButton} onClick={() => void refreshOperations()} disabled={syncing}>↻ Làm mới</button>}/><div className={styles.syncPageList}>{primaryApps.map((application) => { const summary = summaryMap.get(application.id); const connection = connectionFor(application, summary); return <article key={application.id}><AppMark application={application}/><div><strong>{application.shortName}</strong><small>{summary?.note ?? application.contractNote}</small></div><SyncBadge connection={connection}/><span>{operations?.generatedAt ? `Cập nhật ${relativeTime(operations.generatedAt)}` : "Chưa có dữ liệu"}</span><Link href={application.href}>Kiểm tra →</Link></article>; })}</div></section> : null}

        {view === "settings" ? <Settings center={center} access={access} actionBusy={actionBusy} manageControlDevice={manageControlDevice}/> : null}
      </div>

      <footer className={styles.statusFooter}><span>Quản trị Ứng dụng</span><span>{clock ? new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "medium" }).format(clock) : ""}</span><span>{syncWarnings ? `${syncWarnings} ứng dụng cần kiểm tra` : "Hệ thống đồng bộ ổn định"}</span></footer>
    </section>
  </main>;
}

function Overview({
  operations,
  summaryMap,
  devices,
  pendingDevices,
  approvedDevices,
  syncWarnings,
  queueDevices,
  queueWork,
  recentActivities,
  actionBusy,
  webBusy,
  switchView,
  manageClientDevice,
  launchClientWeb,
}: {
  operations: OperationsBootstrap | null;
  summaryMap: Map<string, OperationsSummary>;
  devices: OperationsDevice[];
  pendingDevices: OperationsDevice[];
  approvedDevices: OperationsDevice[];
  syncWarnings: number;
  queueDevices: OperationsDevice[];
  queueWork: OperationsWorkItem[];
  recentActivities: Array<{ id: string; title: string; detail: string; at: string; appId: string }>;
  actionBusy: string;
  webBusy: string;
  switchView: (view: View) => void;
  manageClientDevice: (device: OperationsDevice, operation: "approve" | "remove") => Promise<void>;
  launchClientWeb: (appId: string) => Promise<void>;
}) {
  return <>
    <section className={styles.metrics}>
      <button onClick={() => switchView("applications")} data-tone="blue"><span>◇</span><div><small>Ứng dụng đang quản lý</small><strong>{primaryApps.length}</strong><em>Tổng số ứng dụng trọng tâm</em></div></button>
      <button onClick={() => switchView("approvals")} data-tone="amber"><span>◷</span><div><small>Yêu cầu chờ duyệt</small><strong>{pendingDevices.length}</strong><em>Cần xem xét và xử lý</em></div></button>
      <button onClick={() => switchView("devices")} data-tone="green"><span>▯</span><div><small>Thiết bị đã duyệt</small><strong>{approvedDevices.length || (operations ? 0 : "—")}</strong><em>Trong dữ liệu đã đồng bộ</em></div></button>
      <button onClick={() => switchView("sync")} data-tone="red"><span>△</span><div><small>Cảnh báo đồng bộ</small><strong>{syncWarnings}</strong><em>Cần kiểm tra và xử lý</em></div></button>
    </section>

    <section className={styles.overviewGrid}>
      <div className={styles.appsPanel}>
        <SectionTitle title="Các ứng dụng đang quản lý" action={<button className={styles.linkButton} onClick={() => switchView("applications")}>Xem tất cả</button>}/>
        <div className={styles.appGrid}>{primaryApps.map((application) => <ApplicationCard key={application.id} application={application} summary={summaryMap.get(application.id)} pendingFallback={devices.filter((device) => device.appId === application.id && device.status === "pending").length} webBusy={webBusy} launchClientWeb={launchClientWeb}/>)}</div>
      </div>

      <aside className={styles.rightRail}>
        <section className={styles.sidePanel}><SectionTitle title="Tình trạng đồng bộ" action={<button className={styles.linkButton} onClick={() => switchView("sync")}>Xem chi tiết</button>}/><div className={styles.syncList}>{primaryApps.map((application) => { const summary = summaryMap.get(application.id); const connection = connectionFor(application, summary); return <article key={application.id}><AppMark application={application}/><strong>{application.shortName}</strong><SyncBadge connection={connection}/><small>{operations?.generatedAt ? relativeTime(operations.generatedAt) : "Chưa có dữ liệu"}</small></article>; })}</div>{syncWarnings > 0 ? <div className={styles.syncHint}>Cần cập nhật trạng thái xác minh từ ứng dụng con.</div> : null}</section>
        <section className={styles.sidePanel}><SectionTitle title="Hoạt động gần đây" action={<button className={styles.linkButton} onClick={() => switchView("audit")}>Xem tất cả</button>}/><div className={styles.activityList}>{recentActivities.map((activity) => <article key={activity.id}><span data-app={activity.appId}>•</span><div><strong>{activity.title}</strong><small>{activity.detail}</small></div><time>{relativeTime(activity.at)}</time></article>)}{!recentActivities.length ? <Empty text="Chưa có hoạt động gần đây."/> : null}</div></section>
      </aside>
    </section>

    <section className={styles.queuePanel}><SectionTitle title="Hàng đợi duyệt trung tâm" action={<button className={styles.linkButton} onClick={() => switchView("approvals")}>Xem tất cả</button>}/><ApprovalQueue devices={queueDevices.slice(0, 4)} workItems={queueWork.slice(0, Math.max(0, 4 - queueDevices.length))} actionBusy={actionBusy} manage={manageClientDevice}/></section>

    <section className={styles.processPanel}><SectionTitle title="Quy trình quản lý tập trung"/><div className={styles.processFlow}><div><span>●</span><strong>Thiết bị / Người dùng<br/>gửi yêu cầu</strong></div><b>→</b><div><span>▤</span><strong>Quản trị Ứng dụng<br/>kiểm duyệt</strong></div><b>→</b><div><span>◆</span><strong>Cấp quyền / Từ chối /<br/>Thu hồi</strong></div><b>→</b><div><span>↻</span><strong>Đồng bộ sang app con</strong></div><b>→</b><div><span>●</span><strong>Người dùng sử dụng<br/>ứng dụng</strong></div></div></section>
  </>;
}

function ApplicationCard({ application, summary, pendingFallback, webBusy, launchClientWeb }: { application: ApplicationConfig; summary?: OperationsSummary; pendingFallback: number; webBusy: string; launchClientWeb: (appId: string) => Promise<void> }) {
  const connection = connectionFor(application, summary);
  const pending = summary?.pendingCount ?? pendingFallback;
  return <article className={styles.appCard} data-app={application.id}>
    <header><AppMark application={application}/><div><h3>{application.shortName}</h3><small>{application.id === "bauman-master-ai" ? "Quản trị học tập" : application.id === "boi-ech" ? "Học tập" : application.id === "health-care" ? "Chăm sóc sức khỏe" : "Hòa nhập"}</small><span className={styles.onlineLabel}><i data-tone={statusTone(connection)}/>{connection === "connected" ? "Online" : connection === "unavailable" ? "Offline" : "Cần kiểm tra"}</span></div>{typeof pending === "number" && pending > 0 ? <b className={styles.pendingBadge}>{pending}<small>Yêu cầu chờ duyệt</small></b> : null}</header>
    <footer><Link href={application.href} className={styles.primaryAction}>Quản trị</Link><button onClick={() => void launchClientWeb(application.id)} disabled={webBusy === application.id}>{webBusy === application.id ? "Đang mở…" : "↗ Truy cập web"}</button><span className={styles.connectionSwitch} data-on={connection === "connected"}><i/></span></footer>
  </article>;
}

function ApprovalQueue({ devices, workItems, actionBusy, manage }: { devices: OperationsDevice[]; workItems: OperationsWorkItem[]; actionBusy: string; manage: (device: OperationsDevice, operation: "approve" | "remove") => Promise<void> }) {
  const hasRows = devices.length > 0 || workItems.length > 0;
  return <div className={styles.queueTable}><div className={styles.queueHead}><span>Ứng dụng</span><span>Loại yêu cầu</span><span>Thiết bị / người dùng</span><span>Trạng thái</span><span>Thao tác</span></div>{devices.map((device) => { const application = appFor(device.appId); const rowBusy = actionBusy === `${device.appId}:${device.deviceId}`; return <div className={styles.queueRow} key={`device:${device.appId}:${device.deviceId}`}><div className={styles.appCell}>{application ? <AppMark application={application}/> : null}<strong>{device.appName}</strong></div><span>{device.status === "pending" ? "Duyệt thiết bị" : "Xác minh thiết bị"}</span><div><strong>{device.userLabel}</strong><small>{device.deviceCode}</small></div><span className={styles.queueStatus} data-tone={device.status === "pending" ? "pending" : "alert"}>{device.status === "pending" ? "Chờ duyệt" : "Cần xử lý"}</span><div className={styles.rowActions}>{device.canApprove ? <button disabled={rowBusy} onClick={() => void manage(device, "approve")}>Duyệt</button> : null}{device.canRemove ? <button className={styles.rejectButton} disabled={rowBusy} onClick={() => void manage(device, "remove")}>Từ chối</button> : null}{!device.canApprove && !device.canRemove ? <Link href={device.href}>Xử lý</Link> : null}</div></div>; })}{workItems.map((item) => { const application = appFor(item.appId); return <div className={styles.queueRow} key={`work:${item.id}`}><div className={styles.appCell}>{application ? <AppMark application={application}/> : null}<strong>{item.appName}</strong></div><span>{item.kind === "connection" ? "Kết nối" : item.kind === "environment" ? "Môi trường" : "Thiết bị"}</span><div><strong>{item.title}</strong><small>{item.detail}</small></div><span className={styles.queueStatus} data-tone={item.priority === "high" ? "alert" : "pending"}>{item.priority === "high" ? "Cần xử lý" : "Cần xem"}</span><div className={styles.rowActions}><Link href={item.href}>Xử lý</Link></div></div>; })}{!hasRows ? <Empty text="Không có yêu cầu chờ duyệt trong dữ liệu hiện tại."/> : null}</div>;
}

function DeviceTable({ devices, actionBusy, manage }: { devices: OperationsDevice[]; actionBusy: string; manage: (device: OperationsDevice, operation: "approve" | "remove") => Promise<void> }) {
  return <div className={styles.deviceTable}><div className={styles.tableHead}><span>Thiết bị</span><span>Người dùng</span><span>Ứng dụng</span><span>Trạng thái</span><span>Hoạt động</span><span>Thao tác</span></div>{devices.map((device) => { const busy = actionBusy === `${device.appId}:${device.deviceId}`; return <div className={styles.tableRow} key={`${device.appId}:${device.deviceId}`}><div><strong>{device.deviceTypeLabel}</strong><small>{device.deviceCode}</small></div><span>{device.userLabel}</span><span>{device.appName}</span><span className={styles.deviceState} data-state={device.status}>{device.status === "approved" ? "Đã duyệt" : device.status === "pending" ? "Chờ duyệt" : device.status === "blocked" ? "Đã khóa" : "Chưa rõ"}</span><span>{device.active ? "● Online" : relativeTime(device.lastSeenAt)}</span><div className={styles.rowActions}>{device.canApprove && device.status === "pending" ? <button disabled={busy} onClick={() => void manage(device, "approve")}>Duyệt</button> : null}{device.canRemove ? <button className={styles.rejectButton} disabled={busy} onClick={() => void manage(device, "remove")}>{device.appId === "boi-ech" ? "Loại bỏ" : "Khóa"}</button> : null}<Link href={device.href}>Quản trị</Link></div></div>; })}{!devices.length ? <Empty text="Không tìm thấy thiết bị phù hợp."/> : null}</div>;
}

function Settings({ center, access, actionBusy, manageControlDevice }: { center: CenterBootstrap; access: AdminAccess; actionBusy: string; manageControlDevice: (device: ControlAdminDevice, operation: "approve" | "block") => Promise<void> }) {
  return <section className={styles.settingsGrid}><div className={styles.fullPanel}><SectionTitle title="Thiết bị quản trị Trung tâm" action={<span className={styles.muted}>{center.controlDevices.length} thiết bị</span>}/><div className={styles.controlDevices}>{center.controlDevices.map((device) => { const protectedDevice = device.owner || device.deviceId === access.deviceId; const busy = actionBusy === `control:${device.deviceId}`; return <article key={device.deviceId}><span className={styles.controlPresence} data-online={device.active}/><div><strong>{device.displayName || device.email}</strong><small>{device.email}</small><code>{device.deviceCode}</code></div><div><small>Vai trò</small><strong>{roleLabels[device.role]}</strong></div><div><small>Trạng thái</small><strong>{device.status === "approved" ? "Đã cấp quyền" : device.status === "pending" ? "Chờ duyệt" : "Đã khóa"}</strong></div><div className={styles.rowActions}>{protectedDevice ? <span className={styles.protected}>Được bảo vệ</span> : access.role === "owner" ? <>{device.status === "pending" ? <button disabled={busy} onClick={() => void manageControlDevice(device, "approve")}>Cấp quyền</button> : null}<button className={styles.rejectButton} disabled={busy} onClick={() => void manageControlDevice(device, "block")}>Khóa</button></> : <span>Chỉ Owner được sửa</span>}</div></article>; })}</div></div><div className={styles.fullPanel}><SectionTitle title="Nguyên tắc vận hành"/><div className={styles.rules}><article><b>01</b><div><strong>Client sở hữu dữ liệu</strong><p>Registry thiết bị, phiên truy cập và dữ liệu nghiệp vụ vẫn nằm ở ứng dụng tương ứng.</p></div></article><article><b>02</b><div><strong>Trung tâm điều phối</strong><p>Application Management chỉ đọc contract và gửi lệnh quản trị có xác minh.</p></div></article><article><b>03</b><div><strong>Không hiển thị dữ liệu giả</strong><p>Chỉ số, badge và trạng thái chỉ xuất hiện từ dữ liệu thật hoặc hiển thị rõ là chưa có dữ liệu.</p></div></article></div></div></section>;
}

function Empty({ text }: { text: string }) {
  return <div className={styles.empty}>{text}</div>;
}
