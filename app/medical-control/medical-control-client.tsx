"use client";

/* eslint-disable @next/next/no-html-link-for-pages -- full navigation is intentional between independently deployed Sites. */

import { useEffect, useMemo, useRef, useState } from "react";
import { signedControlPost, type ControlAccess } from "../control-device.client";
import { integrationRussiaSiteUrl } from "../site-links";

type MedicalAudit = { id: number; action: string; actor: string; target?: string; createdAt: string };
type MedicalBootstrap = {
  actor: ControlAccess;
  stats: { total: number; pending: number; needsDocuments: number; resolved: number };
  rules: { id: string; enabled: boolean; level: number }[];
  reviews: { id: string; status: string; createdAt: string }[];
  meta: { version: string; updatedAt: string; jurisdiction: string };
  auditLog: MedicalAudit[];
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

type DeviceAudit = {
  id: number;
  actor: string;
  action: string;
  target: string;
  detail: Record<string, unknown>;
  createdAt: string;
};

type DeviceBootstrap = {
  actor: ControlAccess;
  app: { id: "hoa-nhap-nga"; name: string };
  devices: ManagedDevice[];
  auditLog: DeviceAudit[];
  error?: string;
};

type DeviceActionResult = {
  ok?: boolean;
  device?: ManagedDevice;
  devices?: ManagedDevice[];
  auditLog?: DeviceAudit[];
  error?: string;
};

type TabId = "devices" | "access" | "content" | "rules" | "audit";
type DeviceFilter = "all" | "pending" | "approved" | "blocked" | "online" | "unnamed";
type DeviceSort = "priority" | "recent" | "name" | "lastSeen";
type BulkOperation = "approve" | "block" | "pending";

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
  pending: "Chờ cấp quyền",
  approved: "Đã cấp quyền",
  blocked: "Đã khóa",
} as const;

const navItems: { id: TabId; icon: string; label: string; note: string }[] = [
  { id: "devices", icon: "⌘", label: "Thiết bị · người dùng", note: "Nhận diện và trạng thái" },
  { id: "access", icon: "⌁", label: "Quyền truy cập", note: "Duyệt, thu hồi, khóa" },
  { id: "content", icon: "✦", label: "Kiểm duyệt nội dung", note: "Hàng đợi và quyết định" },
  { id: "rules", icon: "≋", label: "Quy tắc · cảnh báo", note: "Bộ quy tắc đang áp dụng" },
  { id: "audit", icon: "◎", label: "Nhật ký hoạt động", note: "Theo dõi thay đổi" },
];

function formatTime(value: string | null | undefined) {
  if (!value) return "Chưa có";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", year: "numeric" });
}

function formatShortTime(value: string | null | undefined) {
  if (!value) return "chưa đồng bộ";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
}

function deviceTitle(device: ManagedDevice) {
  return device.label || `${deviceClassLabel[device.deviceClass]} · ${device.osName}`;
}

function csvCell(value: unknown) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

function downloadText(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(href);
}

function StatCard({ label, value, note, tone = "default" }: { label: string; value: number | string; note: string; tone?: "default" | "good" | "warn" | "danger" }) {
  return <article className={`russia-stat tone-${tone}`}><span>{label}</span><strong>{value}</strong><small>{note}</small><i aria-hidden="true" /></article>;
}

