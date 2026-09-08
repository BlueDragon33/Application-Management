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

const deviceStatusLabels = { pending: "Chờ duyệt", approved: "Đã cấp quyền", blocked: "Đã khóa" } as const;
const memberStatusLabels = { active: "Tài khoản hoạt động", inactive: "Đã thu hồi tài khoản", unregistered: "Chưa cấp tài khoản" } as const;
const contractLabels = { connected: "Đã kết nối", migrating: "Đang hoàn thiện", pending: "Chưa nối backend" } as const;
const auditLabels: Record<string, string> = {
  control_device_approved: "Cấp quyền thiết bị quản trị",
  control_device_blocked: "Khóa thiết bị quản trị",
  control_member_deactivated: "Thu hồi tài khoản quản trị",
  control_member_deleted: "Xóa tài khoản quản trị",
};

const viewTitles: Record<CenterView, { eyebrow: string; title: string; description: string }> = {
  overview: { eyebrow: "CONTROL PLANE · OPERATIONS", title: "Bảng điều phối quản trị ứng dụng", description: "Kiểm soát tập trung các client độc lập, cảnh báo thiết bị mới và đưa người quản trị vào đúng khu xử lý chỉ với một lần bấm." },
  inbox: { eyebrow: "PRIORITY INBOX", title: "Hộp việc ưu tiên", description: "Tập trung sự kiện cần chú ý từ từng client; mỗi việc luôn ghi rõ ứng dụng sở hữu dữ liệu và nơi cần xử lý." },
  applications: { eyebrow: "CLIENT REGISTRY", title: "Ứng dụng đang quản lý", description: "Danh sách compact để tìm nhanh khi số lượng client tăng; không dùng các card lớn lặp lại cùng thông tin." },
  "client-devices": { eyebrow: "CLIENT DEVICE ALERTS", title: "Thiết bị mới theo ứng dụng", description: "Thiết bị người dùng được đọc từ registry của client sở hữu nó; Trung tâm không gom registry vào database QT." },
  alerts: { eyebrow: "OPERATIONS ALERTS", title: "Cảnh báo vận hành", description: "Ưu tiên mất kết nối, thay đổi môi trường thiết bị và các sự kiện cần can thiệp nhanh." },
  devices: { eyebrow: "CONTROL ACCESS", title: "Thiết bị quản trị Trung tâm", description: "Chỉ chứa thiết bị QT của Application Management; không trộn thiết bị Bơi, Y tế, Hòa nhập Nga, Bauman hoặc GrowUP." },
  audit: { eyebrow: "SYSTEM AUDIT", title: "Nhật ký hệ thống", description: "Chỉ ghi thay đổi quyền và bảo mật của control-plane. Audit nghiệp vụ thuộc khu quản trị riêng của từng client." },
  settings: { eyebrow: "SYSTEM BOUNDARY", title: "Cấu hình & ranh giới", description: "Kiểm tra topology, contract và nguyên tắc sở hữu dữ liệu trước khi bật thêm capability quản trị." },
};

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

function appDomain(application: ApplicationConfig) {
  if (application.id === "health-care") return { group: "Y tế", boundary: "Kiểm duyệt y tế · quy tắc y khoa · audit y tế" };
  if (application.id === "ru-life") return { group: "Nga", boundary: "Kiểm duyệt Nga · OCR thuốc · thiết bị HN · audit Nga" };
  if (application.id === "boi-ech") return { group: "Học tập", boundary: "Thiết bị học · tiến độ · AI · thanh toán · duyệt sửa" };
  if (application.id === "bauman-master-ai") return { group: "Học thuật", boundary: "Bauman Hub · sub-client môn học · contract BM" };
  return { group: "Gia đình", boundary: "Phát triển 3–18 · privacy-first · contract GU" };
}

