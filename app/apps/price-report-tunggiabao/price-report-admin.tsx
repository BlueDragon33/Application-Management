"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  connectOperationsDashboard,
  operationsAction,
  roleLabels,
  type AdminAccess,
  type OperationsBootstrap,
  type OperationsDevice,
  type OperationsSummary,
} from "../../admin-device-client";
import type { ApplicationConfig } from "../../application-registry";
import styles from "../../application-admin.module.css";
import deviceStyles from "./price-report-admin.module.css";

type View = "overview" | "devices" | "experience" | "contract";
type ReadinessState = "available" | "implemented" | "missing";
type Readiness = { label: string; state: ReadinessState; note: string };

const APP_ID = "price-report-tunggiabao";

const deviceStatusLabel: Record<OperationsDevice["status"], string> = {
  pending: "Chờ duyệt",
  approved: "Đã cấp quyền",
  blocked: "Đã khóa",
  unknown: "Chưa xác định",
};

function formatTime(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(date);
}

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
  const [actioning, setActioning] = useState("");
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
  const devices = useMemo(() => operations?.devices.filter((item) => item.appId === APP_ID) ?? [], [operations]);
  const pending = devices.filter((device) => device.status === "pending").length;
  const approved = devices.filter((device) => device.status === "approved").length;
  const blocked = devices.filter((device) => device.status === "blocked").length;
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


  async function manageDevice(device: OperationsDevice, operation: "approve" | "remove") {
    if (!access || access.role !== "owner") {
      setError("PriceReport yêu cầu quyền Chủ hệ thống để thay đổi thiết bị.");
      return;
    }
    if (!remoteAdminReady) {
      setError("KT Control chưa xác nhận capability quản trị thiết bị live.");
      return;
    }
    if (operation === "remove" && !window.confirm(`Khóa thiết bị ${device.deviceCode}? Registry/audit sẽ được giữ và mọi phiên KT đang hoạt động sẽ bị thu hồi.`)) return;

    const actionKey = `${device.deviceId}:${operation}`;
    setActioning(actionKey);
    setError("");
    try {
      await operationsAction({
        action: "manage-client-device",
        appId: APP_ID,
        deviceId: device.deviceId,
        deviceCode: device.deviceCode,
        deviceType: device.deviceType,
        userLabel: device.userLabel,
        operation,
        expectedStatus: device.status,
        commandId: crypto.randomUUID(),
      });
      const refreshed = await connectOperationsDashboard();
      setAccess(refreshed.access);
      setOperations(refreshed.bootstrap);
      if (!refreshed.bootstrap) throw new Error("Control-plane chưa trả lại registry KT- sau thao tác.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không thể cập nhật thiết bị PriceReport.");
    } finally {
      setActioning("");
    }
  }

  if (!access || access.status !== "approved") return <Gate access={access} busy={busy} error={error} retry={() => void load()} />;

  const title = view === "devices"
    ? ["DEVICE ACCESS · KT-", "Thiết bị & quyền", remoteAdminReady ? "KT Control live đã xác minh; Duyệt/Khóa dùng optimistic concurrency, command idempotent và read-back." : "KT Control chưa đủ capability; mọi mutation bị khóa fail-closed."]
    : view === "experience"
      ? ["DEVICE EXPERIENCE", "Giao diện theo loại thiết bị", "Mỗi lớp thiết bị có viewport, mật độ, điều hướng và kiểu tương tác riêng."]
      : view === "contract"
        ? ["MANAGEMENT CONTRACT", "Độ sẵn sàng quản trị", remoteAdminReady ? "Web contract và KT device-control đang phản hồi; production vẫn được đánh giá riêng theo deployment live." : "Web contract không tự suy ra device-control; mutation chỉ mở khi KT Control xác nhận đủ capability."]
        : ["KẾ TOÁN · CLIENT CONTROL", "Quản trị Báo giá Tùng Gia Bảo", "PriceReport là client Kế toán độc lập; dữ liệu báo giá ở client, Trung tâm chỉ quản trị contract và thiết bị khi có backend thật."];

  return <main className={styles.workspaceShell}>
    <aside className={styles.clientSidebar}>
      <Link href="/" className={styles.serverBack}><span>←</span><div><small>SERVER</small><strong>Application Management</strong></div></Link>
      <div className={styles.clientBrand}><span>KT</span><div><small>CLIENT · KẾ TOÁN</small><strong>Báo giá Tùng Gia Bảo</strong></div></div>
      <div className={styles.clientStatus}><i data-status={webConnected ? "online" : "warning"}/><div><strong>{summary ? connectionLabel[summary.connection] : "Đang đọc contract"}</strong><small>{remoteAdminReady ? "Remote registry KT- sẵn sàng" : "Phân loại thiết bị đã có · remote registry chưa có"}</small></div></div>
      <nav className={styles.clientNav}>
        <span className={styles.navGroup}>QUẢN TRỊ KẾ TOÁN</span>
        <button data-active={view === "overview"} onClick={() => setView("overview")}><span>01</span><div><strong>Tổng quan</strong><small>Runtime & ranh giới</small></div></button>
        <button data-active={view === "devices"} onClick={() => setView("devices")}><span>02</span><div><strong>Thiết bị & quyền</strong><small>{pending} chờ · {approved} duyệt · {blocked} khóa</small></div></button>
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
          <article data-state={remoteAdminReady ? "connected" : "migrating"}><span>Remote admin</span><strong>{remoteAdminReady ? "Sẵn sàng" : "Chưa bật"}</strong><small>{remoteAdminReady ? `${devices.length} thiết bị · ${summary?.onlineCount ?? 0} online` : "Chờ registry / gateway KT-"}</small></article>
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

        <div className={styles.boundaryNotice}><span>!</span><div><strong>Local device record không phải authorization.</strong><p>{remoteAdminReady ? "KT Control đang là nguồn quyền thật cho Duyệt/Khóa; mọi mutation phải qua registry server-side, session/audit và read-back." : "Metadata KT- chỉ dùng để phân loại UI; Duyệt/Khóa vẫn khóa cho tới khi registry server-side + session/audit thật được xác minh."}</p></div></div>
      </> : null}

      {view === "devices" ? <section className={styles.clientPanel}>
        <div className={styles.panelHeader}><div><span>KT DEVICE REGISTRY</span><h2>Thiết bị PriceReport do client sở hữu</h2></div><p>{remoteAdminReady ? `Đã đồng bộ ${devices.length} thiết bị. Duyệt/Khóa dùng commandId + expectedStatus + read-back; khóa thu hồi session nhưng giữ registry/audit.` : "KT Control chưa phản hồi đủ capability; mọi mutation bị khóa fail-closed."}</p></div>
        <div className={deviceStyles.deviceSummary}>
          <div><span>Chờ duyệt</span><strong>{pending}</strong></div>
          <div><span>Đã cấp quyền</span><strong>{approved}</strong></div>
          <div><span>Đã khóa</span><strong>{blocked}</strong></div>
          <div><span>Online</span><strong>{summary?.onlineCount ?? "—"}</strong></div>
        </div>
        {devices.length ? <div className={deviceStyles.deviceList}>{devices.map((device) => {
          const approving = actioning === `${device.deviceId}:approve`;
          const blocking = actioning === `${device.deviceId}:remove`;
          return <article key={device.deviceId} data-status={device.status}>
            <div className={deviceStyles.deviceIdentity}><span>{device.deviceType === "phone" ? "PH" : device.deviceType === "tablet" ? "TB" : "PC"}</span><div><strong>{device.deviceCode}</strong><small>{device.userLabel}</small></div></div>
            <dl>
              <div><dt>Trạng thái</dt><dd data-status={device.status}>{deviceStatusLabel[device.status]}</dd></div>
              <div><dt>Loại</dt><dd>{device.deviceTypeLabel}</dd></div>
              <div><dt>Hoạt động cuối</dt><dd>{formatTime(device.lastSeenAt)}</dd></div>
              <div><dt>Đăng ký</dt><dd>{formatTime(device.createdAt)}</dd></div>
            </dl>
            <div className={deviceStyles.deviceActions}>
              {device.status === "pending" ? <button data-action="approve" onClick={() => void manageDevice(device, "approve")} disabled={!device.canApprove || Boolean(actioning)}>{approving ? "Đang duyệt…" : "Duyệt"}</button> : null}
              {device.status !== "blocked" ? <button data-action="block" onClick={() => void manageDevice(device, "remove")} disabled={!device.canRemove || Boolean(actioning)}>{blocking ? "Đang khóa…" : "Khóa"}</button> : <span>Registry được giữ lại</span>}
            </div>
          </article>;
        })}</div> : <div className={deviceStyles.deviceEmpty}><strong>{remoteAdminReady ? "Chưa có thiết bị KT- đăng ký" : "KT Control chưa live"}</strong><p>{remoteAdminReady ? "Mở PriceReport trên thiết bị mới để client tạo P-256 identity và đăng ký vào registry." : "Sau khi D1/control origin/secret được deploy và read-back PASS, thiết bị live sẽ xuất hiện tại đây."}</p></div>}
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
