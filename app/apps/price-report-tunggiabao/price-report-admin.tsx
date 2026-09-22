"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  connectOperationsDashboard,
  roleLabels,
  type AdminAccess,
  type OperationsBootstrap,
  type OperationsSummary,
} from "../../admin-device-client";
import type { ApplicationConfig } from "../../application-registry";
import styles from "../../application-admin.module.css";

type View = "overview" | "devices" | "experience" | "contract";
type ReadinessState = "available" | "implemented" | "missing";
type Readiness = { label: string; state: ReadinessState; note: string };

const APP_ID = "price-report-tunggiabao";

const connectionLabel: Record<OperationsSummary["connection"], string> = {
  connected: "Contract đã kết nối",
  warning: "Cần xác minh contract",
  pending: "Chưa nối production",
  unavailable: "Mất kết nối",
};

function Gate({ access, busy, error, retry }: { access: AdminAccess | null; busy: boolean; error: string; retry: () => void }) {
  return <main className={styles.workspaceGate}><section>
    <span className={styles.workspaceGateMark}>KT</span>
    <small>PRICE REPORT · ADMIN GATE</small>
    <h1>{access?.status === "pending" ? "Thiết bị quản trị đang chờ cấp quyền." : access?.status === "blocked" ? "Thiết bị quản trị đã bị khóa." : "Đang xác thực khu quản trị Kế toán…"}</h1>
    <p>{error || "PriceReport chỉ mở khu quản trị từ Application Management trên thiết bị quản trị đã được duyệt."}</p>
    {access?.deviceCode ? <div className={styles.workspaceGateCode}><span>Mã thiết bị quản trị</span><strong>{access.deviceCode}</strong></div> : null}
    <button onClick={retry} disabled={busy}>{busy ? "Đang kiểm tra…" : "Kiểm tra lại"}</button>
  </section></main>;
}

