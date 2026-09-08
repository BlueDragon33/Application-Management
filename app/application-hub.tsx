"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { applicationRegistry, getApplicationConfig, type ApplicationConfig } from "./application-registry";
import {
  centerAdminAction,
  connectAdminCenter,
  roleLabels,
  type AdminAccess,
  type CenterBootstrap,
  type ControlAdminDevice,
  type ControlRole,
} from "./admin-device-client";
import styles from "./center-admin.module.css";

type CenterView = "overview" | "applications" | "devices" | "audit";

const statusLabels = {
  online: "Đã nối quản trị",
  warning: "Đang hoàn thiện contract",
  planned: "Chờ kết nối quản trị",
} as const;

const contractLabels = {
  connected: "Contract hoạt động",
  migrating: "Đang chuyển sang kiến trúc độc lập",
  pending: "Chưa nối backend quản trị",
} as const;

const deviceStatusLabels = {
  pending: "Chờ duyệt",
  approved: "Đã cấp quyền",
  blocked: "Đã khóa",
} as const;

const memberStatusLabels = {
  active: "Tài khoản hoạt động",
  inactive: "Đã thu hồi tài khoản",
  unregistered: "Chưa cấp tài khoản",
} as const;

const auditLabels: Record<string, string> = {
  control_device_approved: "Cấp quyền thiết bị quản trị",
  control_device_blocked: "Khóa thiết bị quản trị",
  control_member_deactivated: "Thu hồi tài khoản quản trị",
  control_member_deleted: "Xóa tài khoản quản trị",
};

function formatTime(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(date);
}

function Gate({ access, busy, error, retry }: { access: AdminAccess | null; busy: boolean; error: string; retry: () => void }) {
  return <main className={styles.gateShell}>
    <section className={styles.gateCard}>
      <div className={styles.gateMark}>AM</div>
      <span className={styles.eyebrow}>Application Management · Secure control plane</span>
      <h1>{access?.status === "pending"
        ? "Thiết bị quản trị đang chờ cấp quyền."
        : access?.status === "blocked"
          ? "Thiết bị quản trị đã bị khóa."
          : "Đang xác thực thiết bị quản trị…"}</h1>
      <p>{error || "Mỗi máy quản trị dùng khóa P-256 riêng. Trung tâm chỉ mở sau khi thiết bị và tài khoản đều được cấp quyền."}</p>
      {access?.deviceCode ? <div className={styles.gateCode}><span>Mã thiết bị</span><strong>{access.deviceCode}</strong></div> : null}
      <button className={styles.primaryButton} onClick={retry} disabled={busy}>{busy ? "Đang xác thực…" : "Kiểm tra lại quyền"}</button>
    </section>
  </main>;
}

function ApplicationCard({ application }: { application: ApplicationConfig }) {
  return <article className={styles.appCard} data-status={application.status}>
    <div className={styles.appCardTop}>
      <div className={styles.appIdentity}>
        <span className={styles.appInitials}>{application.initials}</span>
        <div><strong>{application.name}</strong><small>{application.repository}</small></div>
      </div>
      <span className={styles.statusBadge} data-status={application.status}>{statusLabels[application.status]}</span>
    </div>
    <p className={styles.appScope}>{application.scope}</p>
    <div className={styles.contractLine}>
      <span>Contract</span>
      <strong>{contractLabels[application.contractState]}</strong>
    </div>
    <div className={styles.devicePolicy}><span>Thiết bị đầu vào</span><p>{application.devicePolicy}</p></div>
    <div className={styles.capabilityList}>{application.capabilities.slice(0, 5).map((item) => <span key={item}>{item}</span>)}</div>
    <div className={styles.appCardFooter}>
      <small>{application.guardrails[0]}</small>
      <Link href={application.href}>{application.contractState === "connected" ? "Mở khu quản trị" : "Xem cấu trúc quản trị"}<span>→</span></Link>
    </div>
  </article>;
}

