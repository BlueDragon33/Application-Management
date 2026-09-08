"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { applicationRegistry, type ApplicationConfig } from "./application-registry";
import {
  centerAdminAction,
  connectAdminCenter,
  connectOperationsDashboard,
  roleLabels,
  type AdminAccess,
  type CenterBootstrap,
  type ControlAdminDevice,
  type ControlRole,
  type OperationsBootstrap,
  type OperationsDevice,
  type OperationsSummary,
  type OperationsWorkItem,
} from "./admin-device-client";
import styles from "./center-admin.module.css";

type CenterView = "overview" | "inbox" | "applications" | "client-devices" | "alerts" | "devices" | "audit" | "settings";
type DeviceFilter = "all" | OperationsDevice["deviceType"];
type TimeFilter = "all" | "1" | "7" | "30";
type IconName = "home" | "inbox" | "apps" | "device" | "alert" | "audit" | "settings" | "search" | "filter" | "bell" | "cube" | "calendar" | "chevron" | "refresh" | "shield" | "laptop" | "phone" | "tablet" | "clock" | "file" | "wifi";

const deviceStatusLabels = { pending: "Chờ duyệt", approved: "Đã cấp quyền", blocked: "Đã khóa" } as const;
const memberStatusLabels = { active: "Tài khoản hoạt động", inactive: "Đã thu hồi tài khoản", unregistered: "Chưa cấp tài khoản" } as const;
const contractLabels = { connected: "Đã kết nối", migrating: "Đang hoàn thiện", pending: "Chưa nối backend" } as const;
const auditLabels: Record<string, string> = {
  control_device_approved: "Cấp quyền thiết bị quản trị",
  control_device_blocked: "Khóa thiết bị quản trị",
  control_member_deactivated: "Thu hồi tài khoản quản trị",
  control_member_deleted: "Xóa tài khoản quản trị",
};

const viewTitles: Record<CenterView, { title: string; description: string }> = {
  overview: { title: "Bảng điều phối quản trị ứng dụng", description: "Kiểm soát tập trung các client độc lập, cảnh báo thiết bị mới và điều phối kiểm duyệt theo từng ứng dụng." },
  inbox: { title: "Hộp việc ưu tiên", description: "Tập trung sự kiện cần chú ý từ từng client và mở đúng nơi sở hữu dữ liệu để xử lý." },
  applications: { title: "Ứng dụng đang quản lý", description: "Theo dõi trạng thái kết nối, hàng đợi và thiết bị online của từng client cấp 1." },
  "client-devices": { title: "Thiết bị mới theo ứng dụng", description: "Thiết bị được đọc từ registry của client sở hữu; Trung tâm không sao chép dữ liệu thiết bị." },
  alerts: { title: "Cảnh báo vận hành", description: "Ưu tiên mất kết nối, thay đổi môi trường thiết bị và sự kiện cần can thiệp nhanh." },
  devices: { title: "Thiết bị quản trị Trung tâm", description: "Chỉ quản lý thiết bị QT của Application Management, tách khỏi thiết bị người dùng trong các client." },
  audit: { title: "Nhật ký hệ thống", description: "Theo dõi thay đổi quyền và bảo mật của control-plane; audit nghiệp vụ vẫn thuộc từng client." },
  settings: { title: "Cấu hình & ranh giới", description: "Kiểm tra topology, contract và nguyên tắc sở hữu dữ liệu trước khi bật thêm năng lực quản trị." },
};

function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  const common = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
  if (name === "home") return <svg {...common}><path d="m3 11 9-8 9 8"/><path d="M5 10v10h5v-6h4v6h5V10"/></svg>;
  if (name === "inbox") return <svg {...common}><path d="M4 5h16l1 13H3L4 5Z"/><path d="M3 14h5l2 3h4l2-3h5"/></svg>;
  if (name === "apps") return <svg {...common}><rect x="3" y="3" width="6" height="6" rx="1"/><rect x="15" y="3" width="6" height="6" rx="1"/><rect x="3" y="15" width="6" height="6" rx="1"/><rect x="15" y="15" width="6" height="6" rx="1"/></svg>;
  if (name === "device") return <svg {...common}><rect x="5" y="2.5" width="14" height="19" rx="2"/><path d="M10 18.5h4"/></svg>;
  if (name === "alert") return <svg {...common}><path d="M10.3 3.8 2.7 17a2 2 0 0 0 1.7 3h15.2a2 2 0 0 0 1.7-3L13.7 3.8a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/></svg>;
  if (name === "audit" || name === "file") return <svg {...common}><path d="M6 2.5h8l4 4V21H6z"/><path d="M14 2.5V7h4M9 11h6M9 15h6"/></svg>;
  if (name === "settings") return <svg {...common}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.6v-.2h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z"/></svg>;
  if (name === "search") return <svg {...common}><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>;
  if (name === "filter") return <svg {...common}><path d="M4 5h16l-6 7v6l-4 2v-8L4 5Z"/></svg>;
  if (name === "bell") return <svg {...common}><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></svg>;
  if (name === "cube") return <svg {...common}><path d="m12 2 9 5-9 5-9-5 9-5Z"/><path d="m3 7 9 5 9-5M3 7v10l9 5 9-5V7M12 12v10"/></svg>;
  if (name === "calendar") return <svg {...common}><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/></svg>;
  if (name === "chevron") return <svg {...common}><path d="m9 6 6 6-6 6"/></svg>;
  if (name === "refresh") return <svg {...common}><path d="M20 6v5h-5M4 18v-5h5"/><path d="M18 9a7 7 0 0 0-12-2L4 11M6 15a7 7 0 0 0 12 2l2-4"/></svg>;
  if (name === "shield") return <svg {...common}><path d="M12 2 4.5 5v6c0 5 3 8.5 7.5 11 4.5-2.5 7.5-6 7.5-11V5L12 2Z"/><path d="m9 12 2 2 4-5"/></svg>;
  if (name === "laptop") return <svg {...common}><rect x="4" y="4" width="16" height="12" rx="1"/><path d="M2 19h20"/></svg>;
  if (name === "phone") return <svg {...common}><rect x="7" y="2" width="10" height="20" rx="2"/><path d="M11 18h2"/></svg>;
  if (name === "tablet") return <svg {...common}><rect x="5" y="2" width="14" height="20" rx="2"/><path d="M11 18h2"/></svg>;
  if (name === "clock") return <svg {...common}><circle cx="12" cy="12" r="9"/><path d="M12 7v6l4 2"/></svg>;
  return <svg {...common}><path d="M4 8a10 10 0 0 1 16 0M7 11a6 6 0 0 1 10 0M10 14a2 2 0 0 1 4 0M12 19h.01"/></svg>;
}

