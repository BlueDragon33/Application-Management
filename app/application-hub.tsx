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

type CenterView = "overview" | "topology" | "applications" | "devices" | "audit";

const statusLabels = {
  online: "Đang quản trị",
  warning: "Cần hoàn thiện",
  planned: "Chờ kết nối",
} as const;

const contractLabels = {
  connected: "Contract hoạt động",
  migrating: "Adapter đang hoàn thiện",
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
    eyebrow: "SERVER / CONTROL PLANE",
    title: "Trung tâm điều hành",
    description: "Một đầu não quản trị, nhiều client độc lập và mỗi client tự sở hữu runtime, dữ liệu, registry thiết bị.",
  },
  topology: {
    eyebrow: "SYSTEM TOPOLOGY",
    title: "Sơ đồ phân tầng",
    description: "Server → client cấp 1 → sub-client → thiết bị đầu cuối. Quyền đi xuống qua contract, dữ liệu chuyên môn không đi ngược về Trung tâm.",
  },
  applications: {
    eyebrow: "CLIENT REGISTRY",
    title: "Danh mục client",
    description: "Mỗi ứng dụng có khu quản trị, backend contract, policy thiết bị và ranh giới riêng.",
  },
  devices: {
    eyebrow: "CONTROL-PLANE DEVICES",
    title: "Thiết bị quản trị Trung tâm",
    description: "Chỉ quản lý máy của quản trị viên Application Management; thiết bị người dùng nằm trong registry của từng client.",
  },
  audit: {
    eyebrow: "SECURITY & AUDIT",
    title: "Nhật ký control-plane",
    description: "Truy vết thay đổi quyền và bảo mật của server quản trị, tách khỏi nhật ký nghiệp vụ của client.",
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
      <div className={styles.gateMark}>AM</div>
      <span className={styles.eyebrow}>SECURE CONTROL PLANE</span>
      <h1>{access?.status === "pending"
        ? "Thiết bị quản trị đang chờ cấp quyền."
        : access?.status === "blocked"
          ? "Thiết bị quản trị đã bị khóa."
          : "Đang xác thực thiết bị quản trị…"}</h1>
      <p>{error || "Application Management chỉ mở trên máy quản trị có khóa P-256 hợp lệ. Đây là server quản trị, không phải site nghiệp vụ của người dùng."}</p>
      {access?.deviceCode ? <div className={styles.gateCode}><span>Mã thiết bị quản trị</span><strong>{access.deviceCode}</strong></div> : null}
      <button className={styles.primaryButton} onClick={retry} disabled={busy}>{busy ? "Đang xác thực…" : "Kiểm tra lại quyền"}</button>
    </section>
  </main>;
}

function ContractBadge({ application }: { application: ApplicationConfig }) {
  return <span className={styles.contractBadge} data-contract={application.contractState}>
    <i />{contractLabels[application.contractState]}
  </span>;
}

function DeviceExperienceStrip({ application }: { application: ApplicationConfig }) {
  return <div className={styles.deviceStrip}>
    {application.deviceExperiences.map((profile) => <div key={profile.id} className={styles.devicePill} data-device={profile.id}>
      <span className={styles.deviceGlyph}><DeviceGlyph kind={profile.id} /></span>
      <div><strong>{profile.label}</strong><small>{profile.viewport}</small></div>
    </div>)}
  </div>;
}

