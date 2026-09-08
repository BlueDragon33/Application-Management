"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { ApplicationConfig, DeviceClass } from "./application-registry";
import { connectAdminCenter, roleLabels, type AdminAccess } from "./admin-device-client";
import styles from "./application-admin.module.css";

const statusLabels = {
  online: "Đang quản trị",
  warning: "Cần hoàn thiện kết nối",
  planned: "Chờ kết nối",
} as const;

const contractLabels = {
  connected: "Contract quản trị đang hoạt động",
  migrating: "Client đã/đang chuẩn bị contract · adapter Trung tâm chưa hoàn tất",
  pending: "Chưa có backend quản trị chính thức",
} as const;

function DeviceGlyph({ kind }: { kind: DeviceClass }) {
  if (kind === "phone") return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="7" y="2.5" width="10" height="19" rx="2.4" /><path d="M10.2 5h3.6M11.2 18.7h1.6" /></svg>;
  if (kind === "tablet") return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="2.5" width="16" height="19" rx="2.4" /><path d="M10.5 18.5h3" /></svg>;
  return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2.5" y="3.5" width="19" height="13" rx="2" /><path d="M8 20.5h8M10 16.5v4M14 16.5v4" /></svg>;
}

function WorkspaceGate({ application, access, error, busy, retry }: {
  application: ApplicationConfig;
  access: AdminAccess | null;
  error: string;
  busy: boolean;
  retry: () => void;
}) {
  return <main className={styles.workspaceGate}><section>
    <span className={styles.workspaceGateMark}>{application.initials}</span>
    <small>APPLICATION MANAGEMENT · CLIENT ADMIN GATE</small>
    <h1>{access?.status === "pending" ? "Thiết bị quản trị đang chờ cấp quyền." : access?.status === "blocked" ? "Thiết bị quản trị đã bị khóa." : `Đang xác thực khu quản trị ${application.shortName}…`}</h1>
    <p>{error || "Đây là control surface của client, chỉ mở trên thiết bị quản trị đã được Application Management phê duyệt. Runtime client vẫn chạy độc lập."}</p>
    {access?.deviceCode ? <div className={styles.workspaceGateCode}><span>Mã thiết bị quản trị</span><strong>{access.deviceCode}</strong></div> : null}
    <button onClick={retry} disabled={busy}>{busy ? "Đang xác thực…" : "Kiểm tra lại quyền"}</button>
  </section></main>;
}