function DeviceRow({ device, actor, role, busy, run }: {
  device: ControlAdminDevice;
  actor: AdminAccess;
  role: ControlRole;
  busy: string;
  run: (device: ControlAdminDevice, operation: "approve" | "block" | "deactivate-member" | "delete-member", selectedRole?: "reviewer" | "publisher") => void;
}) {
  const [approvalRole, setApprovalRole] = useState<"reviewer" | "publisher">(device.role === "publisher" ? "publisher" : "reviewer");
  const protectedDevice = device.owner || device.deviceId === actor.deviceId;
  const isBusy = busy === device.deviceId;

  return <article className={styles.deviceRow} data-status={device.status}>
    <div className={styles.deviceIdentity}>
      <span className={styles.presence} data-online={device.active ? "true" : "false"} />
      <div><strong>{device.displayName || device.email}</strong><span>{device.email}</span><small>{device.deviceCode} · {device.label || "Chưa đặt nhãn"}</small></div>
    </div>
    <div className={styles.deviceFact}><span>Trạng thái</span><strong>{deviceStatusLabels[device.status]}</strong><small>{memberStatusLabels[device.memberStatus]}</small></div>
    <div className={styles.deviceFact}><span>Vai trò</span><strong>{roleLabels[device.role]}</strong><small>{device.active ? "Đang trực tuyến" : `Tín hiệu cuối ${formatTime(device.lastSeenAt)}`}</small></div>
    <div className={styles.deviceActions}>
      {protectedDevice ? <span className={styles.protected}>Thiết bị chủ hệ thống · được bảo vệ</span>
        : device.status === "pending" ? <>
          <select value={approvalRole} onChange={(event) => setApprovalRole(event.target.value as "reviewer" | "publisher")} disabled={isBusy || role !== "owner"}>
            <option value="reviewer">Kiểm duyệt viên</option><option value="publisher">Người xuất bản</option>
          </select>
          <button className={styles.primarySmall} disabled={isBusy || role !== "owner"} onClick={() => run(device, "approve", approvalRole)}>Cấp quyền</button>
          <button className={styles.secondarySmall} disabled={isBusy || role !== "owner"} onClick={() => run(device, "block")}>Từ chối</button>
        </> : device.memberStatus === "inactive" ?
          <button className={styles.dangerSmall} disabled={isBusy || role !== "owner"} onClick={() => run(device, "delete-member")}>Xóa tài khoản</button>
          : <>
            {device.status !== "blocked" ? <button className={styles.secondarySmall} disabled={isBusy || role !== "owner"} onClick={() => run(device, "block")}>Khóa thiết bị</button> : null}
            <button className={styles.dangerSmall} disabled={isBusy || role !== "owner"} onClick={() => run(device, "deactivate-member")}>Thu hồi tài khoản</button>
          </>}
    </div>
  </article>;
}

