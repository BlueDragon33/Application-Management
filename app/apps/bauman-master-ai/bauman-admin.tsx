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
  type OperationsSubclient,
} from "../../admin-device-client";
import type { ApplicationConfig } from "../../application-registry";
import styles from "../../application-admin.module.css";
import baumanStyles from "./bauman-admin.module.css";

type View = "overview" | "devices" | "subclients" | "contract";
type ReadinessState = "available" | "implemented" | "missing";
type Readiness = { label: string; state: ReadinessState; note: string };

const BAUMAN_APP_ID = "bauman-master-ai";
const deviceStatusLabel: Record<OperationsDevice["status"], string> = {
  pending: "Chờ duyệt",
  approved: "Đã cấp quyền",
  blocked: "Đã khóa",
  unknown: "Chưa xác định",
};
const connectionLabel: Record<OperationsSummary["connection"], string> = {
  connected: "Đã kết nối",
  warning: "Cần xác minh",
  pending: "Chưa nối production",
  unavailable: "Mất kết nối",
};

function formatTime(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(date);
}

function Gate({ access, busy, error, retry }: { access: AdminAccess | null; busy: boolean; error: string; retry: () => void }) {
  return <main className={styles.workspaceGate}><section>
    <span className={styles.workspaceGateMark}>BM</span>
    <small>BAUMAN HUB · ADMIN GATE</small>
    <h1>{access?.status === "pending" ? "Thiết bị quản trị đang chờ cấp quyền." : access?.status === "blocked" ? "Thiết bị quản trị đã bị khóa." : "Đang xác thực khu quản trị Bauman Hub…"}</h1>
    <p>{error || "Bauman Hub chỉ hiển thị trên thiết bị quản trị đã được Application Management duyệt."}</p>
    {access?.deviceCode ? <div className={styles.workspaceGateCode}><span>Mã thiết bị quản trị</span><strong>{access.deviceCode}</strong></div> : null}
    <button onClick={retry} disabled={busy}>{busy ? "Đang kiểm tra…" : "Kiểm tra lại"}</button>
  </section></main>;
}

