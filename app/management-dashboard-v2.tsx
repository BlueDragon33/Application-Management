"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { applicationRegistry, type ApplicationConfig } from "./application-registry";
import BoiAccessView from "./boi-access-view";
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

type View = "overview" | "approvals" | "applications" | "devices" | "access" | "alerts" | "audit" | "settings";
type ControlDeviceOperation = "approve" | "block" | "deactivate-member" | "delete-member";
type FontScale = "compact" | "standard" | "large" | "xlarge";

const fontScaleStorageKey = "application-management:font-scale:v1";
const fontScaleOptions: Array<{ id: FontScale; label: string; hint: string }> = [
  { id: "compact", label: "Gọn", hint: "Mức hiện tại · nhiều nội dung" },
  { id: "standard", label: "Chuẩn", hint: "Dễ đọc hơn" },
  { id: "large", label: "Lớn", hint: "Tăng thêm một cấp" },
  { id: "xlarge", label: "Rất lớn", hint: "Ưu tiên khả năng đọc" },
];

// The registry is the single source of truth for what belongs to the central
// management surface. Do not maintain a second hard-coded allow-list here:
// doing so can leave a real client connected on the server but invisible in UI.
const activeApps = applicationRegistry;
const activeAppSet = new Set<string>(activeApps.map((app) => app.id));
const validViews: readonly View[] = ["overview", "approvals", "applications", "devices", "access", "alerts", "audit", "settings"];

const navItems: Array<{ view: View; label: string; icon: string }> = [
  { view: "overview", label: "Tổng quan", icon: "⌂" },
  { view: "approvals", label: "Hộp việc", icon: "▱" },
  { view: "applications", label: "Ứng dụng", icon: "▦" },
  { view: "devices", label: "Thiết bị mới", icon: "▣" },
  { view: "access", label: "Thanh toán & Quyền", icon: "◈" },
  { view: "alerts", label: "Cảnh báo", icon: "△" },
  { view: "audit", label: "Nhật ký", icon: "≣" },
  { view: "settings", label: "Cấu hình", icon: "⚙" },
];

const viewTitles: Record<View, { title: string; subtitle: string }> = {
  overview: {
    title: "Bảng điều phối quản trị ứng dụng",
    subtitle: "Kiểm soát tập trung các ứng dụng, thiết bị, người dùng, phê duyệt và điều phối hệ thống.",
  },
  approvals: { title: "Hộp việc", subtitle: "Các yêu cầu và sự kiện cần xử lý được gom về một hàng đợi thống nhất." },
  applications: { title: "Ứng dụng", subtitle: "Quản trị client và mở đúng website sử dụng của từng ứng dụng." },
  devices: { title: "Thiết bị mới", subtitle: "Duyệt, khóa hoặc loại bỏ thiết bị bằng dữ liệu registry thật của từng client." },
  access: { title: "Thanh toán & Quyền", subtitle: "Xử lý quyền truy cập và thanh toán chỉ trên các ứng dụng đã công bố contract nghiệp vụ thật." },
  alerts: { title: "Cảnh báo", subtitle: "Theo dõi mất kết nối, thay đổi môi trường và contract chưa hoàn tất." },
  audit: { title: "Nhật ký", subtitle: "Theo dõi lịch sử thao tác quản trị và các sự kiện bảo mật gần nhất." },
  settings: { title: "Cấu hình", subtitle: "Điều chỉnh giao diện trên thiết bị này và quản lý thiết bị quản trị Trung tâm." },
};

function initials(value: string) {
  const words = value.trim().split(/\s+/).filter(Boolean);
  return (words.slice(-2).map((word) => word[0]?.toUpperCase()).join("") || "ND").slice(0, 2);
}

