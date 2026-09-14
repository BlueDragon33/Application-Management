"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { connectAdminCenter, roleLabels, type AdminAccess } from "../../admin-device-client";
import {
  connectGrowUpControl,
  manageGrowUpDevice,
  type GrowUpControlBootstrap,
  type GrowUpManagedDevice,
} from "../../growup-control-client";
import styles from "../../application-admin.module.css";

type View = "overview" | "devices" | "audit" | "privacy" | "contract";
type SiteState = { url: string; error: string; remoteAdminReady: boolean };

const allowlist = [
  "Mã thiết bị và lớp thiết bị",
  "Trạng thái truy cập",
  "Quyền chỉnh sửa",
  "Phiên bản ứng dụng và trạng thái dịch vụ",
  "Audit metadata đã lọc",
  "Cấu hình/bản sửa chủ động gửi lên duyệt",
] as const;

const denylist = [
  "Hồ sơ trẻ em",
  "Nhật ký sức khỏe và dinh dưỡng",
  "Ghi chú riêng tư dạng free-text",
  "Portfolio và minh chứng",
  "Nội dung backup cục bộ",
] as const;

function Gate({ access, busy, error, retry }: { access: AdminAccess | null; busy: boolean; error: string; retry: () => void }) {
  return <main className={styles.workspaceGate}><section><span className={styles.workspaceGateMark}>GU</span><small>GROWUP · ADMIN GATE</small><h1>{access?.status === "pending" ? "Thiết bị quản trị đang chờ cấp quyền." : access?.status === "blocked" ? "Thiết bị quản trị đã bị khóa." : "Đang xác thực khu quản trị GrowUP…"}</h1><p>{error || "Control surface GrowUP chỉ mở trên thiết bị quản trị đã được Application Management duyệt."}</p>{access?.deviceCode ? <div className={styles.workspaceGateCode}><span>Mã thiết bị quản trị</span><strong>{access.deviceCode}</strong></div> : null}<button onClick={retry} disabled={busy}>{busy ? "Đang kiểm tra…" : "Kiểm tra lại"}</button></section></main>;
}

function statusText(status: GrowUpManagedDevice["status"]) {
  return status === "approved" ? "Đã duyệt" : status === "blocked" ? "Đã khóa" : "Chờ duyệt";
}

function deviceClassLabel(value: GrowUpManagedDevice["deviceClass"]) {
  return value === "desktop" ? "Máy tính" : value === "tablet" ? "Tablet / iPad" : "Điện thoại";
}