export default function ApplicationWorkspace({ application, user }: { application: ApplicationConfig; user: { displayName: string; email: string } }) {
  const [access, setAccess] = useState<AdminAccess | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");

  async function verifyAccess() {
    setBusy(true); setError("");
    try {
      const result = await connectAdminCenter();
      setAccess(result.access);
      if (result.access.status === "approved" && !result.bootstrap) setError("Không thể xác nhận control-plane của thiết bị quản trị.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không thể xác thực thiết bị quản trị.");
    } finally { setBusy(false); }
  }

  useEffect(() => { void verifyAccess(); }, []);

  if (!access || access.status !== "approved") {
    return <WorkspaceGate application={application} access={access} error={error} busy={busy} retry={() => void verifyAccess()} />;
  }

  const hasChildren = Boolean(application.childClients?.length);

  return <main className={styles.workspaceShell}>
    <aside className={styles.clientRail}>
      <Link href="/" className={styles.railBrand}><span>AM</span><div><small>SERVER</small><strong>Application Management</strong></div></Link>
      <div className={styles.railConnector}><i /><span>signed contract</span><i /></div>
      <div className={styles.railClient}><span>{application.initials}</span><div><small>CLIENT CẤP 1</small><strong>{application.shortName}</strong></div></div>
      <nav className={styles.railNav} aria-label={`Khu quản trị ${application.shortName}`}>
        <a href="#overview"><span>01</span><div><strong>Tổng quan</strong><small>Boundary & contract</small></div></a>
        {hasChildren ? <a href="#subclients"><span>02</span><div><strong>Sub-client</strong><small>Tầng client con</small></div></a> : null}
        <a href="#devices"><span>{hasChildren ? "03" : "02"}</span><div><strong>Thiết bị & giao diện</strong><small>Endpoint policy</small></div></a>
        <a href="#contract"><span>{hasChildren ? "04" : "03"}</span><div><strong>Admin contract</strong><small>Backend thật</small></div></a>
        <a href="#guardrails"><span>{hasChildren ? "05" : "04"}</span><div><strong>Ranh giới</strong><small>Không vượt phạm vi</small></div></a>
      </nav>
      <div className={styles.railUser}><span>{user.displayName.slice(0,1).toUpperCase()}</span><div><strong>{user.displayName}</strong><small>{roleLabels[access.role]} · {access.deviceCode}</small></div></div>
    </aside>

    <div className={styles.workspaceMain}>
      <header className={styles.workspaceTopbar}>
        <div className={styles.breadcrumb}><Link href="/">Server</Link><span>/</span><b>Client</b><span>/</span><strong>{application.shortName}</strong></div>
        <div className={styles.topbarMeta}><span data-status={application.status}>{statusLabels[application.status]}</span><small>{application.repository}</small></div>
      </header>

      <section id="overview" className={styles.clientHero} data-status={application.status}>
        <div className={styles.clientHeroCopy}>
          <span className={styles.eyebrow}>LEVEL 1 · INDEPENDENT CLIENT</span>
          <h1>Quản trị {application.name}</h1>
          <p>{application.scope}</p>
          <div className={styles.heroFacts}>
            <div><span>Control plane</span><strong>Application Management</strong></div>
            <div><span>Client repository</span><strong>{application.repository}</strong></div>
            <div><span>Admin contract</span><strong>{contractLabels[application.contractState]}</strong></div>
          </div>
        </div>
        <div className={styles.boundaryDiagram}>
          <div data-level="server"><small>LEVEL 0</small><strong>Application Management</strong><span>policy · admin device · audit</span></div>
          <i><span>signed contract</span></i>
          <div data-level="client"><small>LEVEL 1</small><strong>{application.shortName}</strong><span>runtime · DB · device registry</span></div>
          {hasChildren ? <><i><span>client-owned contract</span></i><div data-level="subclient"><small>LEVEL 2</small><strong>{application.childClients?.length} sub-client/module</strong><span>do {application.shortName} quản trị</span></div></> : null}
        </div>
      </section>

      <section className={styles.contractStatusCard}>
        <div><span className={styles.statusDot} data-contract={application.contractState} /><div><small>TRẠNG THÁI KẾT NỐI</small><strong>{contractLabels[application.contractState]}</strong></div></div>
        <p>{application.contractNote}</p>
      </section>

      <section className={styles.boundaryCallout}>
        <span>CONTROL BOUNDARY</span>
        <p><strong>Server không chạy client.</strong> Application Management chỉ cấp/thu hồi quyền, gọi API quản trị đã công bố và nhận telemetry tối thiểu. Runtime, dữ liệu chuyên môn, phiên người dùng và registry endpoint thuộc client này.</p>
      </section>

      {hasChildren ? <section id="subclients" className={styles.workspaceSection}>
        <div className={styles.sectionHeader}><div><span className={styles.eyebrow}>LEVEL 2 · SUB-CLIENT TOPOLOGY</span><h2>Client con dưới {application.shortName}</h2></div><p>Sub-client không tự trở thành client cấp 1 của Application Management. Client cha quyết định policy, contract và đường quản trị xuống tầng dưới.</p></div>
        <div className={styles.subClientGrid}>{application.childClients?.map((child) => <article key={child.id} data-state={child.state}>
          <div className={styles.subClientHead}><span>{child.initials}</span><div><small>{child.kind === "subject-site" ? "SUB-CLIENT SITE" : "SUB-CLIENT MODULE"}</small><strong>{child.name}</strong></div></div>
          <div className={styles.subClientState}><span>{child.state === "independent" ? "Repo/site độc lập" : child.state === "module" ? "Đang nằm trong client cha" : "Lập kế hoạch"}</span><b data-contract={child.contractState}>{child.contractState === "connected" ? "Contract active" : child.contractState === "migrating" ? "Migrating" : "Contract pending"}</b></div>
          <p>{child.note}</p>
          <small>{child.repository ?? child.sourcePath ?? "Chưa gán nguồn"}</small>
        </article>)}</div>
      </section> : null}

      <section id="devices" className={styles.workspaceSection}>
        <div className={styles.sectionHeader}><div><span className={styles.eyebrow}>ENDPOINT EXPERIENCE</span><h2>Phân loại thiết bị và giao diện</h2></div><p>Thiết bị được client tự nhận diện. Không chỉ responsive theo kích thước; từng lớp endpoint có mật độ, điều hướng và kiểu tương tác khác nhau.</p></div>
        <div className={styles.deviceExperienceGrid}>{application.deviceExperiences.map((profile) => <article key={profile.id} data-device={profile.id}>
          <div className={styles.deviceIllustration}><DeviceGlyph kind={profile.id} /></div>
          <div className={styles.deviceExperienceBody}><div><small>{profile.viewport}</small><h3>{profile.label}</h3></div><p>{profile.shell}</p><dl><div><dt>Điều hướng</dt><dd>{profile.navigation}</dd></div><div><dt>Mật độ</dt><dd>{profile.density}</dd></div><div><dt>Tương tác</dt><dd>{profile.interaction}</dd></div></dl></div>
        </article>)}</div>
        <div className={styles.devicePolicyBox}><span>DEVICE REGISTRY</span><p>{application.devicePolicy}</p><strong>Registry endpoint không nằm trong database Application Management.</strong></div>
      </section>

      <section id="contract" className={styles.workspaceSection}>
        <div className={styles.sectionHeader}><div><span className={styles.eyebrow}>ADMIN CONTRACT</span><h2>{application.contractState === "connected" ? "Backend quản trị đã sẵn sàng" : "Chưa bật các thao tác giả lập"}</h2></div><p>{application.contractState === "connected" ? "Chỉ những chức năng được backend client cung cấp thật mới xuất hiện trong khu quản trị." : "Chỉ khi repository ứng dụng cung cấp API quản trị, xác thực thiết bị, policy và audit theo chuẩn thì nút thao tác mới được bật."}</p></div>
        <div className={styles.capabilityGrid}>{application.capabilities.map((item, index) => <article key={item}><span>{String(index + 1).padStart(2,"0")}</span><strong>{item}</strong><small>{application.contractState === "connected" ? "Có thể nối backend thật" : "Chờ contract chính thức"}</small></article>)}</div>
      </section>

      <section id="guardrails" className={styles.workspaceSection}>
        <div className={styles.sectionHeader}><div><span className={styles.eyebrow}>GUARDRAILS</span><h2>Ranh giới không được vượt</h2></div><p>Các quy tắc này quan trọng hơn sự tiện lợi của giao diện. Nếu contract chưa đủ, giao diện phải thể hiện trạng thái chờ thay vì giả lập thao tác.</p></div>
        <div className={styles.guardrailGrid}>{application.guardrails.map((item, index) => <article key={item}><span>{String(index + 1).padStart(2,"0")}</span><p>{item}</p></article>)}</div>
      </section>
    </div>
  </main>;
}
