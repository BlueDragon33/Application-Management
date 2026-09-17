"use client";

import { useEffect, useMemo, useState } from "react";
import { applicationRegistry, type ApplicationConfig } from "./application-registry";
import {
  connectAdminCenter,
  connectOperationsDashboard,
  operationsAction,
  roleLabels,
  type AdminAccess,
  type CenterBootstrap,
  type OperationsBootstrap,
  type OperationsDevice,
  type OperationsSummary,
  type OperationsWorkItem,
} from "./admin-device-client";

type ManagementTheme = "emerald" | "jade" | "midnight" | "graphite";

const THEME_STORAGE_KEY = "application-management:theme:v1";
const PRIMARY_APP_IDS = new Set(["boi-ech", "bauman-master-ai"]);
const primaryApps = applicationRegistry.filter((app) => PRIMARY_APP_IDS.has(app.id));
const themeOptions: Array<{ value: ManagementTheme; label: string }> = [
  { value: "emerald", label: "Xanh lục chuẩn" },
  { value: "jade", label: "Ngọc lục" },
  { value: "midnight", label: "Xanh đêm" },
  { value: "graphite", label: "Than chì" },
];

const navItems = [
  ["overview", "⌂", "Tổng quan"],
  ["approvals", "▧", "Hộp việc"],
  ["applications", "▦", "Ứng dụng"],
  ["devices", "▣", "Thiết bị mới"],
  ["sync", "△", "Cảnh báo"],
  ["audit", "≣", "Nhật ký"],
  ["settings", "⚙", "Cấu hình"],
] as const;

function appFor(id: string) {
  return primaryApps.find((app) => app.id === id);
}

function appGlyph(app: ApplicationConfig) {
  if (app.id === "bauman-master-ai") return "◇";
  if (app.id === "boi-ech") return "≋";
  return "◆";
}

