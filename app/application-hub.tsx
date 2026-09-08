"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { applicationRegistry, type ApplicationConfig, type DeviceClass } from "./application-registry";
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

type CenterView = "overview" | "devices" | "audit";

const statusLabels = {
  online: "Đang quản trị",
  warning: "Cần hoàn thiện",
  planned: "Chờ kết nối",
} as const;

const contractLabels = {
  connected: "Đã kết nối",
  migrating: "Đang nối adapter",
  pending: "Chưa nối backend",
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

const viewTitles: Record<CenterView, { eyebrow: string; title: string; description: string }> = {
  overview: {
    eyebrow: "SYSTEM CONTROL PLANE",
    title: "Tổng quan hệ thống",
    description: "Application Management là server quản trị. Mỗi ứng dụng bên dưới là một client độc lập và chỉ giao tiếp qua contract quản trị.",
  },
  devices: {
    eyebrow: "ACCESS CONTROL",
    title: "Quyền & thiết bị quản trị",
    description: "Phần dùng chung cho toàn bộ Trung tâm; không chứa thiết bị người dùng của Bơi ếch, Y tế, Hòa nhập Nga, Bauman hay GrowUP.",
  },
  audit: {
    eyebrow: "SYSTEM AUDIT",
    title: "Nhật ký hệ thống",
    description: "Chỉ ghi thay đổi quyền và bảo mật của control-plane; audit nghiệp vụ vẫn thuộc từng client.",
  },
};

function formatTime(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(date);
}

function DeviceGlyph({ kind }: { kind: DeviceClass }) {
  if (kind === "phone") {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="7" y="2.5" width="10" height="19" rx="2.4" /><path d="M10.2 5h3.6M11.2 18.7h1.6" /></svg>;
  }
  if (kind === "tablet") {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="2.5" width="16" height="19" rx="2.4" /><path d="M10.5 18.5h3" /></svg>;
  }
  return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2.5" y="3.5" width="19" height="13" rx="2" /><path d="M8 20.5h8M10 16.5v4M14 16.5v4" /></svg>;
}

function Gate({ access, busy, error, retry }: { access: AdminAccess | null; busy: boolean; error: string; retry: () => void }) {
  return <main className={styles.gateShell}>
    <section className={styles.gateCard}>
      <div className={styles.gateMark}>QT</div>
      <span className={styles.eyebrow}>SECURE CONTROL PLANE</span>
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

function ContractState({ application }: { application: ApplicationConfig }) {
  return <span className={styles.contractState} data-contract={application.contractState}><i />{contractLabels[application.contractState]}</span>;
}

function ClientStatusRow({ application }: { application: ApplicationConfig & { registered?: boolean } }) {
  const childCount = application.childClients?.length ?? 0;
  return <article className={styles.clientRow} data-status={application.status}>
    <span className={styles.clientMark}>{application.initials}</span>
    <div className={styles.clientIdentity}>
      <strong>{application.shortName}</strong>
      <small>{application.repository}</small>
    </div>
    <div className={styles.clientFact}><span>Contract</span><ContractState application={application} /></div>
    <div className={styles.clientFact}><span>Tầng con</span><strong>{childCount ? `${childCount} sub-client` : "Không có"}</strong></div>
    <div className={styles.clientFact}><span>Registry</span><strong>{application.registered ? "Live" : "Cấu hình"}</strong></div>
    <Link href={application.href} className={styles.manageLink}>Quản trị <span>→</span></Link>
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
    <div className={styles.presenceCell}><span className={styles.presence} data-online={device.active ? "true" : "false"} /><small>{device.active ? "Online" : "Offline"}</small></div>
    <div className={styles.deviceIdentity}><strong>{device.displayName || device.email}</strong><span>{device.email}</span><small>{device.deviceCode} · {device.label || "Chưa đặt nhãn"}</small></div>
    <div className={styles.deviceFact}><span>Trạng thái</span><strong>{deviceStatusLabels[device.status]}</strong><small>{memberStatusLabels[device.memberStatus]}</small></div>
    <div className={styles.deviceFact}><span>Vai trò</span><strong>{roleLabels[device.role]}</strong><small>{device.active ? "Đang trực tuyến" : `Tín hiệu cuối ${formatTime(device.lastSeenAt)}`}</small></div>
    <div className={styles.deviceActions}>
      {protectedDevice ? <span className={styles.protected}>Owner · được bảo vệ</span>
        : device.status === "pending" ? <>
          <select value={approvalRole} onChange={(event) => setApprovalRole(event.target.value as "reviewer" | "publisher")} disabled={isBusy || role !== "owner"}>
            <option value="reviewer">Kiểm duyệt viên</option><option value="publisher">Người xuất bản</option>
          </select>
          <button className={styles.primarySmall} disabled={isBusy || role !== "owner"} onClick={() => run(device, "approve", approvalRole)}>Cấp quyền</button>
          <button className={styles.secondarySmall} disabled={isBusy || role !== "owner"} onClick={() => run(device, "block")}>Từ chối</button>
        </> : device.memberStatus === "inactive" ?
          <button className={styles.dangerSmall} disabled={isBusy || role !== "owner"} onClick={() => run(device, "delete-member")}>Xóa tài khoản</button>
          : <>
            {device.status !== "blocked" ? <button className={styles.secondarySmall} disabled={isBusy || role !== "owner"} onClick={() => run(device, "block")}>Khóa máy</button> : null}
            <button className={styles.dangerSmall} disabled={isBusy || role !== "owner"} onClick={() => run(device, "deactivate-member")}>Thu hồi</button>
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
    if (requested === "devices" || requested === "audit" || requested === "overview") setView(requested);
    // Liên kết cũ được thu gọn về Tổng quan để tránh duy trì màn hình trùng lặp.
    if (requested === "topology" || requested === "applications") setView("overview");
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
    children: applications.reduce((sum, item) => sum + (item.childClients?.length ?? 0), 0),
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
  const title = viewTitles[view];

  return <main className={styles.shell}>
    <aside className={styles.sidebar}>
      <div className={styles.brand}><div className={styles.brandMark}>QT</div><div><span>QUẢN TRỊ ỨNG DỤNG</span><strong>Hệ thống</strong></div></div>
      <div className={styles.systemState}><span className={styles.systemDot} /><div><strong>Control-plane hoạt động</strong><small>Server quản trị trung tâm</small></div></div>

      <nav className={styles.nav} aria-label="Điều hướng hệ thống">
        <span className={styles.navGroup}>HỆ THỐNG</span>
        <button data-active={view === "overview"} onClick={() => switchView("overview")}><span>01</span><div><strong>Tổng quan</strong><small>Trạng thái & kiến trúc</small></div></button>
        {canSeeDevices ? <button data-active={view === "devices"} onClick={() => switchView("devices")}><span>02</span><div><strong>Quyền & thiết bị</strong><small>Máy quản trị Trung tâm</small></div></button> : null}
        {canSeeAudit ? <button data-active={view === "audit"} onClick={() => switchView("audit")}><span>{canSeeDevices ? "03" : "02"}</span><div><strong>Nhật ký hệ thống</strong><small>Quyền & bảo mật</small></div></button> : null}
      </nav>

      <div className={styles.clientNav}>
        <span className={styles.navGroup}>CLIENT</span>
        {applications.map((application) => <Link key={application.id} href={application.href}>
          <span className={styles.clientNavMark}>{application.initials}</span>
          <div><strong>{application.shortName}</strong><small>{contractLabels[application.contractState]}</small></div>
          <i data-status={application.status} />
        </Link>)}
      </div>

      <div className={styles.boundaryBox}><span>RANH GIỚI</span><strong>Server quản trị không chứa runtime client.</strong><p>Client tự giữ dữ liệu, phiên, thiết bị và nghiệp vụ. Bauman Hub tự quản trị các site môn học bên dưới.</p></div>
      <div className={styles.userCard}><div className={styles.avatar}>{user.displayName.slice(0, 1).toUpperCase()}</div><div><strong>{user.displayName}</strong><span>{roleLabels[role]}</span><small>{access.deviceCode}</small></div><a href="/logout?return_to=/login" aria-label="Đăng xuất">↗</a></div>
    </aside>

    <section className={styles.main}>
      <header className={styles.topbar}>
        <div><span>{title.eyebrow}</span><h1>{title.title}</h1><p>{title.description}</p></div>
        <button className={styles.refreshButton} onClick={() => void initialize()} disabled={busy}>{busy ? "Đang cập nhật…" : "Cập nhật"}</button>
      </header>

      {error || bootstrap.upstreamError ? <div className={styles.error}>{error || bootstrap.upstreamError}</div> : null}
      {notice ? <div className={styles.notice}>{notice}</div> : null}

      {view === "overview" ? <>
        <section className={styles.metrics}>
          <article><span>Client cấp 1</span><strong>{appCounts.total}</strong><small>{appCounts.connected} contract hoạt động</small></article>
          <article data-alert={appCounts.attention > 0}><span>Cần hoàn thiện</span><strong>{appCounts.attention}</strong><small>Adapter hoặc backend</small></article>
          <article><span>Sub-client</span><strong>{appCounts.children}</strong><small>Hiện thuộc Bauman Hub</small></article>
          <article data-alert={deviceCounts.pending > 0}><span>Thiết bị quản trị</span><strong>{deviceCounts.total}</strong><small>{deviceCounts.online} online · {deviceCounts.pending} chờ duyệt</small></article>
        </section>

        <section className={styles.architecturePanel}>
          <div className={styles.sectionHead}><div><span className={styles.eyebrow}>ARCHITECTURE</span><h2>Một server → nhiều client → thiết bị</h2></div><p>Không tạo thêm “trung tâm con”. Khu quản trị của mỗi client chỉ là control surface của chính client đó.</p></div>
          <div className={styles.architectureFlow}>
            <div className={styles.serverBlock}><span>LEVEL 0 · SERVER</span><strong>Application Management</strong><small>Policy · quyền quản trị · audit · signed contract</small></div>
            <div className={styles.flowArrow}>↓</div>
            <div className={styles.clientBlocks}>{applications.map((application) => <Link key={application.id} href={application.href} data-status={application.status}><b>{application.initials}</b><span><strong>{application.shortName}</strong><small>{application.childClients?.length ? `${application.childClients.length} sub-client bên dưới` : "Client độc lập"}</small></span></Link>)}</div>
            <div className={styles.flowArrow}>↓</div>
            <div className={styles.endpointBlock}><span>ENDPOINT</span><div>{applicationRegistry[0].deviceExperiences.map((profile) => <i key={profile.id}><DeviceGlyph kind={profile.id} /><small>{profile.label}</small></i>)}</div><p>Thiết bị được phân loại và lưu trong registry của client sở hữu nó.</p></div>
          </div>
        </section>

        <section className={styles.clientPanel}>
          <div className={styles.sectionHead}><div><span className={styles.eyebrow}>CLIENT REGISTRY</span><h2>Ứng dụng đang được quản trị</h2></div><p>Mỗi client chỉ có một đường vào quản trị. Không lặp lại nút “mở site”, “cấp quyền” ở nhiều card/tầng.</p></div>
          <div className={styles.clientTable}>{applications.map((application) => <ClientStatusRow key={application.id} application={application} />)}</div>
        </section>
      </> : null}

      {view === "devices" && canSeeDevices ? <>
        <section className={styles.boundaryNotice}><span>!</span><div><strong>Đây chỉ là thiết bị quản trị Application Management.</strong><p>Thiết bị người dùng của từng client phải quản lý trong khu quản trị của client đó; không đưa chung vào danh sách này.</p></div></section>
        <section className={styles.metrics}>
          <article><span>Tổng thiết bị</span><strong>{deviceCounts.total}</strong><small>Control-plane only</small></article>
          <article data-alert={deviceCounts.pending > 0}><span>Chờ cấp quyền</span><strong>{deviceCounts.pending}</strong><small>Thiết bị mới</small></article>
          <article><span>Đã cấp quyền</span><strong>{deviceCounts.approved}</strong><small>{deviceCounts.online} đang online</small></article>
          <article data-alert={deviceCounts.blocked > 0}><span>Bị khóa/thu hồi</span><strong>{deviceCounts.blocked}</strong><small>Kiểm soát tập trung</small></article>
        </section>
        <section className={styles.devicePanel}>
          <div className={styles.sectionHead}><div><span className={styles.eyebrow}>ACCESS CONTROL</span><h2>Danh sách thiết bị quản trị</h2></div><p>Khóa thiết bị chỉ chặn một máy. Thu hồi tài khoản chặn toàn bộ thiết bị dùng cùng email.</p></div>
          <div className={styles.deviceList}>{bootstrap.controlDevices.length ? bootstrap.controlDevices.map((device) => <DeviceRow key={device.deviceId} device={device} actor={access} role={role} busy={actionBusy} run={(item, operation, selectedRole) => void manageDevice(item, operation, selectedRole)} />) : <div className={styles.emptyState}>Chưa có thiết bị quản trị nào.</div>}</div>
        </section>
      </> : null}

      {view === "audit" && canSeeAudit ? <section className={styles.auditPanel}>
        <div className={styles.sectionHead}><div><span className={styles.eyebrow}>SECURITY TRAIL</span><h2>Thay đổi gần đây</h2></div><p>Nhật ký này không trộn với nhật ký học tập, sức khỏe hoặc hoạt động người dùng của client.</p></div>
        <div className={styles.auditList}>{bootstrap.auditLog.length ? bootstrap.auditLog.map((entry) => <article key={entry.id}>
          <span className={styles.auditMark}>QT</span><div><strong>{auditLabels[entry.action] ?? entry.action}</strong><span>{entry.actor}</span><small>{formatTime(entry.createdAt)} · {entry.target}</small></div>
        </article>) : <div className={styles.emptyState}>Chưa có thay đổi quyền hoặc bảo mật.</div>}</div>
      </section> : null}
    </section>
  </main>;
}