function DeviceCard({ device, busy, canGrant, selected, onToggle, onDetail, onRename, onChange }: {
  device: ManagedDevice;
  busy: boolean;
  canGrant: boolean;
  selected: boolean;
  onToggle: (deviceId: string) => void;
  onDetail: (deviceId: string) => void;
  onRename: (device: ManagedDevice) => void;
  onChange: (deviceId: string, action: "approve" | "block" | "pending") => void;
}) {
  return <article className={`russia-device-card status-${device.status} ${selected ? "is-selected" : ""}`}>
    <label className="russia-device-check" title="Chọn thiết bị"><input type="checkbox" checked={selected} onChange={() => onToggle(device.deviceId)} /><span /></label>
    <button className="russia-device-identity" onClick={() => onDetail(device.deviceId)}>
      <div className="russia-device-code"><strong>{device.deviceCode}</strong><span>{statusLabel[device.status]}</span>{device.active ? <b>ONLINE</b> : null}{!device.label ? <em>CHƯA ĐẶT TÊN</em> : null}</div>
      <h3>{deviceTitle(device)}</h3>
      <p>{deviceClassLabel[device.deviceClass]} · {device.osName} · {device.browserName}{device.modelHint ? ` · ${device.modelHint}` : ""}{device.screen ? ` · ${device.screen}` : ""}</p>
      <div className="russia-device-meta"><span>Đăng ký: {formatTime(device.createdAt)}</span><span>Lần cuối: {formatTime(device.lastSeenAt)}</span>{device.approvedBy ? <span>Duyệt bởi: {device.approvedBy}</span> : null}</div>
    </button>
    <div className="russia-device-actions">
      <button onClick={() => onDetail(device.deviceId)}>Chi tiết</button>
      <button onClick={() => onRename(device)} disabled={busy || !canGrant}>Đặt tên</button>
      {device.status !== "approved" ? <button className="approve" onClick={() => onChange(device.deviceId, "approve")} disabled={busy || !canGrant}>Cấp quyền</button> : <button onClick={() => onChange(device.deviceId, "pending")} disabled={busy || !canGrant}>Thu hồi tạm</button>}
      {device.status !== "blocked" ? <button className="danger" onClick={() => onChange(device.deviceId, "block")} disabled={busy || !canGrant}>Khóa</button> : <button onClick={() => onChange(device.deviceId, "pending")} disabled={busy || !canGrant}>Bỏ khóa</button>}
    </div>
  </article>;
}