function relative(value: string) {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return "—";
  const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60_000));
  if (minutes < 1) return "Vừa xong";
  if (minutes < 60) return `${minutes} phút trước`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} giờ trước`;
  return `${Math.floor(hours / 24)} ngày trước`;
}

export default function GrowUpAdmin({ user, site }: { user: { displayName: string; email: string }; site: SiteState }) {
  const [access, setAccess] = useState<AdminAccess | null>(null);
  const [view, setView] = useState<View>("overview");
  const [busy, setBusy] = useState(true);
  const [controlBusy, setControlBusy] = useState(false);
  const [actionBusy, setActionBusy] = useState("");
  const [error, setError] = useState("");
  const [controlError, setControlError] = useState("");
  const [notice, setNotice] = useState("");
  const [control, setControl] = useState<GrowUpControlBootstrap | null>(null);

  async function refreshControl() {
    setControlBusy(true);
    setControlError("");
    try {
      const result = await connectGrowUpControl();
      setControl(result);
      return result;
    } catch (caught) {
      setControl(null);
      setControlError(caught instanceof Error ? caught.message : "GrowUP Control chưa sẵn sàng.");
      return null;
    } finally {
      setControlBusy(false);
    }
  }

  async function load() {
    setBusy(true); setError(""); setNotice("");
    try {
      const result = await connectAdminCenter();
      setAccess(result.access);
      if (result.access.status === "approved") {
        if (!result.bootstrap) setError("Không thể xác nhận control-plane của thiết bị quản trị.");
        else void refreshControl();
      }
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Không thể xác thực khu quản trị GrowUP."); }
    finally { setBusy(false); }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const devices = control?.devices ?? [];
  const pending = devices.filter((device) => device.status === "pending").length;
  const approved = devices.filter((device) => device.status === "approved").length;
  const online = devices.filter((device) => device.active).length;
  const canManage = access?.role === "publisher" || access?.role === "owner";
  const localControlReady = Boolean(control);
  const readiness = useMemo(() => [
    ["Runtime local-first", "available", "Ứng dụng/PWA đang tồn tại và vẫn giữ dữ liệu nhạy cảm ở phía GrowUP."],
    ["Privacy local-first", "available", "Không đưa hồ sơ trẻ em/sức khỏe về Application Management."],
    ["PWA / offline", "available", "App shell và offline flow của GrowUP vẫn độc lập."],
    ["Direct site contract", site.url ? "available" : "missing", site.url ? "Đã xác minh contract runtime của Site GrowUP." : site.error || "Chưa cấu hình URL Site GrowUP."],
    ["Local registry GU-", localControlReady ? "available" : "missing", localControlReady ? `Registry ${control?.registryInstanceId ?? "GU local"} đang được đọc trực tiếp.` : "Chạy npm run run:all để bật registry local phục vụ E2E."],
    ["P-256 device gateway local", localControlReady ? "available" : "missing", localControlReady ? "Thiết bị loopback tự tạo P-256 fingerprint và đăng ký metadata tối thiểu." : "Chưa có local gateway đang hoạt động."],
    ["Admin API local", localControlReady ? "available" : "missing", localControlReady ? "Duyệt/khóa đi qua app-scoped API và QT P-256 proof." : "Chưa có GrowUP Control Service local."],
    ["Privacy-safe audit local", localControlReady ? "available" : "missing", localControlReady ? "Audit chỉ chứa action, target và metadata thiết bị." : "Chưa có audit API local."],
    ["Production remote admin", site.remoteAdminReady ? "available" : "missing", site.remoteAdminReady ? "Contract production đã xác nhận backend thật." : "Vẫn khóa cho tới khi GrowUP có backend production và deployment thật."],
  ] as const, [control?.registryInstanceId, localControlReady, site.error, site.remoteAdminReady, site.url]);
  const available = readiness.filter((item) => item[1] === "available").length;

  async function manage(device: GrowUpManagedDevice, operation: "approve" | "block") {
    if (!canManage) return;
    if (operation === "block" && !window.confirm(`Khóa thiết bị GrowUP ${device.deviceCode}? Quyền truy cập và quyền sửa sẽ bị thu hồi.`)) return;
    setActionBusy(device.deviceId); setNotice(""); setControlError("");
    try {
      await manageGrowUpDevice(device, operation, control?.registryInstanceId);
      await refreshControl();
      setNotice(operation === "approve" ? `Đã duyệt ${device.deviceCode} và xác minh readback.` : `Đã khóa ${device.deviceCode} và xác minh readback.`);
    } catch (caught) {
      setControlError(caught instanceof Error ? caught.message : "Không thể cập nhật thiết bị GrowUP.");
      await refreshControl();
    } finally {
      setActionBusy("");
    }
  }

  if (!access || access.status !== "approved") return <Gate access={access} busy={busy} error={error} retry={() => void load()} />;

  const title = view === "devices"
    ? ["DEVICE REGISTRY", "Thiết bị GrowUP", "Registry GU- local thuộc GrowUP; Trung tâm chỉ gửi lệnh app-scoped và đọc lại trạng thái sau thao tác."]
    : view === "audit"
      ? ["PRIVACY-SAFE AUDIT", "Nhật ký GrowUP", "Chỉ action/target/metadata vận hành; không có hồ sơ trẻ em hoặc dữ liệu sức khỏe."]
      : view === "privacy"
        ? ["PRIVACY BOUNDARY", "Ranh giới dữ liệu trẻ em", "Control-plane chỉ nhận metadata quản trị tối thiểu; không nhận hồ sơ/sức khỏe trẻ."]
        : view === "contract"
          ? ["REMOTE ADMIN CONTRACT", "Độ sẵn sàng quản trị", "Tách rõ local E2E với production readiness để không đánh dấu xanh giả."]
          : ["GROWUP · CLIENT CONTROL", "Quản trị GrowUP MyChildren", "Theo dõi runtime, registry GU-, thiết bị và ranh giới privacy từ một khu quản trị app-scoped."];

  return <main className={styles.workspaceShell}>
    <aside className={styles.clientSidebar}>
      <Link href="/" className={styles.serverBack}><span>←</span><div><small>SERVER</small><strong>Application Management</strong></div></Link>
      <div className={styles.clientBrand}><span>GU</span><div><small>CLIENT CẤP 1</small><strong>GrowUP MyChildren</strong></div></div>
      <div className={styles.clientStatus}><i data-status={localControlReady ? "online" : site.url ? "warning" : "warning"}/><div><strong>{localControlReady ? "Local control đã kết nối" : site.url ? "Web contract đã kết nối" : "Runtime sẵn sàng"}</strong><small>{localControlReady ? `${devices.length} thiết bị trong registry GU-` : site.url ? "Production remote admin vẫn khóa" : "Chờ local/production connection"}</small></div></div>
      <nav className={styles.clientNav}><span className={styles.navGroup}>QUẢN TRỊ GROWUP</span><button data-active={view === "overview"} onClick={() => setView("overview")}><span>01</span><div><strong>Tổng quan</strong><small>Runtime & kết nối</small></div></button><button data-active={view === "devices"} onClick={() => setView("devices")}><span>02</span><div><strong>Thiết bị</strong><small>{localControlReady ? `${devices.length} GU- · ${pending} chờ` : "Chờ control"}</small></div></button><button data-active={view === "audit"} onClick={() => setView("audit")}><span>03</span><div><strong>Audit</strong><small>{control?.audit.length ?? 0} sự kiện</small></div></button><button data-active={view === "privacy"} onClick={() => setView("privacy")}><span>04</span><div><strong>Ranh giới dữ liệu</strong><small>Allowlist / denylist</small></div></button><button data-active={view === "contract"} onClick={() => setView("contract")}><span>05</span><div><strong>Contract</strong><small>{available}/{readiness.length} sẵn sàng</small></div></button></nav>
      <div className={styles.clientBoundary}><span>RANH GIỚI</span><strong>Không đưa hồ sơ trẻ em vào Application Management.</strong><p>Registry GU- chỉ chứa metadata thiết bị và quyền tối thiểu.</p></div>
      <div className={styles.clientUser}><span>{user.displayName.slice(0,1).toUpperCase()}</span><div><strong>{user.displayName}</strong><small>{roleLabels[access.role]}</small><small>{access.deviceCode}</small></div></div>
    </aside>

    <section className={styles.workspaceMain}>
      <header className={styles.workspaceTopbar}><div><span>{title[0]}</span><h1>{title[1]}</h1><p>{title[2]}</p></div><div className={styles.topbarActions}>{site.url ? <a href={site.url} target="_blank" rel="noreferrer">Mở Site GrowUP ↗</a> : null}<Link href="/">Hệ thống</Link><button onClick={() => void refreshControl()} disabled={controlBusy}>{controlBusy ? "Đang đồng bộ…" : "↻ Đồng bộ"}</button></div></header>
      {error ? <div className={styles.workspaceError}>{error}</div> : null}
      {controlError ? <div className={styles.workspaceError}>{controlError}</div> : null}
      {notice ? <div className={styles.boundaryNotice}><span>✓</span><div><strong>Đã xác minh thao tác</strong><p>{notice}</p></div></div> : null}

      {view === "overview" ? <>
        <section className={styles.clientMetrics}>
          <article><span>Runtime</span><strong>{site.url ? "Đã nối" : "Local-first"}</strong><small>PWA · offline</small></article>
          <article data-state={localControlReady ? "ready" : "pending"}><span>Local control</span><strong>{localControlReady ? "Đã nối" : "Chưa chạy"}</strong><small>{localControlReady ? control?.transport : "npm run run:all"}</small></article>
          <article data-state={pending ? "pending" : "ready"}><span>Thiết bị chờ duyệt</span><strong>{localControlReady ? pending : "—"}</strong><small>{localControlReady ? `${approved} đã duyệt · ${online} đang hoạt động` : "Chưa có registry local"}</small></article>
          <article data-state={site.remoteAdminReady ? "ready" : "pending"}><span>Production remote admin</span><strong>{site.remoteAdminReady ? "Sẵn sàng" : "Chưa bật"}</strong><small>Không đánh dấu xanh từ local test</small></article>
        </section>

        <section className={styles.clientPanel}><div className={styles.panelHeader}><div><span>CONTROL STATUS</span><h2>GrowUP local control tách khỏi production</h2></div><p>Local E2E dùng registry GU- và API thật trong repo GrowUP; production contract vẫn giữ trạng thái pending cho tới khi backend được deploy.</p></div><div className={styles.contractSummary}><div><span>Site runtime</span><strong>{site.url ? "Đã xác minh" : "Chưa cấu hình"}</strong></div><div><span>Local Control</span><strong>{localControlReady ? "Đang hoạt động" : "Chưa hoạt động"}</strong></div><div><span>Registry</span><strong>{control?.registryInstanceId ?? "—"}</strong></div><div><span>Child / Health data</span><strong>Không đưa lên control-plane</strong></div></div></section>

        <section className={styles.boundaryNotice}><span>!</span><div><strong>GrowUP local control chỉ quản lý metadata thiết bị.</strong><p>Không API nào trong luồng này đọc hồ sơ trẻ, sức khỏe, dinh dưỡng, ghi chú riêng, portfolio hoặc backup cục bộ.</p></div></section>
      </> : null}

      {view === "devices" ? <section className={styles.clientPanel}><div className={styles.panelHeader}><div><span>GU- DEVICE REGISTRY</span><h2>Thiết bị GrowUP</h2></div><p>{localControlReady ? `${devices.length} thiết bị · ${pending} chờ duyệt · ${approved} đã duyệt.` : "Chạy run:all và mở GrowUP local để thiết bị tự đăng ký P-256."}</p></div>{!localControlReady ? <div className={styles.boundaryNotice}><span>!</span><div><strong>GrowUP Control chưa kết nối.</strong><p>{controlError || "Dùng npm run run:all từ Application-Management sau khi checkout đúng nhánh GrowUP integration."}</p></div></div> : <div className={styles.capabilityList}>{devices.map((device, index) => <article key={device.deviceId}><span>{String(index + 1).padStart(2, "0")}</span><div><strong>{device.deviceCode} · {device.label}</strong><small>{deviceClassLabel(device.deviceClass)} · {statusText(device.status)} · {device.active ? "Online" : `Last seen ${relative(device.lastSeenAt)}`} · access {device.accessAllowed ? "ON" : "OFF"} · edit {device.editAllowed ? "ON" : "OFF"}</small></div><div className={styles.topbarActions}>{device.status === "pending" && canManage ? <button disabled={actionBusy === device.deviceId} onClick={() => void manage(device, "approve")}>{actionBusy === device.deviceId ? "Đang xử lý…" : "Duyệt"}</button> : null}{device.status !== "blocked" && canManage ? <button disabled={actionBusy === device.deviceId} onClick={() => void manage(device, "block")}>Khóa</button> : null}</div><i data-contract={device.status === "approved" ? "connected" : device.status === "blocked" ? "pending" : "pending"}/></article>)}{!devices.length ? <div className={styles.boundaryNotice}><span>i</span><div><strong>Chưa có thiết bị GrowUP.</strong><p>Mở `http://127.0.0.1:3006` sau khi chạy run:all; gateway loopback sẽ đăng ký thiết bị GU- tự động.</p></div></div> : null}</div>}</section> : null}

      {view === "audit" ? <section className={styles.clientPanel}><div className={styles.panelHeader}><div><span>LOCAL AUDIT</span><h2>Nhật ký metadata GrowUP</h2></div><p>Không hiển thị nội dung học tập hay dữ liệu sức khỏe.</p></div><div className={styles.capabilityList}>{(control?.audit ?? []).map((entry, index) => <article key={entry.id}><span>{String(index + 1).padStart(2, "0")}</span><div><strong>{entry.action.replaceAll("_", " ")} · {entry.target}</strong><small>{new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "medium" }).format(new Date(entry.createdAt))}</small></div><i data-contract="connected"/></article>)}{!(control?.audit.length) ? <div className={styles.boundaryNotice}><span>i</span><div><strong>Chưa có audit metadata.</strong><p>Sự kiện đăng ký/duyệt/khóa sẽ xuất hiện ở đây sau khi local control hoạt động.</p></div></div> : null}</div></section> : null}

      {view === "privacy" ? <><section className={styles.clientPanel}><div className={styles.panelHeader}><div><span>CONTROL-PLANE ALLOWLIST</span><h2>Được phép trao đổi</h2></div><p>Chỉ metadata cần thiết cho quyền và vận hành.</p></div><div className={styles.capabilityList}>{allowlist.map((item,index) => <article key={item}><span>{String(index+1).padStart(2,"0")}</span><div><strong>{item}</strong><small>Metadata quản trị tối thiểu</small></div><i data-contract="connected"/></article>)}</div></section><section className={styles.clientPanel}><div className={styles.panelHeader}><div><span>DENYLIST</span><h2>Không được đưa vào Trung tâm</h2></div><p>Các nhóm này phải ở lại GrowUP/local storage.</p></div><div className={styles.capabilityList}>{denylist.map((item,index) => <article key={item}><span>{String(index+1).padStart(2,"0")}</span><div><strong>{item}</strong><small>Local only · không đồng bộ control-plane</small></div><i data-contract="pending"/></article>)}</div></section></> : null}

      {view === "contract" ? <section className={styles.clientPanel}><div className={styles.panelHeader}><div><span>READINESS</span><h2>Local E2E và production gate</h2></div><p>Nguồn production contract vẫn là `control/application-management.contract.json`; local control không tự nâng trạng thái production.</p></div><div className={styles.capabilityList}>{readiness.map((item,index) => <article key={item[0]}><span>{String(index+1).padStart(2,"0")}</span><div><strong>{item[0]}</strong><small>{item[2]}</small></div><i data-contract={item[1] === "available" ? "connected" : "pending"}/></article>)}</div><div className={styles.guardrailBlock}><span>GATE</span><p>• Registry dùng namespace GU- riêng.</p><p>• Access và edit permission tách biệt.</p><p>• QT P-256 proof bắt buộc cho thao tác quản trị.</p><p>• Remote audit chỉ trả metadata allowlist.</p><p>• Production chỉ chuyển connected sau deployment + handshake thật.</p></div></section> : null}
    </section>
  </main>;
}
