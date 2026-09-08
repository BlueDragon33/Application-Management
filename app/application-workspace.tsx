"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { ApplicationConfig, DeviceClass } from "./application-registry";
import { connectAdminCenter, roleLabels, type AdminAccess } from "./admin-device-client";
import styles from "./application-admin.module.css";

type WorkspaceView = "overview" | "devices" | "content" | "subclients";

const statusLabels = {
  online: "Đang quản trị",
  warning: "Cần hoàn thiện",
  planned: "Chờ kết nối",
} as const;

const contractLabels = {
  connected: "Contract hoạt động",
  migrating: "Đang nối adapter",
  pending: "Chưa nối backend",
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
    <p>{error || "Khu quản trị client chỉ mở trên thiết bị đã được Application Management cấp quyền. Runtime và dữ liệu của client vẫn hoàn toàn độc lập."}</p>
    {access?.deviceCode ? <div className={styles.workspaceGateCode}><span>Mã thiết bị quản trị</span><strong>{access.deviceCode}</strong></div> : null}
    <button onClick={retry} disabled={busy}>{busy ? "Đang xác thực…" : "Kiểm tra lại quyền"}</button>
  </section></main>;
}

export default function ApplicationWorkspace({ application, user }: { application: ApplicationConfig; user: { displayName: string; email: string } }) {
  const [access, setAccess] = useState<AdminAccess | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [view, setView] = useState<WorkspaceView>("overview");

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
  const childCount = application.childClients?.length ?? 0;
  const connectedCapabilities = application.contractState === "connected" ? application.capabilities.length : 0;
  const currentTitle = useMemo(() => {
    if (view === "devices") return { eyebrow: "DEVICE & ACCESS", title: "Thiết bị & quyền truy cập", description: "Client tự nhận diện endpoint, giữ registry và áp dụng giao diện phù hợp theo loại thiết bị." };
    if (view === "content") return { eyebrow: "CONTENT & CONTROL", title: "Nội dung & quyền chỉnh sửa", description: "Một nơi duy nhất cho các năng lực quản trị client; không nhân bản nút thao tác ở nhiều màn hình." };
    if (view === "subclients") return { eyebrow: "SUB-CLIENTS", title: `Client con của ${application.shortName}`, description: "Sub-client nằm dưới quyền client cha; Application Management không biến chúng thành client cấp 1 một cách tự động." };
    return { eyebrow: "CLIENT CONTROL SURFACE", title: `Quản trị ${application.name}`, description: application.scope };
  }, [application.name, application.scope, application.shortName, view]);

  return <main className={styles.workspaceShell}>
    <aside className={styles.clientSidebar}>
      <Link href="/" className={styles.serverBack}><span>←</span><div><small>SERVER</small><strong>Application Management</strong></div></Link>
      <div className={styles.clientBrand}><span>{application.initials}</span><div><small>CLIENT CẤP 1</small><strong>{application.shortName}</strong></div></div>
      <div className={styles.clientStatus}><i data-status={application.status} /><div><strong>{statusLabels[application.status]}</strong><small>{contractLabels[application.contractState]}</small></div></div>

      <nav className={styles.clientNav} aria-label={`Khu quản trị ${application.shortName}`}>
        <span className={styles.navGroup}>QUẢN TRỊ CLIENT</span>
        <button data-active={view === "overview"} onClick={() => setView("overview")}><span>01</span><div><strong>Tổng quan</strong><small>Trạng thái & boundary</small></div></button>
        <button data-active={view === "devices"} onClick={() => setView("devices")}><span>02</span><div><strong>Thiết bị & quyền</strong><small>Endpoint registry</small></div></button>
        <button data-active={view === "content"} onClick={() => setView("content")}><span>03</span><div><strong>Nội dung & chỉnh sửa</strong><small>Capability contract</small></div></button>
        {hasChildren ? <button data-active={view === "subclients"} onClick={() => setView("subclients")}><span>04</span><div><strong>Sub-client</strong><small>Site/module cấp 2</small></div></button> : null}
      </nav>

      <div className={styles.clientBoundary}><span>RANH GIỚI</span><strong>Không có “trung tâm quản trị con”.</strong><p>Đây chỉ là control surface của {application.shortName}. Runtime, DB, phiên và thiết bị người dùng vẫn thuộc client.</p></div>
      <div className={styles.clientUser}><span>{user.displayName.slice(0, 1).toUpperCase()}</span><div><strong>{user.displayName}</strong><small>{roleLabels[access.role]}</small><small>{access.deviceCode}</small></div></div>
    </aside>

    <section className={styles.workspaceMain}>
      <header className={styles.workspaceTopbar}>
        <div><span>{currentTitle.eyebrow}</span><h1>{currentTitle.title}</h1><p>{currentTitle.description}</p></div>
        <div className={styles.topbarActions}><Link href="/">Hệ thống</Link><button onClick={() => void verifyAccess()} disabled={busy}>{busy ? "Đang cập nhật…" : "Cập nhật"}</button></div>
      </header>
      {error ? <div className={styles.workspaceError}>{error}</div> : null}

      {view === "overview" ? <>
        <section className={styles.clientMetrics}>
          <article><span>Vai trò</span><strong>Client cấp 1</strong><small>Thuộc Application Management</small></article>
          <article data-state={application.contractState}><span>Admin contract</span><strong>{contractLabels[application.contractState]}</strong><small>{connectedCapabilities}/{application.capabilities.length} năng lực đang có backend</small></article>
          <article><span>Sub-client</span><strong>{childCount}</strong><small>{childCount ? `Do ${application.shortName} quản trị` : "Không có tầng con"}</small></article>
          <article><span>Endpoint class</span><strong>{application.deviceExperiences.length}</strong><small>Desktop · tablet/iPad · phone</small></article>
        </section>

        <section className={styles.clientPanel}>
          <div className={styles.panelHeader}><div><span>ARCHITECTURE</span><h2>Luồng quản trị duy nhất</h2></div><p>Quyền đi từ server xuống client; dữ liệu chuyên môn không bị kéo ngược về server chỉ để hiển thị giao diện.</p></div>
          <div className={styles.controlFlow}>
            <div data-level="server"><small>LEVEL 0 · SERVER</small><strong>Application Management</strong><span>Policy · admin device · audit</span></div>
            <b>→</b>
            <div data-level="client"><small>LEVEL 1 · CLIENT</small><strong>{application.shortName}</strong><span>Runtime · DB · registry thiết bị</span></div>
            {hasChildren ? <><b>→</b><div data-level="subclient"><small>LEVEL 2 · SUB-CLIENT</small><strong>{childCount} site/module</strong><span>Do {application.shortName} quản trị</span></div></> : null}
          </div>
        </section>

        <section className={styles.clientPanel}>
          <div className={styles.panelHeader}><div><span>CONTRACT STATUS</span><h2>Trạng thái kết nối</h2></div><p>{application.contractNote}</p></div>
          <div className={styles.contractSummary}>
            <div><span>Repository</span><strong>{application.repository}</strong></div>
            <div><span>Backend</span><strong>{contractLabels[application.contractState]}</strong></div>
            <div><span>Device registry</span><strong>Thuộc {application.shortName}</strong></div>
            <div><span>Control-plane</span><strong>Chỉ policy & audit cần thiết</strong></div>
          </div>
        </section>
      </> : null}

      {view === "devices" ? <>
        <section className={styles.boundaryNotice}><span>!</span><div><strong>Thiết bị người dùng thuộc registry của {application.shortName}.</strong><p>Application Management không gom fingerprint hoặc presence endpoint của client vào database quản trị Trung tâm.</p></div></section>
        <section className={styles.clientPanel}>
          <div className={styles.panelHeader}><div><span>ENDPOINT EXPERIENCE</span><h2>Phân loại thiết bị</h2></div><p>{application.devicePolicy}</p></div>
          <div className={styles.endpointList}>{application.deviceExperiences.map((profile) => <article key={profile.id}>
            <span className={styles.endpointIcon}><DeviceGlyph kind={profile.id} /></span>
            <div><small>{profile.viewport}</small><strong>{profile.label}</strong><p>{profile.shell}</p></div>
            <dl><div><dt>Điều hướng</dt><dd>{profile.navigation}</dd></div><div><dt>Mật độ</dt><dd>{profile.density}</dd></div><div><dt>Tương tác</dt><dd>{profile.interaction}</dd></div></dl>
          </article>)}</div>
        </section>
      </> : null}

      {view === "content" ? <section className={styles.clientPanel}>
        <div className={styles.panelHeader}><div><span>CAPABILITY CONTRACT</span><h2>{application.contractState === "connected" ? "Năng lực quản trị client" : "Chưa bật thao tác khi backend chưa đủ"}</h2></div><p>{application.contractState === "connected" ? "Các năng lực dưới đây chỉ được nối tới backend thật của client." : "Không dựng nút cấp quyền, mở Web App, duyệt hay chỉnh sửa giả. Khi adapter thật hoàn tất, thao tác sẽ xuất hiện đúng một lần tại khu này."}</p></div>
        <div className={styles.capabilityList}>{application.capabilities.map((item, index) => <article key={item}>
          <span>{String(index + 1).padStart(2, "0")}</span><div><strong>{item}</strong><small>{application.contractState === "connected" ? "Backend sẵn sàng" : "Chờ contract/adapter chính thức"}</small></div><i data-contract={application.contractState} />
        </article>)}</div>
        <div className={styles.guardrailBlock}><span>KHÔNG ĐƯỢC VƯỢT PHẠM VI</span>{application.guardrails.map((item) => <p key={item}>• {item}</p>)}</div>
      </section> : null}

      {view === "subclients" && hasChildren ? <section className={styles.clientPanel}>
        <div className={styles.panelHeader}><div><span>LEVEL 2</span><h2>Sub-client dưới {application.shortName}</h2></div><p>Mỗi site/module chỉ xuất hiện một lần ở đây; không nhân bản thành card ở Y tế, Hòa nhập Nga hoặc khu client khác.</p></div>
        <div className={styles.subClientList}>{application.childClients?.map((child) => <article key={child.id}>
          <span className={styles.subClientMark}>{child.initials}</span>
          <div><strong>{child.name}</strong><small>{child.repository ?? child.sourcePath ?? "Chưa gán nguồn"}</small></div>
          <div><span>Loại</span><strong>{child.kind === "subject-site" ? "Site môn học" : "Module"}</strong></div>
          <div><span>Trạng thái</span><strong>{child.state === "independent" ? "Độc lập" : child.state === "module" ? "Trong client cha" : "Kế hoạch"}</strong></div>
          <div><span>Contract</span><strong>{contractLabels[child.contractState]}</strong></div>
        </article>)}</div>
      </section> : null}
    </section>
  </main>;
}