function ApplicationCard({ application }: { application: ApplicationConfig & { registered?: boolean } }) {
  const childCount = application.childClients?.length ?? 0;
  return <article className={styles.appCard} data-status={application.status}>
    <div className={styles.appCardTop}>
      <div className={styles.appIdentity}>
        <span className={styles.appInitials}>{application.initials}</span>
        <div><small>CLIENT CẤP 1</small><strong>{application.name}</strong><span>{application.repository}</span></div>
      </div>
      <span className={styles.statusBadge} data-status={application.status}>{statusLabels[application.status]}</span>
    </div>
    <p className={styles.appScope}>{application.scope}</p>
    <div className={styles.appMetaGrid}>
      <div><span>Control contract</span><ContractBadge application={application} /></div>
      <div><span>Client con</span><strong>{childCount ? `${childCount} sub-client/module` : "Không có tầng con"}</strong></div>
      <div><span>Registry Trung tâm</span><strong>{application.registered ? "Đã khai báo live" : "Registry cấu hình"}</strong></div>
    </div>
    <div className={styles.appContractNote}>{application.contractNote}</div>
    <DeviceExperienceStrip application={application} />
    {childCount ? <div className={styles.childPreview}>
      <span>Sub-client dưới {application.shortName}</span>
      <div>{application.childClients?.slice(0, 5).map((child) => <b key={child.id}>{child.name}</b>)}{childCount > 5 ? <b>+{childCount - 5}</b> : null}</div>
    </div> : null}
    <div className={styles.appCardFooter}>
      <small>{application.guardrails[0]}</small>
      <Link href={application.href}>{application.contractState === "connected" ? "Mở khu quản trị" : "Xem khu quản trị"}<span>→</span></Link>
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

function TopologyMap({ applications }: { applications: readonly (ApplicationConfig & { registered?: boolean })[] }) {
  return <section className={styles.topologyCanvas}>
    <div className={styles.serverNode}>
      <div className={styles.serverNodeHead}><span className={styles.serverIcon}>AM</span><div><small>LEVEL 0 · SERVER</small><strong>Application Management</strong><p>Policy · quyền · admin device · audit · signed contracts</p></div></div>
      <div className={styles.serverBoundary}>Không chứa runtime, DB, nội dung hoặc registry thiết bị người dùng của client.</div>
    </div>
    <div className={styles.verticalConnector}><span>signed admin contracts</span></div>
    <div className={styles.clientTopologyGrid}>
      {applications.map((application) => <article key={application.id} className={styles.clientNode} data-status={application.status}>
        <div className={styles.clientNodeHead}><span>{application.initials}</span><div><small>LEVEL 1 · CLIENT</small><strong>{application.shortName}</strong><ContractBadge application={application} /></div></div>
        <p>{application.scope}</p>
        {application.childClients?.length ? <div className={styles.subClientTree}>
          <div className={styles.subClientStem}>LEVEL 2 · SUB-CLIENT</div>
          <div className={styles.subClientList}>{application.childClients.map((child) => <div key={child.id} data-state={child.state}>
            <b>{child.initials}</b><span><strong>{child.name}</strong><small>{child.state === "independent" ? "Repo/site độc lập" : child.state === "module" ? "Module trong client cha" : "Đang lập kế hoạch"}</small></span>
          </div>)}</div>
        </div> : <div className={styles.noSubClient}>Không có sub-client được khai báo.</div>}
        <div className={styles.endpointBranch}>
          <span>ENDPOINTS</span>
          <div>{application.deviceExperiences.map((profile) => <i key={profile.id} title={`${profile.label} ${profile.viewport}`}><DeviceGlyph kind={profile.id} /></i>)}</div>
          <small>Registry thiết bị thuộc {application.shortName}</small>
        </div>
      </article>)}
    </div>
  </section>;
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
    if (requested && ["overview", "topology", "applications", "devices", "audit"].includes(requested)) setView(requested as CenterView);
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
  const attentionApps = applications.filter((item) => item.status !== "online");
  const title = viewTitles[view];

  return <main className={styles.shell}>
    <aside className={styles.sidebar}>
      <div className={styles.brand}><div className={styles.brandMark}>AM</div><div><span>SERVER / CONTROL PLANE</span><strong>Application Management</strong></div></div>
      <div className={styles.systemState}><span className={styles.systemDot} /><div><strong>Server quản trị hoạt động</strong><small>Client boundary được thực thi</small></div></div>
      <nav className={styles.nav} aria-label="Điều hướng Trung tâm quản trị">
        <button data-active={view === "overview"} onClick={() => switchView("overview")}><span>01</span><div><strong>Tổng quan</strong><small>Điều hành server</small></div></button>
        <button data-active={view === "topology"} onClick={() => switchView("topology")}><span>02</span><div><strong>Sơ đồ hệ thống</strong><small>Server → client → device</small></div></button>
        <button data-active={view === "applications"} onClick={() => switchView("applications")}><span>03</span><div><strong>Client</strong><small>Khu quản trị riêng</small></div></button>
        {canSeeDevices ? <button data-active={view === "devices"} onClick={() => switchView("devices")}><span>04</span><div><strong>Thiết bị quản trị</strong><small>Chỉ của control-plane</small></div></button> : null}
        {canSeeAudit ? <button data-active={view === "audit"} onClick={() => switchView("audit")}><span>05</span><div><strong>Nhật ký & bảo mật</strong><small>Truy vết server</small></div></button> : null}
      </nav>
      <div className={styles.boundaryBox}><span>KIẾN TRÚC CỨNG</span><strong>Server quản trị ≠ client nghiệp vụ.</strong><p>Server cấp policy và quyền qua contract. Client tự giữ runtime, dữ liệu và thiết bị. Client lớn có thể quản trị sub-client của chính nó.</p></div>
      <div className={styles.userCard}><div className={styles.avatar}>{user.displayName.slice(0, 1).toUpperCase()}</div><div><strong>{user.displayName}</strong><span>{roleLabels[role]}</span><small>{access.deviceCode}</small></div><a href="/logout?return_to=/login" aria-label="Đăng xuất">↗</a></div>
    </aside>

    <section className={styles.main}>
      <header className={styles.topbar}>
        <div><span>{title.eyebrow}</span><h1>{title.title}</h1><p>{title.description}</p></div>
        <button className={styles.refreshButton} onClick={() => void initialize()} disabled={busy}>{busy ? "Đang đồng bộ…" : "Đồng bộ trạng thái"}</button>
      </header>
      {error || bootstrap.upstreamError ? <div className={styles.error}>{error || bootstrap.upstreamError}</div> : null}
      {notice ? <div className={styles.notice}>{notice}</div> : null}

      {view === "overview" ? <>
        <section className={styles.hero}>
          <div className={styles.heroCopy}>
            <span className={styles.eyebrow}>CONTROL PLANE ARCHITECTURE</span>
            <h2>Một server quản trị. Nhiều client độc lập.</h2>
            <p>Application Management là đầu não cấp quyền và điều phối. Bơi ếch, Sức khỏe Y tế, Hòa nhập Nga, Bauman Hub và GrowUP là client cấp 1. Bauman có thể có thêm site môn học ở cấp 2; thiết bị luôn nằm dưới client sở hữu chúng.</p>
            <div className={styles.heroActions}><button onClick={() => switchView("topology")}>Xem sơ đồ phân tầng</button><button onClick={() => switchView("applications")}>Quản trị client</button></div>
          </div>
          <div className={styles.heroDiagram} aria-label="Sơ đồ Server đến Client đến thiết bị">
            <div className={styles.heroServer}><span>SERVER</span><strong>Application Management</strong><small>policy · admin devices · audit</small></div>
            <div className={styles.heroBus}><i /><span>signed contracts</span><i /></div>
            <div className={styles.heroClients}>{applications.map((application) => <span key={application.id} data-status={application.status}>{application.initials}</span>)}</div>
            <div className={styles.heroEndpointLine} />
            <div className={styles.heroEndpoints}><span><DeviceGlyph kind="desktop" /></span><span><DeviceGlyph kind="tablet" /></span><span><DeviceGlyph kind="phone" /></span></div>
            <small className={styles.heroCaption}>Endpoint registry thuộc từng client, không thuộc server.</small>
          </div>
        </section>

        <section className={styles.metrics}>
          <article><span>Client cấp 1</span><strong>{appCounts.total}</strong><small>{appCounts.connected} contract đã nối</small></article>
          <article data-alert={appCounts.attention > 0}><span>Cần hoàn thiện</span><strong>{appCounts.attention}</strong><small>adapter/contract đang xử lý</small></article>
          <article><span>Sub-client đã mô hình hóa</span><strong>{appCounts.children}</strong><small>hiện tập trung dưới Bauman Hub</small></article>
          <article data-alert={deviceCounts.pending > 0}><span>Thiết bị quản trị chờ duyệt</span><strong>{deviceCounts.pending}</strong><small>{deviceCounts.online} máy quản trị đang online</small></article>
        </section>

        <section className={styles.dashboardGrid}>
          <div className={styles.panel}>
            <div className={styles.panelHead}><div><span className={styles.eyebrow}>CLIENT HEALTH</span><h3>Trạng thái quản trị</h3><p>Trạng thái dưới đây là contract với server, không phải trạng thái runtime nghiệp vụ.</p></div><button onClick={() => switchView("applications")}>Xem tất cả</button></div>
            <div className={styles.compactApps}>{applications.map((application) => <Link key={application.id} href={application.href}>
              <span className={styles.compactIcon}>{application.initials}</span><div><strong>{application.shortName}</strong><small>{application.contractNote}</small></div><ContractBadge application={application} />
            </Link>)}</div>
          </div>
          <div className={styles.panel}>
            <div className={styles.panelHead}><div><span className={styles.eyebrow}>ACTION QUEUE</span><h3>Việc cần xử lý</h3><p>Chỉ hiển thị việc thuộc control-plane hoặc contract.</p></div></div>
            <div className={styles.queue}>
              {deviceCounts.pending > 0 && canSeeDevices ? <button onClick={() => switchView("devices")}><span className={styles.queueNumber}>{deviceCounts.pending}</span><div><strong>Thiết bị quản trị chờ duyệt</strong><small>Cấp quyền reviewer/publisher hoặc từ chối.</small></div><b>→</b></button> : null}
              {attentionApps.map((application, index) => <Link key={application.id} href={application.href}><span className={styles.queueNumber}>{String(index + 1).padStart(2, "0")}</span><div><strong>{application.shortName}</strong><small>{application.contractNote}</small></div><b>→</b></Link>)}
              {!deviceCounts.pending && !attentionApps.length ? <div className={styles.emptyState}>Không có việc control-plane đang chờ xử lý.</div> : null}
            </div>
          </div>
        </section>

        <section className={styles.deviceStandard}>
          <div className={styles.sectionTitle}><div><span className={styles.eyebrow}>RESPONSIVE DEVICE CONTRACT</span><h3>Giao diện theo đúng loại thiết bị</h3></div><p>Phân loại diễn ra tại từng client. Server chỉ quy định chuẩn UX tối thiểu và không gom device fingerprint của client.</p></div>
          <div className={styles.deviceProfiles}>{applicationRegistry[0].deviceExperiences.map((profile) => <article key={profile.id}>
            <div className={styles.deviceProfileIcon}><DeviceGlyph kind={profile.id} /></div><div><span>{profile.viewport}</span><h4>{profile.label}</h4><p>{profile.shell}</p><small>{profile.navigation} · {profile.interaction}</small></div>
          </article>)}</div>
        </section>
      </> : null}

      {view === "topology" ? <>
        <section className={styles.architectureNotice}><div><span>SERVER</span><strong>Chỉ cấp quyền và điều phối</strong></div><i>→</i><div><span>CLIENT</span><strong>Tự sở hữu runtime + DB + device registry</strong></div><i>→</i><div><span>SUB-CLIENT</span><strong>Thuộc phạm vi quản trị của client cha</strong></div><i>→</i><div><span>ENDPOINT</span><strong>Desktop · tablet/iPad · phone</strong></div></section>
        <TopologyMap applications={applications} />
        <section className={styles.rulesGrid}>
          <article><b>01</b><div><strong>Không xuyên tầng</strong><p>Server không quản trị trực tiếp dữ liệu môn học của sub-client khi contract client cha chưa cho phép.</p></div></article>
          <article><b>02</b><div><strong>Không dùng chung registry</strong><p>Mỗi client giữ định danh và presence thiết bị của chính nó; Application Management chỉ giữ thiết bị quản trị server.</p></div></article>
          <article><b>03</b><div><strong>UI theo endpoint</strong><p>Client tự nhận diện desktop/tablet/phone và dùng layout phù hợp, không chỉ co nhỏ giao diện desktop.</p></div></article>
          <article><b>04</b><div><strong>Contract trước, nút sau</strong><p>Chỉ hiển thị thao tác vận hành thật khi backend client đã có API, auth, policy và audit tương ứng.</p></div></article>
        </section>
      </> : null}

      {view === "applications" ? <>
        <section className={styles.registryIntro}><div><span className={styles.eyebrow}>LEVEL 1 CLIENTS</span><h2>Client được quản trị bởi server</h2></div><p>Nhấn vào từng client để vào khu quản trị của chính nó. Đây không phải đường dẫn mở site người dùng; khu quản trị chỉ là control surface qua contract.</p></section>
        <section className={styles.appGrid}>{applications.map((application) => <ApplicationCard key={application.id} application={application} />)}</section>
      </> : null}

      {view === "devices" && canSeeDevices ? <>
        <section className={styles.deviceBoundaryNotice}><span className={styles.noticeIcon}>!</span><div><strong>Đây chỉ là thiết bị quản trị Application Management.</strong><p>Máy tính/điện thoại/tablet của người dùng Bơi ếch, Health, RU_LIFE, Bauman hoặc GrowUP không được lưu ở danh sách này. Muốn quản trị endpoint của client, hãy vào khu quản trị của client tương ứng.</p></div></section>
        <section className={styles.metrics}>
          <article><span>Tổng thiết bị quản trị</span><strong>{deviceCounts.total}</strong><small>Control-plane only</small></article>
          <article data-alert={deviceCounts.pending > 0}><span>Chờ duyệt</span><strong>{deviceCounts.pending}</strong><small>Cần quyết định của owner</small></article>
          <article><span>Đã cấp quyền</span><strong>{deviceCounts.approved}</strong><small>{deviceCounts.online} đang online</small></article>
          <article data-alert={deviceCounts.blocked > 0}><span>Đã khóa</span><strong>{deviceCounts.blocked}</strong><small>Không thể vào server quản trị</small></article>
        </section>
        <section className={styles.deviceList}>{bootstrap.controlDevices.length ? bootstrap.controlDevices.map((device) => <DeviceRow key={device.deviceId} device={device} actor={access} role={role} busy={actionBusy} run={(item, operation, selectedRole) => void manageDevice(item, operation, selectedRole)} />) : <div className={styles.emptyState}>Chưa có thiết bị quản trị nào.</div>}</section>
      </> : null}

      {view === "audit" && canSeeAudit ? <section className={styles.auditPanel}>
        <div className={styles.auditHead}><div><span className={styles.eyebrow}>CONTROL-PLANE AUDIT</span><h2>Thay đổi quyền và bảo mật</h2></div><span>{bootstrap.auditLog.length} bản ghi gần nhất</span></div>
        <div className={styles.auditList}>{bootstrap.auditLog.length ? bootstrap.auditLog.map((entry) => <article key={entry.id}>
          <span className={styles.auditDot} /><div><strong>{auditLabels[entry.action] ?? entry.action}</strong><p>{entry.actor} → {entry.target}</p><small>{entry.source} · {formatTime(entry.createdAt)}</small></div><code>{Object.keys(entry.detail ?? {}).length ? JSON.stringify(entry.detail) : "{}"}</code>
        </article>) : <div className={styles.emptyState}>Chưa có thay đổi control-plane để hiển thị.</div>}</div>
      </section> : null}
    </section>
  </main>;
}