export default function PriceReportAdmin({ application, user }: { application: ApplicationConfig; user: { displayName: string; email: string } }) {
  const [access, setAccess] = useState<AdminAccess | null>(null);
  const [operations, setOperations] = useState<OperationsBootstrap | null>(null);
  const [view, setView] = useState<View>("overview");
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setBusy(true);
    setError("");
    try {
      const result = await connectOperationsDashboard();
      setAccess(result.access);
      setOperations(result.bootstrap);
      if (result.access.status === "approved" && !result.bootstrap) setError("Không thể tải bảng điều phối PriceReport từ control-plane.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không thể xác thực khu quản trị PriceReport.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const summary = useMemo(() => operations?.summaries.find((item) => item.appId === APP_ID) ?? null, [operations]);
  const webConnected = summary?.connection === "connected" && Boolean(summary.webHref);
  const remoteAdminReady = summary?.remoteAdminReady === true;

  const readiness = useMemo<Readiness[]>(() => [
    { label: "Runtime PriceReport", state: webConnected ? "available" : "implemented", note: webConnected ? "GitHub Pages và management contract đang phản hồi." : "WebApp độc lập đã có; đang chờ xác minh contract production từ Trung tâm." },
    { label: "Phân loại desktop/tablet/phone", state: "available", note: "Client tự nhận diện lớp thiết bị và áp UI profile tương ứng." },
    { label: "UI profile theo thiết bị", state: "available", note: "Desktop = workspace rộng; tablet = touch split; phone = mobile một cột." },
    { label: "Local device record KT-", state: "available", note: "Client tạo mã KT- và heartbeat cục bộ để chuẩn hóa metadata; không dùng record local làm quyền truy cập." },
    { label: "Remote registry KT-", state: remoteAdminReady ? "available" : "missing", note: remoteAdminReady ? "Registry KT- đang phản hồi qua control-plane." : "Chưa có backend registry tập trung thuộc PriceReport." },
    { label: "Device gateway / session", state: remoteAdminReady ? "available" : "missing", note: remoteAdminReady ? "Gateway thiết bị đã sẵn sàng." : "Chưa có challenge/session server-side nên Trung tâm không được giả lập quyền." },
    { label: "Duyệt / Khóa thiết bị", state: remoteAdminReady ? "available" : "missing", note: remoteAdminReady ? "Có thể điều khiển thiết bị qua contract." : "Đang khóa thao tác cho tới khi client có Control API thật." },
    { label: "Remote audit", state: remoteAdminReady ? "available" : "missing", note: remoteAdminReady ? "Audit thiết bị thuộc PriceReport." : "Hiện audit quản trị thiết bị từ xa chưa tồn tại." },
  ], [remoteAdminReady, webConnected]);

  if (!access || access.status !== "approved") return <Gate access={access} busy={busy} error={error} retry={() => void load()} />;

  const title = view === "devices"
    ? ["DEVICE ACCESS · KT-", "Thiết bị & quyền", "Chuẩn hóa registry thiết bị kiểu Bauman nhưng không bật mutation khi backend PriceReport chưa tồn tại."]
    : view === "experience"
      ? ["DEVICE EXPERIENCE", "Giao diện theo loại thiết bị", "Mỗi lớp thiết bị có viewport, mật độ, điều hướng và kiểu tương tác riêng."]
      : view === "contract"
        ? ["MANAGEMENT CONTRACT", "Độ sẵn sàng quản trị", "Phân biệt rõ contract Web đã có với remote device control chưa có backend."]
        : ["KẾ TOÁN · CLIENT CONTROL", "Quản trị Báo giá Tùng Gia Bảo", "PriceReport là client Kế toán độc lập; dữ liệu báo giá ở client, Trung tâm chỉ quản trị contract và thiết bị khi có backend thật."];

  return <main className={styles.workspaceShell}>
    <aside className={styles.clientSidebar}>
      <Link href="/" className={styles.serverBack}><span>←</span><div><small>SERVER</small><strong>Application Management</strong></div></Link>
      <div className={styles.clientBrand}><span>KT</span><div><small>CLIENT · KẾ TOÁN</small><strong>Báo giá Tùng Gia Bảo</strong></div></div>
      <div className={styles.clientStatus}><i data-status={webConnected ? "online" : "warning"}/><div><strong>{summary ? connectionLabel[summary.connection] : "Đang đọc contract"}</strong><small>{remoteAdminReady ? "Remote registry KT- sẵn sàng" : "Phân loại thiết bị đã có · remote registry chưa có"}</small></div></div>
      <nav className={styles.clientNav}>
        <span className={styles.navGroup}>QUẢN TRỊ KẾ TOÁN</span>
        <button data-active={view === "overview"} onClick={() => setView("overview")}><span>01</span><div><strong>Tổng quan</strong><small>Runtime & ranh giới</small></div></button>
        <button data-active={view === "devices"} onClick={() => setView("devices")}><span>02</span><div><strong>Thiết bị & quyền</strong><small>KT- registry model</small></div></button>
        <button data-active={view === "experience"} onClick={() => setView("experience")}><span>03</span><div><strong>Giao diện thiết bị</strong><small>Desktop · Tablet · Phone</small></div></button>
        <button data-active={view === "contract"} onClick={() => setView("contract")}><span>04</span><div><strong>Contract</strong><small>{readiness.filter((item) => item.state === "available").length}/{readiness.length} sẵn sàng</small></div></button>
      </nav>
      <div className={styles.clientBoundary}><span>RANH GIỚI</span><strong>Không đưa báo giá, khách hàng hoặc backup vào Application Management.</strong><p>Trung tâm không dùng LocalStorage của client làm registry quyền và không bật nút Duyệt/Khóa giả.</p></div>
      <div className={styles.clientUser}><span>{user.displayName.slice(0,1).toUpperCase()}</span><div><strong>{user.displayName}</strong><small>{roleLabels[access.role]}</small><small>{access.deviceCode}</small></div></div>
    </aside>

    <section className={styles.workspaceMain}>
      <header className={styles.workspaceTopbar}>
        <div><span>{title[0]}</span><h1>{title[1]}</h1><p>{title[2]}</p></div>
        <div className={styles.topbarActions}>
          {summary?.webHref ? <a href={summary.webHref} target="_blank" rel="noreferrer">Mở PriceReport ↗</a> : application.publicUrl ? <a href={application.publicUrl} target="_blank" rel="noreferrer">Mở PriceReport ↗</a> : null}
          <Link href="/">Hệ thống</Link>
          <button onClick={() => void load()} disabled={busy}>{busy ? "Đang cập nhật…" : "Cập nhật"}</button>
        </div>
      </header>

      {error ? <div className={styles.workspaceError}>{error}</div> : null}

      {view === "overview" ? <>
        <section className={styles.clientMetrics}>
          <article><span>Nhóm nghiệp vụ</span><strong>Kế toán</strong><small>Báo giá · bảng giá</small></article>
          <article data-state={webConnected ? "connected" : "migrating"}><span>Web contract</span><strong>{webConnected ? "Đã nối" : "Đang xác minh"}</strong><small>management-contract.json</small></article>
          <article data-state="connected"><span>Phân loại thiết bị</span><strong>3 lớp</strong><small>Máy tính · Tablet · Điện thoại</small></article>
          <article data-state={remoteAdminReady ? "connected" : "migrating"}><span>Remote admin</span><strong>{remoteAdminReady ? "Sẵn sàng" : "Chưa bật"}</strong><small>Chờ registry / gateway KT-</small></article>
        </section>

        <section className={styles.clientPanel}>
          <div className={styles.panelHeader}><div><span>CONTROL TOPOLOGY</span><h2>Application Management → PriceReport → thiết bị KT-</h2></div><p>Giữ đúng mô hình Bauman: client sở hữu runtime/registry; Trung tâm chỉ điều phối qua contract.</p></div>
          <div className={styles.controlFlow}>
            <div data-level="server"><small>SERVER</small><strong>Application Management</strong><span>Quản trị tập trung</span></div>
            <b>→</b>
            <div data-level="client"><small>CLIENT KẾ TOÁN</small><strong>PriceReport</strong><span>Local-first · PWA · báo giá</span></div>
            <b>→</b>
            <div data-level="subclient"><small>ENDPOINT</small><strong>KT-*</strong><span>Desktop · Tablet · Phone</span></div>
          </div>
          <div className={styles.contractSummary}>
            <div><span>Repository</span><strong>{application.repository}</strong></div>
            <div><span>Category</span><strong>{application.category}</strong></div>
            <div><span>Device namespace</span><strong>KT-</strong></div>
            <div><span>Remote control</span><strong>{remoteAdminReady ? "Ready" : "Locked"}</strong></div>
          </div>
        </section>

        <div className={styles.boundaryNotice}><span>!</span><div><strong>Local device record không phải authorization.</strong><p>Metadata KT- hiện dùng để phân loại UI và chuẩn bị contract. Quyền Duyệt/Khóa chỉ bật khi có registry server-side + session/audit thật.</p></div></div>
      </> : null}

      {view === "devices" ? <section className={styles.clientPanel}>
        <div className={styles.panelHeader}><div><span>DEVICE REGISTRY MODEL</span><h2>Thiết bị PriceReport</h2></div><p>Thiết kế cùng nguyên tắc với Bauman: registry thuộc client, control-plane đọc qua API, mutation phải đọc lại trạng thái.</p></div>
        <div className={styles.endpointList}>
          {application.deviceExperiences.map((device, index) => <article key={device.id}>
            <span className={styles.endpointIcon}>{index + 1}</span>
            <div><small>{device.id.toUpperCase()}</small><strong>{device.label}</strong><p>{device.viewport} · {device.interaction}</p></div>
            <dl>
              <div><dt>UI shell</dt><dd>{device.shell}</dd></div>
              <div><dt>Navigation</dt><dd>{device.navigation}</dd></div>
              <div><dt>Mật độ</dt><dd>{device.density}</dd></div>
            </dl>
          </article>)}
        </div>
        <div className={styles.guardrailBlock}><span>REMOTE ACTIONS</span><p>{remoteAdminReady ? "Registry KT- đã có backend; có thể triển khai mutation xác minh read-back." : "Duyệt / Khóa / Thu hồi phiên đang bị khóa vì PriceReport chưa có Device Registry + Gateway server-side. Đây là trạng thái chủ động, không phải lỗi UI."}</p></div>
      </section> : null}

      {view === "experience" ? <section className={styles.clientPanel}>
        <div className={styles.panelHeader}><div><span>ADAPTIVE UI POLICY</span><h2>Giao diện đối ứng loại thiết bị</h2></div><p>Client tự phân loại; Application Management dùng cùng taxonomy để quản trị và kiểm tra trải nghiệm.</p></div>
        <div className={styles.endpointList}>
          {application.deviceExperiences.map((device) => <article key={device.id}>
            <span className={styles.endpointIcon}>{device.id === "desktop" ? "PC" : device.id === "tablet" ? "TB" : "PH"}</span>
            <div><small>{device.viewport}</small><strong>{device.label}</strong><p>{device.interaction}</p></div>
            <dl>
              <div><dt>Shell</dt><dd>{device.shell}</dd></div>
              <div><dt>Điều hướng</dt><dd>{device.navigation}</dd></div>
              <div><dt>Mật độ</dt><dd>{device.density}</dd></div>
            </dl>
          </article>)}
        </div>
      </section> : null}

      {view === "contract" ? <section className={styles.clientPanel}>
        <div className={styles.panelHeader}><div><span>READINESS MATRIX</span><h2>Contract quản trị PriceReport</h2></div><p>Không biến capability “đã code” thành “đã kết nối” nếu production backend chưa tồn tại.</p></div>
        <div className={styles.capabilityList}>
          {readiness.map((item, index) => <article key={item.label}>
            <span>{String(index + 1).padStart(2, "0")}</span>
            <div><strong>{item.label}</strong><small>{item.note}</small></div>
            <i data-contract={item.state === "available" ? "connected" : item.state === "implemented" ? "migrating" : "pending"}/>
          </article>)}
        </div>
        <div className={styles.guardrailBlock}><span>GUARDRAILS</span>{application.guardrails.map((guardrail) => <p key={guardrail}>• {guardrail}</p>)}</div>
      </section> : null}
    </section>
  </main>;
}
