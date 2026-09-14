"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { applicationRegistry, type ApplicationConfig } from "./application-registry";
import {
  AdminApiError,
  centerAdminAction,
  clearCachedOperations,
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
import {
  AppearanceDialog,
  AppearanceTrigger,
  AutomationDialog,
  appearanceReadableCss,
  saveAutomationRules,
  useAdminAppearance,
  type ExtendedOperationsSettings,
} from "./management-controls";
import styles from "./management-dashboard.module.css";

type View = "overview" | "applications" | "devices" | "users" | "approvals" | "access" | "audit" | "sync" | "settings";
type ControlDeviceOperation = "approve" | "block" | "deactivate-member" | "delete-member";
type UserRow = { key: string; appId: string; appName: string; userLabel: string; devices: number; online: number; pending: number; href: string };

const managedApps = [...applicationRegistry];
const managedIdSet = new Set<string>(managedApps.map((item) => item.id));
const validViews: readonly View[] = ["overview", "applications", "devices", "users", "approvals", "access", "audit", "sync", "settings"];
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
  overview: { title: "Tổng quan hệ thống", subtitle: "Theo dõi đầy đủ 5 ứng dụng, hàng đợi kiểm duyệt và trạng thái đồng bộ trong một màn hình." },
  applications: { title: "Ứng dụng đang quản lý", subtitle: "Hiển thị toàn bộ client cấp 1, kể cả ứng dụng đang chờ hoàn thiện contract quản trị." },
  devices: { title: "Thiết bị", subtitle: "Thiết bị được đọc trực tiếp từ registry của từng ứng dụng; Trung tâm không tạo trạng thái giả." },
  users: { title: "Người dùng", subtitle: "Tổng hợp định danh xuất hiện trong dữ liệu thiết bị đã đồng bộ từ các ứng dụng." },
  approvals: { title: "Yêu cầu chờ duyệt", subtitle: "Duyệt thủ công hoặc cấu hình tự động duyệt / tự động từ chối riêng cho từng ứng dụng." },
  access: { title: "Thanh toán & Quyền", subtitle: "Theo dõi năng lực quản trị đã được từng ứng dụng công bố." },
  audit: { title: "Nhật ký hệ thống", subtitle: "Nhật ký bảo mật và thay đổi quyền của control-plane Application Management." },
  sync: { title: "Đồng bộ dữ liệu", subtitle: "Theo dõi kết nối, registry và cảnh báo đồng bộ giữa Trung tâm với từng client." },
  settings: { title: "Cài đặt", subtitle: "Thiết bị quản trị Trung tâm, vai trò và ranh giới an toàn của hệ thống." },
};
const auditLabels: Record<string, string> = {
  control_device_approved: "Cấp quyền thiết bị quản trị",
  control_device_blocked: "Khóa thiết bị quản trị",
  control_member_deactivated: "Thu hồi tài khoản quản trị",
  control_member_deleted: "Xóa tài khoản quản trị",
  operations_notifications_cleared: "Xóa hết thông báo hàng đợi",
  application_auto_approval_updated: "Cập nhật duyệt tự động",
  application_auto_reject_updated: "Cập nhật từ chối tự động",
  application_auto_block_pending_updated: "Cập nhật khóa pending tự động",
};