function formatTime(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(date);
}

function relativeTime(value: string | null | undefined) {
  if (!value) return "—";
  const time = Date.parse(value);
  if (!Number.isFinite(time)) return "—";
  const minutes = Math.max(0, Math.floor((Date.now() - time) / 60_000));
  if (minutes < 1) return "Vừa xong";
  if (minutes < 60) return `${minutes} phút trước`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} giờ trước`;
  return `${Math.floor(hours / 24)} ngày trước`;
}

function formatDate(value: Date | null) {
  if (!value) return "Đang cập nhật ngày giờ";
  return new Intl.DateTimeFormat("vi-VN", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(value);
}

function formatClock(value: Date | null) {
  return value ? new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(value) : "--:--:--";
}

function appDomain(application: ApplicationConfig) {
  if (application.id === "health-care") return { group: "Y tế", boundary: "Kiểm duyệt y tế · quy tắc y khoa · audit y tế" };
  if (application.id === "ru-life") return { group: "Nga", boundary: "Kiểm duyệt Nga · OCR thuốc · thiết bị HN · audit Nga" };
  if (application.id === "boi-ech") return { group: "Học tập", boundary: "Thiết bị học · tiến độ · AI · thanh toán · duyệt sửa" };
  if (application.id === "bauman-master-ai") return { group: "Học thuật", boundary: "Bauman Hub · sub-client môn học · contract BM" };
  return { group: "Gia đình", boundary: "Phát triển 3–18 · privacy-first · contract GU" };
}

function applicationFor(id: string) {
  return applicationRegistry.find((application) => application.id === id);
}

function AppBadge({ appId, initials }: { appId: string; initials: string }) {
  return <b className={styles.appBadge} data-app={appId}>{initials}</b>;
}

function DeviceTypeIcon({ type }: { type: OperationsDevice["deviceType"] }) {
  return <Icon name={type === "phone" ? "phone" : type === "tablet" ? "tablet" : "laptop"} size={17}/>;
}

function Gate({ access, busy, error, retry }: { access: AdminAccess | null; busy: boolean; error: string; retry: () => void }) {
  return <main className={styles.gateShell}><section className={styles.gateCard}>
    <div className={styles.gateMark}>QT</div><span className={styles.eyebrow}>SECURE CONTROL PLANE</span>
    <h1>{access?.status === "pending" ? "Thiết bị quản trị đang chờ cấp quyền." : access?.status === "blocked" ? "Thiết bị quản trị đã bị khóa." : "Đang xác thực thiết bị quản trị…"}</h1>
    <p>{error || "Mỗi máy quản trị dùng khóa P-256 riêng. Trung tâm chỉ mở sau khi thiết bị và tài khoản đều được cấp quyền."}</p>
    {access?.deviceCode ? <div className={styles.gateCode}><span>Mã thiết bị</span><strong>{access.deviceCode}</strong></div> : null}
    <button className={styles.primaryButton} onClick={retry} disabled={busy}>{busy ? "Đang xác thực…" : "Kiểm tra lại quyền"}</button>
  </section></main>;
}

function SectionHeader({ icon, title, meta, action }: { icon: IconName; title: string; meta?: string; action?: React.ReactNode }) {
  return <header className={styles.sectionHeader}><div><span className={styles.sectionIcon}><Icon name={icon} size={21}/></span><h2>{title}</h2>{meta ? <span className={styles.sectionMeta}>{meta}</span> : null}</div>{action}</header>;
}

function LoadingRows({ count = 4 }: { count?: number }) {
  return <div className={styles.loadingRows}>{Array.from({ length: count }, (_, index) => <i key={index}/>)}</div>;
}

function StatusDot({ state }: { state: OperationsSummary["connection"] }) {
  return <span className={styles.connectionState} data-state={state}><i/>{state === "connected" ? "Kết nối tốt" : state === "pending" ? "Chờ backend" : state === "unavailable" ? "Mất kết nối" : "Có cảnh báo"}</span>;
}

function matchesApp(appId: string, appFilter: string) {
  return appFilter === "all" || appId === appFilter;
}

function withinTimeRange(value: string | null | undefined, timeFilter: TimeFilter) {
  if (timeFilter === "all") return true;
  if (!value) return false;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && Date.now() - parsed <= Number(timeFilter) * 86_400_000;
}

function WorkTable({ items, loading, search, appFilter = "all", limit = 20 }: { items: OperationsWorkItem[]; loading: boolean; search: string; appFilter?: string; limit?: number }) {
  const normalized = search.trim().toLowerCase();
  const visible = items.filter((item) => matchesApp(item.appId, appFilter) && (!normalized || `${item.appName} ${item.title} ${item.detail} ${item.deviceType}`.toLowerCase().includes(normalized)));
  if (loading) return <LoadingRows/>;
  if (!visible.length) return <div className={styles.emptyState}>Không có việc phù hợp với bộ lọc hiện tại.</div>;
  return <div className={styles.workTable}>
    <div className={styles.tableHead}><span>Ứng dụng</span><span>Sự kiện</span><span>Thiết bị</span><span>Thời gian</span><span>Trạng thái</span><span>Thao tác</span></div>
    {visible.slice(0, limit).map((item) => {
      const application = applicationFor(item.appId);
      return <article key={item.id} className={styles.workRow}>
        <div className={styles.appCell}><AppBadge appId={item.appId} initials={application?.initials ?? "AP"}/><strong>{item.appName}</strong></div>
        <div><strong>{item.title}</strong><small>{item.detail}</small></div>
        <span>{item.deviceType}</span><span>{relativeTime(item.occurredAt)}</span>
        <span className={styles.priority} data-priority={item.priority}>{item.priority === "high" ? "Ưu tiên cao" : item.kind === "device" ? "Chờ duyệt" : "Theo dõi"}</span>
        <Link href={item.href} className={styles.rowAction}>Xem</Link>
      </article>;
    })}
  </div>;
}

function DeviceFilters({ appFilter, setAppFilter, deviceFilter, setDeviceFilter, timeFilter, setTimeFilter }: {
  appFilter: string; setAppFilter: (value: string) => void; deviceFilter: DeviceFilter; setDeviceFilter: (value: DeviceFilter) => void; timeFilter: TimeFilter; setTimeFilter: (value: TimeFilter) => void;
}) {
  return <div className={styles.deviceFilters} aria-label="Bộ lọc thiết bị">
    <label><span className={styles.srOnly}>Ứng dụng</span><select value={appFilter} onChange={(event) => setAppFilter(event.target.value)}><option value="all">Tất cả ứng dụng</option>{applicationRegistry.map((application) => <option key={application.id} value={application.id}>{application.shortName}</option>)}</select></label>
    <label><span className={styles.srOnly}>Loại thiết bị</span><select value={deviceFilter} onChange={(event) => setDeviceFilter(event.target.value as DeviceFilter)}><option value="all">Tất cả thiết bị</option><option value="desktop">Máy tính</option><option value="tablet">Tablet / iPad</option><option value="phone">Điện thoại</option><option value="unknown">Chưa phân loại</option></select></label>
    <label><span className={styles.srOnly}>Khoảng thời gian</span><select value={timeFilter} onChange={(event) => setTimeFilter(event.target.value as TimeFilter)}><option value="7">Thời gian: 7 ngày</option><option value="1">Thời gian: 24 giờ</option><option value="30">Thời gian: 30 ngày</option><option value="all">Mọi thời gian</option></select></label>
  </div>;
}

function ClientDeviceTable({ devices, loading, appFilter, deviceFilter, timeFilter, search, limit = 24 }: { devices: OperationsDevice[]; loading: boolean; appFilter: string; deviceFilter: DeviceFilter; timeFilter: TimeFilter; search: string; limit?: number }) {
  const normalized = search.trim().toLowerCase();
  const visible = devices.filter((device) => {
    const relevantTime = device.attention === "environment" ? device.lastSeenAt ?? device.createdAt : device.createdAt ?? device.lastSeenAt;
    return (device.status === "pending" || device.attention === "environment")
      && matchesApp(device.appId, appFilter)
      && (deviceFilter === "all" || device.deviceType === deviceFilter)
      && withinTimeRange(relevantTime, timeFilter)
      && (!normalized || `${device.appName} ${device.deviceCode} ${device.userLabel} ${device.deviceTypeLabel}`.toLowerCase().includes(normalized));
  });
  if (loading) return <LoadingRows/>;
  if (!visible.length) return <div className={styles.emptyState}>Không có thiết bị mới/cảnh báo trong phạm vi đang chọn.</div>;
  return <div className={styles.clientDeviceTable}>
    <div className={styles.deviceTableHead}><span>Ứng dụng</span><span>Thiết bị</span><span>Người dùng</span><span>Thời gian</span><span>Thao tác</span></div>
    {visible.slice(0, limit).map((device) => {
      const application = applicationFor(device.appId);
      return <article key={`${device.appId}:${device.deviceId}`} className={styles.clientDeviceRow}>
        <div className={styles.appCell}><AppBadge appId={device.appId} initials={application?.initials ?? "AP"}/><strong>{device.appName}</strong></div>
        <div className={styles.deviceKind}><DeviceTypeIcon type={device.deviceType}/><span>{device.deviceTypeLabel}</span></div>
        <div><strong>{device.userLabel}</strong><small>{device.deviceCode}</small></div>
        <span>{relativeTime(device.createdAt ?? device.lastSeenAt)}</span>
        <Link href={device.href} className={styles.rowAction}>{device.attention === "environment" ? "Kiểm tra" : "Duyệt"}</Link>
      </article>;
    })}
  </div>;
}

function ApplicationTable({ summaries, loading, search, appFilter }: { summaries: OperationsSummary[]; loading: boolean; search: string; appFilter: string }) {
  const normalized = search.trim().toLowerCase();
  const map = new Map(summaries.map((item) => [item.appId, item]));
  const apps = applicationRegistry.filter((application) => {
    const summary = map.get(application.id);
    const domain = appDomain(application);
    const haystack = `${application.name} ${application.shortName} ${application.repository} ${domain.group} ${domain.boundary} ${summary?.note ?? ""}`.toLowerCase();
    return matchesApp(application.id, appFilter) && (!normalized || haystack.includes(normalized));
  });
  return <div className={styles.applicationTable}>
    <div className={styles.applicationHead}><span>Ứng dụng</span><span>Nhóm nghiệp vụ</span><span>Việc chờ xử lý</span><span>Thiết bị online</span><span>Trạng thái</span><span>Thao tác</span></div>
    {apps.map((application) => {
      const summary = map.get(application.id);
      const domain = appDomain(application);
      const pending = loading ? "…" : summary?.pendingCount ?? "—";
      const online = loading ? "…" : summary?.onlineCount ?? "—";
      const connection: OperationsSummary["connection"] = summary?.connection ?? (application.contractState === "pending" ? "pending" : "warning");
      return <article key={application.id} className={styles.applicationRow}>
        <div className={styles.appCell}><AppBadge appId={application.id} initials={application.initials}/><div><strong>{application.shortName}</strong><small>{domain.boundary}</small></div></div>
        <span>{domain.group}</span><strong data-count={typeof pending === "number" && pending > 0 ? "attention" : "normal"}>{pending}</strong><strong>{online}</strong>
        <StatusDot state={connection}/><Link href={application.href} className={styles.manageButton}>Vào quản trị →</Link>
      </article>;
    })}
    {!apps.length ? <div className={styles.emptyState}>Không tìm thấy ứng dụng phù hợp.</div> : null}
  </div>;
}

function DeviceRow({ device, actor, role, busy, run }: {
  device: ControlAdminDevice; actor: AdminAccess; role: ControlRole; busy: string;
  run: (device: ControlAdminDevice, operation: "approve" | "block" | "deactivate-member" | "delete-member", selectedRole?: "reviewer" | "publisher") => void;
}) {
  const [approvalRole, setApprovalRole] = useState<"reviewer" | "publisher">(device.role === "publisher" ? "publisher" : "reviewer");
  const protectedDevice = device.owner || device.deviceId === actor.deviceId;
  const isBusy = busy === device.deviceId;
  return <article className={styles.adminDeviceRow} data-status={device.status}>
    <span className={styles.presence} data-online={device.active ? "true" : "false"}/>
    <div><strong>{device.displayName || device.email}</strong><small>{device.email}</small><code>{device.deviceCode}</code></div>
    <div><span>Trạng thái</span><strong>{deviceStatusLabels[device.status]}</strong><small>{memberStatusLabels[device.memberStatus]}</small></div>
    <div><span>Vai trò</span><strong>{roleLabels[device.role]}</strong><small>{device.active ? "Đang trực tuyến" : formatTime(device.lastSeenAt)}</small></div>
    <div className={styles.adminDeviceActions}>{protectedDevice ? <span className={styles.protected}>Owner · được bảo vệ</span> : device.status === "pending" ? <>
      <select value={approvalRole} onChange={(event) => setApprovalRole(event.target.value as "reviewer" | "publisher")} disabled={isBusy || role !== "owner"}><option value="reviewer">Kiểm duyệt viên</option><option value="publisher">Người xuất bản</option></select>
      <button disabled={isBusy || role !== "owner"} onClick={() => run(device, "approve", approvalRole)}>Cấp quyền</button><button className={styles.dangerButton} disabled={isBusy || role !== "owner"} onClick={() => run(device, "block")}>Từ chối</button>
    </> : device.memberStatus === "inactive" ? <button className={styles.dangerButton} disabled={isBusy || role !== "owner"} onClick={() => run(device, "delete-member")}>Xóa tài khoản</button> : <><button disabled={isBusy || role !== "owner" || device.status === "blocked"} onClick={() => run(device, "block")}>Khóa máy</button><button className={styles.dangerButton} disabled={isBusy || role !== "owner"} onClick={() => run(device, "deactivate-member")}>Thu hồi</button></>}</div>
  </article>;
}

export default function ApplicationHub({ user }: { user: { displayName: string; email: string } }) {
  const [access, setAccess] = useState<AdminAccess | null>(null);
  const [bootstrap, setBootstrap] = useState<CenterBootstrap | null>(null);
  const [operations, setOperations] = useState<OperationsBootstrap | null>(null);
  const [view, setView] = useState<CenterView>("overview");
  const [busy, setBusy] = useState(true);
  const [operationsBusy, setOperationsBusy] = useState(false);
  const [actionBusy, setActionBusy] = useState("");
  const [error, setError] = useState("");
  const [operationsError, setOperationsError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [appFilter, setAppFilter] = useState("all");
  const [deviceFilter, setDeviceFilter] = useState<DeviceFilter>("all");
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("7");
  const [now, setNow] = useState<Date | null>(null);

  async function refreshOperations() {
    setOperationsBusy(true); setOperationsError("");
    try {
      const result = await connectOperationsDashboard();
      if (result.bootstrap) setOperations(result.bootstrap);
    } catch (caught) {
      setOperationsError(caught instanceof Error ? caught.message : "Không thể đồng bộ trạng thái các client.");
    } finally { setOperationsBusy(false); }
  }

  async function initialize() {
    setBusy(true); setError("");
    try {
      const result = await connectAdminCenter();
      setAccess(result.access); setBootstrap(result.bootstrap);
      if (result.bootstrap) void refreshOperations();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không thể mở Trung tâm quản trị.");
    } finally { setBusy(false); }
  }

  useEffect(() => {
    const start = window.setTimeout(() => {
      const requested = new URLSearchParams(window.location.search).get("view");
      const valid: CenterView[] = ["overview", "inbox", "applications", "client-devices", "alerts", "devices", "audit", "settings"];
      if (requested && valid.includes(requested as CenterView)) setView(requested as CenterView);
      if (requested === "topology") setView("settings");
      setNow(new Date());
      void initialize();
    }, 0);
    const clock = window.setInterval(() => setNow(new Date()), 1_000);
    return () => { window.clearTimeout(start); window.clearInterval(clock); };
    // The first connection is intentionally tied to the mounted control-plane shell.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function switchView(next: CenterView) {
    setView(next);
    window.history.replaceState(null, "", next === "overview" ? "/" : `/?view=${next}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const centralCounts = useMemo(() => {
    const devices = bootstrap?.controlDevices ?? [];
    return { total: devices.length, pending: devices.filter((item) => item.status === "pending").length, online: devices.filter((item) => item.active).length };
  }, [bootstrap?.controlDevices]);

  const operational = operations?.metrics;
  const notificationCount = (operational?.pendingDevices ?? 0) + (operational?.alerts ?? 0) + centralCounts.pending;
  const summaryById = useMemo(() => new Map((operations?.summaries ?? []).map((item) => [item.appId, item])), [operations]);
  const highAlerts = useMemo(() => (operations?.workItems ?? []).filter((item) => item.priority === "high"), [operations]);
  const unavailableCount = operations?.summaries.filter((item) => item.connection === "unavailable").length ?? 0;
  const environmentCount = operations?.devices.filter((item) => item.attention === "environment").length ?? 0;
  const systemState = operationsBusy && !operations ? "syncing" : operationsError || unavailableCount ? "warning" : "healthy";

  async function manageDevice(device: ControlAdminDevice, operation: "approve" | "block" | "deactivate-member" | "delete-member", selectedRole?: "reviewer" | "publisher") {
    if (!bootstrap || !access || access.role !== "owner") return;
    if (operation === "deactivate-member" && !window.confirm(`Thu hồi toàn bộ quyền quản trị của ${device.email}?`)) return;
    if (operation === "delete-member") {
      const confirmation = window.prompt(`Nhập chính xác email để xóa tài khoản đã thu hồi:\n${device.email}`);
      if (confirmation?.trim().toLowerCase() !== device.email.toLowerCase()) { setNotice("Đã hủy xóa vì chuỗi xác nhận không khớp."); return; }
    }
    setActionBusy(device.deviceId); setNotice("");
    try {
      const result = await centerAdminAction({ action: "manage-control-device", operation, targetDeviceId: device.deviceId, role: selectedRole, displayName: device.displayName });
      setBootstrap((current) => current ? { ...current, controlDevices: result.controlDevices ?? current.controlDevices, auditLog: result.auditLog ?? current.auditLog } : current);
      setNotice("Đã cập nhật quyền thiết bị quản trị.");
    } catch (caught) { setNotice(caught instanceof Error ? caught.message : "Không thể cập nhật thiết bị quản trị."); }
    finally { setActionBusy(""); }
  }

  if (!access || access.status !== "approved" || !bootstrap) return <Gate access={access} busy={busy} error={error} retry={() => void initialize()}/>;

  const role = access.role;
  const canSeeAdminDevices = role === "owner";
  const canSeeAudit = role === "publisher" || role === "owner";
  const title = viewTitles[view];
  const workItems = operations?.workItems ?? [];
  const devices = operations?.devices ?? [];

  const navItems: Array<{ view: CenterView; label: string; icon: IconName; count?: number }> = [
    { view: "overview", label: "Tổng quan", icon: "home" },
    { view: "inbox", label: "Hộp việc", icon: "inbox", count: operational?.workItems },
    { view: "applications", label: "Ứng dụng", icon: "apps" },
    { view: "client-devices", label: "Thiết bị mới", icon: "device", count: operational?.pendingDevices },
    { view: "alerts", label: "Cảnh báo", icon: "alert", count: operational?.alerts },
    ...(canSeeAudit ? [{ view: "audit" as const, label: "Nhật ký", icon: "audit" as const }] : []),
    { view: "settings", label: "Cấu hình", icon: "settings" },
  ];

  return <main className={styles.shell}>
    <aside className={styles.sidebar}>
      <div className={styles.brand}><div className={styles.brandMark}>QT</div><div><span>TRUNG TÂM ĐIỀU PHỐI</span><strong>QUẢN TRỊ ỨNG DỤNG</strong></div></div>
      <nav className={styles.nav} aria-label="Điều hướng quản trị">{navItems.map((item) => <button key={item.view} data-active={view === item.view || (item.view === "settings" && view === "devices")} onClick={() => switchView(item.view)} title={item.label}><i><Icon name={item.icon} size={22}/></i><strong>{item.label}</strong>{item.count ? <b>{item.count}</b> : null}</button>)}</nav>
      <div className={styles.sidebarFooter}><blockquote>Quản trị tập trung<br/>Vận hành an toàn<br/>Phát triển bền vững</blockquote><div><small>v2.0</small><span><i/> Hệ thống hoạt động</span></div></div>
    </aside>

    <section className={styles.main}>
      <header className={styles.topbar}>
        <label className={styles.searchBox}><Icon name="search" size={22}/><span className={styles.srOnly}>Tìm kiếm toàn hệ thống</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm theo ứng dụng, thiết bị, người dùng…"/></label>
        <label className={styles.quickFilter}><Icon name="filter" size={19}/><span className={styles.srOnly}>Lọc nhanh theo ứng dụng</span><select value={appFilter} onChange={(event) => setAppFilter(event.target.value)}><option value="all">Bộ lọc nhanh</option>{applicationRegistry.map((application) => <option key={application.id} value={application.id}>{application.shortName}</option>)}</select></label>
        <button className={styles.bell} onClick={() => switchView("alerts")} aria-label={`Mở cảnh báo${notificationCount ? `, ${notificationCount} thông báo` : ""}`}><Icon name="bell" size={23}/>{notificationCount > 0 ? <b>{notificationCount}</b> : null}</button>
        <details className={styles.userMenu}><summary><span>{user.displayName.slice(0, 1).toUpperCase()}</span><div><strong>{user.displayName}</strong><small>{roleLabels[role]}</small></div><Icon name="chevron" size={15}/></summary><div className={styles.userPopover}><strong>{user.displayName}</strong><small>{user.email}</small><hr/><button onClick={() => switchView("devices")} disabled={!canSeeAdminDevices}>Thiết bị quản trị</button><a href="/signout-with-chatgpt?return_to=%2F">Đăng xuất ChatGPT</a></div></details>
      </header>

      <div className={styles.pageBody}>
        <header className={styles.pageHeader}><div><h1>{title.title}</h1><p>{title.description}</p></div><div className={styles.systemCard}><Icon name="calendar" size={23}/><div><span>{formatDate(now)}</span><strong>{formatClock(now)}</strong></div><i/><div data-state={systemState}><span>Hệ thống</span><strong>{systemState === "healthy" ? "Hoạt động ổn định" : systemState === "syncing" ? "Đang đồng bộ" : `${unavailableCount || 1} client cần kiểm tra`}</strong></div><button onClick={() => void refreshOperations()} disabled={operationsBusy} aria-label="Đồng bộ dữ liệu client" title="Đồng bộ dữ liệu client"><Icon name="refresh" size={17}/></button></div></header>
        {operationsError ? <div className={styles.operationsWarning} role="alert"><strong>Một phần dữ liệu client chưa tải được.</strong><span>{operationsError}</span><button onClick={() => void refreshOperations()}>Thử lại</button></div> : null}
        {notice ? <div className={styles.notice} role="status">{notice}</div> : null}

        {view === "overview" ? <>
          <section className={styles.metricGrid} aria-label="Chỉ số vận hành">
            <button onClick={() => switchView("applications")} data-tone="teal"><i><Icon name="cube" size={29}/></i><div><span>Tổng ứng dụng</span><strong>{applicationRegistry.length}</strong><small>Client đang quản lý</small></div><Icon name="chevron" size={20}/></button>
            <button onClick={() => switchView("client-devices")} data-tone="amber"><i><Icon name="device" size={28}/></i><div><span>Thiết bị mới chờ duyệt</span><strong>{operationsBusy && !operations ? "…" : operational?.pendingDevices ?? "—"}</strong><small>Registry của từng client</small></div><Icon name="chevron" size={20}/></button>
            <button onClick={() => switchView("alerts")} data-tone="red"><i><Icon name="alert" size={29}/></i><div><span>Cảnh báo hôm nay</span><strong>{operationsBusy && !operations ? "…" : operational?.alerts ?? "—"}</strong><small>{highAlerts.length ? `${highAlerts.length} ưu tiên cao` : "Không có cảnh báo cao"}</small></div><Icon name="chevron" size={20}/></button>
            <button onClick={() => switchView("inbox")} data-tone="gold"><i><Icon name="file" size={28}/></i><div><span>Ca kiểm duyệt cần xử lý</span><strong>{operationsBusy && !operations ? "…" : operational?.workItems ?? "—"}</strong><small>Không tạo số liệu giả</small></div><Icon name="chevron" size={20}/></button>
          </section>

          <section className={styles.dashboardGrid}>
            <div className={styles.panel}><SectionHeader icon="inbox" title="Hộp việc ưu tiên" meta={operational ? `${operational.workItems}` : "…"} action={<button onClick={() => switchView("inbox")}>Xem tất cả <span>→</span></button>}/><WorkTable items={workItems} loading={operationsBusy && !operations} search={search} appFilter={appFilter} limit={4}/></div>
            <div className={styles.panel}><SectionHeader icon="device" title="Thiết bị mới theo ứng dụng" meta={operational ? `${operational.pendingDevices}` : "…"} action={<button onClick={() => switchView("client-devices")}>Xem tất cả <span>→</span></button>}/><DeviceFilters appFilter={appFilter} setAppFilter={setAppFilter} deviceFilter={deviceFilter} setDeviceFilter={setDeviceFilter} timeFilter={timeFilter} setTimeFilter={setTimeFilter}/><ClientDeviceTable devices={devices} loading={operationsBusy && !operations} appFilter={appFilter} deviceFilter={deviceFilter} timeFilter={timeFilter} search={search} limit={4}/></div>
            <div className={`${styles.panel} ${styles.applicationPanel}`}><SectionHeader icon="cube" title="Ứng dụng đang quản lý" meta="Một hàng / một client" action={<button onClick={() => switchView("applications")}>Quản lý ứng dụng <span>→</span></button>}/><ApplicationTable summaries={operations?.summaries ?? []} loading={operationsBusy && !operations} search={search} appFilter={appFilter}/></div>
            <div className={styles.panel}><SectionHeader icon="bell" title="Cảnh báo nhanh" meta={highAlerts.length ? `${highAlerts.length}` : undefined} action={<button onClick={() => switchView("alerts")}>Xem tất cả <span>→</span></button>}/><div className={styles.alertTiles}>
              <button onClick={() => switchView("client-devices")} data-tone="amber"><span><Icon name="device" size={24}/></span><div><small>Thiết bị mới</small><strong>{operational?.pendingDevices ?? "—"}</strong><em>Chờ duyệt</em></div></button>
              <button onClick={() => switchView("alerts")} data-tone="red"><span><Icon name="wifi" size={24}/></span><div><small>App mất kết nối</small><strong>{operations ? unavailableCount : "—"}</strong><em>Cần kiểm tra ngay</em></div></button>
              <button onClick={() => switchView("alerts")} data-tone="gold"><span><Icon name="clock" size={24}/></span><div><small>Môi trường thay đổi</small><strong>{operations ? environmentCount : "—"}</strong><em>Cần xác minh</em></div></button>
              <button onClick={() => switchView("applications")} data-tone="blue"><span><Icon name="file" size={24}/></span><div><small>Contract chờ hoàn tất</small><strong>{applicationRegistry.filter((item) => item.contractState !== "connected").length}</strong><em>Không bật thao tác giả</em></div></button>
            </div></div>
          </section>
        </> : null}

        {view === "inbox" ? <section className={styles.panel}><SectionHeader icon="inbox" title="Tất cả việc cần chú ý" meta={operational ? `${operational.workItems}` : "…"}/><WorkTable items={workItems} loading={operationsBusy && !operations} search={search} appFilter={appFilter}/></section> : null}
        {view === "applications" ? <section className={styles.panel}><SectionHeader icon="apps" title="Danh sách client cấp 1" meta={`${applicationRegistry.length} ứng dụng`}/><ApplicationTable summaries={operations?.summaries ?? []} loading={operationsBusy && !operations} search={search} appFilter={appFilter}/></section> : null}
        {view === "client-devices" ? <section className={styles.panel}><SectionHeader icon="device" title="Thiết bị mới / thiết bị cần xác minh" meta="Registry vẫn thuộc client"/><DeviceFilters appFilter={appFilter} setAppFilter={setAppFilter} deviceFilter={deviceFilter} setDeviceFilter={setDeviceFilter} timeFilter={timeFilter} setTimeFilter={setTimeFilter}/><ClientDeviceTable devices={devices} loading={operationsBusy && !operations} appFilter={appFilter} deviceFilter={deviceFilter} timeFilter={timeFilter} search={search}/></section> : null}

        {view === "alerts" ? <section className={styles.alertsLayout}>
          <div className={styles.panel}><SectionHeader icon="alert" title="Cảnh báo cần xử lý" meta={`${highAlerts.length} mức cao`}/><WorkTable items={workItems.filter((item) => item.priority === "high")} loading={operationsBusy && !operations} search={search} appFilter={appFilter}/></div>
          <div className={styles.panel}><SectionHeader icon="wifi" title="Tình trạng từng client"/><div className={styles.connectionList}>{applicationRegistry.filter((app) => matchesApp(app.id, appFilter)).map((application) => {
            const summary = summaryById.get(application.id); const state: OperationsSummary["connection"] = summary?.connection ?? (application.contractState === "pending" ? "pending" : "warning");
            return <article key={application.id}><AppBadge appId={application.id} initials={application.initials}/><div><strong>{application.shortName}</strong><small>{summary?.note ?? application.contractNote}</small></div><StatusDot state={state}/><Link href={application.href}>Kiểm tra →</Link></article>;
          })}</div></div>
        </section> : null}

        {view === "devices" && canSeeAdminDevices ? <section className={styles.panel}><SectionHeader icon="shield" title="Thiết bị quản trị Application Management" meta={`${centralCounts.total} thiết bị · ${centralCounts.online} online`}/><div className={styles.centralBoundary}>Đây chỉ là thiết bị quản trị Application Management. Thiết bị người dùng của từng client phải xử lý trong khu quản trị của client đó.</div><div className={styles.adminDeviceList}>{bootstrap.controlDevices.map((device) => <DeviceRow key={device.deviceId} device={device} actor={access} role={role} busy={actionBusy} run={manageDevice}/>)}</div></section> : null}
        {view === "devices" && !canSeeAdminDevices ? <section className={styles.panel}><SectionHeader icon="shield" title="Thiết bị quản trị Application Management"/><div className={styles.emptyState}>Chỉ Chủ hệ thống mới có quyền quản lý thiết bị QT.</div></section> : null}

        {view === "audit" && canSeeAudit ? <section className={styles.panel}><SectionHeader icon="audit" title="Nhật ký bảo mật control-plane" meta={`${bootstrap.auditLog.length} sự kiện gần nhất`}/><div className={styles.auditList}>{bootstrap.auditLog.map((entry) => <article key={entry.id}><time>{formatTime(entry.createdAt)}</time><div><strong>{auditLabels[entry.action] ?? entry.action}</strong><small>{entry.actor}</small></div><code>{entry.target}</code></article>)}{!bootstrap.auditLog.length ? <div className={styles.emptyState}>Chưa có sự kiện audit Trung tâm.</div> : null}</div></section> : null}
        {view === "audit" && !canSeeAudit ? <section className={styles.panel}><SectionHeader icon="audit" title="Nhật ký bảo mật control-plane"/><div className={styles.emptyState}>Vai trò hiện tại không có quyền xem nhật ký hệ thống.</div></section> : null}

        {view === "settings" ? <section className={styles.settingsGrid}>
          <div className={styles.panel}><SectionHeader icon="settings" title="Topology bắt buộc"/><div className={styles.topologyFlow}><div><span>LEVEL 0</span><strong>Application Management</strong><small>QT · role · central audit</small></div><b>→</b><div><span>LEVEL 1</span><strong>Client độc lập</strong><small>BE · SK · HN · BM · GU</small></div><b>→</b><div><span>ENDPOINT</span><strong>Thiết bị client</strong><small>Registry thuộc client</small></div></div>{canSeeAdminDevices ? <button className={styles.settingsAction} onClick={() => switchView("devices")}><Icon name="shield" size={18}/> Quản lý thiết bị QT <span>→</span></button> : null}</div>
          <div className={styles.panel}><SectionHeader icon="wifi" title="Contract từng ứng dụng"/><div className={styles.contractList}>{applicationRegistry.map((application) => <article key={application.id}><AppBadge appId={application.id} initials={application.initials}/><div><strong>{application.shortName}</strong><small>{application.repository}</small></div><span data-contract={application.contractState}>{contractLabels[application.contractState]}</span><Link href={application.href}>Quản trị →</Link></article>)}</div></div>
          <div className={`${styles.panel} ${styles.boundaryPanel}`}><SectionHeader icon="shield" title="Ranh giới nghiệp vụ"/><div className={styles.boundaryCards}><article data-client="health"><strong>Sức khỏe Y tế</strong><p>Chỉ kiểm duyệt y tế, quy tắc y khoa, hồ sơ/phiên Health và audit y tế. Không quản trị OCR hoặc ca Hòa nhập Nga.</p></article><article data-client="ru"><strong>Hòa nhập Nga</strong><p>Chỉ quản trị thiết bị HN, OCR thuốc, đối chiếu quy định và audit Nga. Không xử lý hồ sơ y tế tổng quát.</p></article><article data-client="children"><strong>Dữ liệu trẻ em</strong><p>GrowUP giữ dữ liệu trẻ em tại backend riêng theo privacy-first. Application Management chỉ đọc trạng thái contract an toàn.</p></article></div></div>
        </section> : null}
      </div>
    </section>
  </main>;
}
