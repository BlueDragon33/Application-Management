"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { ApplicationConfig } from "./application-registry";
import { connectAdminCenter, type AdminAccess } from "./admin-device-client";
import styles from "./application-admin.module.css";

const statusLabels = {
  online: "Đã nối quản trị",
  warning: "Đang hoàn thiện contract",
  planned: "Chờ kết nối quản trị",
} as const;

const contractLabels = {
  connected: "Contract quản trị đang hoạt động",
  migrating: "Đang chuyển sang contract độc lập",
  pending: "Chưa có backend quản trị chính thức",
} as const;

function WorkspaceGate({ application, access, error, busy, retry }: {
  application: ApplicationConfig;
  access: AdminAccess | null;
  error: string;
  busy: boolean;
  retry: () => void;
}) {
  return <main className={styles.workspaceGate}><section>
    <span className={styles.workspaceGateMark}>{application.initials}</span>
    <small>APPLICATION MANAGEMENT · DEVICE GATE</small>
    <h1>{access?.status === "pending" ? "Thiết bị quản trị đang chờ cấp quyền." : access?.status === "blocked" ? "Thiết bị quản trị đã bị khóa." : `Đang xác thực khu quản trị ${application.shortName}…`}</h1>
    <p>{error || "Khu quản trị ứng dụng chỉ mở trên thiết bị đã được Application Management cấp quyền. Site ứng dụng vẫn hoạt động độc lập và giữ dữ liệu của chính nó."}</p>
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

  return <main className={styles.workspaceShell}><div className={styles.workspaceFrame}>
    <Link href="/" className={styles.backLink}>← Application Management</Link>
    <header className={styles.workspaceHeader}>
      <div className={styles.workspaceIdentity}><span>{application.initials}</span><div><small>ỨNG DỤNG ĐỘC LẬP</small><h1>Quản trị {application.name}</h1><p>{application.scope}</p></div></div>
      <div className={styles.workspaceUser}><strong>{user.displayName}</strong><span>{user.email}</span><small>{access.deviceCode} · {application.repository}</small></div>
    </header>
    <section className={styles.workspaceStatus} data-status={application.status}>
      <div><span>Trạng thái quản trị</span><strong>{statusLabels[application.status]}</strong></div>
      <div><span>Backend contract</span><strong>{contractLabels[application.contractState]}</strong></div>
      <div><span>Mô hình thiết bị</span><strong>Registry riêng theo ứng dụng</strong></div>
    </section>
    <section className={styles.boundary}><strong>Ranh giới bắt buộc</strong><p>Site này phải chạy độc lập với Application Management. Trung tâm chỉ được cấp/thu hồi quyền truy cập, quyền chỉnh sửa, theo dõi trạng thái và gọi các API quản trị đã được công bố. Không nhúng runtime, không chia sẻ DB và không dùng registry thiết bị của site khác.</p></section>
    <section className={styles.workspaceGrid}>
      <article><span>01</span><div><strong>Thiết bị đầu vào</strong><p>{application.devicePolicy}</p></div></article>
      <article><span>02</span><div><strong>Quyền truy cập</strong><p>Cấp, khóa và gia hạn quyền sử dụng theo thiết bị. Mỗi site phải tự giữ mã thiết bị và trạng thái của chính mình.</p></div></article>
      <article><span>03</span><div><strong>Quyền chỉnh sửa</strong><p>Tách riêng quyền xem/sử dụng và quyền sửa. Quyền sửa phải có phạm vi, thời hạn, người cấp và audit.</p></div></article>
      <article><span>04</span><div><strong>Theo dõi & audit</strong><p>Trung tâm chỉ nhận số liệu vận hành cần thiết; dữ liệu chuyên môn và dữ liệu cá nhân vẫn nằm tại ứng dụng.</p></div></article>
    </section>
    <section className={styles.contractPanel}>
      <div><small>ADMIN CONTRACT</small><h2>{application.contractState === "connected" ? "Khu quản trị đã sẵn sàng." : "Chưa bật các thao tác giả lập."}</h2><p>{application.contractState === "connected" ? "Các chức năng bên dưới chỉ dùng backend thật của ứng dụng." : "Chỉ khi repository ứng dụng cung cấp API quản trị, xác thực thiết bị và audit theo chuẩn thì các nút cấp quyền/sửa mới được bật. Điều này tránh giao diện có nút nhưng không có backend thật."}</p></div>
      <div className={styles.contractRules}>{application.capabilities.map((item) => <span key={item}>{item}</span>)}</div>
    </section>
    <section className={styles.guardrails}><h3>Không được vượt phạm vi</h3>{application.guardrails.map((item) => <div key={item}><span>✓</span><p>{item}</p></div>)}</section>
  </div></main>;
}