function deviceIcon(type: OperationsDevice["deviceType"]) {
  return type === "phone" ? "▯" : type === "tablet" ? "▭" : type === "desktop" ? "▱" : "◇";
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

function SectionHeader({ title, meta, action }: { title: string; meta?: string; action?: React.ReactNode }) {
  return <header className={styles.sectionHeader}><div><h2>{title}</h2>{meta ? <span>{meta}</span> : null}</div>{action}</header>;
}

function LoadingRows({ count = 4 }: { count?: number }) {
  return <div className={styles.loadingRows}>{Array.from({ length: count }, (_, index) => <i key={index} />)}</div>;
}

function StatusDot({ state }: { state: OperationsSummary["connection"] }) {
  return <span className={styles.connectionState} data-state={state}><i />{state === "connected" ? "Kết nối tốt" : state === "pending" ? "Chờ backend" : state === "unavailable" ? "Không đọc được" : "Có cảnh báo"}</span>;
}

function WorkTable({ items, loading, search }: { items: OperationsWorkItem[]; loading: boolean; search: string }) {
  const normalized = search.trim().toLowerCase();
  const visible = items.filter((item) => !normalized || `${item.appName} ${item.title} ${item.detail} ${item.deviceType}`.toLowerCase().includes(normalized));
  if (loading) return <LoadingRows />;
  if (!visible.length) return <div className={styles.emptyState}>Không có việc phù hợp với bộ lọc hiện tại.</div>;
  return <div className={styles.workTable}>
    <div className={styles.tableHead}><span>Ứng dụng</span><span>Sự kiện</span><span>Thiết bị</span><span>Thời gian</span><span>Trạng thái</span><span>Thao tác</span></div>
    {visible.slice(0, 20).map((item) => <article key={item.id} className={styles.workRow}>
      <div className={styles.appCell}><b>{applicationRegistry.find((app) => app.id === item.appId)?.initials ?? "AP"}</b><strong>{item.appName}</strong></div>
      <div><strong>{item.title}</strong><small>{item.detail}</small></div>
      <span>{item.deviceType}</span><span>{relativeTime(item.occurredAt)}</span>
      <span className={styles.priority} data-priority={item.priority}>{item.priority === "high" ? "Cần kiểm tra" : item.kind === "device" ? "Chờ duyệt" : "Theo dõi"}</span>
      <Link href={item.href} className={styles.rowAction}>Xử lý →</Link>
    </article>)}
  </div>;
}

function ClientDeviceTable({ devices, loading, appFilter, search }: { devices: OperationsDevice[]; loading: boolean; appFilter: string; search: string }) {
  const normalized = search.trim().toLowerCase();
  const visible = devices.filter((device) => (device.status === "pending" || device.attention === "environment")
    && (appFilter === "all" || device.appId === appFilter)
    && (!normalized || `${device.appName} ${device.deviceCode} ${device.userLabel} ${device.deviceTypeLabel}`.toLowerCase().includes(normalized)));
  if (loading) return <LoadingRows />;
  if (!visible.length) return <div className={styles.emptyState}>Không có thiết bị mới/cảnh báo trong phạm vi đang chọn.</div>;
  return <div className={styles.clientDeviceTable}>
    <div className={styles.deviceTableHead}><span>Ứng dụng</span><span>Thiết bị</span><span>Người dùng</span><span>Thời gian</span><span>Thao tác</span></div>
    {visible.slice(0, 24).map((device) => <article key={`${device.appId}:${device.deviceId}`} className={styles.clientDeviceRow}>
      <div className={styles.appCell}><b>{applicationRegistry.find((app) => app.id === device.appId)?.initials ?? "AP"}</b><strong>{device.appName}</strong></div>
      <div className={styles.deviceKind}><i>{deviceIcon(device.deviceType)}</i><span>{device.deviceTypeLabel}</span></div>
      <div><strong>{device.userLabel}</strong><small>{device.deviceCode}</small></div>
      <span>{relativeTime(device.createdAt ?? device.lastSeenAt)}</span>
      <Link href={device.href} className={styles.rowAction}>{device.attention === "environment" ? "Kiểm tra →" : "Duyệt →"}</Link>
    </article>)}
  </div>;
}

function ApplicationTable({ summaries, loading, search, appFilter }: { summaries: OperationsSummary[]; loading: boolean; search: string; appFilter: string }) {
  const normalized = search.trim().toLowerCase();
  const map = new Map(summaries.map((item) => [item.appId, item]));
  const apps = applicationRegistry.filter((application) => {
    const summary = map.get(application.id);
    const domain = appDomain(application);
    const haystack = `${application.name} ${application.shortName} ${application.repository} ${domain.group} ${domain.boundary} ${summary?.note ?? ""}`.toLowerCase();
    return (appFilter === "all" || application.id === appFilter) && (!normalized || haystack.includes(normalized));
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
        <div className={styles.appCell}><b>{application.initials}</b><div><strong>{application.shortName}</strong><small>{domain.boundary}</small></div></div>
        <span>{domain.group}</span><strong data-count={typeof pending === "number" && pending > 0 ? "attention" : "normal"}>{pending}</strong><strong>{online}</strong>
        <StatusDot state={connection} /><Link href={application.href} className={styles.manageButton}>Vào quản trị →</Link>
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
    <span className={styles.presence} data-online={device.active ? "true" : "false"} />
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
    const requested = new URLSearchParams(window.location.search).get("view");
    const valid: CenterView[] = ["overview", "inbox", "applications", "client-devices", "alerts", "devices", "audit", "settings"];
    if (requested && valid.includes(requested as CenterView)) setView(requested as CenterView);
    if (requested === "topology") setView("settings");
    void initialize();
  }, []);

  function switchView(next: CenterView) {
    setView(next);
    window.history.replaceState(null, "", next === "overview" ? "/" : `/?view=${next}`);
  }

  const centralCounts = useMemo(() => {
    const devices = bootstrap?.controlDevices ?? [];
    return { total: devices.length, pending: devices.filter((item) => item.status === "pending").length, online: devices.filter((item) => item.active).length };
  }, [bootstrap?.controlDevices]);

  const operational = operations?.metrics;
  const notificationCount = (operational?.pendingDevices ?? 0) + (operational?.alerts ?? 0) + centralCounts.pending;
  const summaryById = useMemo(() => new Map((operations?.summaries ?? []).map((item) => [item.appId, item])), [operations]);
  const highAlerts = useMemo(() => (operations?.workItems ?? []).filter((item) => item.priority === "high"), [operations]);

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

  if (!access || access.status !== "approved" || !bootstrap) return <Gate access={access} busy={busy} error={error} retry={() => void initialize()} />;

  const role = access.role;
  const canSeeAdminDevices = role === "owner";
  const canSeeAudit = role === "publisher" || role === "owner";
  const title = viewTitles[view];
  const filteredWorkItems = operations?.workItems ?? [];
  const filteredDevices = operations?.devices ?? [];

  return <main className={styles.shell}>
    <aside className={styles.sidebar}>
      <div className={styles.brand}><div className={styles.brandMark}>QT</div><div><span>TRUNG TÂM ĐIỀU PHỐI</span><strong>QUẢN TRỊ ỨNG DỤNG</strong></div></div>
      <nav className={styles.nav} aria-label="Điều hướng quản trị">
        <button data-active={view === "overview"} onClick={() => switchView("overview")}><i>⌂</i><div><strong>Tổng quan</strong><small>Bảng điều phối</small></div></button>
        <button data-active={view === "inbox"} onClick={() => switchView("inbox")}><i>▤</i><div><strong>Hộp việc</strong><small>Ưu tiên xử lý</small></div>{operational?.workItems ? <b>{operational.workItems}</b> : null}</button>
        <button data-active={view === "applications"} onClick={() => switchView("applications")}><i>⊞</i><div><strong>Ứng dụng</strong><small>Tìm & quản trị client</small></div></button>
        <button data-active={view === "client-devices"} onClick={() => switchView("client-devices")}><i>▯</i><div><strong>Thiết bị mới</strong><small>Theo từng ứng dụng</small></div>{operational?.pendingDevices ? <b>{operational.pendingDevices}</b> : null}</button>
        <button data-active={view === "alerts"} onClick={() => switchView("alerts")}><i>△</i><div><strong>Cảnh báo</strong><small>Vận hành client</small></div>{operational?.alerts ? <b>{operational.alerts}</b> : null}</button>
        <span className={styles.navDivider}>HỆ THỐNG</span>
        {canSeeAdminDevices ? <button data-active={view === "devices"} onClick={() => switchView("devices")}><i>♙</i><div><strong>Thiết bị QT</strong><small>Quyền Trung tâm</small></div>{centralCounts.pending ? <b>{centralCounts.pending}</b> : null}</button> : null}
        {canSeeAudit ? <button data-active={view === "audit"} onClick={() => switchView("audit")}><i>▧</i><div><strong>Nhật ký</strong><small>Bảo mật hệ thống</small></div></button> : null}
        <button data-active={view === "settings"} onClick={() => switchView("settings")}><i>⚙</i><div><strong>Cấu hình</strong><small>Contract & ranh giới</small></div></button>
      </nav>
      <div className={styles.sidebarFooter}><p>Quản trị tập trung<br/>Vận hành an toàn<br/>Client độc lập</p><span><i/> Control-plane hoạt động</span></div>
    </aside>

    <section className={styles.main}>
      <header className={styles.topbar}>
        <label className={styles.searchBox}><span>⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm theo ứng dụng, thiết bị, người dùng…" /></label>
        <select className={styles.filterSelect} value={appFilter} onChange={(event) => setAppFilter(event.target.value)}><option value="all">Tất cả ứng dụng</option>{applicationRegistry.map((application) => <option key={application.id} value={application.id}>{application.shortName}</option>)}</select>
        <button className={styles.bell} onClick={() => switchView("alerts")} aria-label="Mở cảnh báo"><span>♢</span>{notificationCount > 0 ? <b>{notificationCount}</b> : null}</button>
        <div className={styles.topUser}><span>{user.displayName.slice(0, 1).toUpperCase()}</span><div><strong>{user.displayName}</strong><small>{roleLabels[role]}</small></div></div>
      </header>

      <div className={styles.pageBody}>
        <header className={styles.pageHeader}><div><span>{title.eyebrow}</span><h1>{title.title}</h1><p>{title.description}</p></div><button className={styles.syncButton} onClick={() => void refreshOperations()} disabled={operationsBusy}>{operationsBusy ? "Đang đồng bộ…" : "Đồng bộ client"}</button></header>
        {operationsError ? <div className={styles.operationsWarning}><strong>Một phần dữ liệu client chưa tải được.</strong><span>{operationsError}</span><button onClick={() => void refreshOperations()}>Thử lại</button></div> : null}
        {notice ? <div className={styles.notice}>{notice}</div> : null}

        {view === "overview" ? <>
          <section className={styles.metricGrid}>
            <button onClick={() => switchView("applications")} data-tone="teal"><i>◇</i><div><span>Tổng ứng dụng</span><strong>{applicationRegistry.length}</strong><small>Client cấp 1 đang quản lý</small></div><b>→</b></button>
            <button onClick={() => switchView("client-devices")} data-tone="amber"><i>▯</i><div><span>Thiết bị mới chờ duyệt</span><strong>{operationsBusy && !operations ? "…" : operational?.pendingDevices ?? "—"}</strong><small>Đọc từ registry từng client</small></div><b>→</b></button>
            <button onClick={() => switchView("alerts")} data-tone="red"><i>△</i><div><span>Cảnh báo vận hành</span><strong>{operationsBusy && !operations ? "…" : operational?.alerts ?? "—"}</strong><small>Client lỗi hoặc môi trường đổi</small></div><b>→</b></button>
            <button onClick={() => switchView("inbox")} data-tone="gold"><i>▤</i><div><span>Việc cần xử lý</span><strong>{operationsBusy && !operations ? "…" : operational?.workItems ?? "—"}</strong><small>Không tạo số liệu giả</small></div><b>→</b></button>
          </section>

          <section className={styles.dashboardGrid}>
            <div className={styles.panel}><SectionHeader title="Hộp việc ưu tiên" meta={operational ? `${operational.workItems} việc` : "Đang đồng bộ"} action={<button onClick={() => switchView("inbox")}>Xem tất cả →</button>} /><WorkTable items={filteredWorkItems.slice(0, 6)} loading={operationsBusy && !operations} search={search} /></div>
            <div className={styles.panel}><SectionHeader title="Thiết bị mới theo ứng dụng" meta={operational ? `${operational.pendingDevices} chờ duyệt` : "Đang đồng bộ"} action={<button onClick={() => switchView("client-devices")}>Xem tất cả →</button>} /><ClientDeviceTable devices={filteredDevices} loading={operationsBusy && !operations} appFilter={appFilter} search={search} /></div>
            <div className={`${styles.panel} ${styles.applicationPanel}`}><SectionHeader title="Ứng dụng đang quản lý" meta="Một hàng / một client" action={<button onClick={() => switchView("applications")}>Quản lý ứng dụng →</button>} /><ApplicationTable summaries={operations?.summaries ?? []} loading={operationsBusy && !operations} search={search} appFilter={appFilter} /></div>
            <div className={styles.panel}><SectionHeader title="Cảnh báo nhanh" meta={highAlerts.length ? `${highAlerts.length} cần kiểm tra` : "Không có cảnh báo nghiêm trọng"} action={<button onClick={() => switchView("alerts")}>Xem tất cả →</button>} /><div className={styles.alertTiles}>
              <button onClick={() => switchView("client-devices")} data-tone="amber"><span>▯</span><div><small>Thiết bị mới</small><strong>{operational?.pendingDevices ?? "—"}</strong><em>Chờ duyệt theo app</em></div></button>
              <button onClick={() => switchView("alerts")} data-tone="red"><span>⌁</span><div><small>Client không đọc được</small><strong>{operations?.summaries.filter((item) => item.connection === "unavailable").length ?? "—"}</strong><em>Kiểm tra contract/origin</em></div></button>
              <button onClick={() => switchView("alerts")} data-tone="gold"><span>△</span><div><small>Môi trường thay đổi</small><strong>{filteredDevices.filter((item) => item.attention === "environment").length || 0}</strong><em>Thiết bị cần xác minh</em></div></button>
              <button onClick={() => switchView("applications")} data-tone="blue"><span>▤</span><div><small>Contract chưa hoàn tất</small><strong>{applicationRegistry.filter((item) => item.contractState !== "connected").length}</strong><em>Không bật thao tác giả</em></div></button>
            </div></div>
          </section>
        </> : null}

        {view === "inbox" ? <section className={styles.panel}><SectionHeader title="Tất cả việc cần chú ý" meta="Ưu tiên sự kiện thật từ client" /><WorkTable items={filteredWorkItems} loading={operationsBusy && !operations} search={search} /></section> : null}

        {view === "applications" ? <section className={styles.panel}><SectionHeader title="Danh sách client cấp 1" meta={`${applicationRegistry.length} ứng dụng`} /><ApplicationTable summaries={operations?.summaries ?? []} loading={operationsBusy && !operations} search={search} appFilter={appFilter} /></section> : null}

        {view === "client-devices" ? <section className={styles.panel}><SectionHeader title="Thiết bị mới / thiết bị cần xác minh" meta="Registry vẫn thuộc client" /><ClientDeviceTable devices={filteredDevices} loading={operationsBusy && !operations} appFilter={appFilter} search={search} /></section> : null}

        {view === "alerts" ? <section className={styles.alertsLayout}>
          <div className={styles.panel}><SectionHeader title="Cảnh báo cần xử lý" meta={`${highAlerts.length} cảnh báo mức cao`} /><WorkTable items={filteredWorkItems.filter((item) => item.priority === "high")} loading={operationsBusy && !operations} search={search} /></div>
          <div className={styles.panel}><SectionHeader title="Tình trạng từng client" /><div className={styles.connectionList}>{applicationRegistry.map((application) => {
            const summary = summaryById.get(application.id); const state: OperationsSummary["connection"] = summary?.connection ?? (application.contractState === "pending" ? "pending" : "warning");
            return <article key={application.id}><b>{application.initials}</b><div><strong>{application.shortName}</strong><small>{summary?.note ?? application.contractNote}</small></div><StatusDot state={state}/><Link href={application.href}>Kiểm tra →</Link></article>;
          })}</div></div>
        </section> : null}

        {view === "devices" && canSeeAdminDevices ? <section className={styles.panel}><SectionHeader title="Thiết bị quản trị Application Management" meta={`${centralCounts.total} thiết bị · ${centralCounts.online} online`} />
          <div className={styles.centralBoundary}>Đây chỉ là thiết bị quản trị Application Management. Thiết bị người dùng của từng client phải xử lý trong khu quản trị của client đó.</div>
          <div className={styles.adminDeviceList}>{bootstrap.controlDevices.map((device) => <DeviceRow key={device.deviceId} device={device} actor={access} role={role} busy={actionBusy} run={manageDevice} />)}</div>
        </section> : null}

        {view === "audit" && canSeeAudit ? <section className={styles.panel}><SectionHeader title="Nhật ký bảo mật control-plane" meta={`${bootstrap.auditLog.length} sự kiện gần nhất`} /><div className={styles.auditList}>{bootstrap.auditLog.map((entry) => <article key={entry.id}><time>{formatTime(entry.createdAt)}</time><div><strong>{auditLabels[entry.action] ?? entry.action}</strong><small>{entry.actor}</small></div><code>{entry.target}</code></article>)}{!bootstrap.auditLog.length ? <div className={styles.emptyState}>Chưa có sự kiện audit Trung tâm.</div> : null}</div></section> : null}

        {view === "settings" ? <section className={styles.settingsGrid}>
          <div className={styles.panel}><SectionHeader title="Topology bắt buộc" /><div className={styles.topologyFlow}><div><span>LEVEL 0</span><strong>Application Management</strong><small>QT · role · central audit</small></div><b>→</b><div><span>LEVEL 1</span><strong>Client độc lập</strong><small>BE · SK · HN · BM · GU</small></div><b>→</b><div><span>ENDPOINT</span><strong>Thiết bị client</strong><small>Registry thuộc client</small></div></div></div>
          <div className={styles.panel}><SectionHeader title="Contract từng ứng dụng" /><div className={styles.contractList}>{applicationRegistry.map((application) => <article key={application.id}><b>{application.initials}</b><div><strong>{application.shortName}</strong><small>{application.repository}</small></div><span data-contract={application.contractState}>{contractLabels[application.contractState]}</span><Link href={application.href}>Quản trị →</Link></article>)}</div></div>
          <div className={`${styles.panel} ${styles.boundaryPanel}`}><SectionHeader title="Ranh giới nghiệp vụ" /><div className={styles.boundaryCards}><article data-client="health"><strong>Sức khỏe Y tế</strong><p>Chỉ kiểm duyệt y tế, quy tắc y khoa, hồ sơ/phiên Health và audit y tế. Không quản trị OCR hoặc ca Hòa nhập Nga.</p></article><article data-client="ru"><strong>Hòa nhập Nga</strong><p>Chỉ quản trị thiết bị HN, OCR thuốc, đối chiếu quy định và audit Nga. Không xử lý hồ sơ y tế tổng quát.</p></article></div></div>
        </section> : null}
      </div>
    </section>
  </main>;
}