function relativeTime(value: string | null | undefined) {
  if (!value) return "—";
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return "—";
  const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60_000));
  if (minutes < 1) return "Vừa xong";
  if (minutes < 60) return `${minutes} phút trước`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} giờ trước`;
  return `${Math.floor(hours / 24)} ngày trước`;
}

function appFor(appId: string) {
  return activeApps.find((app) => app.id === appId);
}

function appGlyph(appId: string) {
  if (appId === "boi-ech") return "≋";
  if (appId === "bauman-master-ai") return "◇";
  return "◆";
}

function appGroup(app: ApplicationConfig) {
  if (app.id === "boi-ech") return "Học tập";
  if (app.id === "bauman-master-ai") return "Học thuật";
  return app.scope;
}

function connectionFor(app: ApplicationConfig, summary?: OperationsSummary): OperationsSummary["connection"] {
  if (summary?.connection) return summary.connection;
  return app.contractState === "pending" ? "pending" : "warning";
}

function connectionLabel(value: OperationsSummary["connection"], issueCode?: string) {
  if (issueCode === "BOI_ECH_STALE_PUBLISH") return "Publish cũ · đã chặn";
  if (issueCode === "BOI_ECH_RUNTIME_IDENTITY_UNAVAILABLE") return "Chưa cập nhật publish";
  if (value === "connected") return "Kết nối tốt";
  if (value === "unavailable") return "Mất kết nối";
  if (value === "warning") return "Có cảnh báo";
  return "Chờ contract";
}

function deviceKind(device: OperationsDevice) {
  if (device.deviceType === "desktop") return "Desktop";
  if (device.deviceType === "phone") return "Điện thoại";
  if (device.deviceType === "tablet") return "Tablet";
  return device.deviceTypeLabel || "Chưa phân loại";
}

function Gate({ busy, error, access, retry }: { busy: boolean; error: string; access: AdminAccess | null; retry: () => void }) {
  return <main className="amv2-gate"><section><div>QT</div><h1>Quản trị Ứng dụng</h1><p>{busy ? "Đang xác minh thiết bị quản trị…" : error || (access?.status === "pending" ? "Thiết bị này đang chờ Chủ hệ thống cấp quyền." : access?.status === "blocked" ? "Thiết bị quản trị đã bị khóa." : "Không thể mở Trung tâm quản trị.")}</p>{busy ? <span/> : <button onClick={retry}>Kiểm tra lại</button>}</section></main>;
}

export default function ManagementDashboardV2({ user }: { user: { displayName: string; email: string } }) {
  const [access, setAccess] = useState<AdminAccess | null>(null);
  const [center, setCenter] = useState<CenterBootstrap | null>(null);
  const [operations, setOperations] = useState<OperationsBootstrap | null>(null);
  const [view, setView] = useState<View>("overview");
  const [search, setSearch] = useState("");
  const [appFilter, setAppFilter] = useState("all");
  const [busy, setBusy] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [actionBusy, setActionBusy] = useState("");
  const [webBusy, setWebBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [syncError, setSyncError] = useState("");
  const [clock, setClock] = useState<Date | null>(null);
  const [webMenu, setWebMenu] = useState(false);
  const [fontScale, setFontScale] = useState<FontScale>("compact");

  async function refreshOperations(silent = false) {
    if (!silent) setSyncing(true);
    setSyncError("");
    try {
      const result = await connectOperationsDashboard();
      if (result.bootstrap) setOperations(result.bootstrap);
      return result.bootstrap ?? null;
    } catch (caught) {
      setSyncError(caught instanceof Error ? caught.message : "Không thể đồng bộ dữ liệu ứng dụng.");
      return null;
    } finally {
      if (!silent) setSyncing(false);
    }
  }

  async function initialize() {
    setBusy(true);
    setError("");
    try {
      const cached = readCachedOperations();
      if (cached) setOperations(cached);
      const result = await connectAdminCenter();
      setAccess(result.access);
      setCenter(result.bootstrap);
      if (result.bootstrap) void refreshOperations(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không thể mở Trung tâm quản trị.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    const resolveView = () => {
      const requested = new URLSearchParams(window.location.search).get("view");
      setView(requested && validViews.includes(requested as View) ? requested as View : "overview");
    };
    resolveView();
    setClock(new Date());
    void initialize();
    const timer = window.setInterval(() => setClock(new Date()), 1000);
    const onFocus = () => void refreshOperations(true);
    window.addEventListener("popstate", resolveView);
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("popstate", resolveView);
      window.removeEventListener("focus", onFocus);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(fontScaleStorageKey);
      if (saved && fontScaleOptions.some((option) => option.id === saved)) setFontScale(saved as FontScale);
    } catch {
      // Appearance preference is device-local and optional.
    }
  }, []);

  function changeFontScale(next: FontScale) {
    setFontScale(next);
    try { window.localStorage.setItem(fontScaleStorageKey, next); } catch { /* Device-local persistence is optional. */ }
  }

  const summaries = useMemo(() => (operations?.summaries ?? []).filter((item) => activeAppSet.has(item.appId)), [operations]);
  const summaryMap = useMemo(() => new Map(summaries.map((item) => [item.appId, item])), [summaries]);
  const devices = useMemo(() => (operations?.devices ?? []).filter((item) => activeAppSet.has(item.appId)), [operations]);
  const workItems = useMemo(() => (operations?.workItems ?? []).filter((item) => activeAppSet.has(item.appId)), [operations]);
  const pendingDevices = devices.filter((device) => device.status === "pending");
  const approvalDevices = devices.filter((device) => device.status === "pending" || device.attention !== "none");
  const environmentCount = devices.filter((device) => device.attention === "environment").length;
  const unavailableCount = activeApps.filter((app) => connectionFor(app, summaryMap.get(app.id)) === "unavailable").length;
  const contractPending = activeApps.filter((app) => app.contractState !== "connected").length;
  const highAlerts = workItems.filter((item) => item.priority === "high").length;
  const notificationCount = workItems.length;
  const approvalCount = approvalDevices.length;
  const onlineApps = activeApps.filter((app) => connectionFor(app, summaryMap.get(app.id)) === "connected").length;
  const onlineDevices = summaries.reduce((sum, item) => sum + (item.onlineCount ?? 0), 0);
  const searchValue = search.trim().toLowerCase();

  const filteredApps = activeApps.filter((app) => {
    if (appFilter !== "all" && app.id !== appFilter) return false;
    return !searchValue || `${app.name} ${app.shortName} ${app.scope}`.toLowerCase().includes(searchValue);
  });
  const filteredDevices = devices.filter((device) => {
    if (appFilter !== "all" && device.appId !== appFilter) return false;
    return !searchValue || `${device.appName} ${device.deviceCode} ${device.userLabel} ${device.deviceTypeLabel}`.toLowerCase().includes(searchValue);
  });
  const filteredWork = workItems.filter((item) => {
    if (appFilter !== "all" && item.appId !== appFilter) return false;
    return !searchValue || `${item.appName} ${item.title} ${item.detail}`.toLowerCase().includes(searchValue);
  });
  const filteredApprovalDevices = filteredDevices.filter((device) => device.status === "pending" || device.attention !== "none");

  function switchView(next: View) {
    if (next === view) return;
    setView(next);
    setWebMenu(false);
    const nextUrl = next === "overview" ? "/" : `/?view=${encodeURIComponent(next)}`;
    window.history.pushState({ view: next }, "", nextUrl);
    const content = document.querySelector<HTMLElement>(".amv2-content");
    if (content) content.scrollTop = 0;
  }

  async function manageDevice(device: OperationsDevice, operation: "approve" | "remove") {
    if (operation === "approve" && device.appId === "boi-ech") {
      setAppFilter("boi-ech");
      switchView("access");
      setNotice("Bơi ếch cần chọn rõ Miễn phí hoặc Trả phí trong Thanh toán & Quyền; không tự động cấp miễn phí từ danh sách thiết bị.");
      return;
    }
    if (operation === "remove") {
      const destructive = device.appId === "boi-ech";
      const message = destructive ? `Xóa vĩnh viễn thiết bị ${device.deviceCode} khỏi registry Bơi ếch?` : `Khóa thiết bị ${device.deviceCode} của ${device.appName}?`;
      if (!window.confirm(message)) return;
    }
    setActionBusy(`${device.appId}:${device.deviceId}`);
    setNotice("");
    try {
      const result = await operationsAction({
        action: "manage-client-device",
        operation,
        appId: device.appId,
        deviceId: device.deviceId,
        deviceCode: device.deviceCode,
        expectedStatus: device.status,
        registryInstanceId: device.registryInstanceId ?? undefined,
      });
      await refreshOperations(true);
      setNotice(result.code === "STALE_DEVICE_REMOVED"
        ? `Thiết bị ${device.deviceCode} không còn trong registry; danh sách đã được đồng bộ lại.`
        : operation === "approve" ? `Đã duyệt ${device.deviceCode}.` : `Đã xử lý ${device.deviceCode}.`);
    } catch (caught) {
      setNotice(caught instanceof Error ? caught.message : "Không thể cập nhật thiết bị.");
      await refreshOperations(true);
    } finally {
      setActionBusy("");
    }
  }

  async function launchWeb(appId: string) {
    const app = appFor(appId);
    const summary = summaryMap.get(appId);
    const fallback = app?.publicUrl;
    if (!summary?.webHref && !fallback) {
      setNotice("Ứng dụng chưa công bố URL website hợp lệ.");
      return;
    }
    setWebBusy(appId);
    setNotice("");
    try {
      if (summary?.managedWebLaunch) {
        const popup = window.open("about:blank", "_blank");
        if (popup) popup.opener = null;
        try {
          const result = await operationsAction({ action: "launch-client-web", appId });
          if (!result.launchUrl) throw new Error(result.error ?? "Không lấy được vé mở website ứng dụng.");
          if (popup) popup.location.replace(result.launchUrl);
          else window.location.assign(result.launchUrl);
        } catch (caught) {
          popup?.close();
          throw caught;
        }
      } else {
        window.open(summary?.webHref ?? fallback, "_blank", "noopener,noreferrer");
      }
      setWebMenu(false);
    } catch (caught) {
      setNotice(caught instanceof Error ? caught.message : "Không thể mở website ứng dụng.");
    } finally {
      setWebBusy("");
    }
  }

  async function clearNotifications() {
    const ids = workItems.map((item) => item.id);
    if (!ids.length) {
      setNotice("Không có thông báo cần dọn.");
      return;
    }
    if (!window.confirm(`Xóa ${ids.length} mục khỏi danh sách hiển thị? Dữ liệu nghiệp vụ gốc không bị xóa.`)) return;
    setActionBusy("clear");
    try {
      await operationsAction({ action: "dismiss-notifications", workItemIds: ids });
      await refreshOperations(true);
      setNotice("Đã dọn thông báo hiển thị; dữ liệu gốc được giữ nguyên.");
    } catch (caught) {
      setNotice(caught instanceof Error ? caught.message : "Không thể xóa thông báo.");
    } finally {
      setActionBusy("");
    }
  }

  async function enableAutoApproval() {
    const supported = (operations?.settings.autoApproveSupportedAppIds ?? []).filter((id) => id !== "boi-ech");
    if (!supported.length) {
      setNotice("Chưa có ứng dụng nào hỗ trợ duyệt tự động an toàn.");
      return;
    }
    if (!window.confirm(`Bật duyệt tự động cho ${supported.map((id) => appFor(id)?.shortName ?? id).join(", ")}?`)) return;
    setActionBusy("auto");
    try {
      await operationsAction({ action: "set-auto-approval", appIds: supported });
      await refreshOperations(true);
      setNotice("Đã cập nhật duyệt tự động.");
    } catch (caught) {
      setNotice(caught instanceof Error ? caught.message : "Không thể cập nhật duyệt tự động.");
    } finally {
      setActionBusy("");
    }
  }

  async function manageControlDevice(device: ControlAdminDevice, operation: ControlDeviceOperation, selectedRole?: "reviewer" | "publisher") {
    if (!access || access.role !== "owner" || device.owner || device.deviceId === access.deviceId) return;
    if (operation === "block" && !window.confirm(`Khóa thiết bị quản trị ${device.deviceCode}?`)) return;
    if (operation === "deactivate-member" && !window.confirm(`Thu hồi toàn bộ quyền quản trị của ${device.email}?`)) return;
    if (operation === "delete-member") {
      const confirmation = window.prompt(`Nhập chính xác email để xóa tài khoản đã thu hồi:\n${device.email}`);
      if (confirmation?.trim().toLowerCase() !== device.email.toLowerCase()) return;
    }
    setActionBusy(`control:${device.deviceId}`);
    try {
      const result = await centerAdminAction({ action: "manage-control-device", operation, targetDeviceId: device.deviceId, role: selectedRole ?? "reviewer", displayName: device.displayName });
      setCenter((current) => current ? { ...current, controlDevices: result.controlDevices ?? current.controlDevices, auditLog: result.auditLog ?? current.auditLog } : current);
      setNotice("Đã cập nhật thiết bị quản trị.");
    } catch (caught) {
      setNotice(caught instanceof Error ? caught.message : "Không thể cập nhật thiết bị quản trị.");
    } finally {
      setActionBusy("");
    }
  }

  if (!access || access.status !== "approved" || !center) return <Gate busy={busy} error={error} access={access} retry={() => void initialize()}/>;

  const title = viewTitles[view];
  const lastUpdated = operations?.generatedAt ? relativeTime(operations.generatedAt) : "Chưa có dữ liệu";

  return <main className="amv2-shell" data-font-scale={fontScale}>
    <aside className="amv2-sidebar">
      <div className="amv2-brand"><div>QT</div><span><small>TRUNG TÂM ĐIỀU PHỐI</small><strong>QUẢN TRỊ ỨNG DỤNG</strong><em>Kết nối · Kiểm soát · Phát triển</em></span></div>
      <nav aria-label="Điều hướng quản trị">{navItems.map((item) => <button key={item.view} data-active={view === item.view} onClick={() => switchView(item.view)}><i>{item.icon}</i><span>{item.label}</span>{item.view === "devices" && pendingDevices.length ? <b>{pendingDevices.length}</b> : null}{item.view === "approvals" && approvalCount ? <b>{approvalCount}</b> : null}</button>)}</nav>
      <section className="amv2-system-card"><header><span>▣</span><div><small>Trạng thái hệ thống</small><strong>{unavailableCount ? "Cần kiểm tra" : "Đã cập nhật dữ liệu"}</strong></div></header><p><span>Ứng dụng quản lý</span><b>{activeApps.length}</b></p><p><span>Kết nối tốt</span><b>{onlineApps}</b></p><p><span>Thiết bị chờ duyệt</span><b>{pendingDevices.length}</b></p><p><span>Lần cập nhật</span><b>{clock ? new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(clock) : "—"}</b></p></section>
      <blockquote>Quản trị tập trung<br/>Vận hành an toàn<br/>Phát triển bền vững</blockquote>
      <footer><i/>Hệ thống hoạt động</footer>
    </aside>

    <section className="amv2-workspace">
      <header className="amv2-topbar">
        <label className="amv2-search"><span>⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm theo ứng dụng, thiết bị, người dùng…"/></label>
        <label className="amv2-filter"><span>▽</span><select value={appFilter} onChange={(event) => setAppFilter(event.target.value)}><option value="all">Bộ lọc nhanh</option>{activeApps.map((app) => <option key={app.id} value={app.id}>{app.shortName}</option>)}</select></label>
        <button className="amv2-bell" onClick={() => switchView("approvals")}>♧{notificationCount ? <b>{notificationCount}</b> : null}</button>
        <span className="amv2-online"><i/><strong>Hệ thống kết nối</strong><small>{syncing ? "Đang đồng bộ…" : "Dữ liệu đã cập nhật"}</small></span>
        <details className="amv2-account"><summary><span>{initials(user.displayName)}</span><div><strong>{user.displayName}</strong><small>{roleLabels[access.role]}</small></div><b>⌄</b></summary><div><small>{user.email}</small><button onClick={() => switchView("settings")}>Cấu hình</button><a href="/signout-with-chatgpt?return_to=%2F">Đăng xuất</a></div></details>
      </header>

      <div className="amv2-content">
        <header className="amv2-page-head"><div><h1>{title.title}</h1><p>{title.subtitle}</p></div>{view === "overview" ? <section className="amv2-clock"><span>▣</span><div><small>{clock ? new Intl.DateTimeFormat("vi-VN", { weekday: "short", day: "2-digit", month: "2-digit", year: "numeric" }).format(clock) : ""}</small><strong>{clock ? new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(clock) : ""}</strong></div><i/><div><small>Hệ thống</small><strong>{unavailableCount ? "Cần kiểm tra" : "Hoạt động ổn định"}</strong></div></section> : <button className="amv2-sync" disabled={syncing} onClick={() => void refreshOperations()}>{syncing ? "Đang đồng bộ…" : "↻ Đồng bộ"}</button>}</header>
        {syncError ? <div className="amv2-warning"><strong>Cảnh báo đồng bộ:</strong> {syncError}</div> : null}
        {notice ? <div className="amv2-notice">{notice}</div> : null}

        <div className="amv2-stage" data-view={view}>
          {view === "overview" ? <Overview
            apps={filteredApps}
            summaryMap={summaryMap}
            devices={filteredDevices}
            pendingDevices={pendingDevices.filter((device) => appFilter === "all" || device.appId === appFilter)}
            approvalDevices={filteredApprovalDevices}
            workItems={filteredWork}
            highAlerts={highAlerts}
            unavailableCount={unavailableCount}
            environmentCount={environmentCount}
            contractPending={contractPending}
            actionBusy={actionBusy}
            webBusy={webBusy}
            syncing={syncing}
            webMenu={webMenu}
            setWebMenu={setWebMenu}
            switchView={switchView}
            launchWeb={launchWeb}
            manageDevice={manageDevice}
            clearNotifications={clearNotifications}
            enableAutoApproval={enableAutoApproval}
            refreshOperations={refreshOperations}
          /> : null}
          {view === "approvals" ? <ApprovalView devices={filteredApprovalDevices} actionBusy={actionBusy} manageDevice={manageDevice}/> : null}
          {view === "applications" ? <ApplicationsView apps={filteredApps} summaryMap={summaryMap} devices={devices} webBusy={webBusy} launchWeb={launchWeb}/> : null}
          {view === "devices" ? <DevicesView devices={filteredDevices} actionBusy={actionBusy} manageDevice={manageDevice}/> : null}
          {view === "access" ? <BoiAccessView query={search}/> : null}
          {view === "alerts" ? <AlertsView apps={filteredApps} summaryMap={summaryMap} workItems={filteredWork} lastUpdated={lastUpdated}/> : null}
          {view === "audit" ? <AuditView center={center}/> : null}
          {view === "settings" ? <SettingsView center={center} access={access} actionBusy={actionBusy} fontScale={fontScale} changeFontScale={changeFontScale} manageControlDevice={manageControlDevice}/> : null}
        </div>
      </div>
    </section>
  </main>;
}

function PanelTitle({ icon, title, count, onClick }: { icon: string; title: string; count?: number; onClick?: () => void }) {
  return <header className="amv2-panel-title"><div><span>{icon}</span><h2>{title}</h2>{typeof count === "number" && count > 0 ? <b>{count}</b> : null}</div>{onClick ? <button onClick={onClick}>Xem tất cả →</button> : null}</header>;
}

function AppCell({ appId, name }: { appId: string; name: string }) {
  return <div className="amv2-app-cell"><i data-app={appId}>{appGlyph(appId)}</i><strong>{name}</strong></div>;
}

function Overview({ apps, summaryMap, devices, pendingDevices, approvalDevices, workItems, highAlerts, unavailableCount, environmentCount, contractPending, actionBusy, webBusy, syncing, webMenu, setWebMenu, switchView, launchWeb, manageDevice, clearNotifications, enableAutoApproval, refreshOperations }: {
  apps: ApplicationConfig[];
  summaryMap: Map<string, OperationsSummary>;
  devices: OperationsDevice[];
  pendingDevices: OperationsDevice[];
  approvalDevices: OperationsDevice[];
  workItems: OperationsWorkItem[];
  highAlerts: number;
  unavailableCount: number;
  environmentCount: number;
  contractPending: number;
  actionBusy: string;
  webBusy: string;
  syncing: boolean;
  webMenu: boolean;
  setWebMenu: (value: boolean | ((current: boolean) => boolean)) => void;
  switchView: (view: View) => void;
  launchWeb: (appId: string) => Promise<void>;
  manageDevice: (device: OperationsDevice, operation: "approve" | "remove") => Promise<void>;
  clearNotifications: () => Promise<void>;
  enableAutoApproval: () => Promise<void>;
  refreshOperations: (silent?: boolean) => Promise<OperationsBootstrap | null>;
}) {
  const priorityRows = [
    ...approvalDevices.map((device) => ({ key: `device:${device.appId}:${device.deviceId}`, appId: device.appId, appName: device.appName, type: device.attention === "environment" ? "Môi trường" : "Thiết bị", content: `${device.userLabel} · ${device.deviceCode}`, at: device.lastSeenAt ?? device.createdAt, priority: device.attention === "environment" ? "Cao" : "Vừa", status: device.status === "pending" ? "Chờ duyệt" : "Cần xác minh" })),
    ...workItems.filter((item) => item.kind === "connection").map((item) => ({ key: `work:${item.id}`, appId: item.appId, appName: item.appName, type: "Kết nối", content: item.title, at: item.occurredAt, priority: item.priority === "high" ? "Cao" : item.priority === "normal" ? "Vừa" : "Thông tin", status: item.priority === "high" ? "Cần xử lý" : "Theo dõi" })),
  ].slice(0, 4);

  return <>
    <section className="amv2-metrics">
      <button data-tone="teal" onClick={() => switchView("applications")}><i>◇</i><div><small>Tổng ứng dụng</small><strong>{activeApps.length}</strong><em>Ứng dụng đang quản lý</em></div><b>›</b></button>
      <button data-tone="gold" onClick={() => switchView("devices")}><i>▣</i><div><small>Thiết bị mới chờ duyệt</small><strong>{pendingDevices.length}</strong><em>Thiết bị cần cấp quyền</em></div><b>›</b></button>
      <button data-tone="red" onClick={() => switchView("alerts")}><i>△</i><div><small>Cảnh báo hôm nay</small><strong>{highAlerts}</strong><em>{highAlerts ? "Có cảnh báo cần kiểm tra" : "Không có cảnh báo cao"}</em></div><b>›</b></button>
      <button data-tone="blue" onClick={() => switchView("approvals")}><i>▤</i><div><small>Ca kiểm duyệt cần xử lý</small><strong>{approvalDevices.length}</strong><em>Yêu cầu đang chờ xử lý</em></div><b>›</b></button>
    </section>

    <section className="amv2-overview-grid">
      <section className="amv2-panel amv2-priority-panel"><PanelTitle icon="▱" title="Hộp việc ưu tiên" count={priorityRows.length} onClick={() => switchView("approvals")}/><div className="amv2-priority-table"><div className="amv2-priority-head"><span>Loại công việc</span><span>Ứng dụng</span><span>Nội dung</span><span>Thời gian</span><span>Độ ưu tiên</span><span>Trạng thái</span></div>{priorityRows.map((row) => <div className="amv2-priority-row" key={row.key}><span>{row.type}</span><AppCell appId={row.appId} name={row.appName}/><span title={row.content}>{row.content}</span><span>{relativeTime(row.at)}</span><b data-priority={row.priority}>{row.priority}</b><em>{row.status}</em></div>)}{!priorityRows.length ? <div className="amv2-empty"><span>▱</span><strong>Không có việc phù hợp với bộ lọc hiện tại.</strong><small>Hệ thống sẽ hiển thị các nhiệm vụ cần xử lý tại đây.</small></div> : null}</div></section>

      <section className="amv2-panel amv2-alert-panel"><PanelTitle icon="♧" title="Cảnh báo nhanh" onClick={() => switchView("alerts")}/><div className="amv2-alert-grid"><button onClick={() => switchView("devices")} data-tone="gold"><small>Thiết bị mới</small><strong>{pendingDevices.length}</strong></button><button onClick={() => switchView("alerts")} data-tone="red"><small>App mất kết nối</small><strong>{unavailableCount}</strong></button><button onClick={() => switchView("alerts")} data-tone="olive"><small>Môi trường thay đổi</small><strong>{environmentCount}</strong></button><button onClick={() => switchView("applications")} data-tone="blue"><small>Kết nối chờ hoàn tất</small><strong>{contractPending}</strong></button></div></section>

      <section className="amv2-panel amv2-quick-panel"><header><h2>⚡ Thao tác nhanh</h2></header><div className="amv2-quick-grid"><button onClick={() => switchView("applications")}>◇<span>Quản trị ứng dụng</span></button><button data-active={webMenu} onClick={() => setWebMenu((current) => !current)}>◎<span>Truy cập web</span></button><button onClick={() => switchView("devices")}>▣<span>Duyệt thiết bị</span></button><button onClick={() => switchView("approvals")}>⬡<span>Yêu cầu chờ duyệt</span></button><button data-danger="true" disabled={Boolean(actionBusy)} onClick={() => void clearNotifications()}>⌫<span>{actionBusy === "clear" ? "Đang xóa…" : "Xóa hết thông báo"}</span></button><button disabled={Boolean(actionBusy)} onClick={() => void enableAutoApproval()}>⚙<span>{actionBusy === "auto" ? "Đang lưu…" : "Duyệt tự động"}</span></button><button disabled={syncing} onClick={() => void refreshOperations()}>↻<span>{syncing ? "Đang đồng bộ…" : "Đồng bộ dữ liệu"}</span></button><button onClick={() => switchView("settings")}>▦<span>Giao diện</span></button><button onClick={() => switchView("audit")}>▤<span>Xem nhật ký</span></button></div>{webMenu ? <div className="amv2-web-menu">{apps.map((app) => <button key={app.id} disabled={webBusy === app.id} onClick={() => void launchWeb(app.id)}><span>{app.shortName}</span><b>{webBusy === app.id ? "Đang mở…" : "Mở ↗"}</b></button>)}</div> : null}</section>

      <section className="amv2-panel amv2-apps-panel"><PanelTitle icon="◇" title="Ứng dụng đang quản lý" onClick={() => switchView("applications")}/><div className="amv2-app-table"><div className="amv2-app-head"><span>Ứng dụng</span><span>Nhóm nghiệp vụ</span><span>Việc chờ xử lý</span><span>Thiết bị online</span><span>Trạng thái</span><span>Website</span><span>Quản Trị</span></div>{apps.map((app) => { const summary = summaryMap.get(app.id); const state = connectionFor(app, summary); const pending = summary?.pendingCount ?? devices.filter((device) => device.appId === app.id && device.status === "pending").length; const hasWeb = Boolean(summary?.webHref || app.publicUrl); return <div className="amv2-app-row" key={app.id}><AppCell appId={app.id} name={app.shortName}/><span>{appGroup(app)}</span><strong>{pending}</strong><strong>{summary?.onlineCount ?? 0}</strong><b data-state={state}><i/>{connectionLabel(state, summary?.issueCode)}</b><button className="amv2-web-action" disabled={!hasWeb || webBusy === app.id} onClick={() => void launchWeb(app.id)}>{webBusy === app.id ? "…" : hasWeb ? "Đến" : "Chờ"}</button><Link className="amv2-manage-action" href={app.href}>Vào</Link></div>; })}{!apps.length ? <div className="amv2-empty compact"><strong>Không tìm thấy ứng dụng phù hợp.</strong></div> : null}</div></section>

      <section className="amv2-panel amv2-devices-panel"><PanelTitle icon="▣" title="Thiết bị mới theo ứng dụng" count={pendingDevices.length} onClick={() => switchView("devices")}/><div className="amv2-device-table"><div className="amv2-device-head"><span>Ứng dụng</span><span>Thiết bị</span><span>Người dùng</span><span>Thời gian</span><span>Thao tác</span></div>{pendingDevices.slice(0, 4).map((device) => { const rowBusy = actionBusy === `${device.appId}:${device.deviceId}`; return <div className="amv2-device-row" key={`${device.appId}:${device.deviceId}`}><AppCell appId={device.appId} name={device.appName}/><span>{deviceKind(device)}</span><span title={device.userLabel}>{device.userLabel}</span><span>{relativeTime(device.createdAt)}</span><div>{device.canApprove ? <button disabled={rowBusy} onClick={() => void manageDevice(device, "approve")}>{device.appId === "boi-ech" ? "Phân quyền" : "Duyệt"}</button> : null}{device.canRemove ? <button data-danger="true" disabled={rowBusy} onClick={() => void manageDevice(device, "remove")}>{device.appId === "boi-ech" ? "Xóa" : "Khóa"}</button> : null}</div></div>; })}{!pendingDevices.length ? <div className="amv2-empty compact"><strong>Không có thiết bị chờ duyệt.</strong></div> : null}</div></section>
    </section>
  </>;
}

function ApprovalView({ devices, actionBusy, manageDevice }: { devices: OperationsDevice[]; actionBusy: string; manageDevice: (device: OperationsDevice, operation: "approve" | "remove") => Promise<void> }) {
  return <section className="amv2-page-panel"><div className="amv2-view-table approval"><div className="head"><span>Ứng dụng</span><span>Loại yêu cầu</span><span>Thiết bị / người dùng</span><span>Trạng thái</span><span>Thao tác</span></div>{devices.map((device) => { const rowBusy = actionBusy === `${device.appId}:${device.deviceId}`; return <div className="row" key={`${device.appId}:${device.deviceId}`}><AppCell appId={device.appId} name={device.appName}/><span>{device.status === "pending" ? "Duyệt thiết bị" : "Xác minh môi trường"}</span><div><strong>{device.userLabel}</strong><small>{device.deviceCode}</small></div><b>{device.status === "pending" ? "Chờ duyệt" : "Cần xử lý"}</b><div>{device.canApprove ? <button disabled={rowBusy} onClick={() => void manageDevice(device, "approve")}>{device.appId === "boi-ech" ? "Phân quyền" : "Duyệt"}</button> : null}{device.canRemove ? <button data-danger="true" disabled={rowBusy} onClick={() => void manageDevice(device, "remove")}>{device.appId === "boi-ech" ? "Xóa" : "Khóa"}</button> : null}</div></div>; })}{!devices.length ? <div className="amv2-empty"><strong>Không có yêu cầu cần xử lý.</strong></div> : null}</div></section>;
}

function ApplicationsView({ apps, summaryMap, devices, webBusy, launchWeb }: { apps: ApplicationConfig[]; summaryMap: Map<string, OperationsSummary>; devices: OperationsDevice[]; webBusy: string; launchWeb: (appId: string) => Promise<void> }) {
  return <section className="amv2-page-panel"><div className="amv2-app-table full"><div className="amv2-app-head"><span>Ứng dụng</span><span>Nhóm nghiệp vụ</span><span>Việc chờ xử lý</span><span>Thiết bị online</span><span>Trạng thái</span><span>Website</span><span>Quản Trị</span></div>{apps.map((app) => { const summary = summaryMap.get(app.id); const state = connectionFor(app, summary); const pending = summary?.pendingCount ?? devices.filter((device) => device.appId === app.id && device.status === "pending").length; const hasWeb = Boolean(summary?.webHref || app.publicUrl); return <div className="amv2-app-row" key={app.id}><AppCell appId={app.id} name={app.shortName}/><span>{appGroup(app)}</span><strong>{pending}</strong><strong>{summary?.onlineCount ?? 0}</strong><b data-state={state}><i/>{connectionLabel(state, summary?.issueCode)}</b><button className="amv2-web-action" disabled={!hasWeb || webBusy === app.id} onClick={() => void launchWeb(app.id)}>{webBusy === app.id ? "…" : hasWeb ? "Đến" : "Chờ"}</button><Link className="amv2-manage-action" href={app.href}>Vào</Link></div>; })}</div></section>;
}

function DevicesView({ devices, actionBusy, manageDevice }: { devices: OperationsDevice[]; actionBusy: string; manageDevice: (device: OperationsDevice, operation: "approve" | "remove") => Promise<void> }) {
  return <section className="amv2-page-panel"><div className="amv2-view-table devices"><div className="head"><span>Ứng dụng</span><span>Thiết bị</span><span>Người dùng</span><span>Trạng thái</span><span>Hoạt động</span><span>Thao tác</span></div>{devices.map((device) => { const rowBusy = actionBusy === `${device.appId}:${device.deviceId}`; return <div className="row" key={`${device.appId}:${device.deviceId}`}><AppCell appId={device.appId} name={device.appName}/><div><strong>{deviceKind(device)}</strong><small>{device.deviceCode}</small></div><span>{device.userLabel}</span><b>{device.status === "approved" ? "Đã duyệt" : device.status === "pending" ? "Chờ duyệt" : device.status === "blocked" ? "Đã khóa" : "Chưa rõ"}</b><span>{device.active ? "● Online" : relativeTime(device.lastSeenAt)}</span><div>{device.canApprove && device.status === "pending" ? <button disabled={rowBusy} onClick={() => void manageDevice(device, "approve")}>{device.appId === "boi-ech" ? "Phân quyền" : "Duyệt"}</button> : null}{device.canRemove ? <button data-danger="true" disabled={rowBusy} onClick={() => void manageDevice(device, "remove")}>{device.appId === "boi-ech" ? "Xóa" : "Khóa"}</button> : null}<Link href={device.href}>Quản trị</Link></div></div>; })}{!devices.length ? <div className="amv2-empty"><strong>Không tìm thấy thiết bị phù hợp.</strong></div> : null}</div></section>;
}

function AlertsView({ apps, summaryMap, workItems, lastUpdated }: { apps: ApplicationConfig[]; summaryMap: Map<string, OperationsSummary>; workItems: OperationsWorkItem[]; lastUpdated: string }) {
  return <section className="amv2-page-panel alerts"><div className="amv2-alert-list">{apps.map((app) => { const summary = summaryMap.get(app.id); const state = connectionFor(app, summary); return <article key={app.id}><AppCell appId={app.id} name={app.shortName}/><b data-state={state}>{connectionLabel(state, summary?.issueCode)}</b><p>{summary?.note ?? app.contractNote}</p><time>{lastUpdated}</time></article>; })}{workItems.map((item) => <article key={item.id}><AppCell appId={item.appId} name={item.appName}/><b data-state={item.priority === "high" ? "unavailable" : "warning"}>{item.priority === "high" ? "Cần xử lý" : "Theo dõi"}</b><p>{item.title} · {item.detail}</p><time>{relativeTime(item.occurredAt)}</time></article>)}</div></section>;
}

function AuditView({ center }: { center: CenterBootstrap }) {
  return <section className="amv2-page-panel"><div className="amv2-audit-list">{center.auditLog.map((entry) => <article key={entry.id}><time>{new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(new Date(entry.createdAt))}</time><div><strong>{entry.action.replaceAll("_", " ")}</strong><small>{entry.actor}</small></div><code>{entry.target}</code></article>)}{!center.auditLog.length ? <div className="amv2-empty"><strong>Chưa có sự kiện audit.</strong></div> : null}</div></section>;
}

function SettingsView({ center, access, actionBusy, fontScale, changeFontScale, manageControlDevice }: {
  center: CenterBootstrap;
  access: AdminAccess;
  actionBusy: string;
  fontScale: FontScale;
  changeFontScale: (next: FontScale) => void;
  manageControlDevice: (device: ControlAdminDevice, operation: ControlDeviceOperation, selectedRole?: "reviewer" | "publisher") => Promise<void>;
}) {
  const [roles, setRoles] = useState<Record<string, "reviewer" | "publisher">>({});
  return <section className="amv2-settings-grid">
    <div className="amv2-page-panel">
      <h2>Thiết bị quản trị Trung tâm</h2>
      <div className="amv2-control-list">{center.controlDevices.map((device) => {
        const protectedDevice = device.owner || device.deviceId === access.deviceId;
        const rowBusy = actionBusy === `control:${device.deviceId}`;
        const role = roles[device.deviceId] ?? (device.role === "publisher" ? "publisher" : "reviewer");
        return <article key={device.deviceId}><i data-online={device.active}/><div><strong>{device.displayName || device.email}</strong><small>{device.email}</small><code>{device.deviceCode}</code></div><span>{roleLabels[device.role]}</span><b>{device.status === "approved" ? "Đã cấp quyền" : device.status === "pending" ? "Chờ duyệt" : "Đã khóa"}</b><div>{protectedDevice ? <em>Được bảo vệ</em> : access.role !== "owner" ? <em>Chỉ Owner được sửa</em> : device.status === "pending" ? <><select value={role} onChange={(event) => setRoles((current) => ({ ...current, [device.deviceId]: event.target.value as "reviewer" | "publisher" }))}><option value="reviewer">Kiểm duyệt viên</option><option value="publisher">Người xuất bản</option></select><button disabled={rowBusy} onClick={() => void manageControlDevice(device, "approve", role)}>Cấp quyền</button><button data-danger="true" disabled={rowBusy} onClick={() => void manageControlDevice(device, "block")}>Từ chối</button></> : device.memberStatus === "inactive" ? <button data-danger="true" disabled={rowBusy} onClick={() => void manageControlDevice(device, "delete-member")}>Xóa tài khoản</button> : <><button disabled={rowBusy} onClick={() => void manageControlDevice(device, "block")}>Khóa máy</button><button data-danger="true" disabled={rowBusy} onClick={() => void manageControlDevice(device, "deactivate-member")}>Thu hồi</button></>}</div></article>;
      })}</div>
    </div>
    <div className="amv2-page-panel">
      <h2>Giao diện trên thiết bị này</h2>
      <div className="amv2-appearance-settings">
        <p>Cỡ chữ chỉ được lưu trên trình duyệt hiện tại. Mức <strong>Gọn</strong> giữ bố cục hiện tại; các mức sau tăng dần khả năng đọc mà không thay đổi dữ liệu hay quyền.</p>
        <div className="amv2-font-scale-options">{fontScaleOptions.map((option) => <button key={option.id} data-active={fontScale === option.id} onClick={() => changeFontScale(option.id)}><strong>{option.label}</strong><small>{option.hint}</small></button>)}</div>
      </div>
      <h2>Nguyên tắc vận hành</h2>
      <div className="amv2-rules"><article><b>01</b><div><strong>Client sở hữu dữ liệu</strong><p>Registry thiết bị, phiên truy cập và dữ liệu nghiệp vụ vẫn nằm tại ứng dụng tương ứng.</p></div></article><article><b>02</b><div><strong>Trung tâm điều phối</strong><p>Application Management đọc contract và gửi lệnh quản trị có xác minh.</p></div></article><article><b>03</b><div><strong>Không hiển thị dữ liệu giả</strong><p>Chỉ số và trạng thái chỉ xuất hiện từ dữ liệu thật hoặc thể hiện rõ chưa có dữ liệu.</p></div></article></div>
    </div>
  </section>;
}