export default function MedicalControlClient({ user }: { user: { displayName: string; email: string } }) {
  const [data, setData] = useState<MedicalBootstrap | null>(null);
  const [devices, setDevices] = useState<ManagedDevice[]>([]);
  const [deviceAudit, setDeviceAudit] = useState<DeviceAudit[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [syncError, setSyncError] = useState("");
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [newPendingCount, setNewPendingCount] = useState(0);
  const [tab, setTab] = useState<TabId>("devices");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<DeviceFilter>("all");
  const [sort, setSort] = useState<DeviceSort>("priority");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [detailId, setDetailId] = useState<string | null>(null);
  const refreshing = useRef(false);
  const knownDeviceIds = useRef<Set<string>>(new Set());
  const initialized = useRef(false);

  async function refresh(options: { quiet?: boolean } = {}) {
    if (refreshing.current) return;
    refreshing.current = true;
    if (!options.quiet) setBusy(true);
    if (!options.quiet) setError("");
    try {
      const [medical, appDevices] = await Promise.all([
        signedControlPost<MedicalBootstrap>("/api/medicine/control", { action: "bootstrap" }),
        signedControlPost<DeviceBootstrap>("/api/apps/hoa-nhap-nga/control", { action: "bootstrap" }),
      ]);
      const incoming = appDevices.devices || [];
      if (initialized.current) {
        const newlyPending = incoming.filter((device) => device.status === "pending" && !knownDeviceIds.current.has(device.deviceId));
        if (newlyPending.length) setNewPendingCount((count) => count + newlyPending.length);
      }
      knownDeviceIds.current = new Set(incoming.map((device) => device.deviceId));
      initialized.current = true;
      setData(medical);
      setDevices(incoming);
      setDeviceAudit(appDevices.auditLog || []);
      setSelectedIds((current) => current.filter((id) => incoming.some((device) => device.deviceId === id)));
      setLastSyncAt(new Date().toISOString());
      setSyncError("");
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "Không thể tải dữ liệu quản trị Hòa nhập Nga.";
      if (options.quiet && data) setSyncError(message);
      else setError(message);
    } finally {
      refreshing.current = false;
      if (!options.quiet) setBusy(false);
    }
  }

  async function changeDevice(deviceId: string, action: "approve" | "block" | "pending") {
    if (action === "block" && !window.confirm("Khóa thiết bị này? Thiết bị sẽ không thể lấy phiên truy cập mới.")) return;
    setBusy(true);
    setError("");
    try {
      const next = await signedControlPost<DeviceActionResult>("/api/apps/hoa-nhap-nga/control", { action, deviceId });
      if (next.devices) setDevices(next.devices);
      if (next.auditLog) setDeviceAudit(next.auditLog);
      setLastSyncAt(new Date().toISOString());
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
      if (next.auditLog) setDeviceAudit(next.auditLog);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể đổi tên thiết bị.");
    } finally {
      setBusy(false);
    }
  }

  async function bulkAction(operation: BulkOperation) {
    if (!selectedIds.length) return;
    const label = operation === "approve" ? "cấp quyền" : operation === "block" ? "khóa" : "thu hồi tạm";
    if (!window.confirm(`Xác nhận ${label} cho ${selectedIds.length} thiết bị đã chọn?`)) return;
    setBusy(true);
    setError("");
    try {
      const next = await signedControlPost<DeviceActionResult>("/api/apps/hoa-nhap-nga/control", { action: "bulk", operation, deviceIds: selectedIds });
      if (next.devices) setDevices(next.devices);
      if (next.auditLog) setDeviceAudit(next.auditLog);
      setSelectedIds([]);
      setLastSyncAt(new Date().toISOString());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể cập nhật các thiết bị đã chọn.");
    } finally {
      setBusy(false);
    }
  }

  function toggleSelection(deviceId: string) {
    setSelectedIds((current) => current.includes(deviceId) ? current.filter((id) => id !== deviceId) : [...current, deviceId]);
  }

  function exportDevices(format: "json" | "csv") {
    const stamp = new Date().toISOString().slice(0, 10);
    if (format === "json") {
      downloadText(`hoa-nhap-nga-thiet-bi-${stamp}.json`, JSON.stringify({ exportedAt: new Date().toISOString(), devices }, null, 2), "application/json;charset=utf-8");
      return;
    }
    const header = ["Mã HN", "Tên", "Trạng thái", "Loại", "Hệ điều hành", "Trình duyệt", "Model", "Màn hình", "Đăng ký", "Lần cuối", "Duyệt bởi"];
    const rows = devices.map((device) => [device.deviceCode, device.label || "", statusLabel[device.status], deviceClassLabel[device.deviceClass], device.osName, device.browserName, device.modelHint || "", device.screen || "", device.createdAt, device.lastSeenAt, device.approvedBy || ""]);
    downloadText(`hoa-nhap-nga-thiet-bi-${stamp}.csv`, `\uFEFF${[header, ...rows].map((row) => row.map(csvCell).join(",")).join("\n")}`, "text/csv;charset=utf-8");
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void refresh(), 0);
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh({ quiet: true });
    }, 60_000);
    const onVisible = () => { if (document.visibilityState === "visible") void refresh({ quiet: true }); };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearTimeout(timer);
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  const filteredDevices = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("vi");
    const result = devices.filter((device) => {
      const filterMatch = filter === "all"
        || (filter === "online" ? device.active : filter === "unnamed" ? !device.label : device.status === filter);
      if (!filterMatch) return false;
      if (!normalized) return true;
      return [device.deviceCode, device.label, device.osName, device.browserName, device.modelHint, device.deviceClass]
        .filter(Boolean).join(" ").toLocaleLowerCase("vi").includes(normalized);
    });
    return result.sort((a, b) => {
      if (sort === "recent") return Date.parse(b.createdAt) - Date.parse(a.createdAt);
      if (sort === "lastSeen") return Date.parse(b.lastSeenAt) - Date.parse(a.lastSeenAt);
      if (sort === "name") return deviceTitle(a).localeCompare(deviceTitle(b), "vi");
      const priority = { pending: 0, approved: 1, blocked: 2 } as const;
      return priority[a.status] - priority[b.status] || Date.parse(b.createdAt) - Date.parse(a.createdAt);
    });
  }, [devices, filter, query, sort]);

  if (!data) return <main className="russia-loading"><div><span>HN</span><h1>{error || "Đang xác thực khu quản trị Hòa nhập Nga…"}</h1><a href="/">← QUẢN TRỊ ỨNG DỤNG</a></div></main>;

  const canGrant = ["publisher", "owner"].includes(data.actor.role);
  const pendingDevices = devices.filter((device) => device.status === "pending");
  const approvedDevices = devices.filter((device) => device.status === "approved");
  const blockedDevices = devices.filter((device) => device.status === "blocked");
  const onlineDevices = devices.filter((device) => device.active);
  const computerDevices = devices.filter((device) => device.deviceClass === "computer");
  const mobileDevices = devices.filter((device) => device.deviceClass === "phone" || device.deviceClass === "tablet");
  const unnamedDevices = devices.filter((device) => !device.label);
  const enabledRules = data.rules.filter((rule) => rule.enabled);
  const highRiskRules = enabledRules.filter((rule) => rule.level >= 4);
  const waitingReviews = data.reviews.filter((review) => ["pending", "needs_documents"].includes(review.status));
  const detailDevice = detailId ? devices.find((device) => device.deviceId === detailId) || null : null;
  const detailAudit = detailDevice ? deviceAudit.filter((entry) => entry.target.endsWith(detailDevice.deviceId)).slice(0, 12) : [];
  const allSelected = filteredDevices.length > 0 && filteredDevices.every((device) => selectedIds.includes(device.deviceId));

  const tabHeading: Record<TabId, { eyebrow: string; title: string; description: string }> = {
    devices: { eyebrow: "HÒA NHẬP NGA · QUẢN TRỊ", title: "Thiết bị và người dùng", description: "Kiểm soát thiết bị được phép vào Site Hòa nhập Nga. Site người dùng hoạt động riêng và không có màn hình đăng nhập trực tiếp; quyền được quyết định tại đây theo thiết bị HN." },
    access: { eyebrow: "HÒA NHẬP NGA · QUYỀN", title: "Quyền truy cập", description: "Duyệt, thu hồi hoặc khóa quyền theo từng thiết bị. Thiết bị quản trị và thiết bị Hòa nhập Nga là hai miền quyền độc lập." },
    content: { eyebrow: "HÒA NHẬP NGA · KIỂM DUYỆT", title: "Kiểm duyệt nội dung", description: "Theo dõi hàng đợi cần quyết định, trạng thái hồ sơ và điều phối sang Trung tâm kiểm duyệt chuyên sâu." },
    rules: { eyebrow: "HÒA NHẬP NGA · QUY TẮC", title: "Quy tắc và cảnh báo", description: "Tổng hợp bộ quy tắc đang bật, mức rủi ro và phiên bản dữ liệu dùng để kiểm duyệt nội dung liên quan đến Nga." },
    audit: { eyebrow: "HÒA NHẬP NGA · NHẬT KÝ", title: "Nhật ký hoạt động", description: "Theo dõi riêng thay đổi quyền thiết bị HN cùng nhật ký kiểm duyệt để truy vết đầy đủ thao tác quản trị." },
  };

  return <main className="russia-admin-shell">
    <aside className="russia-sidebar">
      <a className="russia-brand" href="/"><span>HN</span><div><small>QUẢN TRỊ ỨNG DỤNG</small><strong>Hòa nhập Nga</strong></div></a>
      <nav className="russia-nav" aria-label="Quản trị Hòa nhập Nga">
        {navItems.map((item) => <button key={item.id} className={tab === item.id ? "active" : ""} onClick={() => { setTab(item.id); if (item.id === "devices") setNewPendingCount(0); }}><i>{item.icon}</i><span><strong>{item.label}</strong><small>{item.note}</small></span>{item.id === "devices" && newPendingCount ? <b className="russia-nav-badge">{newPendingCount}</b> : null}</button>)}
      </nav>
      <div className="russia-sidebar-links"><span>LIÊN KẾT RÕ RÀNG</span><a href="/"><b>←</b><div><strong>Quản trị ứng dụng</strong><small>Điều phối các Site</small></div></a><a href="/system-control"><b>⚙</b><div><strong>Hệ thống dùng chung</strong><small>Tài khoản, quyền, nhật ký</small></div></a><a href={integrationRussiaSiteUrl} target="_blank" rel="noreferrer"><b>↗</b><div><strong>Mở Hòa nhập Nga</strong><small>Site người dùng độc lập</small></div></a></div>
      <div className="russia-account"><span>{user.displayName.slice(0, 1).toUpperCase()}</span><div><strong>{user.displayName}</strong><small>{roleLabel[data.actor.role]}</small><a href="/logout?return_to=/login">Đăng xuất</a></div></div>
    </aside>

    <section className="russia-workspace">
      <header className="russia-toolbar"><div className="russia-toolbar-links"><a href="/">← QUẢN TRỊ ỨNG DỤNG</a><a href="/system-control">Hệ thống dùng chung</a></div></header>
      <div className="russia-content">
        <section className="russia-page-head">
          <div><span>{tabHeading[tab].eyebrow}</span><h1>{tabHeading[tab].title}</h1><p>{tabHeading[tab].description}</p></div>
          <div className="russia-sync"><span title={syncError || "Tự động đồng bộ mỗi 60 giây"}><i className={syncError ? "has-error" : ""} /> {syncError ? "ĐỒNG BỘ LỖI" : "ĐÃ ĐỒNG BỘ · 60 GIÂY/LẦN"}<small>Lần cuối {formatShortTime(lastSyncAt)}</small></span><button onClick={() => void refresh()} disabled={busy}>{busy ? "Đang cập nhật…" : "Cập nhật thiết bị"}</button></div>
        </section>

        {error ? <div className="russia-alert">{error}</div> : null}
        {syncError ? <div className="russia-sync-warning">Không thể đồng bộ nền: {syncError}. Danh sách gần nhất vẫn được giữ nguyên.</div> : null}

        {tab === "devices" ? <>
          <section className="russia-stat-grid">
            <StatCard label="Tổng thiết bị" value={devices.length} note="Registry Hòa nhập Nga" />
            <StatCard label="Online" value={onlineDevices.length} note="Tín hiệu trong 5 phút" tone="good" />
            <StatCard label="Chờ cấp quyền" value={pendingDevices.length} note="Cần Publisher/Owner xử lý" tone="warn" />
            <StatCard label="Đã cấp quyền" value={approvedDevices.length} note="Có thể xác thực vào Site" tone="good" />
            <StatCard label="Máy tính" value={computerDevices.length} note="Windows · macOS · Linux…" />
            <StatCard label="Điện thoại / tablet" value={mobileDevices.length} note="Thiết bị di động đã nhận diện" />
            <StatCard label="Đã khóa" value={blockedDevices.length} note="Không thể lấy phiên mới" tone="danger" />
            <StatCard label="Chưa đặt tên" value={unnamedDevices.length} note="Nên đặt tên để dễ kiểm soát" tone={unnamedDevices.length ? "warn" : "default"} />
            <StatCard label="Kiểm duyệt chờ" value={waitingReviews.length} note="Nội dung cần quyết định" tone={waitingReviews.length ? "warn" : "default"} />
          </section>

          <section className="russia-inbox">
            <div className="russia-inbox-title"><span>HỘP VIỆC HÒA NHẬP NGA</span><strong>Ưu tiên những việc đang chờ quyết định</strong></div>
            <button onClick={() => { setFilter("pending"); setQuery(""); setNewPendingCount(0); }}><span>Thiết bị chờ duyệt</span><strong>{pendingDevices.length}</strong></button>
            <button onClick={() => { setFilter("unnamed"); setQuery(""); }}><span>Chưa đặt tên</span><strong>{unnamedDevices.length}</strong></button>
            <button onClick={() => setTab("content")}><span>Kiểm duyệt nội dung</span><strong>{waitingReviews.length}</strong></button>
            <button onClick={() => setTab("rules")}><span>Quy tắc mức cao</span><strong>{highRiskRules.length}</strong></button>
          </section>

          <section className="russia-device-panel">
            <div className="russia-panel-head"><div><span>TRA CỨU THIẾT BỊ HN</span><h2>Thiết bị mới được phát hiện tự động mỗi 60 giây</h2><p>Tìm theo mã HN, tên gợi nhớ, hệ điều hành, trình duyệt hoặc model. Danh sách gần nhất vẫn được giữ nếu lần đồng bộ tiếp theo thất bại.</p></div><div className="russia-search"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="HN-… / tên thiết bị / Windows / iPhone…"/><select value={filter} onChange={(event) => setFilter(event.target.value as DeviceFilter)}><option value="all">Tất cả</option><option value="pending">Chờ cấp quyền</option><option value="approved">Đã cấp quyền</option><option value="blocked">Đã khóa</option><option value="online">Đang online</option><option value="unnamed">Chưa đặt tên</option></select><select value={sort} onChange={(event) => setSort(event.target.value as DeviceSort)}><option value="priority">Ưu tiên xử lý</option><option value="recent">Đăng ký mới nhất</option><option value="lastSeen">Hoạt động gần nhất</option><option value="name">Theo tên</option></select></div></div>
            <div className="russia-result-summary"><span>Hiển thị <b>{filteredDevices.length}</b> / {devices.length} thiết bị</span><div><button onClick={() => exportDevices("csv")}>Xuất CSV</button><button onClick={() => exportDevices("json")}>Xuất JSON</button></div></div>

            <div className="russia-selection-bar">
              <label><input type="checkbox" checked={allSelected} onChange={() => setSelectedIds(allSelected ? selectedIds.filter((id) => !filteredDevices.some((device) => device.deviceId === id)) : [...new Set([...selectedIds, ...filteredDevices.map((device) => device.deviceId)])])} /> Chọn toàn bộ kết quả</label>
              <span>{selectedIds.length ? `Đã chọn ${selectedIds.length} thiết bị` : "Chưa chọn thiết bị"}</span>
              {selectedIds.length && canGrant ? <div><button className="approve" onClick={() => void bulkAction("approve")} disabled={busy}>Cấp quyền hàng loạt</button><button onClick={() => void bulkAction("pending")} disabled={busy}>Thu hồi tạm</button><button className="danger" onClick={() => void bulkAction("block")} disabled={busy}>Khóa hàng loạt</button></div> : null}
            </div>

            <div className="russia-device-list">{filteredDevices.length ? filteredDevices.map((device) => <DeviceCard key={device.deviceId} device={device} busy={busy} canGrant={canGrant} selected={selectedIds.includes(device.deviceId)} onToggle={toggleSelection} onDetail={setDetailId} onRename={(item) => void renameDevice(item)} onChange={(id, action) => void changeDevice(id, action)} />) : <div className="russia-empty">Không có thiết bị phù hợp với bộ lọc hiện tại.</div>}</div>
            {!canGrant ? <p className="russia-role-note">Tài khoản hiện tại chỉ được xem. Cấp/thu hồi quyền thiết bị cần Publisher hoặc Owner.</p> : null}
          </section>
        </> : null}

        {tab === "access" ? <>
          <section className="russia-stat-grid compact"><StatCard label="Chờ cấp quyền" value={pendingDevices.length} note="Yêu cầu mới" tone="warn" /><StatCard label="Đã cấp quyền" value={approvedDevices.length} note="Thiết bị hợp lệ" tone="good" /><StatCard label="Đã khóa" value={blockedDevices.length} note="Bị từ chối phiên mới" tone="danger" /><StatCard label="Online" value={onlineDevices.length} note="Có tín hiệu gần đây" tone="good" /></section>
          <section className="russia-policy-grid">
            <article><span>01</span><div><strong>Thiết bị tự đăng ký</strong><p>Hòa nhập Nga tạo khóa P-256 trên thiết bị và gửi khóa công khai về Site Quản trị. Trạng thái ban đầu luôn là chờ duyệt.</p></div></article>
            <article><span>02</span><div><strong>Duyệt tại Trung tâm</strong><p>Publisher/Owner quyết định cấp quyền, thu hồi tạm hoặc khóa. Không có màn hình đăng nhập trực tiếp trên Hòa nhập Nga.</p></div></article>
            <article><span>03</span><div><strong>Xác thực đúng thiết bị</strong><p>Thiết bị đã được duyệt phải ký challenge bằng khóa riêng cục bộ trước khi nhận access token ngắn hạn.</p></div></article>
            <article><span>04</span><div><strong>Ranh giới độc lập</strong><p>`control_devices` của Site Quản trị không thay thế `managed_app_devices` của Hòa nhập Nga. Hai miền quyền không kế thừa lẫn nhau.</p></div></article>
          </section>
          <section className="russia-device-panel"><div className="russia-panel-head"><div><span>HÀNG ĐỢI CẤP QUYỀN</span><h2>{pendingDevices.length ? `${pendingDevices.length} thiết bị đang chờ quyết định` : "Không có thiết bị chờ duyệt"}</h2><p>Chỉ cấp quyền sau khi xem chi tiết loại máy, hệ điều hành, trình duyệt và thời điểm đăng ký.</p></div></div><div className="russia-device-list">{pendingDevices.length ? pendingDevices.map((device) => <DeviceCard key={device.deviceId} device={device} busy={busy} canGrant={canGrant} selected={selectedIds.includes(device.deviceId)} onToggle={toggleSelection} onDetail={setDetailId} onRename={(item) => void renameDevice(item)} onChange={(id, action) => void changeDevice(id, action)} />) : <div className="russia-empty">Hàng đợi hiện trống.</div>}</div></section>
        </> : null}

        {tab === "content" ? <>
          <section className="russia-stat-grid compact"><StatCard label="Tổng hồ sơ" value={data.stats.total} note="Đã ghi nhận" /><StatCard label="Đang chờ" value={data.stats.pending} note="Cần kiểm duyệt" tone="warn" /><StatCard label="Cần bổ sung" value={data.stats.needsDocuments} note="Thiếu căn cứ/hồ sơ" tone="warn" /><StatCard label="Đã xử lý" value={data.stats.resolved} note="Đã có quyết định" tone="good" /></section>
          <section className="russia-review-panel"><div><span>TRUNG TÂM KIỂM DUYỆT</span><h2>Quyết định nội dung tách khỏi quyền thiết bị</h2><p>Quyền vào Site Hòa nhập Nga và việc duyệt nội dung là hai quy trình khác nhau. Thiết bị được phép truy cập không đồng nghĩa được phép xuất bản hoặc sửa nội dung máy chủ.</p><a href="/medicine-control">Mở Trung tâm kiểm duyệt →</a></div><aside><small>Bộ dữ liệu</small><strong>{data.meta.version}</strong><span>{data.meta.jurisdiction}</span><span>Cập nhật {data.meta.updatedAt}</span></aside></section>
          <section className="russia-list-panel"><header><span>HỒ SƠ GẦN ĐÂY</span><h2>{data.reviews.length} hồ sơ trong dữ liệu hiện tại</h2></header><div className="russia-simple-list">{data.reviews.slice(0, 20).map((review) => <article key={review.id}><div><strong>{review.id}</strong><small>{formatTime(review.createdAt)}</small></div><span className={`review-${review.status}`}>{review.status}</span></article>)}{!data.reviews.length ? <div className="russia-empty">Chưa có hồ sơ kiểm duyệt.</div> : null}</div></section>
        </> : null}

        {tab === "rules" ? <>
          <section className="russia-stat-grid compact"><StatCard label="Tổng quy tắc" value={data.rules.length} note="Trong bộ dữ liệu" /><StatCard label="Đang bật" value={enabledRules.length} note="Được áp dụng" tone="good" /><StatCard label="Mức 4–5" value={highRiskRules.length} note="Cảnh báo cao" tone={highRiskRules.length ? "warn" : "default"} /><StatCard label="Phiên bản" value={data.meta.version} note={data.meta.updatedAt} /></section>
          <section className="russia-list-panel"><header><span>BỘ QUY TẮC</span><h2>Phân tầng cảnh báo đang áp dụng</h2><p>Quản trị chi tiết và xuất bản quy tắc được thực hiện trong Trung tâm kiểm duyệt.</p></header><div className="russia-rule-grid">{data.rules.map((rule) => <article key={rule.id} className={rule.enabled ? "" : "disabled"}><div><strong>{rule.id}</strong><span>MỨC {rule.level}</span></div><small>{rule.enabled ? "Đang bật" : "Đã tắt"}</small></article>)}</div><a className="russia-panel-link" href="/medicine-control">Quản trị quy tắc chi tiết →</a></section>
        </> : null}

        {tab === "audit" ? <>
          <section className="russia-stat-grid compact"><StatCard label="Nhật ký thiết bị HN" value={deviceAudit.length} note="Cấp quyền · khóa · đặt tên" /><StatCard label="Nhật ký kiểm duyệt" value={data.auditLog.length} note="Nội dung và quy tắc" /><StatCard label="Thiết bị đã cấp" value={approvedDevices.length} note="Registry hiện tại" tone="good" /><StatCard label="Thiết bị đã khóa" value={blockedDevices.length} note="Registry hiện tại" tone="danger" /></section>
          <section className="russia-list-panel"><header><span>NHẬT KÝ THIẾT BỊ HN</span><h2>Thao tác quyền được lưu riêng theo thiết bị</h2></header><div className="russia-audit-list">{deviceAudit.map((entry) => <article key={`device-${entry.id}`}><div><strong>{entry.action}</strong><small>{entry.actor} · {formatTime(entry.createdAt)}</small></div><span>{entry.target.replace("hoa-nhap-nga:", "").slice(0, 12)}…</span></article>)}{!deviceAudit.length ? <div className="russia-empty">Chưa có thay đổi quyền thiết bị.</div> : null}</div></section>
          <section className="russia-list-panel"><header><span>NHẬT KÝ KIỂM DUYỆT</span><h2>Hoạt động nội dung và quy tắc</h2></header><div className="russia-audit-list">{data.auditLog.slice(0, 60).map((entry) => <article key={`medical-${entry.id}`}><div><strong>{entry.action}</strong><small>{entry.actor} · {formatTime(entry.createdAt)}</small></div><span>{entry.target || "Y tế"}</span></article>)}{!data.auditLog.length ? <div className="russia-empty">Tài khoản hiện tại không có nhật ký kiểm duyệt hoặc chưa phát sinh thao tác.</div> : null}</div></section>
        </> : null}
      </div>
    </section>

    {detailDevice ? <div className="russia-detail-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setDetailId(null); }}><aside className="russia-detail-drawer">
      <header><div><span>CHI TIẾT THIẾT BỊ HN</span><h2>{deviceTitle(detailDevice)}</h2><p>{detailDevice.deviceCode}</p></div><button onClick={() => setDetailId(null)} aria-label="Đóng">×</button></header>
      <section className="russia-detail-status"><span className={`status-${detailDevice.status}`}>{statusLabel[detailDevice.status]}</span>{detailDevice.active ? <b>ONLINE</b> : <small>Offline · lần cuối {formatTime(detailDevice.lastSeenAt)}</small>}</section>
      <dl><div><dt>Loại thiết bị</dt><dd>{deviceClassLabel[detailDevice.deviceClass]}</dd></div><div><dt>Hệ điều hành</dt><dd>{detailDevice.osName}</dd></div><div><dt>Trình duyệt</dt><dd>{detailDevice.browserName}</dd></div><div><dt>Model nhận diện</dt><dd>{detailDevice.modelHint || "Không xác định"}</dd></div><div><dt>Màn hình</dt><dd>{detailDevice.screen || "Không có dữ liệu"}</dd></div><div><dt>Đăng ký</dt><dd>{formatTime(detailDevice.createdAt)}</dd></div><div><dt>Được duyệt</dt><dd>{formatTime(detailDevice.approvedAt)}</dd></div><div><dt>Người duyệt</dt><dd>{detailDevice.approvedBy || "Chưa có"}</dd></div><div><dt>Fingerprint khóa</dt><dd className="fingerprint">{detailDevice.deviceId}</dd></div></dl>
      <div className="russia-detail-actions"><button onClick={() => navigator.clipboard?.writeText(detailDevice.deviceCode)}>Sao chép mã HN</button><button onClick={() => void renameDevice(detailDevice)} disabled={!canGrant || busy}>Đặt tên</button>{detailDevice.status !== "approved" ? <button className="approve" onClick={() => void changeDevice(detailDevice.deviceId, "approve")} disabled={!canGrant || busy}>Cấp quyền</button> : <button onClick={() => void changeDevice(detailDevice.deviceId, "pending")} disabled={!canGrant || busy}>Thu hồi tạm</button>}{detailDevice.status !== "blocked" ? <button className="danger" onClick={() => void changeDevice(detailDevice.deviceId, "block")} disabled={!canGrant || busy}>Khóa</button> : <button onClick={() => void changeDevice(detailDevice.deviceId, "pending")} disabled={!canGrant || busy}>Bỏ khóa</button>}</div>
      <section className="russia-detail-audit"><span>LỊCH SỬ THIẾT BỊ</span>{detailAudit.length ? detailAudit.map((entry) => <article key={entry.id}><strong>{entry.action}</strong><small>{entry.actor} · {formatTime(entry.createdAt)}</small></article>) : <p>Chưa có thay đổi quyền được ghi nhận.</p>}</section>
    </aside></div> : null}
  </main>;
}