export default function ApplicationHub({ user }: { user: { displayName: string; email: string } }) {
  const [access, setAccess] = useState<AdminAccess | null>(null);
  const [bootstrap, setBootstrap] = useState<CenterBootstrap | null>(null);
  const [view, setView] = useState<CenterView>("overview");
  const [busy, setBusy] = useState(true);
  const [actionBusy, setActionBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function initialize() {
    setBusy(true); setError("");
    try {
      const result = await connectAdminCenter();
      setAccess(result.access); setBootstrap(result.bootstrap);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không thể mở Trung tâm quản trị.");
    } finally { setBusy(false); }
  }

  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("view");
    if (requested && ["overview", "applications", "devices", "audit"].includes(requested)) setView(requested as CenterView);
    void initialize();
  }, []);

  function switchView(next: CenterView) {
    setView(next);
    window.history.replaceState(null, "", next === "overview" ? "/" : `/?view=${next}`);
  }

  const applications = useMemo(() => {
    const liveIds = new Set((bootstrap?.applications ?? []).map((item) => item.id));
    return applicationRegistry.map((application) => ({ ...application, registered: liveIds.has(application.id) }));
  }, [bootstrap]);

  const deviceCounts = useMemo(() => {
    const devices = bootstrap?.controlDevices ?? [];
    return {
      total: devices.length,
      pending: devices.filter((item) => item.status === "pending").length,
      approved: devices.filter((item) => item.status === "approved").length,
      blocked: devices.filter((item) => item.status === "blocked").length,
      online: devices.filter((item) => item.active).length,
    };
  }, [bootstrap?.controlDevices]);

  const appCounts = useMemo(() => ({
    total: applications.length,
    connected: applications.filter((item) => item.contractState === "connected").length,
    attention: applications.filter((item) => item.status === "warning").length,
    planned: applications.filter((item) => item.status === "planned").length,
  }), [applications]);

  async function manageDevice(device: ControlAdminDevice, operation: "approve" | "block" | "deactivate-member" | "delete-member", selectedRole?: "reviewer" | "publisher") {
    if (!bootstrap || !access || access.role !== "owner") return;
    if (operation === "deactivate-member" && !window.confirm(`Thu hồi toàn bộ quyền quản trị của ${device.email}? Tất cả thiết bị của tài khoản này sẽ bị khóa.`)) return;
    if (operation === "delete-member") {
      const confirmation = window.prompt(`Xóa vĩnh viễn tài khoản đã thu hồi. Nhập chính xác email để xác nhận:\n${device.email}`);
      if (confirmation?.trim().toLowerCase() !== device.email.toLowerCase()) { setNotice("Đã hủy xóa vì chuỗi xác nhận không khớp."); return; }
    }
    setActionBusy(device.deviceId); setNotice("");
    try {
      const result = await centerAdminAction({ action: "manage-control-device", operation, targetDeviceId: device.deviceId, role: selectedRole, displayName: device.displayName });
      setBootstrap((current) => current ? { ...current, controlDevices: result.controlDevices ?? current.controlDevices, auditLog: result.auditLog ?? current.auditLog } : current);
      setNotice(operation === "approve" ? "Đã cấp quyền thiết bị quản trị." : operation === "block" ? "Đã khóa thiết bị quản trị." : operation === "deactivate-member" ? "Đã thu hồi tài khoản và khóa các thiết bị liên quan." : "Đã xóa tài khoản quản trị.");
    } catch (caught) { setNotice(caught instanceof Error ? caught.message : "Không thể cập nhật quyền thiết bị."); }
    finally { setActionBusy(""); }
  }

  if (!access || access.status !== "approved" || !bootstrap) return <Gate access={access} busy={busy} error={error} retry={() => void initialize()} />;

  const role = access.role;
  const canSeeDevices = role === "owner";
  const canSeeAudit = ["publisher", "owner"].includes(role);
  const attentionApps = applications.filter((item) => item.status !== "online");

  return <main className={styles.shell}>
    <aside className={styles.sidebar}>
      <div className={styles.brand}><div className={styles.brandMark}>AM</div><div><span>Control plane</span><strong>Application Management</strong></div></div>
      <div className={styles.systemState}><span className={styles.systemDot} /><div><strong>Trung tâm hoạt động</strong><small>Ranh giới ứng dụng được bật</small></div></div>
      <nav className={styles.nav} aria-label="Điều hướng Trung tâm quản trị">
        <button data-active={view === "overview"} onClick={() => switchView("overview")}><span>01</span><div><strong>Tổng quan</strong><small>Điều hành hệ thống</small></div></button>
        <button data-active={view === "applications"} onClick={() => switchView("applications")}><span>02</span><div><strong>Ứng dụng</strong><small>Khu quản trị riêng</small></div></button>
        {canSeeDevices ? <button data-active={view === "devices"} onClick={() => switchView("devices")}><span>03</span><div><strong>Thiết bị & quyền</strong><small>Quản trị viên Trung tâm</small></div></button> : null}
        {canSeeAudit ? <button data-active={view === "audit"} onClick={() => switchView("audit")}><span>04</span><div><strong>Nhật ký & bảo mật</strong><small>Truy vết thay đổi</small></div></button> : null}
      </nav>
      <div className={styles.boundaryBox}><span>Nguyên tắc cứng</span><strong>Trung tâm không chứa runtime chuyên môn.</strong><p>Mỗi site sở hữu thiết bị, dữ liệu, nội dung và tiến trình riêng. Trung tâm chỉ cấp quyền, điều phối và theo dõi qua contract.</p></div>
      <div className={styles.userCard}><div className={styles.avatar}>{user.displayName.slice(0, 1).toUpperCase()}</div><div><strong>{user.displayName}</strong><span>{roleLabels[role]}</span><small>{access.deviceCode}</small></div><a href="/logout?return_to=/login" aria-label="Đăng xuất">↗</a></div>
    </aside>

    <section className={styles.main}>
      <header className={styles.topbar}><div><span>TRUNG TÂM QUẢN TRỊ ỨNG DỤNG</span><h1>{view === "overview" ? "Tổng quan điều hành" : view === "applications" ? "Danh mục ứng dụng" : view === "devices" ? "Thiết bị & quyền quản trị" : "Nhật ký & bảo mật"}</h1></div><button className={styles.refreshButton} onClick={() => void initialize()} disabled={busy}>{busy ? "Đang đồng bộ…" : "Đồng bộ trạng thái"}</button></header>
      {error || bootstrap.upstreamError ? <div className={styles.error}>{error || bootstrap.upstreamError}</div> : null}
      {notice ? <div className={styles.notice}>{notice}</div> : null}

      {view === "overview" ? <>
        <section className={styles.hero}><div><span className={styles.eyebrow}>Kiến trúc quản trị mới</span><h2>Một control-plane, nhiều ứng dụng độc lập.</h2><p>Thiết bị truy cập, quyền sửa và dữ liệu vận hành thuộc về từng site. Application Management giữ một cửa phê duyệt, chính sách và nhật ký để hệ thống không quay lại trạng thái chồng chéo.</p></div><div className={styles.heroArchitecture}><span>APPLICATION MANAGEMENT</span><div className={styles.archLine} /><div className={styles.archNodes}>{applications.slice(0, 5).map((item) => <b key={item.id} data-status={item.status}>{item.initials}</b>)}</div><small>Control contract · không nhúng runtime</small></div></section>
        <section className={styles.metrics}>
          <article><span>Ứng dụng quản lý</span><strong>{appCounts.total}</strong><small>{appCounts.connected} đã nối contract</small></article>
          <article><span>Cần hoàn thiện</span><strong>{appCounts.attention}</strong><small>Contract đang chuyển đổi</small></article>
          <article><span>Thiết bị quản trị</span><strong>{canSeeDevices ? deviceCounts.total : "—"}</strong><small>{canSeeDevices ? `${deviceCounts.online} online` : "Theo quyền vai trò"}</small></article>
          <article data-alert={deviceCounts.pending > 0 ? "true" : "false"}><span>Chờ phê duyệt</span><strong>{canSeeDevices ? deviceCounts.pending : "—"}</strong><small>Thiết bị Trung tâm mới</small></article>
        </section>
        <section className={styles.twoColumn}>
          <div className={styles.panel}><div className={styles.panelHead}><div><span className={styles.eyebrow}>Ứng dụng ưu tiên</span><h3>Trạng thái contract quản trị</h3></div><button onClick={() => switchView("applications")}>Xem tất cả</button></div><div className={styles.compactApps}>{applications.map((app) => <Link href={app.href} key={app.id}><span className={styles.compactIcon}>{app.initials}</span><div><strong>{app.shortName}</strong><small>{contractLabels[app.contractState]}</small></div><b data-status={app.status}>{statusLabels[app.status]}</b></Link>)}</div></div>
          <div className={styles.panel}><div className={styles.panelHead}><div><span className={styles.eyebrow}>Việc cần xử lý</span><h3>Hàng đợi điều hành</h3></div></div><div className={styles.queue}>
            {canSeeDevices && deviceCounts.pending > 0 ? <button onClick={() => switchView("devices")}><span className={styles.queueNumber}>{deviceCounts.pending}</span><div><strong>Thiết bị quản trị chờ duyệt</strong><small>Chỉ chủ hệ thống có thể cấp vai trò.</small></div><b>→</b></button> : null}
            {attentionApps.map((app) => <Link key={app.id} href={app.href}><span className={styles.queueNumber}>{app.initials}</span><div><strong>{app.shortName}</strong><small>{contractLabels[app.contractState]}</small></div><b>→</b></Link>)}
            {attentionApps.length === 0 && (!canSeeDevices || deviceCounts.pending === 0) ? <div className={styles.empty}>Không có việc ưu tiên ở cấp Trung tâm.</div> : null}
          </div></div>
        </section>
        <section className={styles.rules}><article><b>01</b><div><strong>Một cửa thiết bị</strong><p>Mỗi site tự nhận diện máy tính, điện thoại hoặc tablet/iPad và gửi yêu cầu quyền qua contract.</p></div></article><article><b>02</b><div><strong>Đúng site · đúng dữ liệu</strong><p>Không site nào được dùng registry thiết bị, DB hay hàng đợi nội dung của site khác.</p></div></article><article><b>03</b><div><strong>Truy cập ≠ chỉnh sửa</strong><p>Quyền xem/sử dụng và quyền sửa nội dung là hai lớp độc lập, có thể thu hồi riêng.</p></div></article><article><b>04</b><div><strong>Mọi thay đổi có dấu vết</strong><p>Cấp quyền, khóa, thu hồi và xuất bản phải được audit ở đúng lớp quản trị.</p></div></article></section>
      </> : null}

      {view === "applications" ? <section className={styles.appSection}><div className={styles.sectionIntro}><span className={styles.eyebrow}>Application registry</span><h2>Mỗi ứng dụng có một khu quản trị riêng.</h2><p>Không thêm tab chuyên môn trực tiếp vào Trung tâm. Muốn đưa site mới vào hệ thống phải khai báo registry, contract quyền và ranh giới dữ liệu trước.</p></div><div className={styles.appGrid}>{applications.map((application) => <ApplicationCard key={application.id} application={getApplicationConfig(application.id)!} />)}</div></section> : null}

      {view === "devices" && canSeeDevices ? <section className={styles.deviceSection}><div className={styles.sectionIntro}><span className={styles.eyebrow}>Thiết bị quản trị Trung tâm</span><h2>Quyền vào control-plane.</h2><p>Đây chỉ là máy quản trị Application Management. Thiết bị người dùng của Bơi ếch, Sức khỏe Y tế, Hòa nhập Nga… phải quản lý trong đúng khu ứng dụng.</p></div><div className={styles.deviceSummary}><span><b>{deviceCounts.pending}</b> chờ duyệt</span><span><b>{deviceCounts.approved}</b> đã cấp</span><span><b>{deviceCounts.blocked}</b> đã khóa</span><span><b>{deviceCounts.online}</b> online</span></div><div className={styles.deviceList}>{(bootstrap.controlDevices ?? []).map((device) => <DeviceRow key={device.deviceId} device={device} actor={access} role={role} busy={actionBusy} run={(item, operation, selectedRole) => void manageDevice(item, operation, selectedRole)} />)}{bootstrap.controlDevices.length === 0 ? <div className={styles.empty}>Chưa có thiết bị quản trị nào.</div> : null}</div></section> : null}

      {view === "audit" && canSeeAudit ? <section className={styles.auditSection}><div className={styles.sectionIntro}><span className={styles.eyebrow}>Security audit</span><h2>Nhật ký thay đổi quyền Trung tâm.</h2><p>Nhật ký chuyên môn của từng app vẫn thuộc app đó; đây chỉ là các hành động bảo mật và phân quyền ở control-plane.</p></div><div className={styles.auditList}>{(bootstrap.auditLog ?? []).map((entry) => <article key={entry.id}><span className={styles.auditIcon}>AU</span><div><strong>{auditLabels[entry.action] || entry.action}</strong><small>{entry.actor} → {entry.target}</small></div><time>{formatTime(entry.createdAt)}</time></article>)}{bootstrap.auditLog.length === 0 ? <div className={styles.empty}>Chưa có sự kiện bảo mật nào.</div> : null}</div></section> : null}
    </section>
  </main>;
}