export default function BaumanAdmin({ application, user }: { application: ApplicationConfig; user: { displayName: string; email: string } }) {
  const [access, setAccess] = useState<AdminAccess | null>(null);
  const [operations, setOperations] = useState<OperationsBootstrap | null>(null);
  const [view, setView] = useState<View>("overview");
  const [busy, setBusy] = useState(true);
  const [actioning, setActioning] = useState("");
  const [error, setError] = useState("");

  async function load(showBusy = true) {
    if (showBusy) setBusy(true);
    setError("");
    try {
      const result = await connectOperationsDashboard();
      setAccess(result.access);
      setOperations(result.bootstrap);
      if (result.access.status === "approved" && !result.bootstrap) setError("Không thể tải bảng điều phối Bauman từ control-plane.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không thể xác thực khu quản trị Bauman Hub.");
    } finally {
      if (showBusy) setBusy(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const summary = useMemo(() => operations?.summaries.find((item) => item.appId === BAUMAN_APP_ID) ?? null, [operations]);
  const devices = useMemo(() => operations?.devices.filter((item) => item.appId === BAUMAN_APP_ID) ?? [], [operations]);
  const pending = devices.filter((device) => device.status === "pending").length;
  const approved = devices.filter((device) => device.status === "approved").length;
  const blocked = devices.filter((device) => device.status === "blocked").length;
  const liveConnected = summary?.connection === "connected";
  const fallbackChildren = useMemo<OperationsSubclient[]>(() => (application.childClients ?? []).map((child) => ({
    id: child.id,
    name: child.name,
    initials: child.initials,
    kind: child.kind,
    repository: child.repository ?? null,
    sourcePath: child.sourcePath ?? null,
    state: child.state === "planned" ? "module" : child.state,
    controlState: child.contractState,
  })), [application.childClients]);
  const liveInventory = summary?.subclientInventoryLive === true && Boolean(summary.subclients?.length);
  const children = liveInventory ? summary?.subclients ?? [] : fallbackChildren;
  const independent = children.filter((item) => item.state === "independent").length;
  const modules = children.filter((item) => item.state === "module").length;
  const workflows = children.filter((item) => item.state === "workflow").length;
  const directRuntimeOpenAllowed = summary?.webAccessPolicy === "allow";

  const readiness = useMemo<Readiness[]>(() => [
    { label: "Runtime Bauman", state: summary?.runtimeConnected ? "available" : "implemented", note: summary?.runtimeConnected ? "Learning runtime đang phản hồi trong snapshot vận hành hiện tại." : "Runtime đã được triển khai nhưng snapshot hiện tại chưa xác nhận kết nối live." },
    { label: "Inventory sub-client", state: liveInventory ? "available" : "implemented", note: liveInventory ? `Đang đọc trực tiếp ${children.length} sub-client từ Bauman Control.` : "Chưa đọc được inventory live; đang dùng registry tĩnh làm fallback và không suy diễn trạng thái production." },
    { label: "Device registry BM-", state: liveConnected ? "available" : "implemented", note: liveConnected ? "Registry BM- đang phản hồi qua control-plane." : "Backend BM- đã triển khai nhưng runtime hiện tại chưa xác nhận kết nối live." },
    { label: "P-256 device gateway", state: liveConnected ? "available" : "implemented", note: liveConnected ? "Gateway thiết bị đang được đọc qua Bauman Control." : "Challenge/session P-256 đã triển khai và đã qua local E2E; chưa suy diễn production từ CI." },
    { label: "Duyệt / Khóa / Mở khóa / Quyền sửa", state: liveConnected ? "available" : "implemented", note: "Mutation đi qua commandId + expectedStatus và capability live. Quyền truy cập tách riêng quyền sửa; khóa giữ registry và thu hồi phiên." },
    { label: "Audit API", state: liveConnected ? "available" : "implemented", note: "Audit thuộc Bauman; Trung tâm không sao chép registry sang database khác." },
    { label: "Content review API", state: summary?.contentReviewReady ? "available" : "implemented", note: summary?.contentReviewReady ? "Content review metadata API đang phản hồi live; nội dung học vẫn thuộc Bauman và không được sao chép vào control-plane." : "Backend content review metadata đã triển khai; chưa coi là live nếu D1/migration chưa phản hồi capability." },
  ], [children.length, liveConnected, liveInventory, summary?.contentReviewReady, summary?.runtimeConnected]);
  const ready = readiness.filter((item) => item.state === "available").length;

  const title = useMemo(() => view === "devices"
    ? { eyebrow: "DEVICE ACCESS · BM REGISTRY", title: "Thiết bị & truy cập", description: "Duyệt hoặc khóa trực tiếp registry thiết bị do Bauman sở hữu; mọi mutation đều được control-plane xác minh lại." }
    : view === "subclients"
      ? { eyebrow: "LEVEL 2 · SUB-CLIENTS", title: "Môn học & site con", description: "Quản trị cấu trúc Bauman mà không biến từng môn học thành client cấp 1." }
      : view === "contract"
        ? { eyebrow: "LIVE ADMIN CONTRACT", title: "Độ sẵn sàng quản trị", description: "Phân biệt rõ phần đã triển khai, phần đang phản hồi live và phần chưa có backend." }
        : { eyebrow: "BAUMAN HUB · CLIENT CONTROL", title: "Quản trị Bauman Hub", description: "Bauman là client cha. Thiết bị, quyền truy cập và topology được điều phối tại đây; runtime học tập vẫn chạy độc lập." }, [view]);

  async function manageDevice(
    device: OperationsDevice,
    operation: "approve" | "remove" | "unblock" | "set-edit-permission",
    editEnabled?: boolean,
  ) {
    if (!access || access.role !== "owner") {
      setError("Bauman yêu cầu quyền Chủ hệ thống để thay đổi thiết bị.");
      return;
    }
    if (operation === "remove" && !window.confirm(`Khóa thiết bị ${device.deviceCode}? Registry và audit sẽ được giữ lại, các phiên Bauman hiện tại sẽ bị thu hồi.`)) return;
    if (operation === "unblock" && !window.confirm(`Mở khóa thiết bị ${device.deviceCode}? Thiết bị sẽ trở lại trạng thái được cấp quyền nhưng quyền sửa vẫn giữ theo registry.`)) return;
    const actionKey = `${device.deviceId}:${operation}`;
    setActioning(actionKey);
    setError("");
    try {
      await operationsAction({
        action: "manage-client-device",
        appId: BAUMAN_APP_ID,
        deviceId: device.deviceId,
        deviceCode: device.deviceCode,
        operation,
        expectedStatus: device.status,
        commandId: crypto.randomUUID(),
        ...(operation === "set-edit-permission" ? { editEnabled: Boolean(editEnabled) } : {}),
      });
      const refreshed = await connectOperationsDashboard();
      setAccess(refreshed.access);
      setOperations(refreshed.bootstrap);
      if (!refreshed.bootstrap) throw new Error("Control-plane chưa trả lại trạng thái Bauman sau thao tác.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không thể cập nhật thiết bị Bauman.");
    } finally {
      setActioning("");
    }
  }

  if (!access || access.status !== "approved") return <Gate access={access} busy={busy} error={error} retry={() => void load()} />;

  return <main className={styles.workspaceShell}>
    <aside className={styles.clientSidebar}>
      <Link href="/" className={styles.serverBack}><span>←</span><div><small>SERVER</small><strong>Application Management</strong></div></Link>
      <div className={styles.clientBrand}><span>BM</span><div><small>CLIENT CẤP 1</small><strong>Bauman Hub</strong></div></div>
      <div className={styles.clientStatus}><i data-status={liveConnected ? "online" : "warning"}/><div><strong>{summary ? connectionLabel[summary.connection] : "Đang đọc contract"}</strong><small>{liveConnected ? "Registry BM- đang phản hồi" : "Không bật thao tác khi capability chưa live"}</small></div></div>
      <nav className={styles.clientNav}>
        <span className={styles.navGroup}>QUẢN TRỊ BAUMAN</span>
        <button data-active={view === "overview"} onClick={() => setView("overview")}><span>01</span><div><strong>Tổng quan</strong><small>Control & topology</small></div></button>
        <button data-active={view === "devices"} onClick={() => setView("devices")}><span>02</span><div><strong>Thiết bị & truy cập</strong><small>{pending} chờ · {approved} được duyệt</small></div></button>
        <button data-active={view === "subclients"} onClick={() => setView("subclients")}><span>03</span><div><strong>Sub-client</strong><small>{children.length} site/module/workflow</small></div></button>
        <button data-active={view === "contract"} onClick={() => setView("contract")}><span>04</span><div><strong>Contract</strong><small>{ready}/{readiness.length} live/ready</small></div></button>
      </nav>
      <div className={styles.clientBoundary}><span>RANH GIỚI</span><strong>Đây là khu quản trị, không phải site học Bauman.</strong><p>Không iframe runtime, không dùng DB thiết bị của Bơi ếch/Health/RU. Thiết bị Bauman giữ namespace BM- và registry riêng.</p></div>
      <div className={styles.clientUser}><span>{user.displayName.slice(0,1).toUpperCase()}</span><div><strong>{user.displayName}</strong><small>{roleLabels[access.role]}</small><small>{access.deviceCode}</small></div></div>
    </aside>

    <section className={styles.workspaceMain}>
      <header className={styles.workspaceTopbar}><div><span>{title.eyebrow}</span><h1>{title.title}</h1><p>{title.description}</p></div><div className={styles.topbarActions}><Link href="/">Hệ thống</Link><Link href="/tools/study-plan">Kế hoạch học tập</Link><button onClick={() => void load()} disabled={busy || Boolean(actioning)}>{busy ? "Đang cập nhật…" : "Cập nhật"}</button></div></header>
      {error ? <div className={styles.workspaceError}>{error}</div> : null}

      {view === "overview" ? <>
        <section className={styles.clientMetrics}>
          <article data-state={liveConnected ? "connected" : "migrating"}><span>Kết nối Bauman</span><strong>{summary ? connectionLabel[summary.connection] : "Đang đọc"}</strong><small>{summary?.note ?? "Chưa có snapshot vận hành."}</small></article>
          <article><span>Thiết bị BM</span><strong>{devices.length}</strong><small>{pending} chờ · {approved} duyệt · {blocked} khóa</small></article>
          <article><span>Online</span><strong>{summary?.onlineCount ?? "—"}</strong><small>Đọc từ registry Bauman, không copy sang Trung tâm</small></article>
          <article><span>Sub-client</span><strong>{children.length}</strong><small>{independent} độc lập · {modules} module · {workflows} workflow</small></article>
        </section>
        <section className={baumanStyles.studyPlanBridge}>
          <div>
            <span>STUDY PLAN BRIDGE · APPLICATION MANAGEMENT</span>
            <h2>Phân tích lịch học 09.04.01/11</h2>
            <p>Study Plan là Tool nội bộ của Application Management nhưng dùng Bauman Hub làm ứng dụng cha: đọc contract/manifest để nối học phần với học liệu hoặc workflow, và fail-closed khi registry Bauman không khả dụng.</p>
          </div>
          <div className={baumanStyles.studyPlanFacts}>
            <span><small>Chương trình</small><strong>09.04.01/11</strong></span>
            <span><small>Khối lượng</small><strong>120 tín chỉ</strong></span>
            <span><small>Chu kỳ</small><strong>4 học kỳ</strong></span>
            <span><small>Liên kết</small><strong>Registry-aware</strong></span>
          </div>
          <Link href="/tools/study-plan">Mở Phân tích lịch học →</Link>
        </section>
        <section className={styles.clientPanel}><div className={styles.panelHeader}><div><span>CONTROL TOPOLOGY</span><h2>Một client cha → nhiều sub-client</h2></div><p>Application Management chỉ điều phối quyền và quản trị từ xa. Dữ liệu thiết bị, session và audit vẫn do Bauman Control sở hữu.</p></div><div className={styles.controlFlow}><div data-level="server"><small>LEVEL 0</small><strong>Application Management</strong><span>Policy · admin device · signed command</span></div><b>→</b><div data-level="client"><small>LEVEL 1</small><strong>Bauman Hub</strong><span>BM registry · P-256 · session · audit</span></div><b>→</b><div data-level="subclient"><small>LEVEL 2</small><strong>{children.length} sub-client</strong><span>Math + subject modules</span></div></div></section>
        <section className={styles.boundaryNotice}><span>✓</span><div><strong>Backend thiết bị Bauman đã được nối vào khu quản trị.</strong><p>Duyệt/Khóa dùng commandId + optimistic concurrency + read-back. {liveInventory ? `Topology đang đọc live ${children.length} sub-client từ Bauman Control.` : "Topology đang dùng fallback đã đồng bộ với contract."} {directRuntimeOpenAllowed ? "Policy hiện cho phép mở learning runtime trực tiếp." : "Policy hiện chặn mở learning runtime trực tiếp từ Application Management."}</p></div></section>
      </> : null}

      {view === "devices" ? <section className={styles.clientPanel}>
        <div className={styles.panelHeader}><div><span>BM DEVICE REGISTRY</span><h2>Thiết bị do Bauman sở hữu</h2></div><p>{liveConnected ? `Đã đồng bộ ${devices.length} thiết bị. Khóa không xóa registry và sẽ thu hồi session đang hoạt động.` : "Bauman chưa phản hồi live; các nút mutation bị vô hiệu theo capability từ control-plane."}</p></div>
        <div className={baumanStyles.deviceAdminSummary}><div><span>Chờ duyệt</span><strong>{pending}</strong></div><div><span>Đã cấp quyền</span><strong>{approved}</strong></div><div><span>Đã khóa</span><strong>{blocked}</strong></div><div><span>Vai trò</span><strong>{roleLabels[access.role]}</strong></div></div>
        {devices.length ? <div className={baumanStyles.deviceAdminList}>{devices.map((device) => {
          const approving = actioning === `${device.deviceId}:approve`;
          const blocking = actioning === `${device.deviceId}:remove`;
          const unblocking = actioning === `${device.deviceId}:unblock`;
          const editing = actioning === `${device.deviceId}:set-edit-permission`;
          return <article key={device.deviceId} data-status={device.status}>
            <div className={baumanStyles.deviceAdminIdentity}><span>{device.deviceType === "phone" ? "PH" : device.deviceType === "tablet" ? "TB" : "PC"}</span><div><strong>{device.deviceCode}</strong><small>{device.userLabel}</small></div></div>
            <dl><div><dt>Trạng thái</dt><dd data-status={device.status}>{deviceStatusLabel[device.status]}</dd></div><div><dt>Loại</dt><dd>{device.deviceTypeLabel}</dd></div><div><dt>Quyền sửa</dt><dd>{device.editEnabled ? "Được phép" : "Tắt"}</dd></div><div><dt>Hoạt động cuối</dt><dd>{formatTime(device.lastSeenAt)}</dd></div><div><dt>Đăng ký</dt><dd>{formatTime(device.createdAt)}</dd></div></dl>
            <div className={baumanStyles.deviceAdminActions}>
              {device.status === "pending" ? <button data-action="approve" onClick={() => void manageDevice(device, "approve")} disabled={!device.canApprove || Boolean(actioning)}>{approving ? "Đang duyệt…" : "Duyệt"}</button> : null}
              {device.status === "approved" ? <button data-action="edit-permission" onClick={() => void manageDevice(device, "set-edit-permission", !device.editEnabled)} disabled={!device.canEditPermission || Boolean(actioning)}>{editing ? "Đang cập nhật…" : device.editEnabled ? "Tắt quyền sửa" : "Bật quyền sửa"}</button> : null}
              {device.status !== "blocked" ? <button data-action="block" onClick={() => void manageDevice(device, "remove")} disabled={!device.canRemove || Boolean(actioning)}>{blocking ? "Đang khóa…" : "Khóa"}</button> : <button data-action="unblock" onClick={() => void manageDevice(device, "unblock")} disabled={!device.canUnblock || Boolean(actioning)}>{unblocking ? "Đang mở khóa…" : "Mở khóa"}</button>}
            </div>
          </article>;
        })}</div> : <div className={baumanStyles.deviceAdminEmpty}><strong>{liveConnected ? "Chưa có thiết bị Bauman trong registry." : "Chưa đọc được registry Bauman."}</strong><p>{liveConnected ? "Mở runtime Bauman trên thiết bị mới để Device Gate đăng ký mã BM-, sau đó yêu cầu sẽ xuất hiện tại đây." : "Kiểm tra Bauman Control URL, secret, D1 binding và BAUMAN_APP_ORIGIN. Trung tâm không tạo dữ liệu thiết bị giả."}</p></div>}
      </section> : null}

      {view === "subclients" ? <section className={styles.clientPanel}><div className={styles.panelHeader}><div><span>SUB-CLIENT INVENTORY · {liveInventory ? "LIVE" : "FALLBACK"}</span><h2>Cấu trúc học tập dưới Bauman</h2></div><p>{liveInventory ? "Inventory đang đọc trực tiếp từ Bauman Control; Application Management không duy trì topology song song khi endpoint live khả dụng." : "Chưa đọc được inventory live; tạm dùng registry tĩnh và không suy diễn trạng thái production."}</p></div><div className={styles.subClientList}>{children.map((child) => <article key={child.id}><span className={styles.subClientMark}>{child.initials}</span><div><strong>{child.name}</strong><small>{child.repository ?? child.sourcePath ?? "Chưa gán nguồn"}</small></div><div><span>Loại</span><strong>{child.kind === "subject-site" ? "Site môn học" : child.kind === "workflow" ? "Workflow" : "Module"}</strong></div><div><span>Trạng thái</span><strong>{child.state === "independent" ? "Độc lập" : child.state === "workflow" ? "Workflow trong Bauman" : "Trong Bauman"}</strong></div><div><span>Admin contract</span><strong>{child.controlState || (child.state === "independent" ? "Cần contract riêng" : "Qua Bauman Hub")}</strong></div></article>)}</div></section> : null}

      {view === "contract" ? <section className={styles.clientPanel}><div className={styles.panelHeader}><div><span>READINESS GATE</span><h2>Contract quản trị có kiểm chứng</h2></div><p>Màu xanh = đang sẵn sàng trong snapshot hiện tại; vàng = source/backend đã triển khai nhưng chưa được coi là production live; xám = chưa có backend.</p></div><div className={styles.capabilityList}>{readiness.map((item, index) => <article key={item.label}><span>{String(index+1).padStart(2,"0")}</span><div><strong>{item.label}</strong><small>{item.note}</small></div><i data-contract={item.state === "available" ? "connected" : item.state === "implemented" ? "migrating" : "pending"}/></article>)}</div><div className={styles.guardrailBlock}><span>GATE</span><p>• BM registry, session và audit thuộc Bauman.</p><p>• Khóa thiết bị giữ registry và thu hồi session, không xóa mù.</p><p>• Sync/Cập nhật chỉ đọc; mutation chỉ xảy ra khi bấm Duyệt, Khóa, Mở khóa hoặc đổi quyền sửa.</p><p>• Không đánh dấu production hoàn tất chỉ vì GitHub CI xanh.</p><p>• Content review chỉ xử lý metadata/review state; learning content vẫn thuộc Bauman.</p><p>• {directRuntimeOpenAllowed ? "Policy hiện cho phép mở learning runtime trực tiếp." : "Learning runtime không được mở trực tiếp từ Application Management khi policy Bauman đang chặn."}</p></div></section> : null}
    </section>
  </main>;
}