function relativeTime(value: string | null | undefined) {
  if (!value) return "—";
  const time = Date.parse(value);
  if (!Number.isFinite(time)) return "—";
  const minutes = Math.max(0, Math.floor((Date.now() - time) / 60000));
  if (minutes < 1) return "Vừa xong";
  if (minutes < 60) return `${minutes} phút trước`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} giờ trước`;
  return `${Math.floor(hours / 24)} ngày trước`;
}

function initials(value: string) {
  return (value.trim().split(/\s+/).slice(-2).map((word) => word[0]?.toUpperCase()).join("") || "ND").slice(0, 2);
}

function connection(summary: OperationsSummary | undefined, app: ApplicationConfig) {
  if (summary?.connection) return summary.connection;
  return app.contractState === "pending" ? "pending" : "warning";
}

function connectionText(value: ReturnType<typeof connection>) {
  if (value === "connected") return "Kết nối tốt";
  if (value === "unavailable") return "Mất kết nối";
  if (value === "warning") return "Có cảnh báo";
  return "Chờ backend";
}

function deviceKind(device: OperationsDevice) {
  if (device.deviceType === "desktop") return "Desktop";
  if (device.deviceType === "tablet") return "Tablet/iPad";
  if (device.deviceType === "phone") return "Điện thoại";
  return device.deviceTypeLabel || "Thiết bị";
}

function workTone(item: OperationsWorkItem) {
  if (item.priority === "high") return "danger";
  if (item.kind === "environment") return "amber";
  if (item.kind === "connection") return "blue";
  return "pending";
}

function ModernGate({ busy, access, error, retry }: { busy: boolean; access: AdminAccess | null; error: string; retry: () => void }) {
  return <main className="modernGate"><section><div>QT</div><h1>Quản trị Ứng dụng</h1><p>{busy ? "Đang xác minh thiết bị quản trị…" : error || (access?.status === "pending" ? "Thiết bị này đang chờ Chủ hệ thống cấp quyền." : access?.status === "blocked" ? "Thiết bị quản trị đã bị khóa." : "Không thể mở Trung tâm quản trị.")}</p>{busy ? <span/> : <button onClick={retry}>Kiểm tra lại</button>}</section></main>;
}

export default function ManagementModernOverview({ user }: { user: { displayName: string; email: string } }) {
  const [access, setAccess] = useState<AdminAccess | null>(null);
  const [center, setCenter] = useState<CenterBootstrap | null>(null);
  const [operations, setOperations] = useState<OperationsBootstrap | null>(null);
  const [busy, setBusy] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [actionBusy, setActionBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [appFilter, setAppFilter] = useState("all");
  const [webMenu, setWebMenu] = useState(false);
  const [theme, setTheme] = useState<ManagementTheme>("emerald");

  async function refreshOperations(silent = false) {
    if (!silent) setSyncing(true);
    try {
      const result = await connectOperationsDashboard();
      if (result.bootstrap) setOperations(result.bootstrap);
      return result.bootstrap ?? null;
    } catch (caught) {
      setNotice(caught instanceof Error ? caught.message : "Không thể đồng bộ dữ liệu ứng dụng.");
      return null;
    } finally {
      if (!silent) setSyncing(false);
    }
  }

  async function initialize() {
    setBusy(true);
    setError("");
    try {
      const result = await connectAdminCenter();
      setAccess(result.access);
      setCenter(result.bootstrap);
      if (result.bootstrap) await refreshOperations(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không thể mở Trung tâm quản trị.");
    } finally {
      setBusy(false);
    }
  }

  function changeTheme(next: ManagementTheme) {
    setTheme(next);
    try { window.localStorage.setItem(THEME_STORAGE_KEY, next); } catch { /* local preference is optional */ }
    document.documentElement.dataset.managementTheme = next;
  }

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(THEME_STORAGE_KEY) as ManagementTheme | null;
      if (saved && themeOptions.some((option) => option.value === saved)) {
        setTheme(saved);
        document.documentElement.dataset.managementTheme = saved;
      } else {
        document.documentElement.dataset.managementTheme = "emerald";
      }
    } catch {
      document.documentElement.dataset.managementTheme = "emerald";
    }
    void initialize();
    const onFocus = () => void refreshOperations(true);
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const summaries = useMemo(() => operations?.summaries ?? [], [operations]);
  const summaryMap = useMemo(() => new Map(summaries.map((item) => [item.appId, item])), [summaries]);
  const devices = useMemo(() => operations?.devices ?? [], [operations]);
  const workItems = useMemo(() => operations?.workItems ?? [], [operations]);
  const pendingDevices = devices.filter((item) => item.status === "pending");
  const unavailable = primaryApps.filter((app) => connection(summaryMap.get(app.id), app) === "unavailable").length;
  const searchValue = search.trim().toLowerCase();

  const visibleApps = primaryApps.filter((app) => {
    if (!searchValue) return true;
    return `${app.name} ${app.shortName} ${app.scope}`.toLowerCase().includes(searchValue);
  });

  const visibleWork = workItems.filter((item) => {
    if (appFilter !== "all" && item.appId !== appFilter) return false;
    return !searchValue || `${item.appName} ${item.title} ${item.detail}`.toLowerCase().includes(searchValue);
  }).slice(0, 6);

  const visibleDevices = pendingDevices.filter((item) => {
    if (appFilter !== "all" && item.appId !== appFilter) return false;
    return !searchValue || `${item.appName} ${item.userLabel} ${item.deviceCode}`.toLowerCase().includes(searchValue);
  }).slice(0, 6);

  function go(view: string) {
    window.location.assign(view === "overview" ? "/" : `/?view=${encodeURIComponent(view)}`);
  }

  async function manageDevice(device: OperationsDevice, operation: "approve" | "remove") {
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
      });
      const synced = await refreshOperations(true);
      if (result.code === "STALE_DEVICE_REMOVED") {
        setNotice(`Thiết bị ${device.deviceCode} không còn trong registry; danh sách đã được đồng bộ lại.`);
      } else {
        setNotice(synced ? (operation === "approve" ? `Đã duyệt và đồng bộ ${device.deviceCode}.` : `Đã xử lý và đồng bộ ${device.deviceCode}.`) : "Backend đã xử lý nhưng Trung tâm chưa đọc lại được trạng thái.");
      }
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
    if (!summary?.webHref && !fallback) { setNotice("Ứng dụng chưa công bố URL website hợp lệ."); return; }
    setActionBusy(`web:${appId}`);
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
      setActionBusy("");
    }
  }

  async function clearNotifications() {
    const ids = workItems.map((item) => item.id);
    if (!ids.length) { setNotice("Không có thông báo cần dọn."); return; }
    if (!window.confirm(`Xóa ${ids.length} mục khỏi danh sách chờ duyệt? Dữ liệu gốc tại ứng dụng không bị xóa.`)) return;
    setActionBusy("clear");
    try {
      await operationsAction({ action: "dismiss-notifications", workItemIds: ids });
      await refreshOperations(true);
      setNotice("Đã dọn danh sách hiển thị; dữ liệu nghiệp vụ gốc vẫn được giữ nguyên.");
    } catch (caught) {
      setNotice(caught instanceof Error ? caught.message : "Không thể xóa thông báo.");
    } finally { setActionBusy(""); }
  }

  async function enableAutoApproval() {
    const supported = operations?.settings.autoApproveSupportedAppIds ?? [];
    if (!supported.length) { setNotice("Chưa có ứng dụng nào hỗ trợ duyệt tự động an toàn."); return; }
    const names = supported.map((id) => appFor(id)?.shortName ?? id).join(", ");
    if (!window.confirm(`Bật duyệt tự động cho: ${names}?`)) return;
    setActionBusy("auto");
    try {
      await operationsAction({ action: "set-auto-approval", appIds: supported });
      await refreshOperations(true);
      setNotice(`Đã bật duyệt tự động cho ${supported.length} ứng dụng được hỗ trợ.`);
    } catch (caught) {
      setNotice(caught instanceof Error ? caught.message : "Không thể lưu quy tắc duyệt tự động.");
    } finally { setActionBusy(""); }
  }

  if (!access || access.status !== "approved" || !center) return <ModernGate busy={busy} access={access} error={error} retry={() => void initialize()}/>;

  const notificationCount = workItems.length + pendingDevices.length;
  const onlineApps = primaryApps.filter((app) => connection(summaryMap.get(app.id), app) === "connected").length;
  const systemHealthy = unavailable === 0;

  return <main className="modernAdminShell" data-theme={theme}>
    <aside className="modernSidebar">
      <div className="modernBrand"><div>QT</div><span><small>TRUNG TÂM ĐIỀU PHỐI</small><strong>QUẢN TRỊ ỨNG DỤNG</strong><em>Kết nối · Kiểm soát · Phát triển</em></span></div>
      <nav aria-label="Điều hướng quản trị hiện đại">{navItems.map(([view, icon, label]) => <button key={view} data-active={view === "overview"} onClick={() => go(view)}><i>{icon}</i><span>{label}</span>{view === "approvals" && notificationCount ? <b>{notificationCount}</b> : null}</button>)}</nav>
      <section className="modernSystemHealth"><header><span>●</span><div><small>Trạng thái hệ thống</small><strong>{systemHealthy ? "Hoạt động ổn định" : "Cần kiểm tra"}</strong></div></header><div><span>Ứng dụng quản lý</span><b>{primaryApps.length}</b></div><div><span>Kết nối tốt</span><b>{onlineApps}</b></div><div><span>Thiết bị chờ duyệt</span><b>{pendingDevices.length}</b></div></section>
    </aside>

    <section className="modernWorkspace">
      <header className="modernTopbar">
        <label className="modernSearch"><span>⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm theo ứng dụng, thiết bị, người dùng…"/></label>
        <label className="modernFilter"><span>▽</span><select value={appFilter} onChange={(event) => setAppFilter(event.target.value)}><option value="all">Bộ lọc nhanh</option>{primaryApps.map((app) => <option key={app.id} value={app.id}>{app.shortName}</option>)}</select></label>
        <button className="modernBell" onClick={() => go("approvals")}>♧{notificationCount ? <b>{notificationCount}</b> : null}</button>
        <span className="modernOnline"><i/>Hệ thống kết nối<small>Dữ liệu đã cập nhật</small></span>
        <details className="modernAccount"><summary><span>{initials(user.displayName)}</span><div><strong>{user.displayName}</strong><small>{roleLabels[access.role]}</small></div><b>⌄</b></summary><div><small>{user.email}</small><label className="modernThemePicker"><span>Giao diện</span><select value={theme} onChange={(event) => changeTheme(event.target.value as ManagementTheme)}>{themeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label><button onClick={() => go("settings")}>Cài đặt quản trị</button><a href="/signout-with-chatgpt?return_to=%2F">Đăng xuất</a></div></details>
      </header>

      <div className="modernPage">
        {notice ? <div className="modernNotice">{notice}</div> : null}

        <section className="modernMetrics">
          <button onClick={() => go("applications")} data-tone="teal"><i>◇</i><div><small>Tổng ứng dụng</small><strong>{primaryApps.length}</strong><em>Ứng dụng đang quản lý</em></div><b>›</b></button>
          <button onClick={() => go("approvals")} data-tone="gold"><i>▣</i><div><small>Thiết bị mới chờ duyệt</small><strong>{pendingDevices.length}</strong><em>Thiết bị cần cấp quyền</em></div><b>›</b></button>
          <button onClick={() => go("sync")} data-tone="red"><i>△</i><div><small>Cảnh báo hôm nay</small><strong>{workItems.filter((item) => item.priority === "high").length + unavailable}</strong><em>{unavailable ? `${unavailable} app mất kết nối` : "Không có cảnh báo cao"}</em></div><b>›</b></button>
          <button onClick={() => go("approvals")} data-tone="blue"><i>▤</i><div><small>Ca kiểm duyệt cần xử lý</small><strong>{notificationCount}</strong><em>Yêu cầu đang chờ xử lý</em></div><b>›</b></button>
        </section>

        <section className="modernBoard modernBoardCompact">
          <section className="modernPanel modernAppsPanel"><PanelTitle icon="◇" title="Ứng dụng đang quản lý" onClick={() => go("applications")}/><div className="modernAppsTable"><div className="modernAppsHead"><span>Ứng dụng</span><span>Nhóm nghiệp vụ</span><span>Việc chờ xử lý</span><span>Thiết bị online</span><span>Trạng thái</span><span>Quản trị</span><span>Website</span></div>{visibleApps.map((app) => { const summary = summaryMap.get(app.id); const state = connection(summary, app); const pending = summary?.pendingCount ?? devices.filter((item) => item.appId === app.id && item.status === "pending").length; const hasWeb = Boolean(summary?.webHref || app.publicUrl); return <div className="modernAppsRow" key={app.id}><AppCell appId={app.id} name={app.shortName}/><span>{app.id === "boi-ech" ? "Học tập" : "Học thuật"}</span><strong>{summary?.pendingCount == null ? "—" : pending}</strong><strong>{summary?.onlineCount ?? "—"}</strong><b data-state={state}><i/>{connectionText(state)}</b><button className="modernManageAction" onClick={() => window.location.assign(app.href)}>Vào quản trị →</button><button className="modernWebAction" disabled={!hasWeb || actionBusy === `web:${app.id}`} onClick={() => void launchWeb(app.id)}>{actionBusy === `web:${app.id}` ? "Đang mở…" : hasWeb ? "Truy cập web ↗" : "Chờ contract"}</button></div>; })}{!visibleApps.length ? <EmptyRow text="Không tìm thấy ứng dụng phù hợp."/> : null}</div></section>

          <section className="modernPanel modernQuickPanel"><header><h2>⚡ Thao tác nhanh</h2></header><div className="modernQuickGrid"><button onClick={() => go("applications")}><i>◇</i><span><strong>Quản trị ứng dụng</strong><small>Cấu hình và giám sát</small></span><b>›</b></button><button data-active={webMenu} onClick={() => setWebMenu((value) => !value)}><i>◎</i><span><strong>Truy cập web</strong><small>Mở ứng dụng sử dụng</small></span><b>›</b></button><button onClick={() => go("approvals")}><i>▣</i><span><strong>Duyệt thiết bị</strong><small>Xem và phê duyệt mới</small></span><b>›</b></button><button disabled={Boolean(actionBusy)} onClick={() => void enableAutoApproval()}><i>⚙</i><span><strong>{actionBusy === "auto" ? "Đang lưu…" : "Duyệt tự động"}</strong><small>Thiết lập quy tắc duyệt</small></span><b>›</b></button><button data-danger="true" disabled={Boolean(actionBusy)} onClick={() => void clearNotifications()}><i>⌫</i><span><strong>{actionBusy === "clear" ? "Đang xóa…" : "Xóa hết thông báo"}</strong><small>Đánh dấu danh sách đã đọc</small></span><b>›</b></button><button disabled={syncing} onClick={() => void refreshOperations()}><i>{syncing ? "…" : "↻"}</i><span><strong>{syncing ? "Đang đồng bộ…" : "Đồng bộ dữ liệu"}</strong><small>Cập nhật dữ liệu hệ thống</small></span><b>›</b></button></div>{webMenu ? <div className="modernWebMenu">{primaryApps.map((app) => <button key={app.id} disabled={Boolean(actionBusy)} onClick={() => void launchWeb(app.id)}><span>{app.shortName}</span><b>{actionBusy === `web:${app.id}` ? "Đang mở…" : "Mở ↗"}</b></button>)}</div> : null}</section>

          <section className="modernPanel modernWorkPanel"><PanelTitle icon="☷" title="Hộp việc ưu tiên" count={workItems.length} onClick={() => go("approvals")}/><div className="modernTable modernWorkTable"><div className="modernTableHead"><span>Ứng dụng</span><span>Sự kiện</span><span>Thiết bị</span><span>Thời gian</span><span>Trạng thái</span><span>Thao tác</span></div>{visibleWork.map((item) => <div className="modernTableRow" key={item.id}><AppCell appId={item.appId} name={item.appName}/><span>{item.title}</span><span>{item.deviceType || "Thiết bị"}</span><span>{relativeTime(item.occurredAt)}</span><b data-tone={workTone(item)}>{item.priority === "high" ? "Ưu tiên cao" : item.kind === "environment" ? "Cần kiểm tra" : item.kind === "connection" ? "Theo dõi" : "Chờ duyệt"}</b><button onClick={() => go("approvals")}>Xem</button></div>)}{!visibleWork.length ? <EmptyRow text="Không có việc phù hợp với bộ lọc hiện tại."/> : null}</div></section>

          <section className="modernPanel modernDevicePanel"><PanelTitle icon="▣" title="Thiết bị mới theo ứng dụng" count={pendingDevices.length} onClick={() => go("devices")}/><div className="modernMiniFilters"><select value={appFilter} onChange={(event) => setAppFilter(event.target.value)}><option value="all">Tất cả ứng dụng</option>{primaryApps.map((app) => <option key={app.id} value={app.id}>{app.shortName}</option>)}</select><select defaultValue="all"><option value="all">Tất cả thiết bị</option><option value="desktop">Desktop</option><option value="tablet">Tablet</option><option value="phone">Điện thoại</option></select><button>7 ngày qua⌄</button></div><div className="modernTable modernDeviceTable"><div className="modernTableHead"><span>Ứng dụng</span><span>Thiết bị</span><span>Người dùng</span><span>Thời gian</span><span>Thao tác</span></div>{visibleDevices.map((device) => { const rowBusy = actionBusy === `${device.appId}:${device.deviceId}`; return <div className="modernTableRow" key={`${device.appId}:${device.deviceId}`}><AppCell appId={device.appId} name={device.appName}/><span>{deviceKind(device)}</span><span>{device.userLabel}</span><span>{relativeTime(device.createdAt)}</span><div className="modernRowActions">{device.canApprove ? <button disabled={rowBusy} onClick={() => void manageDevice(device, "approve")}>Duyệt</button> : null}{device.canRemove ? <button data-danger="true" disabled={rowBusy} onClick={() => void manageDevice(device, "remove")}>{device.appId === "boi-ech" ? "Từ chối" : "Khóa"}</button> : null}<button onClick={() => go("devices")}>Chi tiết</button></div></div>; })}{!visibleDevices.length ? <EmptyRow text="Không có thiết bị mới/cảnh báo trong phạm vi đang chọn."/> : null}</div></section>
        </section>
      </div>
    </section>
  </main>;
}

function PanelTitle({ icon, title, count, onClick }: { icon: string; title: string; count?: number; onClick: () => void }) {
  return <header className="modernPanelTitle"><div><span>{icon}</span><h2>{title}</h2>{typeof count === "number" && count > 0 ? <b>{count}</b> : null}</div><button onClick={onClick}>Xem tất cả →</button></header>;
}

function AppCell({ appId, name }: { appId: string; name: string }) {
  const app = appFor(appId);
  return <div className="modernAppCell"><i data-app={appId}>{app ? appGlyph(app) : "◆"}</i><strong>{name}</strong></div>;
}

function EmptyRow({ text }: { text: string }) {
  return <div className="modernEmptyRow">{text}</div>;
}