function appIcon(application: ApplicationConfig) {
  if (application.id === "bauman-master-ai") return "🎓";
  if (application.id === "boi-ech") return "≋";
  if (application.id === "health-care") return "♥";
  if (application.id === "ru-life") return "RU";
  return "GU";
}
function appFor(appId: string) { return managedApps.find((application) => application.id === appId); }
function statusLabel(connection: OperationsSummary["connection"] | undefined) {
  if (connection === "connected") return "Đã đồng bộ";
  if (connection === "unavailable") return "Mất kết nối";
  if (connection === "warning") return "Cần cập nhật";
  return "Đang hoàn thiện";
}
function statusTone(connection: OperationsSummary["connection"] | undefined) { return connection === "connected" ? "ok" : connection === "unavailable" ? "bad" : "warn"; }
function connectionFor(application: ApplicationConfig, summary?: OperationsSummary): OperationsSummary["connection"] {
  if (summary?.connection) return summary.connection;
  return application.contractState === "pending" ? "pending" : "warning";
}
function initials(value: string) {
  const words = value.trim().split(/\s+/).filter(Boolean);
  return (words.slice(0, 2).map((word) => word[0]?.toUpperCase()).join("") || "ND").slice(0, 2);
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

function Gate({ busy, error, access, retry }: { busy: boolean; error: string; access: AdminAccess | null; retry: () => void }) {
  return <main className={styles.gate}><div className={styles.gateCard}><div className={styles.gateLogo}>QT</div><h1>Quản trị Ứng dụng</h1><p>{busy ? "Đang xác minh thiết bị quản trị…" : error || (access?.status === "pending" ? "Thiết bị này đang chờ Chủ hệ thống cấp quyền." : access?.status === "blocked" ? "Thiết bị quản trị đã bị khóa." : "Không thể mở Trung tâm quản trị.")}</p>{!busy ? <button onClick={retry}>Kiểm tra lại</button> : <span className={styles.spinner}/>}</div></main>;
}
function SectionTitle({ title, action }: { title: string; action?: React.ReactNode }) { return <header className={styles.sectionTitle}><h2>{title}</h2>{action}</header>; }
function AppMark({ application }: { application: ApplicationConfig }) { return <span className={styles.appMark} data-app={application.id}>{appIcon(application)}</span>; }
function SyncBadge({ connection }: { connection: OperationsSummary["connection"] | undefined }) { return <span className={styles.syncBadge} data-tone={statusTone(connection)}><i/>{statusLabel(connection)}</span>; }
function Empty({ text }: { text: string }) { return <div className={styles.empty}>{text}</div>; }

export default function ManagementDashboardV2({ user }: { user: { displayName: string; email: string } }) {
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
  const [appearanceOpen, setAppearanceOpen] = useState(false);
  const [automationOpen, setAutomationOpen] = useState(false);
  const { appearance, setAppearance, style: appearanceStyle } = useAdminAppearance();

  async function refreshOperations() {
    setSyncing(true); setSyncError("");
    try {
      const result = await connectOperationsDashboard();
      if (result.bootstrap) setOperations(result.bootstrap);
      return result.bootstrap ?? null;
    } catch (caught) {
      setSyncError(caught instanceof Error ? caught.message : "Không thể đồng bộ dữ liệu các ứng dụng.");
      return null;
    } finally { setSyncing(false); }
  }
  async function initialize() {
    setBusy(true); setError("");
    try {
      const result = await connectAdminCenter();
      setAccess(result.access); setCenter(result.bootstrap);
      if (result.bootstrap) void refreshOperations();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Không thể mở Trung tâm quản trị."); }
    finally { setBusy(false); }
  }

  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("view");
    setView(requested && validViews.includes(requested as View) ? requested as View : "overview");
    const cached = readCachedOperations(); if (cached) setOperations(cached);
    setClock(new Date()); void initialize();
    const timer = window.setInterval(() => setClock(new Date()), 1_000);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    let last = 0;
    const resync = () => { if (document.visibilityState !== "visible" || Date.now() - last < 1_500) return; last = Date.now(); void refreshOperations(); };
    window.addEventListener("focus", resync); document.addEventListener("visibilitychange", resync);
    return () => { window.removeEventListener("focus", resync); document.removeEventListener("visibilitychange", resync); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const summaries = useMemo(() => (operations?.summaries ?? []).filter((item) => managedIdSet.has(item.appId)), [operations]);
  const summaryMap = useMemo(() => new Map(summaries.map((item) => [item.appId, item])), [summaries]);
  const devices = useMemo(() => (operations?.devices ?? []).filter((item) => managedIdSet.has(item.appId)), [operations]);
  const workItems = useMemo(() => (operations?.workItems ?? []).filter((item) => managedIdSet.has(item.appId)), [operations]);
  const normalizedSearch = search.trim().toLowerCase();
  const filteredApps = useMemo(() => managedApps.filter((application) => !normalizedSearch || `${application.name} ${application.shortName} ${application.scope} ${application.capabilities.join(" ")} ${summaryMap.get(application.id)?.note ?? ""}`.toLowerCase().includes(normalizedSearch)), [normalizedSearch, summaryMap]);
  const filteredDevices = useMemo(() => devices.filter((device) => !normalizedSearch || `${device.appName} ${device.userLabel} ${device.deviceCode} ${device.deviceTypeLabel}`.toLowerCase().includes(normalizedSearch)), [devices, normalizedSearch]);
  const pendingDevices = devices.filter((device) => device.status === "pending");
  const approvedDevices = devices.filter((device) => device.status === "approved");
  const visibleWorkItemIds = useMemo(() => new Set(workItems.map((item) => item.id)), [workItems]);
  const deviceWorkItemIds = useMemo(() => new Set(devices.map((device) => `${device.appId}:device:${device.deviceId}`)), [devices]);
  const notificationDevices = useMemo(() => devices.filter((device) => visibleWorkItemIds.has(`${device.appId}:device:${device.deviceId}`) || visibleWorkItemIds.has(`${device.appId}:environment:${device.deviceId}`)), [devices, visibleWorkItemIds]);
  const distinctWorkItems = useMemo(() => workItems.filter((item) => !deviceWorkItemIds.has(item.id) && !item.id.includes(":environment:")), [workItems, deviceWorkItemIds]);
  const syncWarnings = managedApps.filter((application) => connectionFor(application, summaryMap.get(application.id)) !== "connected").length;
  const notificationCount = notificationDevices.length + distinctWorkItems.length;
  const users = useMemo(() => {
    const map = new Map<string, UserRow>();
    for (const device of devices) {
      const key = `${device.appId}:${device.userLabel}`;
      const current = map.get(key) ?? { key, appId: device.appId, appName: device.appName, userLabel: device.userLabel, devices: 0, online: 0, pending: 0, href: appFor(device.appId)?.href ?? device.href };
      current.devices += 1; if (device.active) current.online += 1; if (device.status === "pending") current.pending += 1; map.set(key, current);
    }
    return [...map.values()].filter((row) => !normalizedSearch || `${row.userLabel} ${row.appName}`.toLowerCase().includes(normalizedSearch));
  }, [devices, normalizedSearch]);

  async function manageClientDevice(device: OperationsDevice, operation: "approve" | "remove") {
    if (operation === "remove") {
      const destructive = device.appId === "boi-ech";
      if (!window.confirm(destructive ? `Xóa vĩnh viễn thiết bị ${device.deviceCode} khỏi registry Bơi ếch?` : `Khóa thiết bị ${device.deviceCode} của ${device.appName} và thu hồi quyền/phiên truy cập?`)) return;
    }
    setActionBusy(`${device.appId}:${device.deviceId}`); setNotice("");
    try {
      await operationsAction({ action: "manage-client-device", operation, appId: device.appId, deviceId: device.deviceId, deviceCode: device.deviceCode, expectedStatus: device.status, registryInstanceId: device.registryInstanceId ?? undefined });
      clearCachedOperations();
      const synced = await refreshOperations();
      setNotice(synced ? (operation === "approve" ? `Đã duyệt và đồng bộ ${device.deviceCode}.` : `Đã xử lý và đồng bộ ${device.deviceCode}.`) : `Backend đã xử lý ${device.deviceCode}, nhưng Trung tâm chưa đọc lại được trạng thái.`);
    } catch (caught) {
      clearCachedOperations();
      await refreshOperations();
      if (caught instanceof AdminApiError && (caught.data.code === "BAUMAN_REGISTRY_INSTANCE_MISMATCH" || caught.data.code === "BAUMAN_REGISTRY_DEVICE_STALE")) {
        setNotice("Snapshot Bauman đã cũ hoặc đang thuộc registry khác. Trung tâm đã đồng bộ lại hàng đợi; hãy mở đúng Bauman Runtime của cùng phiên local rồi thử lại.");
      } else setNotice(caught instanceof Error ? caught.message : "Không thể cập nhật thiết bị.");
    } finally { setActionBusy(""); }
  }

  async function dismissNotifications() {
    const ids = workItems.map((item) => item.id);
    if (!ids.length) { setNotice("Không có thông báo đã ghi nhận để xóa."); return; }
    if (!window.confirm(`Xóa hết ${ids.length} thông báo khỏi hàng đợi hiển thị? Thiết bị, quyền và dữ liệu nghiệp vụ của các app không bị xóa.`)) return;
    setActionBusy("dismiss"); setNotice("");
    try {
      await operationsAction({ action: "dismiss-notifications", workItemIds: ids });
      clearCachedOperations(); await refreshOperations();
      setNotice("Đã xóa hết thông báo hiển thị. Dữ liệu và yêu cầu thiết bị gốc vẫn được giữ nguyên trong mục Thiết bị.");
    } catch (caught) { setNotice(caught instanceof Error ? caught.message : "Không thể xóa thông báo."); }
    finally { setActionBusy(""); }
  }

  async function saveAutomation(autoApproveAppIds: string[], autoRejectAppIds: string[], hours: Record<string, number>) {
    setActionBusy("automation"); setNotice("");
    try {
      await saveAutomationRules(operations?.settings as ExtendedOperationsSettings | undefined, autoApproveAppIds, autoRejectAppIds, hours);
      clearCachedOperations(); await refreshOperations(); setAutomationOpen(false);
      setNotice("Đã lưu và đọc lại quy tắc tự động theo từng ứng dụng.");
    } catch (caught) { await refreshOperations(); setNotice(caught instanceof Error ? caught.message : "Không thể lưu quy tắc tự động."); }
    finally { setActionBusy(""); }
  }

  async function launchClientWeb(appId: string) {
    const summary = summaryMap.get(appId); const fallback = appFor(appId)?.publicUrl;
    if (!summary?.webHref && !fallback) { setNotice("Ứng dụng chưa công bố URL website hợp lệ."); return; }
    if (!summary?.managedWebLaunch) { window.open(summary?.webHref ?? fallback, "_blank", "noopener,noreferrer"); return; }
    const popup = window.open("about:blank", "_blank"); if (popup) popup.opener = null;
    setWebBusy(appId); setNotice("");
    try { const result = await operationsAction({ action: "launch-client-web", appId }); if (!result.launchUrl) throw new Error(result.error ?? "Không lấy được vé mở website client."); if (popup) popup.location.replace(result.launchUrl); else window.location.assign(result.launchUrl); }
    catch (caught) { popup?.close(); setNotice(caught instanceof Error ? caught.message : "Không thể mở website client."); }
    finally { setWebBusy(""); }
  }

  async function manageControlDevice(device: ControlAdminDevice, operation: ControlDeviceOperation, selectedRole?: "reviewer" | "publisher") {
    if (!access || access.role !== "owner" || device.owner || device.deviceId === access.deviceId) return;
    if (operation === "block" && !window.confirm(`Khóa thiết bị quản trị ${device.deviceCode}?`)) return;
    if (operation === "deactivate-member" && !window.confirm(`Thu hồi toàn bộ quyền quản trị của ${device.email}?`)) return;
    if (operation === "delete-member") { const confirmation = window.prompt(`Nhập chính xác email để xóa tài khoản đã thu hồi:\n${device.email}`); if (confirmation?.trim().toLowerCase() !== device.email.toLowerCase()) return; }
    setActionBusy(`control:${device.deviceId}`); setNotice("");
    try { const result = await centerAdminAction({ action: "manage-control-device", operation, targetDeviceId: device.deviceId, role: selectedRole ?? "reviewer", displayName: device.displayName }); setCenter((current) => current ? { ...current, controlDevices: result.controlDevices ?? current.controlDevices, auditLog: result.auditLog ?? current.auditLog } : current); setNotice("Đã cập nhật quyền thiết bị quản trị."); }
    catch (caught) { setNotice(caught instanceof Error ? caught.message : "Không thể cập nhật thiết bị quản trị."); }
    finally { setActionBusy(""); }
  }

  function switchView(next: View) { setView(next); window.history.pushState({ view: next }, "", next === "overview" ? "/" : `/?view=${next}`); window.scrollTo({ top: 0, behavior: "smooth" }); }
  if (!access || access.status !== "approved" || !center) return <Gate busy={busy} error={error} access={access} retry={() => void initialize()}/>;

  const title = viewTitle[view];
  const queueDevices = filteredDevices.filter((device) => visibleWorkItemIds.has(`${device.appId}:device:${device.deviceId}`) || visibleWorkItemIds.has(`${device.appId}:environment:${device.deviceId}`));
  const queueWork = distinctWorkItems.filter((item) => !normalizedSearch || `${item.appName} ${item.title} ${item.detail}`.toLowerCase().includes(normalizedSearch));
  const readableCss = appearanceReadableCss({ shell: styles.shell, nav: styles.nav, search: styles.searchBox, pageText: styles.pageHeading, title: styles.pageHeading, small: styles.muted });

  return <main className={styles.shell} style={appearanceStyle}>
    <style>{readableCss}</style>
    <aside className={styles.sidebar}><div className={styles.brandMarkWrap}><div className={styles.brandMark}>◆</div></div><nav className={styles.nav} aria-label="Điều hướng quản trị">{navItems.map((item) => <button key={item.view} data-active={view === item.view} onClick={() => switchView(item.view)}><span className={styles.navIcon}>{item.icon}</span><span>{item.label}</span>{item.view === "approvals" && notificationCount > 0 ? <b>{notificationCount}</b> : null}</button>)}</nav><div className={styles.sidebarFooter}><div className={styles.footerCube}>◆</div><p>Kết nối · Quản trị · Phát triển</p><small>Vì những ứng dụng tốt hơn</small></div></aside>
    <section className={styles.workspace}>
      <header className={styles.topbar}><div className={styles.productTitle}><span className={styles.productLogo}>◆</span><div><strong>Quản trị Ứng dụng</strong><small>Trung tâm quản lý và điều phối các ứng dụng</small></div></div><label className={styles.searchBox}><span>⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm kiếm ứng dụng, thiết bị, người dùng…"/></label><span className={styles.production}><i/>Offline / Local</span><AppearanceTrigger onClick={() => setAppearanceOpen(true)}/><button className={styles.bell} onClick={() => switchView("approvals")} aria-label="Mở yêu cầu chờ duyệt">🔔{notificationCount > 0 ? <b>{notificationCount}</b> : null}</button><details className={styles.account}><summary><span>{initials(user.displayName)}</span><div><strong>{user.displayName}</strong><small>{roleLabels[access.role]}</small></div><b>⌄</b></summary><div><small>{user.email}</small><button onClick={() => switchView("settings")}>Cài đặt quản trị</button><a href="/signout-with-chatgpt?return_to=%2F">Đăng xuất</a></div></details></header>
      <AppearanceDialog open={appearanceOpen} value={appearance} close={() => setAppearanceOpen(false)} change={setAppearance}/>
      <AutomationDialog open={automationOpen} settings={operations?.settings as ExtendedOperationsSettings | undefined} busy={actionBusy === "automation"} close={() => setAutomationOpen(false)} save={(approve, reject, hours) => void saveAutomation(approve, reject, hours)}/>
      <div className={styles.page}><header className={styles.pageHeading}><div><h1>{title.title}</h1><p>{title.subtitle}</p></div><button className={styles.syncButton} disabled={syncing} onClick={() => void refreshOperations()}>{syncing ? "Đang đồng bộ…" : "↻ Đồng bộ"}</button></header>{syncError ? <div className={styles.warning}><strong>Cảnh báo đồng bộ:</strong> {syncError}</div> : null}{notice ? <div className={styles.notice}>{notice}</div> : null}
        {view === "overview" ? <Overview apps={filteredApps} operations={operations} summaryMap={summaryMap} devices={devices} pendingDevices={pendingDevices} approvedDevices={approvedDevices} syncWarnings={syncWarnings} queueDevices={queueDevices} queueWork={queueWork} actionBusy={actionBusy} webBusy={webBusy} switchView={switchView} manageClientDevice={manageClientDevice} launchClientWeb={launchClientWeb}/> : null}
        {view === "applications" ? <section className={styles.fullPanel}><SectionTitle title="Các ứng dụng đang quản lý" action={<span className={styles.muted}>{managedApps.length} client cấp 1</span>}/><div className={styles.appGridLarge}>{filteredApps.map((application) => <ApplicationCard key={application.id} application={application} summary={summaryMap.get(application.id)} pendingFallback={devices.filter((d) => d.appId === application.id && d.status === "pending").length} webBusy={webBusy} launchClientWeb={launchClientWeb}/>)}</div></section> : null}
        {view === "devices" ? <section className={styles.fullPanel}><SectionTitle title="Thiết bị từ các ứng dụng" action={<span className={styles.muted}>{filteredDevices.length} thiết bị</span>}/><DeviceTable devices={filteredDevices} actionBusy={actionBusy} manage={manageClientDevice}/></section> : null}
        {view === "users" ? <section className={styles.fullPanel}><SectionTitle title="Người dùng đã đồng bộ" action={<span className={styles.muted}>{users.length} định danh</span>}/><div className={styles.userTable}><div className={styles.tableHead}><span>Người dùng</span><span>Ứng dụng</span><span>Thiết bị</span><span>Online</span><span>Chờ duyệt</span><span>Thao tác</span></div>{users.map((row) => <div className={styles.tableRow} key={row.key}><div className={styles.userIdentity}><b>{initials(row.userLabel)}</b><strong>{row.userLabel}</strong></div><span>{row.appName}</span><strong>{row.devices}</strong><strong>{row.online}</strong><strong>{row.pending}</strong><Link href={row.href}>Quản lý →</Link></div>)}{!users.length ? <Empty text="Chưa có người dùng phù hợp."/> : null}</div></section> : null}
        {view === "approvals" ? <section className={styles.fullPanel}><SectionTitle title="Hàng đợi duyệt trung tâm" action={<div className={styles.rowActions}><button onClick={() => setAutomationOpen(true)}>Tự động</button><button className={styles.rejectButton} disabled={actionBusy === "dismiss"} onClick={() => void dismissNotifications()}>Xóa hết</button><button disabled={syncing} onClick={() => void refreshOperations()}>↻ Đồng bộ</button></div>}/><p className={styles.boundaryNote}>“Xóa hết” chỉ dọn thông báo đã ghi nhận khỏi hàng đợi hiển thị; thiết bị gốc vẫn còn trong mục Thiết bị để duyệt, khóa hoặc kiểm tra sau.</p><ApprovalQueue devices={queueDevices} workItems={queueWork} actionBusy={actionBusy} manage={manageClientDevice}/></section> : null}
        {view === "access" ? <section className={styles.fullPanel}><SectionTitle title="Thanh toán & Quyền theo ứng dụng"/><div className={styles.accessGrid}>{filteredApps.map((application) => <article key={application.id} className={styles.accessCard}><div><AppMark application={application}/><div><h3>{application.shortName}</h3><p>{application.scope}</p></div></div><h4>Năng lực đã công bố</h4><ul>{application.capabilities.map((capability) => <li key={capability}>✓ {capability}</li>)}</ul><div className={styles.cardActions}><Link href={application.href} className={styles.primaryAction}>Quản trị</Link><button onClick={() => void launchClientWeb(application.id)} disabled={webBusy === application.id}>{webBusy === application.id ? "Đang mở…" : "Truy cập web ↗"}</button></div></article>)}</div></section> : null}
        {view === "audit" ? <section className={styles.fullPanel}><SectionTitle title="Nhật ký hệ thống" action={<span className={styles.muted}>{center.auditLog.length} sự kiện</span>}/><div className={styles.auditList}>{center.auditLog.map((entry) => <article key={entry.id}><time>{new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(new Date(entry.createdAt))}</time><div><strong>{auditLabels[entry.action] ?? entry.action.replaceAll("_", " ")}</strong><small>{entry.actor}</small></div><code>{entry.target}</code></article>)}{!center.auditLog.length ? <Empty text="Chưa có sự kiện audit Trung tâm."/> : null}</div></section> : null}
        {view === "sync" ? <section className={styles.fullPanel}><SectionTitle title="Tình trạng đồng bộ"/><div className={styles.syncPageList}>{filteredApps.map((application) => { const summary = summaryMap.get(application.id); const connection = connectionFor(application, summary); return <article key={application.id}><AppMark application={application}/><div><strong>{application.shortName}</strong><small>{summary?.note ?? application.contractNote}{summary?.registryInstanceId ? ` · Registry: ${summary.registryInstanceId}` : ""}</small></div><SyncBadge connection={connection}/><span>{operations?.generatedAt ? `Cập nhật ${relativeTime(operations.generatedAt)}` : "Chưa có dữ liệu"}</span><Link href={application.href}>Kiểm tra →</Link></article>; })}</div></section> : null}
        {view === "settings" ? <Settings center={center} access={access} actionBusy={actionBusy} manageControlDevice={manageControlDevice}/> : null}
      </div><footer className={styles.statusFooter}><span>Quản trị Ứng dụng</span><span>{clock ? new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "medium" }).format(clock) : ""}</span><span>{syncWarnings ? `${syncWarnings} ứng dụng cần kiểm tra` : "Hệ thống đồng bộ ổn định"}</span></footer>
    </section>
  </main>;
}

function Overview({ apps, operations, summaryMap, devices, pendingDevices, approvedDevices, syncWarnings, queueDevices, queueWork, actionBusy, webBusy, switchView, manageClientDevice, launchClientWeb }: { apps: ApplicationConfig[]; operations: OperationsBootstrap | null; summaryMap: Map<string, OperationsSummary>; devices: OperationsDevice[]; pendingDevices: OperationsDevice[]; approvedDevices: OperationsDevice[]; syncWarnings: number; queueDevices: OperationsDevice[]; queueWork: OperationsWorkItem[]; actionBusy: string; webBusy: string; switchView: (view: View) => void; manageClientDevice: (device: OperationsDevice, operation: "approve" | "remove") => Promise<void>; launchClientWeb: (appId: string) => Promise<void> }) {
  return <><section className={styles.metrics}><button onClick={() => switchView("applications")} data-tone="blue"><span>◇</span><div><small>Ứng dụng đang quản lý</small><strong>{managedApps.length}</strong><em>Đủ client cấp 1 trong registry</em></div></button><button onClick={() => switchView("approvals")} data-tone="amber"><span>◷</span><div><small>Thiết bị chờ duyệt</small><strong>{pendingDevices.length}</strong><em>Dữ liệu gốc vẫn được giữ trong mục Thiết bị</em></div></button><button onClick={() => switchView("devices")} data-tone="green"><span>▯</span><div><small>Thiết bị đã duyệt</small><strong>{approvedDevices.length || (operations ? 0 : "—")}</strong><em>Trong dữ liệu đã đồng bộ</em></div></button><button onClick={() => switchView("sync")} data-tone="red"><span>△</span><div><small>Cảnh báo đồng bộ</small><strong>{syncWarnings}</strong><em>Cần kiểm tra và xử lý</em></div></button></section><section className={styles.overviewGrid}><div className={styles.appsPanel}><SectionTitle title="Các ứng dụng đang quản lý" action={<button className={styles.linkButton} onClick={() => switchView("applications")}>Xem tất cả</button>}/><div className={styles.appGrid}>{apps.map((application) => <ApplicationCard key={application.id} application={application} summary={summaryMap.get(application.id)} pendingFallback={devices.filter((device) => device.appId === application.id && device.status === "pending").length} webBusy={webBusy} launchClientWeb={launchClientWeb}/>)}</div></div><aside className={styles.rightRail}><section className={styles.sidePanel}><SectionTitle title="Tình trạng đồng bộ"/><div className={styles.syncList}>{apps.map((application) => { const summary = summaryMap.get(application.id); return <article key={application.id}><AppMark application={application}/><strong>{application.shortName}</strong><SyncBadge connection={connectionFor(application, summary)}/><small>{operations?.generatedAt ? relativeTime(operations.generatedAt) : "Chưa có dữ liệu"}</small></article>; })}</div></section><section className={styles.sidePanel}><SectionTitle title="Kiểm soát vận hành"/><div className={styles.activityList}><article><span>•</span><div><strong>5 ứng dụng</strong><small>Không còn hard-code danh sách 4 app.</small></div></article><article><span>•</span><div><strong>Registry Bauman</strong><small>Snapshot được gắn định danh registry để chống duyệt nhầm phiên.</small></div></article></div></section></aside></section><section className={styles.queuePanel}><SectionTitle title="Hàng đợi duyệt trung tâm" action={<button className={styles.linkButton} onClick={() => switchView("approvals")}>Xem tất cả</button>}/><ApprovalQueue devices={queueDevices.slice(0, 5)} workItems={queueWork.slice(0, Math.max(0, 5 - queueDevices.length))} actionBusy={actionBusy} manage={manageClientDevice}/></section></>;
}

function ApplicationCard({ application, summary, pendingFallback, webBusy, launchClientWeb }: { application: ApplicationConfig; summary?: OperationsSummary; pendingFallback: number; webBusy: string; launchClientWeb: (appId: string) => Promise<void> }) {
  const connection = connectionFor(application, summary); const pending = summary?.pendingCount ?? pendingFallback;
  return <article className={styles.appCard} data-app={application.id}><header><AppMark application={application}/><div><h3>{application.shortName}</h3><small>{application.scope}</small><span className={styles.onlineLabel}><i data-tone={statusTone(connection)}/>{connection === "connected" ? "Online" : connection === "unavailable" ? "Offline" : "Cần kiểm tra"}</span></div>{typeof pending === "number" && pending > 0 ? <b className={styles.pendingBadge}>{pending}<small>Yêu cầu chờ duyệt</small></b> : null}</header><footer><Link href={application.href} className={styles.primaryAction}>Quản trị</Link><button onClick={() => void launchClientWeb(application.id)} disabled={webBusy === application.id}>{webBusy === application.id ? "Đang mở…" : "↗ Truy cập web"}</button><SyncBadge connection={connection}/></footer></article>;
}
function ApprovalQueue({ devices, workItems, actionBusy, manage }: { devices: OperationsDevice[]; workItems: OperationsWorkItem[]; actionBusy: string; manage: (device: OperationsDevice, operation: "approve" | "remove") => Promise<void> }) {
  const hasRows = devices.length > 0 || workItems.length > 0;
  return <div className={styles.queueTable}><div className={styles.queueHead}><span>Ứng dụng</span><span>Loại yêu cầu</span><span>Thiết bị / người dùng</span><span>Trạng thái</span><span>Thao tác</span></div>{devices.map((device) => { const application = appFor(device.appId); const rowBusy = actionBusy === `${device.appId}:${device.deviceId}`; const removeLabel = device.status === "pending" ? "Từ chối" : device.appId === "boi-ech" ? "Loại bỏ" : "Khóa"; return <div className={styles.queueRow} key={`device:${device.appId}:${device.deviceId}`}><div className={styles.appCell}>{application ? <AppMark application={application}/> : null}<strong>{device.appName}</strong></div><span>{device.status === "pending" ? "Duyệt thiết bị" : "Xác minh thiết bị"}</span><div><strong>{device.userLabel}</strong><small>{device.deviceCode}</small></div><span className={styles.queueStatus} data-tone={device.status === "pending" ? "pending" : "alert"}>{device.status === "pending" ? "Chờ duyệt" : "Cần xử lý"}</span><div className={styles.rowActions}>{device.canApprove ? <button disabled={rowBusy} onClick={() => void manage(device, "approve")}>Duyệt</button> : null}{device.canRemove ? <button className={styles.rejectButton} disabled={rowBusy} onClick={() => void manage(device, "remove")}>{removeLabel}</button> : null}{!device.canApprove && !device.canRemove ? <Link href={device.href}>Xử lý</Link> : null}</div></div>; })}{workItems.map((item) => { const application = appFor(item.appId); return <div className={styles.queueRow} key={`work:${item.id}`}><div className={styles.appCell}>{application ? <AppMark application={application}/> : null}<strong>{item.appName}</strong></div><span>{item.kind === "connection" ? "Kết nối" : item.kind === "environment" ? "Môi trường" : "Thiết bị"}</span><div><strong>{item.title}</strong><small>{item.detail}</small></div><span className={styles.queueStatus} data-tone={item.priority === "high" ? "alert" : "pending"}>{item.priority === "high" ? "Cần xử lý" : "Cần xem"}</span><div className={styles.rowActions}><Link href={item.href}>Xử lý</Link></div></div>; })}{!hasRows ? <Empty text="Không còn thông báo cần xử lý. Các thiết bị gốc vẫn được giữ trong mục Thiết bị."/> : null}</div>;
}
function DeviceTable({ devices, actionBusy, manage }: { devices: OperationsDevice[]; actionBusy: string; manage: (device: OperationsDevice, operation: "approve" | "remove") => Promise<void> }) {
  return <div className={styles.deviceTable}><div className={styles.tableHead}><span>Thiết bị</span><span>Người dùng</span><span>Ứng dụng</span><span>Trạng thái</span><span>Hoạt động</span><span>Thao tác</span></div>{devices.map((device) => { const rowBusy = actionBusy === `${device.appId}:${device.deviceId}`; return <div className={styles.tableRow} key={`${device.appId}:${device.deviceId}`}><div><strong>{device.deviceTypeLabel}</strong><small>{device.deviceCode}</small></div><span>{device.userLabel}</span><span>{device.appName}</span><span className={styles.deviceState} data-state={device.status}>{device.status === "approved" ? "Đã duyệt" : device.status === "pending" ? "Chờ duyệt" : device.status === "blocked" ? "Đã khóa" : "Chưa rõ"}</span><span>{device.active ? "● Online" : relativeTime(device.lastSeenAt)}</span><div className={styles.rowActions}>{device.canApprove && device.status === "pending" ? <button disabled={rowBusy} onClick={() => void manage(device, "approve")}>Duyệt</button> : null}{device.canRemove ? <button className={styles.rejectButton} disabled={rowBusy} onClick={() => void manage(device, "remove")}>{device.appId === "boi-ech" ? "Loại bỏ" : "Khóa"}</button> : null}<Link href={device.href}>Quản trị</Link></div></div>; })}{!devices.length ? <Empty text="Không tìm thấy thiết bị phù hợp."/> : null}</div>;
}
function Settings({ center, access, actionBusy, manageControlDevice }: { center: CenterBootstrap; access: AdminAccess; actionBusy: string; manageControlDevice: (device: ControlAdminDevice, operation: ControlDeviceOperation, selectedRole?: "reviewer" | "publisher") => Promise<void> }) {
  const [approvalRoles, setApprovalRoles] = useState<Record<string, "reviewer" | "publisher">>({});
  return <section className={styles.settingsGrid}><div className={styles.fullPanel}><SectionTitle title="Thiết bị quản trị Trung tâm"/><div className={styles.controlDevices}>{center.controlDevices.map((device) => { const protectedDevice = device.owner || device.deviceId === access.deviceId; const rowBusy = actionBusy === `control:${device.deviceId}`; const approvalRole = approvalRoles[device.deviceId] ?? "reviewer"; return <article key={device.deviceId}><span className={styles.controlPresence} data-online={device.active}/><div><strong>{device.displayName || device.email}</strong><small>{device.email}</small><code>{device.deviceCode}</code></div><div><small>Vai trò</small><strong>{roleLabels[device.role]}</strong></div><div><small>Trạng thái</small><strong>{device.status === "approved" ? "Đã cấp quyền" : device.status === "pending" ? "Chờ duyệt" : "Đã khóa"}</strong></div><div className={styles.rowActions}>{protectedDevice ? <span className={styles.protected}>Được bảo vệ</span> : access.role !== "owner" ? <span>Chỉ Owner được sửa</span> : device.status === "pending" ? <><select value={approvalRole} disabled={rowBusy} onChange={(event) => setApprovalRoles((current) => ({ ...current, [device.deviceId]: event.target.value as "reviewer" | "publisher" }))}><option value="reviewer">Kiểm duyệt viên</option><option value="publisher">Người xuất bản</option></select><button disabled={rowBusy} onClick={() => void manageControlDevice(device, "approve", approvalRole)}>Cấp quyền</button><button className={styles.rejectButton} disabled={rowBusy} onClick={() => void manageControlDevice(device, "block")}>Từ chối</button></> : device.memberStatus === "inactive" ? <button className={styles.rejectButton} disabled={rowBusy} onClick={() => void manageControlDevice(device, "delete-member")}>Xóa tài khoản</button> : <><button disabled={rowBusy || device.status === "blocked"} onClick={() => void manageControlDevice(device, "block")}>Khóa máy</button><button className={styles.rejectButton} disabled={rowBusy} onClick={() => void manageControlDevice(device, "deactivate-member")}>Thu hồi tài khoản</button></>}</div></article>; })}</div></div></section>;
}
