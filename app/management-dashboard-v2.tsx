"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { applicationRegistry, standardDeviceExperiences, type ApplicationConfig } from "./application-registry";
import BoiAccessView from "./boi-access-view";
import AutomaticDevicePolicies, { type AutomationSelection } from "./automatic-device-policies";
import {
  AdminApiError,
  centerAdminAction,
  connectAdminCenter,
  connectOperationsDashboard,
  operationsAction,
  readCachedOperations,
  roleLabels,
  type AdminAccess,
  type CenterBootstrap,
  type ControlAdminDevice,
  type OperationsBootstrap,
  type OperationsActionResponse,
  type OperationsDevice,
  type OperationsSummary,
  type OperationsWorkItem,
} from "./admin-device-client";

type View = "overview" | "approvals" | "applications" | "devices" | "access" | "alerts" | "audit" | "settings";
type ControlDeviceOperation = "approve" | "block" | "deactivate-member" | "delete-member";
type FontScale = "compact" | "standard" | "large" | "xlarge";
type SystemTool = {
  id: string;
  name: string;
  href: string;
  category: "Tool";
  note: string;
  parentAppId?: string;
  parentLabel?: string;
  manageHref?: string;
};

type AppLauncherMode = "grid" | "list";
type AppLauncherSort = "manual" | "name" | "category-auto" | "status";
type AppLauncherPlacement = { top: number; left: number; side: "left" | "right" | "mobile" };
type AppLauncherItem = {
  id: string;
  name: string;
  shortName?: string;
  iconAppId: string;
  category: string;
  description: string;
  kind: "app" | "tool";
  href?: string;
  manageHref?: string;
  parentAppId?: string;
  parentLabel?: string;
  connection: OperationsSummary["connection"];
  statusLabel: string;
  contractLabel: string;
  runtimeLabel: string;
  onlineCount: number | null;
  pendingCount: number | null;
  tags: string[];
  canOpen: boolean;
};

const fontScaleStorageKey = "application-management:font-scale:v1";
const approvalGateStorageKey = "application-management:approval-gate:v1";
const launcherOrderStorageKey = "application-management:launcher-order:v1";
const launcherCategoryStorageKey = "application-management:launcher-category-overrides:v1";
const launcherSortStorageKey = "application-management:launcher-sort:v1";
const launcherSortOptions: ReadonlyArray<{ id: AppLauncherSort; label: string }> = [
  { id: "manual", label: "Thủ công" },
  { id: "category-auto", label: "Tự động theo phân loại" },
  { id: "name", label: "Tên A → Z" },
  { id: "status", label: "Trạng thái" },
];
const fontScaleOptions: Array<{ id: FontScale; label: string; hint: string }> = [
  { id: "compact", label: "Gọn", hint: "Mức hiện tại · nhiều nội dung" },
  { id: "standard", label: "Chuẩn", hint: "Dễ đọc hơn" },
  { id: "large", label: "Lớn", hint: "Tăng thêm một cấp" },
  { id: "xlarge", label: "Rất lớn", hint: "Ưu tiên khả năng đọc" },
];

// The registry is the single source of truth for what belongs to the central
// management surface. Do not maintain a second hard-coded allow-list here:
// doing so can leave a real client connected on the server but invisible in UI.
const staticApps = applicationRegistry;

function standaloneAccess(user: { displayName: string; email: string }): AdminAccess {
  return {
    deviceId: "standalone:local-owner",
    deviceCode: "LOCAL-OPEN",
    email: user.email,
    displayName: user.displayName,
    status: "approved",
    role: "owner",
    label: "Standalone Development",
    owner: true,
  };
}

function standaloneCenter(user: { displayName: string; email: string }): CenterBootstrap {
  const actor = standaloneAccess(user);
  return {
    actor,
    applications: staticApps.map((app) => ({ id: app.id, name: app.name, status: app.status })),
    controlDevices: [],
    auditLog: [],
    upstreamError: null,
  };
}
const systemTools: readonly SystemTool[] = [
  {
    id: "tool-study-plan",
    name: "Phân tích lịch học Bauman",
    href: "/tools/study-plan",
    category: "Tool",
    note: "Phân tích kế hoạch 09.04.01/11 theo tuần, tháng, học kỳ và năm; đồng bộ học liệu/workflow với Bauman Hub và hiển thị độ phủ 33/33 khi registry live.",
    parentAppId: "bauman-master-ai",
    parentLabel: "Bauman Hub",
    manageHref: "/apps/bauman-master-ai",
  },
  {
    id: "tool-secret-generator",
    name: "Tạo Key / Secret",
    href: "/tools/secret-generator",
    category: "Tool",
    note: "Sinh chuỗi ngẫu nhiên, mật khẩu và secret bằng Web Crypto; không lưu secret vào URL hoặc storage.",
  },
  {
    id: "tool-managed-apps",
    name: "Catalog & Contract",
    href: "/tools/managed-apps",
    category: "Tool",
    note: "Thêm ứng dụng mới theo phân loại và Universal Contract mà không sửa code Trung tâm.",
  },
  {
    id: "tool-deploy-ops",
    name: "Deploy & Ops",
    href: "/tools/deploy-ops",
    category: "Tool",
    note: "Điều phối Vercel · Neon theo evidence; kiểm tra Safe Publish và khóa secret khỏi cấu hình.",
  },
  {
    id: "tool-kd-mid-visa",
    name: "KD-MID Visa VN",
    href: "/tools/kd-mid-visa",
    category: "Tool",
    note: "Chuẩn bị hồ sơ visa Nga với form tiếng Nga, hướng dẫn tiếng Việt, trường dùng chung, bookmarklet tự điền và bản ghi mở lại hồ sơ.",
  },
];
const validViews: readonly View[] = ["overview", "approvals", "applications", "devices", "access", "alerts", "audit", "settings"];

const navItems: Array<{ view: View; label: string; icon: string }> = [
  { view: "overview", label: "Tổng quan", icon: "⌂" },
  { view: "approvals", label: "Hộp việc", icon: "▱" },
  { view: "applications", label: "Ứng dụng", icon: "▦" },
  { view: "devices", label: "Kiểm duyệt thiết bị", icon: "▣" },
  { view: "access", label: "Thanh toán & Quyền", icon: "◈" },
  { view: "alerts", label: "Cảnh báo", icon: "△" },
  { view: "audit", label: "Nhật ký", icon: "≣" },
];

const viewTitles: Record<View, { title: string; subtitle: string }> = {
  overview: {
    title: "Bảng điều phối",
    subtitle: "Tổng quan hệ thống và trạng thái các ứng dụng.",
  },
  approvals: { title: "Hộp việc", subtitle: "Các yêu cầu và sự kiện cần xử lý được gom về một hàng đợi thống nhất." },
  applications: { title: "Ứng dụng", subtitle: "Quản trị client và mở đúng website sử dụng của từng ứng dụng." },
  devices: { title: "Kiểm duyệt thiết bị", subtitle: "Chỉ xử lý thiết bị đang chờ duyệt; mỗi lệnh đều kiểm tra quyền, capability và trạng thái live trước khi thay đổi registry." },
  access: { title: "Thanh toán & Quyền", subtitle: "Xử lý quyền truy cập và thanh toán chỉ trên các ứng dụng đã công bố contract nghiệp vụ thật." },
  alerts: { title: "Cảnh báo", subtitle: "Theo dõi mất kết nối, thay đổi môi trường và contract chưa hoàn tất." },
  audit: { title: "Nhật ký", subtitle: "Theo dõi lịch sử thao tác quản trị và các sự kiện bảo mật gần nhất." },
  settings: { title: "Cấu hình", subtitle: "Mở từ menu Tài khoản để điều chỉnh giao diện và quản lý thiết bị quản trị Trung tâm." },
};

function initials(value: string) {
  const words = value.trim().split(/\s+/).filter(Boolean);
  return (words.slice(-2).map((word) => word[0]?.toUpperCase()).join("") || "ND").slice(0, 2);
}

function relativeTime(value: string | null | undefined) {
  if (!value) return "—";
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return "—";
  const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60_000));
  if (minutes < 1) return "Vừa xong";
  if (minutes < 60) return `${minutes} phút trước`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} giờ trước`;
  return `${Math.floor(hours / 24)} ngày trước`;
}

function appFor(apps: readonly ApplicationConfig[], appId: string) {
  return apps.find((app) => app.id === appId);
}

function appGlyph(appId: string) {
  if (appId === "tool-study-plan") return "▤";
  if (appId === "tool-secret-generator") return "⚿";
  if (appId === "tool-managed-apps") return "◎";
  if (appId === "tool-deploy-ops") return "☁";
  if (appId === "tool-kd-mid-visa") return "✈";
  return "◆";
}

function appIconPath(appId: string) {
  return staticApps.find((app) => app.id === appId)?.iconPath;
}

function appGroup(app: ApplicationConfig) {
  return app.category;
}

function connectionFor(app: ApplicationConfig, summary?: OperationsSummary): OperationsSummary["connection"] {
  if (summary?.connection) return summary.connection;
  return app.contractState === "pending" ? "pending" : "warning";
}

function connectionLabel(value: OperationsSummary["connection"], summary?: OperationsSummary) {
  if (summary?.managementMode === "local-first" && summary.metadataVerified && summary.runtimeConnected !== true) return "Local-first · metadata đã xác minh";
  if (summary?.managementMode === "local-first" && summary.contractConnected === true) return "Local-first · contract live";
  if (summary?.managementMode === "metadata-only" && summary.metadataVerified) return "Metadata đã xác minh";
  const issueCode = summary?.issueCode;
  if (issueCode === "BOI_ECH_STALE_PUBLISH") return "Publish cũ · đã chặn";
  if (issueCode === "BOI_ECH_RUNTIME_IDENTITY_UNAVAILABLE") return "Chưa xác minh runtime";
  if (issueCode === "BOI_ECH_NOT_CONFIGURED") return "Thiếu URL quản trị";
  if (issueCode === "BOI_ECH_SECRET_NOT_CONFIGURED") return "Thiếu khóa quản trị";
  if (issueCode === "BOI_ECH_CONTROL_AUTH_MISMATCH") return "Sai khóa kết nối";
  if (issueCode === "BOI_ECH_CONTROL_API_MISSING") return "Thiếu Control API";
  if (issueCode === "BOI_ECH_CONTROL_UNAVAILABLE") return "Mất kết nối Control";
  if (value === "connected" && summary?.controlChannel === "legacy-adapter") {
    return summary.contractReadiness === "partial" || summary.contractReadiness === "pending"
      ? "Đang kết nối · chờ contract"
      : "Kết nối qua adapter";
  }
  if (summary?.issueCode === "REPOSITORY_METADATA_ONLY") return "Chưa kết nối runtime";
  if (value === "connected") return "Kết nối tốt";
  if (value === "warning" && summary?.controlChannel === "contract-observe") return "Contract live · chưa có quản trị";
  if (value === "unavailable") return "Mất kết nối";
  if (value === "warning") return "Có cảnh báo";
  return "Chờ contract";
}

function webActionLabel(summary: OperationsSummary | undefined, hasWeb: boolean, busy = false) {
  if (busy) return "…";
  if (summary?.webAccessPolicy === "deny") return "Không mở trực tiếp";
  if (hasWeb) return "Mở";
  if (summary?.managementMode === "local-first") return "Chỉ cục bộ";
  if (summary?.managementMode === "metadata-only") return "Chưa có web";
  return "Chưa sẵn sàng";
}

function webAccessAvailable(app: ApplicationConfig, summary: OperationsSummary | undefined, localRuntime: boolean) {
  if (summary?.webAccessPolicy === "deny") return false;
  return Boolean(summary?.webHref || app.publicUrl || (localRuntime && app.localUrl));
}

function intentionalNonRemoteMode(summary?: OperationsSummary) {
  return Boolean((summary?.contractConnected === true || summary?.metadataVerified) && (summary.managementMode === "local-first" || summary.managementMode === "metadata-only"));
}

function statusAxes(app: ApplicationConfig, summary?: OperationsSummary) {
  const state = connectionFor(app, summary);
  const localFirst = summary?.managementMode === "local-first";
  const metadataOnly = summary?.managementMode === "metadata-only";
  const runtimeLive = summary?.runtimeConnected === true;

  const runtime = localFirst
    ? runtimeLive
      ? { label: "Local-first · live", tone: "good" as const }
      : { label: "Local-first", tone: "good" as const }
    : metadataOnly
      ? { label: "Chưa công bố", tone: "idle" as const }
      : state === "unavailable"
        ? { label: "Mất kết nối", tone: "bad" as const }
        : runtimeLive
          ? { label: "Live", tone: "good" as const }
          : summary?.contractConnected === true
            ? { label: "Chưa live", tone: "warn" as const }
            : { label: "Chưa xác minh", tone: "idle" as const };

  const contract = (metadataOnly || (localFirst && !runtimeLive)) && summary?.metadataVerified
      ? { label: "Metadata ✓", tone: "good" as const }
    : summary?.contractConnected === true
      ? { label: "Đã bắt tay", tone: "good" as const }
    : summary?.metadataVerified
      ? { label: "Metadata ✓", tone: "good" as const }
      : summary?.contractReadiness === "partial"
        ? { label: "Đang hoàn tất", tone: "warn" as const }
        : summary?.contractReadiness === "not-enrolled"
          ? { label: "Chưa đăng ký", tone: "idle" as const }
          : { label: "Chờ", tone: "idle" as const };

  const admin = localFirst || metadataOnly
    ? { label: "Không yêu cầu", tone: "good" as const }
    : summary?.remoteAdminReady === true
      ? { label: "Sẵn sàng", tone: "good" as const }
      : summary?.contractConnected === true
        ? { label: "Chỉ quan sát", tone: "warn" as const }
        : { label: "Chưa sẵn sàng", tone: "idle" as const };

  return { runtime, contract, admin };
}

function StatusCell({ app, summary, offline = false }: { app: ApplicationConfig; summary?: OperationsSummary; offline?: boolean }) {
  if (offline) return <div className="amv2-status-cell" title="Dữ liệu cục bộ chưa được xác minh với Production."><b data-state="pending"><i/>Bản lưu · chưa kiểm tra</b><small aria-label="Chi tiết trạng thái kết nối"><span data-tone="idle">Runtime —</span><span data-tone="idle">Contract —</span><span data-tone="idle">Quản trị —</span></small></div>;
  const state = connectionFor(app, summary);
  const axes = statusAxes(app, summary);
  const title = summary?.note ?? app.contractNote;
  const visualState = summary?.managementMode === "local-first" || (summary?.managementMode === "metadata-only" && summary.metadataVerified) ? "connected" : state;
  return <div className="amv2-status-cell" title={title}>
    <b data-state={visualState}><i/>{connectionLabel(state, summary)}</b>
    <small aria-label="Chi tiết trạng thái kết nối">
      <span data-tone={axes.runtime.tone}>Runtime {axes.runtime.label}</span>
      <span data-tone={axes.contract.tone}>Contract {axes.contract.label}</span>
      <span data-tone={axes.admin.tone}>Quản trị {axes.admin.label}</span>
    </small>
  </div>;
}

function operationalCounts(appId: string, summary: OperationsSummary | undefined, devices: OperationsDevice[]) {
  if (summary) return { pending: summary.pendingCount, online: summary.onlineCount };
  const appDevices = devices.filter((device) => device.appId === appId);
  return {
    pending: appDevices.filter((device) => device.status === "pending").length,
    online: appDevices.filter((device) => device.active).length,
  };
}

function countText(value: number | null) {
  return value === null ? "—" : value;
}

function deviceKind(device: OperationsDevice) {
  if (device.deviceType === "desktop") return "Desktop";
  if (device.deviceType === "phone") return "Điện thoại";
  if (device.deviceType === "tablet") return "Tablet";
  return device.deviceTypeLabel || "Chưa phân loại";
}

function Gate({ busy, error, access, retry }: { busy: boolean; error: string; access: AdminAccess | null; retry: () => void }) {
  return <main className="amv2-gate"><section><div>QT</div><h1>Quản trị Ứng dụng</h1><p>{busy ? "Đang xác minh thiết bị quản trị…" : error || (access?.status === "pending" ? "Thiết bị này đang chờ Chủ hệ thống cấp quyền." : access?.status === "blocked" ? "Thiết bị quản trị đã bị khóa." : "Không thể mở Trung tâm quản trị.")}</p>{busy ? <span/> : <button onClick={retry}>Kiểm tra lại</button>}</section></main>;
}

export default function ManagementDashboardV2({ user, authMode, defaultApprovalGate }: {
  user: { displayName: string; email: string };
  authMode: "chatgpt-sites" | "cloudflare-preview" | "cloudflare-production" | "local";
  defaultApprovalGate: boolean;
}) {
  const [access, setAccess] = useState<AdminAccess | null>(null);
  const [center, setCenter] = useState<CenterBootstrap | null>(null);
  const [operations, setOperations] = useState<OperationsBootstrap | null>(null);
  const [view, setView] = useState<View>("overview");
  const [search, setSearch] = useState("");
  const [appFilter, setAppFilter] = useState("all");
  const [busy, setBusy] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [operationsVerified, setOperationsVerified] = useState(false);
  const [actionBusy, setActionBusy] = useState("");
  const [webBusy, setWebBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [syncError, setSyncError] = useState("");
  const notificationListRef = useRef<HTMLDivElement>(null);
  const automationSaveLockRef = useRef(false);
  const actionLocksRef = useRef<Set<string>>(new Set());
  const operationsRefreshPromiseRef = useRef<Promise<OperationsBootstrap | null> | null>(null);
  const [clock, setClock] = useState<Date | null>(null);
  const [webMenu, setWebMenu] = useState(false);
  const [autoPolicyOpen, setAutoPolicyOpen] = useState(false);
  const [accountSecurityOpen, setAccountSecurityOpen] = useState(false);
  const [fontScale, setFontScale] = useState<FontScale>("compact");
  const [localRuntime, setLocalRuntime] = useState(false);
  const [approvalGateEnabled, setApprovalGateEnabled] = useState(defaultApprovalGate);

  async function refreshOperations(silent = false, forceOnline = false) {
    if (!silent) setSyncing(true);
    setSyncError("");
    if (!approvalGateEnabled && !forceOnline) {
      const cached = readCachedOperations();
      if (cached) setOperations(cached);
      if (!silent) setNotice("Standalone Mode: dữ liệu local được ưu tiên. Các thao tác Lưu quản trị vẫn tự xác minh online.");
      if (!silent) setSyncing(false);
      return cached;
    }
    try {
      if (!operationsRefreshPromiseRef.current) {
        operationsRefreshPromiseRef.current = (async () => {
          const result = await connectOperationsDashboard();
          if (result.bootstrap) setOperations(result.bootstrap);
          setOperationsVerified(Boolean(result.bootstrap));
          return result.bootstrap ?? null;
        })().finally(() => {
          operationsRefreshPromiseRef.current = null;
        });
      }
      return await operationsRefreshPromiseRef.current;
    } catch (caught) {
      if (!forceOnline) setOperationsVerified(false);
      setSyncError(caught instanceof Error ? caught.message : "Không thể đồng bộ dữ liệu ứng dụng.");
      return null;
    } finally {
      if (!silent) setSyncing(false);
    }
  }

  async function syncOperationsNow() {
    setOperationsVerified(false);
    return refreshOperations(false, true);
  }

  async function initialize() {
    setBusy(true);
    setError("");
    try {
      const cached = readCachedOperations();
      if (cached) setOperations(cached);
      if (!approvalGateEnabled) {
        const actor = standaloneAccess(user);
        setAccess(actor);
        setCenter(standaloneCenter(user));
        return;
      }
      const result = await connectAdminCenter();
      setAccess(result.access);
      setCenter(result.bootstrap);
      if (result.bootstrap) void refreshOperations(true);
    } catch (caught) {
      if (!approvalGateEnabled) {
        setAccess(standaloneAccess(user));
        setCenter(standaloneCenter(user));
        return;
      }
      setError(caught instanceof Error ? caught.message : "Không thể mở Trung tâm quản trị.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }
  }, []);

  useEffect(() => {
    const resolveView = () => {
      const requested = new URLSearchParams(window.location.search).get("view");
      setView(requested && validViews.includes(requested as View) ? requested as View : "overview");
    };
    resolveView();
    setClock(new Date());
    setLocalRuntime(["127.0.0.1", "localhost"].includes(window.location.hostname));
    try {
      const saved = window.localStorage.getItem(approvalGateStorageKey);
      if (saved === "on") setApprovalGateEnabled(true);
      if (saved === "off") setApprovalGateEnabled(false);
    } catch {
      // Standalone preference is device-local and optional.
    }
    const timer = window.setInterval(() => setClock(new Date()), 1000);
    const onFocus = () => void refreshOperations(true);
    window.addEventListener("popstate", resolveView);
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("popstate", resolveView);
      window.removeEventListener("focus", onFocus);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void initialize();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [approvalGateEnabled]);

  useEffect(() => {
    if (notificationListRef.current) notificationListRef.current.scrollTop = 0;
  }, [notice, syncError]);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(fontScaleStorageKey);
      if (saved && fontScaleOptions.some((option) => option.id === saved)) setFontScale(saved as FontScale);
    } catch {
      // Appearance preference is device-local and optional.
    }
  }, []);

  function changeFontScale(next: FontScale) {
    setFontScale(next);
    try { window.localStorage.setItem(fontScaleStorageKey, next); } catch { /* Device-local persistence is optional. */ }
  }

  function changeApprovalGate(next: boolean) {
    setApprovalGateEnabled(next);
    setOperationsVerified(false);
    setNotice(next
      ? "Đã bật Kiểm duyệt truy cập. Trung tâm sẽ xác minh quyền/thiết bị online."
      : "Đã tắt Kiểm duyệt truy cập. Standalone Mode cho phép vào thẳng và ưu tiên dữ liệu local.");
    try { window.localStorage.setItem(approvalGateStorageKey, next ? "on" : "off"); } catch { /* Device-local persistence is optional. */ }
  }

  function requireManagedAccess(actionLabel: string) {
    if (approvalGateEnabled) return true;
    setNotice(`${actionLabel} cần quyền quản trị online. Bật “Kiểm duyệt truy cập” khi cần thao tác quyền/thiết bị.`);
    return false;
  }

  const activeApps = useMemo<ApplicationConfig[]>(() => {
    const merged = new Map<string, ApplicationConfig>(staticApps.map((app) => [app.id, app]));
    for (const dynamicApp of operations?.managedApps ?? []) {
      const existing = merged.get(dynamicApp.id);
      merged.set(dynamicApp.id, {
        ...(existing ?? {}),
        ...dynamicApp,
        href: existing?.href ?? dynamicApp.href,
        tier: "client",
        deviceExperiences: existing?.deviceExperiences ?? standardDeviceExperiences,
        childClients: existing?.childClients,
      } as ApplicationConfig);
    }
    return [...merged.values()];
  }, [operations]);
  const activeAppSet = useMemo(() => new Set(activeApps.map((app) => app.id)), [activeApps]);

  const summaries = useMemo(() => (operations?.summaries ?? []).filter((item) => activeAppSet.has(item.appId)), [operations, activeAppSet]);
  const summaryMap = useMemo(() => new Map(summaries.map((item) => [item.appId, item])), [summaries]);
  const devices = useMemo(() => (operations?.devices ?? []).filter((item) => activeAppSet.has(item.appId)), [operations, activeAppSet]);
  const workItems = useMemo(() => (operations?.workItems ?? []).filter((item) => activeAppSet.has(item.appId)), [operations, activeAppSet]);
  const pendingDevices = devices.filter((device) => device.status === "pending");
  const approvalDevices = devices.filter((device) => device.status === "pending" || device.attention !== "none");
  const environmentCount = devices.filter((device) => device.attention === "environment").length;
  const unavailableCount = activeApps.filter((app) => connectionFor(app, summaryMap.get(app.id)) === "unavailable").length;
  const contractPending = activeApps.filter((app) => {
    const summary = summaryMap.get(app.id);
    if (intentionalNonRemoteMode(summary)) return false;
    const live = summary?.contractReadiness;
    return live ? live !== "ready" && live !== "metadata" : app.contractState !== "connected";
  }).length;
  const highAlerts = workItems.filter((item) => item.priority === "high").length;
  const offline = !operationsVerified;
  const notificationCount = offline ? 0 : workItems.length;
  const approvalCount = approvalDevices.length;
  const onlineApps = activeApps.filter((app) => connectionFor(app, summaryMap.get(app.id)) === "connected").length;
  const onlineDevices = summaries.reduce((sum, item) => sum + (item.onlineCount ?? 0), 0);
  const searchValue = search.trim().toLowerCase();

  const filteredApps = activeApps.filter((app) => {
    if (appFilter !== "all" && app.id !== appFilter) return false;
    return !searchValue || `${app.name} ${app.shortName} ${app.scope}`.toLowerCase().includes(searchValue);
  });
  const filteredTools = systemTools.filter((tool) => {
    if (appFilter !== "all" && tool.id !== appFilter) return false;
    return !searchValue || `${tool.name} ${tool.category} ${tool.note} ${tool.parentLabel ?? ""}`.toLowerCase().includes(searchValue);
  });
  const filteredDevices = devices.filter((device) => {
    if (appFilter !== "all" && device.appId !== appFilter) return false;
    return !searchValue || `${device.appName} ${device.deviceCode} ${device.userLabel} ${device.deviceTypeLabel}`.toLowerCase().includes(searchValue);
  });
  const filteredPendingDevices = filteredDevices.filter((device) => device.status === "pending");
  const filteredWork = workItems.filter((item) => {
    if (appFilter !== "all" && item.appId !== appFilter) return false;
    return !searchValue || `${item.appName} ${item.title} ${item.detail}`.toLowerCase().includes(searchValue);
  });
  const filteredApprovalDevices = filteredDevices.filter((device) => device.status === "pending" || device.attention !== "none");

  function switchView(next: View) {
    if (next === view) return;
    setView(next);
    setWebMenu(false);
    const nextUrl = next === "overview" ? "/" : `/?view=${encodeURIComponent(next)}`;
    window.history.pushState({ view: next }, "", nextUrl);
    const content = document.querySelector<HTMLElement>(".amv2-content");
    if (content) content.scrollTop = 0;
  }

  function acquireActionLock(key: string) {
    if (actionLocksRef.current.has(key)) return false;
    actionLocksRef.current.add(key);
    return true;
  }

  function releaseActionLock(key: string) {
    actionLocksRef.current.delete(key);
  }

  async function manageDevice(device: OperationsDevice, operation: "approve" | "remove") {
    if (!requireManagedAccess("Kiểm duyệt thiết bị")) return;
    if (device.status !== "pending") {
      setNotice(`Thiết bị ${device.deviceCode} không còn ở trạng thái chờ kiểm duyệt. Hãy đồng bộ lại hoặc mở Quản trị của ${device.appName} để thay đổi quyền.`);
      return;
    }
    if (operation === "approve" && !device.canApprove) {
      setNotice(`Thiết bị ${device.deviceCode} chưa đủ điều kiện hoặc tài khoản hiện tại không có quyền duyệt. Không gửi lệnh lên client.`);
      return;
    }
    if (operation === "remove" && !device.canRemove) {
      setNotice(`Ứng dụng ${device.appName} không cho phép từ chối/khóa thiết bị này từ Trung tâm. Không gửi lệnh lên client.`);
      return;
    }
    if (operation === "approve" && device.appId === "boi-ech") {
      setAppFilter("boi-ech");
      switchView("access");
      setNotice("Bơi ếch cần chọn rõ Miễn phí hoặc Trả phí trong Thanh toán & Quyền; không tự động cấp miễn phí từ hàng kiểm duyệt.");
      return;
    }
    if (operation === "remove") {
      if (device.appId === "boi-ech") {
        if (!window.confirm(`Xóa vĩnh viễn thiết bị ${device.deviceCode} khỏi registry Bơi ếch? Thao tác này không thể hoàn tác tại Trung tâm.`)) return;
        const confirmation = window.prompt(`Nhập chính xác mã thiết bị để xác nhận xóa vĩnh viễn:\n${device.deviceCode}`);
        if (confirmation?.trim().toUpperCase() !== device.deviceCode.trim().toUpperCase()) {
          setNotice(`Đã hủy xóa ${device.deviceCode}: mã xác nhận không khớp.`);
          return;
        }
      } else if (!window.confirm(`Từ chối và khóa thiết bị ${device.deviceCode} của ${device.appName}? Thiết bị sẽ không được cấp quyền truy cập.`)) {
        return;
      }
    }

    const actionKey = `device:${device.appId}:${device.deviceId}`;
    if (!acquireActionLock(actionKey)) return;
    setActionBusy(`${device.appId}:${device.deviceId}`);
    setNotice("");
    try {
      const result = await operationsAction({
        action: "manage-client-device",
        operation,
        appId: device.appId,
        deviceId: device.deviceId,
        deviceCode: device.deviceCode,
        expectedStatus: device.status,
        registryInstanceId: device.registryInstanceId ?? undefined,
      });
      await refreshOperations(true);
      if (result.code === "STALE_DEVICE_REMOVED") {
        setNotice(`Thiết bị ${device.deviceCode} không còn trong registry; hàng kiểm duyệt đã được đồng bộ lại.`);
      } else if (operation === "approve") {
        setNotice(`Đã duyệt ${device.deviceCode}.`);
      } else if (device.appId === "boi-ech") {
        setNotice(`Đã xóa vĩnh viễn ${device.deviceCode} khỏi registry Bơi ếch.`);
      } else {
        setNotice(`Đã từ chối và khóa ${device.deviceCode}.`);
      }
    } catch (caught) {
      const code = caught instanceof AdminApiError ? caught.data.code : undefined;
      const growUpStale = device.appId === "growup-mychildren"
        && (code === "DEVICE_NOT_FOUND" || code === "GROWUP_REGISTRY_INSTANCE_MISMATCH");
      await refreshOperations(true);
      if (growUpStale) {
        setNotice(code === "GROWUP_REGISTRY_INSTANCE_MISMATCH"
          ? "Registry GrowUP vừa thay đổi; hàng kiểm duyệt đã được đồng bộ lại."
          : `Thiết bị ${device.deviceCode} không còn trong registry GU-; dòng dữ liệu cũ đã được loại khỏi danh sách.`);
      } else if (code === "DEVICE_STATE_CONFLICT") {
        setNotice(`Trạng thái ${device.deviceCode} đã thay đổi ở ứng dụng nguồn. Hàng kiểm duyệt đã được đồng bộ; hãy kiểm tra lại trước khi thao tác.`);
      } else if (code === "DEVICE_NOT_FOUND") {
        setNotice(`Thiết bị ${device.deviceCode} không còn trong registry. Hàng kiểm duyệt đã được đồng bộ lại.`);
      } else {
        setNotice(caught instanceof Error ? caught.message : "Không thể cập nhật thiết bị.");
      }
    } finally {
      releaseActionLock(actionKey);
      setActionBusy("");
    }
  }

  async function bulkRemovePendingDevices(visibleDevices: OperationsDevice[]) {
    if (!requireManagedAccess("Từ chối hàng loạt thiết bị")) return;
    const boiTargets = visibleDevices.filter((device) => device.status === "pending" && device.canRemove && device.appId === "boi-ech");
    const targets = visibleDevices.filter((device) => device.status === "pending" && device.canRemove && device.appId !== "boi-ech").slice(0, 24);
    if (!targets.length) {
      setNotice(boiTargets.length
        ? "Bơi ếch không cho xóa hàng loạt vì đây là thao tác xóa vĩnh viễn. Hãy kiểm duyệt từng thiết bị."
        : "Không có thiết bị chờ kiểm duyệt nào hỗ trợ từ chối/khóa trực tiếp trong phạm vi đang hiển thị.");
      return;
    }
    const summary = [
      `Từ chối và khóa ${targets.length} thiết bị chờ kiểm duyệt đang hiển thị?`,
      boiTargets.length ? `${boiTargets.length} thiết bị Bơi ếch được bỏ qua và phải xử lý riêng từng thiết bị.` : "",
      targets.length === 24 ? "Mỗi lượt tối đa 24 thiết bị để giới hạn phạm vi thao tác hàng loạt." : "",
    ].filter(Boolean).join("\n");
    if (!window.confirm(summary)) return;

    const actionKey = "bulk-pending";
    if (!acquireActionLock(actionKey)) return;
    const targetActionKeys: string[] = [];
    for (const device of targets) {
      const deviceActionKey = `device:${device.appId}:${device.deviceId}`;
      if (!acquireActionLock(deviceActionKey)) {
        targetActionKeys.forEach(releaseActionLock);
        releaseActionLock(actionKey);
        setNotice(`Một thiết bị trong hàng đợi đang được xử lý ở cửa sổ khác. Đã hủy thao tác hàng loạt trước khi gửi lệnh.`);
        return;
      }
      targetActionKeys.push(deviceActionKey);
    }
    setActionBusy(actionKey);
    setNotice("");
    let succeeded = 0;
    const failed: string[] = [];
    try {
      for (const device of targets) {
        try {
          await operationsAction({
            action: "manage-client-device",
            operation: "remove",
            appId: device.appId,
            deviceId: device.deviceId,
            deviceCode: device.deviceCode,
            expectedStatus: device.status,
            registryInstanceId: device.registryInstanceId ?? undefined,
          });
          succeeded += 1;
        } catch {
          failed.push(device.deviceCode);
        }
      }
      await refreshOperations(true);
      setNotice(failed.length
        ? `Đã từ chối/khóa ${succeeded}/${targets.length} thiết bị. Lỗi: ${failed.slice(0, 5).join(", ")}${failed.length > 5 ? ` và ${failed.length - 5} thiết bị khác` : ""}. Danh sách đã được đồng bộ lại.`
        : `Đã từ chối và khóa ${succeeded} thiết bị.${boiTargets.length ? ` Bỏ qua ${boiTargets.length} thiết bị Bơi ếch để kiểm duyệt riêng.` : ""}`);
    } finally {
      targetActionKeys.forEach(releaseActionLock);
      releaseActionLock(actionKey);
      setActionBusy("");
    }
  }

  async function launchWeb(appId: string) {
    const app = appFor(activeApps, appId);
    const summary = summaryMap.get(appId);
    if (summary?.webAccessPolicy === "deny") {
      setNotice("Contract ứng dụng không cho Application Management mở learning runtime trực tiếp.");
      return;
    }
    const fallback = app?.publicUrl ?? (localRuntime ? app?.localUrl : undefined);
    if (!summary?.webHref && !fallback) {
      setNotice("Ứng dụng chưa công bố URL website hợp lệ.");
      return;
    }
    const actionKey = `web:${appId}`;
    if (!acquireActionLock(actionKey)) return;
    setWebBusy(appId);
    setNotice("");
    try {
      if (summary?.managedWebLaunch && approvalGateEnabled) {
        const popup = window.open("about:blank", "_blank");
        if (popup) popup.opener = null;
        try {
          const result = await operationsAction({ action: "launch-client-web", appId });
          if (!result.launchUrl) throw new Error(result.error ?? "Không lấy được vé mở website ứng dụng.");
          if (popup) popup.location.replace(result.launchUrl);
          else window.location.assign(result.launchUrl);
        } catch (caught) {
          popup?.close();
          throw caught;
        }
      } else {
        window.open(summary?.webHref ?? fallback, "_blank", "noopener,noreferrer");
      }
      setWebMenu(false);
    } catch (caught) {
      setNotice(caught instanceof Error ? caught.message : "Không thể mở website ứng dụng.");
    } finally {
      releaseActionLock(actionKey);
      setWebBusy("");
    }
  }

  async function clearNotifications() {
    if (!requireManagedAccess("Dọn thông báo online")) return;
    const ids = workItems.map((item) => item.id);
    if (!ids.length) {
      setNotice("Không có thông báo cần dọn.");
      return;
    }
    if (!window.confirm(`Xóa ${ids.length} mục khỏi danh sách hiển thị? Dữ liệu nghiệp vụ gốc không bị xóa.`)) return;
    const actionKey = "clear-notifications";
    if (!acquireActionLock(actionKey)) return;
    setActionBusy("clear");
    try {
      await operationsAction({ action: "dismiss-notifications", workItemIds: ids });
      await refreshOperations(true);
      setNotice("Đã dọn thông báo hiển thị; dữ liệu gốc được giữ nguyên.");
    } catch (caught) {
      setNotice(caught instanceof Error ? caught.message : "Không thể xóa thông báo.");
    } finally {
      releaseActionLock(actionKey);
      setActionBusy("");
    }
  }

  async function saveAutomation(selection: AutomationSelection) {
    if (automationSaveLockRef.current) return null;
    automationSaveLockRef.current = true;
    setActionBusy("auto-policy");

    try {
      // The modal already owns a verified snapshot. Do not block a single-app
      // mutation on a fresh full-dashboard bootstrap. The mutation endpoint
      // reads that target live again before writing and returns its own readback.
      const current = operations?.settings ?? (await refreshOperations(true, true))?.settings;
      if (!current?.automationPolicies?.length) {
        setNotice("Không lấy được snapshot policy để lưu an toàn. Kiểm tra quyền quản trị/kết nối rồi thử lại.");
        return null;
      }

      const policyMap = new Map(current.automationPolicies.map((policy) => [policy.appId, policy]));
      const approvalTargets = current.automationPolicies
        .filter((policy) => {
          if (!policy.mutation.autoApprove) return false;
          const desired = selection.appIds.includes(policy.appId);
          if (policy.current.autoApprove !== desired) return true;
          return policy.appId === "boi-ech" && desired && (
            policy.current.freeAccessDays !== selection.defaultAccessDays
            || policy.current.freeDeviceLimit !== selection.defaultDeviceLimit
          );
        })
        .map((policy) => policy.appId);
      const blockTargets = current.automationPolicies
        .filter((policy) => {
          if (!policy.mutation.autoBlockPending) return false;
          const desired = selection.autoBlockAppIds.includes(policy.appId);
          if (policy.current.autoBlockPending !== desired) return true;
          const desiredHours = selection.pendingBlockAfterHoursByApp[policy.appId] ?? 168;
          return desired && policy.current.pendingBlockAfterHours !== desiredHours;
        })
        .map((policy) => policy.appId);
      const changedAppIds = [...new Set([...approvalTargets, ...blockTargets])];

      if (!changedAppIds.length) {
        setNotice("Không có thay đổi cấu hình kiểm duyệt cần lưu.");
        return current;
      }

      const summaryLines = changedAppIds.map((appId) => {
        const label = activeApps.find((app) => app.id === appId)?.shortName ?? appId;
        const parts: string[] = [];
        if (approvalTargets.includes(appId)) {
          const automatic = selection.appIds.includes(appId);
          if (appId === "boi-ech") {
            parts.push(automatic
              ? "Miễn phí · tự động duyệt (" + selection.defaultAccessDays + " ngày, tối đa " + selection.defaultDeviceLimit + " thiết bị)"
              : "Có phí · xác minh thủ công");
          } else {
            parts.push(automatic ? "Tự động duyệt" : "Duyệt thủ công");
          }
        }
        if (blockTargets.includes(appId)) {
          const autoBlock = selection.autoBlockAppIds.includes(appId);
          const hours = selection.pendingBlockAfterHoursByApp[appId] ?? 168;
          parts.push(autoBlock ? "Từ chối & khóa yêu cầu quá hạn sau " + hours + " giờ" : "Giữ yêu cầu quá hạn để xử lý thủ công");
        }
        return "• " + label + ": " + parts.join(" · ");
      });
      const confirmation = [
        "Lưu " + changedAppIds.length + " cấu hình kiểm duyệt?",
        "",
        ...summaryLines,
        "",
        "Mỗi policy được ghi vào đúng client và chỉ được coi là thành công sau readback.",
      ].join("\n");
      if (!window.confirm(confirmation)) return current;

      type PolicySaveTask = {
        appId: string;
        field: "autoApprove" | "autoBlockPending";
        run: () => Promise<OperationsActionResponse>;
      };
      const tasks: PolicySaveTask[] = [];

      for (const appId of approvalTargets) {
        tasks.push({
          appId,
          field: "autoApprove",
          run: () => operationsAction({
            action: "set-auto-approval",
            appIds: selection.appIds.includes(appId) ? [appId] : [],
            targetAppIds: [appId],
            ...(appId === "boi-ech" ? {
              defaultAccessDays: selection.defaultAccessDays,
              defaultDeviceLimit: selection.defaultDeviceLimit,
            } : {}),
          }),
        });
      }
      for (const appId of blockTargets) {
        tasks.push({
          appId,
          field: "autoBlockPending",
          run: () => operationsAction({
            action: "set-auto-block-pending",
            appId,
            enabled: selection.autoBlockAppIds.includes(appId),
            pendingBlockAfterHours: selection.pendingBlockAfterHoursByApp[appId] ?? policyMap.get(appId)?.current.pendingBlockAfterHours ?? 168,
          }),
        });
      }

      setNotice("");

      // Same app = sequential writes. Different apps may proceed in parallel.
      const chains = new Map<string, Promise<unknown>>();
      const executions = tasks.map((task) => {
        const previous = chains.get(task.appId) ?? Promise.resolve();
        const execution = previous.then(() => task.run());
        chains.set(task.appId, execution.catch(() => undefined));
        return execution;
      });
      const settled = await Promise.allSettled(executions);

      const transportErrors = new Map<string, string>();
      const responseSettings: NonNullable<OperationsBootstrap["settings"]>[] = [];
      settled.forEach((result, index) => {
        const task = tasks[index];
        if (result.status === "rejected") {
          transportErrors.set(task.appId + ":" + task.field, result.reason instanceof Error ? result.reason.message : "Lệnh cập nhật thất bại.");
          return;
        }
        if (result.value.settings) responseSettings.push(result.value.settings);
      });

      const mergedPolicies = new Map(current.automationPolicies.map((policy) => [policy.appId, policy]));
      for (const patch of responseSettings) {
        for (const policy of patch.automationPolicies ?? []) mergedPolicies.set(policy.appId, policy);
      }
      const automationPolicies = [...mergedPolicies.values()];
      const mergedSettings: NonNullable<OperationsBootstrap["settings"]> = {
        ...current,
        automationPolicies,
        autoApproveAppIds: automationPolicies.filter((policy) => policy.current.autoApprove === true).map((policy) => policy.appId),
        autoApproveSupportedAppIds: automationPolicies
          .filter((policy) => policy.verification.state === "live" && policy.support.autoApprove)
          .map((policy) => policy.appId),
        autoBlockPendingAppIds: automationPolicies.filter((policy) => policy.current.autoBlockPending === true).map((policy) => policy.appId),
        autoBlockPendingSupportedAppIds: automationPolicies
          .filter((policy) => policy.verification.state === "live" && policy.support.autoBlockPending)
          .map((policy) => policy.appId),
        pendingBlockAfterHoursByApp: Object.fromEntries(automationPolicies
          .filter((policy) => typeof policy.current.pendingBlockAfterHours === "number")
          .map((policy) => [policy.appId, policy.current.pendingBlockAfterHours!])),
        freeAccessDaysByApp: Object.fromEntries(automationPolicies
          .filter((policy) => typeof policy.current.freeAccessDays === "number")
          .map((policy) => [policy.appId, policy.current.freeAccessDays!])),
        freeDeviceLimitByApp: Object.fromEntries(automationPolicies
          .filter((policy) => typeof policy.current.freeDeviceLimit === "number")
          .map((policy) => [policy.appId, policy.current.freeDeviceLimit!])),
      };

      function taskMatchesReadback(settings: NonNullable<OperationsBootstrap["settings"]>, task: PolicySaveTask) {
        const policy = settings.automationPolicies?.find((item) => item.appId === task.appId);
        let verified = policy?.verification.state === "live";
        if (task.field === "autoApprove") {
          const desired = selection.appIds.includes(task.appId);
          verified = verified && policy?.current.autoApprove === desired;
          if (task.appId === "boi-ech" && desired) {
            verified = verified
              && policy?.current.freeAccessDays === selection.defaultAccessDays
              && policy?.current.freeDeviceLimit === selection.defaultDeviceLimit;
          }
        } else {
          const desired = selection.autoBlockAppIds.includes(task.appId);
          verified = verified && policy?.current.autoBlockPending === desired;
          if (desired) verified = verified && policy?.current.pendingBlockAfterHours === selection.pendingBlockAfterHoursByApp[task.appId];
        }
        return Boolean(verified);
      }

      const failedFields: string[] = [];
      const failedApps = new Set<string>();
      for (const task of tasks) {
        const policy = mergedSettings.automationPolicies?.find((item) => item.appId === task.appId);
        const label = activeApps.find((app) => app.id === task.appId)?.shortName ?? task.appId;
        const verified = !transportErrors.has(task.appId + ":" + task.field) && taskMatchesReadback(mergedSettings, task);
        if (!verified) {
          failedApps.add(task.appId);
          const fieldLabel = task.field === "autoApprove" ? "kiểm duyệt" : "quá hạn";
          const detail = policy?.verification.errorCode ?? transportErrors.get(task.appId + ":" + task.field);
          failedFields.push(label + " · " + fieldLabel + (detail ? " (" + detail + ")" : ""));
        }
      }

      setOperations((previous) => previous ? {
        ...previous,
        settings: mergedSettings,
        generatedAt: new Date().toISOString(),
      } : previous);

      const succeededApps = changedAppIds.filter((appId) => !failedApps.has(appId));
      if (failedFields.length) {
        setNotice(
          "Đã xác minh " + succeededApps.length + "/" + changedAppIds.length + " ứng dụng. Chưa khớp readback: "
          + failedFields.join("; ")
          + ". Giá trị hiển thị là readback của đúng client vừa thao tác.",
        );
      } else {
        setNotice("Đã lưu và readback chính xác " + changedAppIds.length + " ứng dụng.");
      }

      // Full inventory refresh is eventual consistency only. It must never keep
      // the Save button locked after target-app readback already succeeded.
      window.setTimeout(() => void refreshOperations(true, true), 1_200);
      return mergedSettings;
    } catch (caught) {
      setNotice(caught instanceof Error ? caught.message : "Không thể cập nhật quy tắc tự động.");
      return null;
    } finally {
      automationSaveLockRef.current = false;
      setActionBusy("");
    }
  }

  async function manageControlDevice(device: ControlAdminDevice, operation: ControlDeviceOperation, selectedRole?: "reviewer" | "publisher") {
    if (!requireManagedAccess("Quản lý quyền quản trị")) return;
    if (!access || access.role !== "owner" || device.owner || device.deviceId === access.deviceId) return;
    if (operation === "block" && !window.confirm(`Khóa thiết bị quản trị ${device.deviceCode}?`)) return;
    if (operation === "deactivate-member" && !window.confirm(`Thu hồi toàn bộ quyền quản trị của ${device.email}?`)) return;
    if (operation === "delete-member") {
      const confirmation = window.prompt(`Nhập chính xác email để xóa tài khoản đã thu hồi:\n${device.email}`);
      if (confirmation?.trim().toLowerCase() !== device.email.toLowerCase()) return;
    }
    const actionKey = `control:${device.deviceId}`;
    if (!acquireActionLock(actionKey)) return;
    setActionBusy(actionKey);
    try {
      const result = await centerAdminAction({ action: "manage-control-device", operation, targetDeviceId: device.deviceId, role: selectedRole ?? "reviewer", displayName: device.displayName });
      setCenter((current) => current ? { ...current, controlDevices: result.controlDevices ?? current.controlDevices, auditLog: result.auditLog ?? current.auditLog } : current);
      setNotice("Đã cập nhật thiết bị quản trị.");
    } catch (caught) {
      setNotice(caught instanceof Error ? caught.message : "Không thể cập nhật thiết bị quản trị.");
    } finally {
      releaseActionLock(actionKey);
      setActionBusy("");
    }
  }

  if (approvalGateEnabled && (!access || access.status !== "approved" || !center)) return <Gate busy={busy} error={error} access={access} retry={() => void initialize()}/>;
  if (!access || !center) return <Gate busy={busy} error={error} access={access} retry={() => void initialize()}/>;

  const title = viewTitles[view];
  const lastUpdated = operations?.generatedAt ? relativeTime(operations.generatedAt) : "Chưa có dữ liệu";

  return <main className="amv2-shell" data-font-scale={fontScale}>
    {accountSecurityOpen ? <AccountSecurityDialog user={user} role={roleLabels[access.role]} authMode={authMode} close={() => setAccountSecurityOpen(false)}/> : null}
    {autoPolicyOpen ? <AutomaticDevicePolicies apps={activeApps} settings={operations?.settings} busy={actionBusy === "auto-policy"} close={() => setAutoPolicyOpen(false)} save={saveAutomation}/> : null}
    <aside className="amv2-sidebar">
      <div className="amv2-brand"><div>QT</div><span><small>TRUNG TÂM ĐIỀU PHỐI</small><strong>QUẢN TRỊ ỨNG DỤNG</strong><em>Kết nối · Kiểm soát · Phát triển</em></span></div>
      <nav aria-label="Điều hướng quản trị">{navItems.map((item) => <button key={item.view} data-active={view === item.view} onClick={() => switchView(item.view)}><i>{item.icon}</i><span>{item.label}</span>{!offline && item.view === "devices" && pendingDevices.length ? <b>{pendingDevices.length}</b> : null}{!offline && item.view === "approvals" && approvalCount ? <b>{approvalCount}</b> : null}</button>)}</nav>
      <section className="amv2-system-card"><header><span>▣</span><div><small>Trạng thái hệ thống</small><strong>{offline ? "Chưa xác minh online" : unavailableCount ? "Cần kiểm tra" : "Đã cập nhật dữ liệu"}</strong></div></header><p><span>Ứng dụng & Tool</span><b>{activeApps.length + systemTools.length}</b></p><p><span>Kết nối tốt</span><b>{offline ? "—" : onlineApps}</b></p><p><span>Thiết bị chờ duyệt</span><b>{offline ? "—" : pendingDevices.length}</b></p><p><span>Lần đồng bộ</span><b>{offline || !operations?.generatedAt ? "—" : new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(new Date(operations.generatedAt))}</b></p></section>
      <blockquote>Quản trị tập trung<br/>Vận hành an toàn<br/>Phát triển bền vững</blockquote>
      <footer><i/>{offline ? "Chế độ cục bộ" : "Hệ thống hoạt động"}</footer>
    </aside>

    <section className="amv2-workspace">
      <header className="amv2-topbar">
        <label className="amv2-search"><span>⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm theo ứng dụng, thiết bị, người dùng…"/></label>
        <label className="amv2-filter"><span>▽</span><select value={appFilter} onChange={(event) => setAppFilter(event.target.value)}><option value="all">Bộ lọc nhanh</option>{activeApps.map((app) => <option key={app.id} value={app.id}>{app.shortName}</option>)}{systemTools.map((tool) => <option key={tool.id} value={tool.id}>Tool · {tool.name}</option>)}</select></label>
        <button className="amv2-access-mode" data-enabled={approvalGateEnabled} onClick={() => changeApprovalGate(!approvalGateEnabled)} title="Bật/tắt kiểm duyệt quyền và thiết bị"><span>{approvalGateEnabled ? "🔒" : "⚡"}</span><div><small>Kiểm duyệt truy cập</small><strong>{approvalGateEnabled ? "BẬT" : "TẮT · Vào thẳng"}</strong></div></button>
        <button className="amv2-bell" aria-label={notificationCount ? `Mở Cảnh báo: ${notificationCount} thông báo` : "Mở Cảnh báo"} onClick={() => switchView("alerts")}>♧{notificationCount ? <b>{notificationCount}</b> : null}</button>
        <span className="amv2-online" data-standalone={offline}><i/><strong>{offline ? "Bản lưu cục bộ" : "Hệ thống kết nối"}</strong><small>{syncing ? "Đang đồng bộ…" : offline ? "Chưa xác minh Production" : "Dữ liệu đã cập nhật"}</small></span>
        <details className="amv2-account"><summary><span>{initials(user.displayName)}</span><div><strong>{user.displayName}</strong><small>{approvalGateEnabled ? roleLabels[access.role] : "Standalone Owner"}</small></div><b>⌄</b></summary><div><small>{user.email}</small>{authMode === "cloudflare-production" ? <a href="/__account">Tài khoản & bảo mật</a> : <button onClick={() => setAccountSecurityOpen(true)}>Tài khoản & bảo mật</button>}<button onClick={() => switchView("settings")}>Cấu hình</button>{authMode === "cloudflare-production" ? <form method="post" action="/__logout"><button type="submit">Đăng xuất</button></form> : <a href="/signout-with-chatgpt?return_to=%2F">Đăng xuất</a>}</div></details>
      </header>

      <div className="amv2-content" data-view={view}>
        <header className="amv2-page-head" data-view={view}>
          <div className="amv2-page-title"><h1>{title.title}</h1>{title.subtitle ? <p>{title.subtitle}</p> : null}</div>
          <section className="amv2-notification-board" aria-label="Bảng thông báo">
            <h2>Thông báo</h2>
            <div ref={notificationListRef} className="amv2-notification-list" role="status" aria-live="polite" aria-atomic="true" tabIndex={0}>
              {notice ? <div className="amv2-notice"><span>{notice}</span><button type="button" aria-label="Đóng thông báo" onClick={() => setNotice("")}>×</button></div> : null}
              {syncError ? <p className="amv2-warning"><strong>Cảnh báo đồng bộ:</strong> {syncError}</p> : null}
              {offline ? <p className="amv2-warning"><strong>Chưa xác minh kết nối Production.</strong> Dữ liệu đang hiển thị là bản lưu cục bộ; bật Kiểm duyệt truy cập để đọc trạng thái và thiết bị trực tiếp.</p> : null}
              {!offline && !syncError && !notice ? <p className="amv2-notification-empty">{syncing ? "Đang đồng bộ dữ liệu…" : "Không có thông báo mới."}</p> : null}
            </div>
          </section>
          <div className="amv2-page-tools">
            {view === "overview" ? <section className="amv2-clock"><span>▣</span><div><small>{clock ? new Intl.DateTimeFormat("vi-VN", { weekday: "short", day: "2-digit", month: "2-digit", year: "numeric" }).format(clock) : ""}</small><strong>{clock ? new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(clock) : ""}</strong></div><i/><div><small>Hệ thống</small><strong>{offline ? "Chưa xác minh online" : unavailableCount ? "Cần kiểm tra" : "Hoạt động ổn định"}</strong></div></section> : <button className="amv2-sync" disabled={syncing} onClick={() => void syncOperationsNow()}>{syncing ? "Đang đồng bộ…" : "↻ Đồng bộ"}</button>}
          </div>
        </header>

        <div className="amv2-stage" data-view={view}>
          {view === "overview" ? <Overview
            apps={filteredApps}
            tools={filteredTools}
            summaryMap={summaryMap}
            devices={filteredDevices}
            pendingDevices={pendingDevices.filter((device) => appFilter === "all" || device.appId === appFilter)}
            approvalDevices={filteredApprovalDevices}
            workItems={filteredWork}
            highAlerts={highAlerts}
            unavailableCount={unavailableCount}
            environmentCount={environmentCount}
            contractPending={contractPending}
            offline={offline}
            actionBusy={actionBusy}
            webBusy={webBusy}
            syncing={syncing}
            webMenu={webMenu}
            setWebMenu={setWebMenu}
            switchView={switchView}
            launchWeb={launchWeb}
            manageDevice={manageDevice}
            clearNotifications={clearNotifications}
            enableAutoApproval={() => setAutoPolicyOpen(true)}
            syncOperations={syncOperationsNow}
            localRuntime={localRuntime}
          /> : null}
          {view === "approvals" ? <ApprovalView devices={filteredApprovalDevices} actionBusy={actionBusy} manageDevice={manageDevice}/> : null}
          {view === "applications" ? <ApplicationsView apps={filteredApps} tools={filteredTools} summaryMap={summaryMap} devices={devices} webBusy={webBusy} launchWeb={launchWeb} localRuntime={localRuntime} offline={offline} lastUpdatedAt={operations?.generatedAt}/> : null}
          {view === "devices" ? <DevicesView devices={filteredPendingDevices} actionBusy={actionBusy} manageDevice={manageDevice} bulkRemovePendingDevices={bulkRemovePendingDevices} openAutomation={() => setAutoPolicyOpen(true)}/> : null}
          {view === "access" ? <BoiAccessView query={search}/> : null}
          {view === "alerts" ? <AlertsView apps={filteredApps} summaryMap={summaryMap} workItems={filteredWork} lastUpdated={lastUpdated} offline={offline}/> : null}
          {view === "audit" ? <AuditView center={center}/> : null}
          {view === "settings" ? <SettingsView center={center} access={access} actionBusy={actionBusy} fontScale={fontScale} changeFontScale={changeFontScale} manageControlDevice={manageControlDevice} approvalGateEnabled={approvalGateEnabled} changeApprovalGate={changeApprovalGate}/> : null}
        </div>
      </div>
    </section>
  </main>;
}

function AccountSecurityDialog({ user, role, authMode, close }: {
  user: { displayName: string; email: string };
  role: string;
  authMode: "chatgpt-sites" | "cloudflare-preview" | "cloudflare-production" | "local";
  close: () => void;
}) {
  return <div className="amv2-account-scrim" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) close(); }}>
    <section className="amv2-account-dialog" role="dialog" aria-modal="true" aria-labelledby="account-security-title">
      <header><div><small>TÀI KHOẢN</small><h2 id="account-security-title">Tài khoản & bảo mật</h2></div><button onClick={close} aria-label="Đóng">×</button></header>
      <div className="amv2-account-identity">
        <article><span>Tên hiển thị</span><strong>{user.displayName}</strong><small>{authMode === "cloudflare-preview" ? "Danh tính tạm của môi trường Cloudflare Preview." : authMode === "local" ? "Danh tính phát triển cục bộ." : "Danh tính do phiên đăng nhập ChatGPT Sites cung cấp."}</small></article>
        <article><span>Vai trò quản trị</span><strong>{role}</strong><small>Quyền nghiệp vụ của Application Management.</small></article>
      </div>
      <div className="amv2-login-security">
        <h3>Thông tin đăng nhập</h3>
        {authMode === "cloudflare-preview" ? <>
          <p>Preview chỉ dùng để kiểm thử. Tài khoản Production được quản lý trên môi trường Cloudflare Production riêng.</p>
          <article><div><span>Email phiên Preview</span><strong>{user.email}</strong></div><em>Không phải tài khoản Production</em></article>
          <small className="amv2-account-help">Không đổi mật khẩu hoặc số điện thoại trong Preview.</small>
        </> : authMode === "local" ? <>
          <p>Môi trường local dùng danh tính phát triển từ cấu hình máy. Không lưu thông tin đăng nhập thật.</p>
          <article><div><span>Email local</span><strong>{user.email}</strong></div><em>Chỉ dùng phát triển</em></article>
        </> : <>
          {authMode === "cloudflare-production" ? <>
            <p>Production dùng tài khoản Application Management riêng. Phiên đăng nhập và quyền quản trị được xác minh trên control-plane Production.</p>
            <article><div><span>Email đăng nhập</span><strong>{user.email}</strong></div><em>Tài khoản Production</em></article>
            <article><div><span>Mật khẩu / phiên đăng nhập</span><strong>Không hiển thị trong giao diện quản trị</strong></div><em>Quản lý tại trang Tài khoản & bảo mật</em></article>
          </> : <>
            <p>Application Management không lưu mật khẩu, email đăng nhập hoặc số điện thoại của tài khoản ChatGPT. Thay đổi các thông tin này tại cài đặt tài khoản ChatGPT.</p>
            <article><div><span>Email đăng nhập</span><strong>{user.email}</strong></div><em>Quản lý tại ChatGPT</em></article>
            <article><div><span>Mật khẩu / phương thức đăng nhập</span><strong>Không lưu trong ứng dụng</strong></div><em>Quản lý tại ChatGPT</em></article>
            <article><div><span>Số điện thoại</span><strong>Site không được cung cấp số điện thoại</strong></div><em>Quản lý tại ChatGPT</em></article>
            <a href="https://chatgpt.com/" target="_blank" rel="noopener noreferrer">Mở ChatGPT để quản lý tài khoản ↗</a>
          </>}
        </>}
      </div>
      <footer><button onClick={close}>Đóng</button></footer>
    </section>
  </div>;
}

function ToolRow({ tool, parentSummary, offline = false }: { tool: SystemTool; parentSummary?: OperationsSummary; offline?: boolean }) {
  const parentConnected = tool.parentAppId ? parentSummary?.connection === "connected" : true;
  const state = offline ? "pending" : parentConnected ? "connected" : tool.parentAppId ? "warning" : "connected";
  const status = offline
    ? "Chưa xác minh"
    : tool.parentAppId
      ? parentConnected ? `${tool.parentLabel ?? "Ứng dụng cha"} · live` : `${tool.parentLabel ?? "Ứng dụng cha"} · fallback`
      : "Sẵn sàng";
  return <div className="amv2-app-row amv2-tool-row" data-kind="tool" data-parent-app={tool.parentAppId ?? ""}>
    <AppCell appId={tool.id} name={tool.name}/>
    <span>{tool.parentLabel ? `Tool · ${tool.parentLabel}` : tool.category}</span>
    <strong>—</strong>
    <strong>—</strong>
    <b data-state={state} title={tool.note}><i/>{status}</b>
    <Link className="amv2-web-action" href={tool.href}>Mở</Link>
    <Link className="amv2-manage-action" href={tool.manageHref ?? tool.href}>{tool.parentAppId ? "Bauman Admin" : "Quản trị"}</Link>
  </div>;
}

function PanelTitle({ icon, title, count, onClick }: { icon: string; title: string; count?: number; onClick?: () => void }) {
  return <header className="amv2-panel-title"><div><span>{icon}</span><h2>{title}</h2>{typeof count === "number" && count > 0 ? <b>{count}</b> : null}</div>{onClick ? <button onClick={onClick}>Xem tất cả →</button> : null}</header>;
}

function AppIcon({ appId }: { appId: string }) {
  const iconPath = appIconPath(appId);
  return <i
    className="amv2-app-icon"
    data-app={appId}
    data-image={iconPath ? "true" : "false"}
    style={iconPath ? { backgroundImage: `url("${iconPath}")` } : undefined}
    aria-hidden="true"
  >{iconPath ? null : appGlyph(appId)}</i>;
}

function AppCell({ appId, name }: { appId: string; name: string }) {
  return <div className="amv2-app-cell"><AppIcon appId={appId}/><strong>{name}</strong></div>;
}

function Overview({ apps, tools, summaryMap, devices, pendingDevices, approvalDevices, workItems, highAlerts, unavailableCount, environmentCount, contractPending, offline, actionBusy, webBusy, syncing, webMenu, setWebMenu, switchView, launchWeb, manageDevice, clearNotifications, enableAutoApproval, syncOperations, localRuntime }: {
  apps: ApplicationConfig[];
  tools: SystemTool[];
  summaryMap: Map<string, OperationsSummary>;
  devices: OperationsDevice[];
  pendingDevices: OperationsDevice[];
  approvalDevices: OperationsDevice[];
  workItems: OperationsWorkItem[];
  highAlerts: number;
  unavailableCount: number;
  environmentCount: number;
  contractPending: number;
  offline: boolean;
  actionBusy: string;
  webBusy: string;
  syncing: boolean;
  webMenu: boolean;
  setWebMenu: (value: boolean | ((current: boolean) => boolean)) => void;
  switchView: (view: View) => void;
  launchWeb: (appId: string) => Promise<void>;
  manageDevice: (device: OperationsDevice, operation: "approve" | "remove") => Promise<void>;
  clearNotifications: () => Promise<void>;
  enableAutoApproval: () => void;
  syncOperations: () => Promise<OperationsBootstrap | null>;
  localRuntime: boolean;
}) {
  const priorityRows = [
    ...approvalDevices.map((device) => ({ key: `device:${device.appId}:${device.deviceId}`, appId: device.appId, appName: device.appName, type: device.attention === "environment" ? "Môi trường" : "Thiết bị", content: `${device.userLabel} · ${device.deviceCode}`, at: device.lastSeenAt ?? device.createdAt, priority: device.attention === "environment" ? "Cao" : "Vừa", status: device.status === "pending" ? "Chờ duyệt" : "Cần xác minh" })),
    ...workItems.filter((item) => item.kind === "connection").map((item) => ({ key: `work:${item.id}`, appId: item.appId, appName: item.appName, type: "Kết nối", content: item.title, at: item.occurredAt, priority: item.priority === "high" ? "Cao" : item.priority === "normal" ? "Vừa" : "Thông tin", status: item.priority === "high" ? "Cần xử lý" : "Theo dõi" })),
  ].slice(0, 4);

  const overviewItems = [
    ...apps.map((app) => {
      const summary = summaryMap.get(app.id);
      const counts = operationalCounts(app.id, summary, devices);
      const connection = offline ? "pending" as const : connectionFor(app, summary);
      return {
        id: app.id,
        name: app.shortName,
        iconAppId: app.id,
        kind: "app" as const,
        online: offline ? null : counts.online,
        connection,
        status: offline ? "Chưa xác minh" : connectionLabel(connection, summary),
      };
    }),
    ...tools.map((tool) => {
      const parentSummary = tool.parentAppId ? summaryMap.get(tool.parentAppId) : undefined;
      const connected = tool.parentAppId ? parentSummary?.connection === "connected" : true;
      const connection: OperationsSummary["connection"] = offline ? "pending" : connected ? "connected" : tool.parentAppId ? "warning" : "connected";
      return {
        id: tool.id,
        name: tool.name,
        iconAppId: tool.id,
        kind: "tool" as const,
        online: null,
        connection,
        status: offline ? "Chưa xác minh" : tool.parentAppId ? connected ? `${tool.parentLabel ?? "Ứng dụng cha"} · live` : `${tool.parentLabel ?? "Ứng dụng cha"} · fallback` : "Sẵn sàng",
      };
    }),
  ];

  return <>
    <section className="amv2-metrics">
      <button data-tone="teal" onClick={() => switchView("applications")}><i>◇</i><div><small>Tổng ứng dụng</small><strong>{apps.length + tools.length}</strong><em>Ứng dụng & Tool đang quản lý</em></div><b>›</b></button>
      <button data-tone="gold" onClick={() => switchView("devices")}><i>▣</i><div><small>Thiết bị chờ kiểm duyệt</small><strong>{offline ? "—" : pendingDevices.length}</strong><em>{offline ? "Chưa xác minh online" : "Thiết bị cần quyết định"}</em></div><b>›</b></button>
      <button data-tone="red" onClick={() => switchView("alerts")}><i>△</i><div><small>Cảnh báo hôm nay</small><strong>{offline ? "—" : highAlerts}</strong><em>{offline ? "Chưa xác minh online" : highAlerts ? "Có cảnh báo cần kiểm tra" : "Không có cảnh báo cao"}</em></div><b>›</b></button>
      <button data-tone="blue" onClick={() => switchView("approvals")}><i>▤</i><div><small>Ca kiểm duyệt cần xử lý</small><strong>{offline ? "—" : approvalDevices.length}</strong><em>{offline ? "Chưa xác minh online" : "Yêu cầu đang chờ xử lý"}</em></div><b>›</b></button>
    </section>

    <section className="amv2-overview-grid">
      <section className="amv2-panel amv2-priority-panel"><PanelTitle icon="▱" title="Hộp việc ưu tiên" count={priorityRows.length} onClick={() => switchView("approvals")}/><div className="amv2-priority-table"><div className="amv2-priority-head"><span>Loại công việc</span><span>Ứng dụng</span><span>Nội dung</span><span>Thời gian</span><span>Độ ưu tiên</span><span>Trạng thái</span></div>{priorityRows.map((row) => <div className="amv2-priority-row" key={row.key}><span>{row.type}</span><AppCell appId={row.appId} name={row.appName}/><span title={row.content}>{row.content}</span><span>{relativeTime(row.at)}</span><b data-priority={row.priority}>{row.priority}</b><em>{row.status}</em></div>)}{!priorityRows.length ? <div className="amv2-empty"><span>▱</span><strong>Không có việc phù hợp với bộ lọc hiện tại.</strong><small>Hệ thống sẽ hiển thị các nhiệm vụ cần xử lý tại đây.</small></div> : null}</div></section>

      <section className="amv2-panel amv2-alert-panel"><PanelTitle icon="♧" title="Cảnh báo nhanh" onClick={() => switchView("alerts")}/><div className="amv2-alert-grid"><button onClick={() => switchView("devices")} data-tone="gold"><small>Thiết bị mới</small><strong>{offline ? "—" : pendingDevices.length}</strong></button><button onClick={() => switchView("alerts")} data-tone="red"><small>App mất kết nối</small><strong>{offline ? "—" : unavailableCount}</strong></button><button onClick={() => switchView("alerts")} data-tone="olive"><small>Môi trường thay đổi</small><strong>{offline ? "—" : environmentCount}</strong></button><button onClick={() => switchView("applications")} data-tone="blue"><small>Kết nối chờ hoàn tất</small><strong>{offline ? "—" : contractPending}</strong></button></div></section>

      <section className="amv2-panel amv2-quick-panel"><header><h2>⚡ Thao tác nhanh</h2></header><div className="amv2-quick-grid"><button onClick={() => switchView("applications")}>◇<span>Quản trị ứng dụng</span></button><button data-active={webMenu} onClick={() => setWebMenu((current) => !current)}>◎<span>Truy cập web</span></button><button onClick={() => switchView("devices")}>▣<span>Kiểm duyệt thiết bị</span></button><button onClick={() => switchView("approvals")}>⬡<span>Yêu cầu chờ duyệt</span></button><button data-danger="true" disabled={Boolean(actionBusy)} onClick={() => void clearNotifications()}>⌫<span>{actionBusy === "clear" ? "Đang xóa…" : "Xóa hết thông báo"}</span></button><button disabled={Boolean(actionBusy)} onClick={() => void enableAutoApproval()}>⚙<span>{actionBusy === "auto" ? "Đang lưu…" : "Duyệt tự động"}</span></button><button disabled={syncing} onClick={() => void syncOperations()}>↻<span>{syncing ? "Đang đồng bộ…" : "Đồng bộ dữ liệu"}</span></button><button onClick={() => switchView("settings")}>▦<span>Giao diện</span></button><button onClick={() => switchView("audit")}>▤<span>Xem nhật ký</span></button></div>{webMenu ? <div className="amv2-web-menu">{apps.map((app) => { const summary = summaryMap.get(app.id); const hasWeb = webAccessAvailable(app, summary, localRuntime); return <button key={app.id} disabled={!hasWeb || webBusy === app.id} onClick={() => void launchWeb(app.id)}><span className="amv2-web-menu-app"><AppIcon appId={app.id}/><span>{app.shortName}</span></span><b>{webBusy === app.id ? "Đang mở…" : hasWeb ? "Mở ↗" : webActionLabel(summary, false)}</b></button>; })}</div> : null}</section>

      <section
        className="amv2-panel amv2-apps-panel amv2-overview-apps-launcher"
        role="button"
        tabIndex={0}
        aria-label="Mở tab Ứng dụng"
        onClick={() => switchView("applications")}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            switchView("applications");
          }
        }}
      >
        <header className="amv2-overview-apps-title">
          <div><span>◇</span><h2>Ứng dụng đang quản lý</h2></div>
          <span>Xem tất cả →</span>
        </header>
        <div className="amv2-overview-app-screen">
          {overviewItems.map((item) => <div className="amv2-overview-app-tile" data-kind={item.kind} key={item.id}>
            <span className="amv2-overview-app-icon"><AppIcon appId={item.iconAppId}/></span>
            <strong title={item.name}>{item.name}</strong>
            <small><b>Online</b><em>{item.online === null ? "—" : item.online}</em></small>
            <small data-state={item.connection}><i/>{item.status}</small>
          </div>)}
          {!overviewItems.length ? <div className="amv2-empty compact"><strong>Không có ứng dụng hoặc Tool phù hợp.</strong></div> : null}
        </div>
      </section>

      <section className="amv2-panel amv2-devices-panel"><PanelTitle icon="▣" title="Thiết bị chờ kiểm duyệt" count={pendingDevices.length} onClick={() => switchView("devices")}/><div className="amv2-device-table"><div className="amv2-device-head"><span>Ứng dụng</span><span>Thiết bị</span><span>Người dùng</span><span>Thời gian</span><span>Thao tác</span></div>{pendingDevices.slice(0, 4).map((device) => { const rowBusy = actionBusy === `${device.appId}:${device.deviceId}`; return <div className="amv2-device-row" key={`${device.appId}:${device.deviceId}`}><AppCell appId={device.appId} name={device.appName}/><span>{deviceKind(device)}</span><span title={device.userLabel}>{device.userLabel}</span><span>{relativeTime(device.createdAt)}</span><div>{device.canApprove ? <button disabled={rowBusy} onClick={() => void manageDevice(device, "approve")}>{device.appId === "boi-ech" ? "Phân quyền" : "Duyệt"}</button> : null}{device.canRemove ? <button data-danger="true" disabled={rowBusy} onClick={() => void manageDevice(device, "remove")}>{device.appId === "boi-ech" ? "Xóa" : "Khóa"}</button> : null}</div></div>; })}{!pendingDevices.length ? <div className="amv2-empty compact"><strong>Không có thiết bị chờ duyệt.</strong></div> : null}</div></section>
    </section>
  </>;
}

function ApprovalView({ devices, actionBusy, manageDevice }: { devices: OperationsDevice[]; actionBusy: string; manageDevice: (device: OperationsDevice, operation: "approve" | "remove") => Promise<void> }) {
  return <section className="amv2-page-panel"><div className="amv2-view-table approval"><div className="head"><span>Ứng dụng</span><span>Loại yêu cầu</span><span>Thiết bị / người dùng</span><span>Trạng thái</span><span>Thao tác</span></div>{devices.map((device) => { const rowBusy = actionBusy === `${device.appId}:${device.deviceId}`; const pending = device.status === "pending"; return <div className="row" key={`${device.appId}:${device.deviceId}`}><AppCell appId={device.appId} name={device.appName}/><span>{pending ? "Kiểm duyệt thiết bị" : "Xác minh môi trường"}</span><div><strong>{device.userLabel}</strong><small>{device.deviceCode}</small></div><b>{pending ? "Chờ kiểm duyệt" : "Cần xử lý"}</b><div>{pending && device.canApprove ? <button disabled={rowBusy} onClick={() => void manageDevice(device, "approve")}>{device.appId === "boi-ech" ? "Phân quyền" : "Duyệt"}</button> : null}{pending && device.canRemove ? <button data-danger="true" disabled={rowBusy} onClick={() => void manageDevice(device, "remove")}>{device.appId === "boi-ech" ? "Xóa vĩnh viễn" : "Từ chối & khóa"}</button> : null}{!pending ? <Link href={device.href}>Quản trị</Link> : null}</div></div>; })}{!devices.length ? <div className="amv2-empty"><strong>Không có yêu cầu cần xử lý.</strong></div> : null}</div></section>;
}

function ApplicationsView({ apps, tools, summaryMap, devices, webBusy, launchWeb, localRuntime, offline, lastUpdatedAt }: {
  apps: ApplicationConfig[];
  tools: SystemTool[];
  summaryMap: Map<string, OperationsSummary>;
  devices: OperationsDevice[];
  webBusy: string;
  launchWeb: (appId: string) => Promise<void>;
  localRuntime: boolean;
  offline: boolean;
  lastUpdatedAt?: string;
}) {
  const [mode, setMode] = useState<AppLauncherMode>("grid");
  const [launcherSearch, setLauncherSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [sortMode, setSortMode] = useState<AppLauncherSort>("manual");
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [anchorElement, setAnchorElement] = useState<HTMLButtonElement | null>(null);
  const [popoverPlacement, setPopoverPlacement] = useState<AppLauncherPlacement>({ top: 12, left: 12, side: "right" });
  const [detailOpen, setDetailOpen] = useState(false);
  const [categoryEditing, setCategoryEditing] = useState(false);
  const [categoryDraft, setCategoryDraft] = useState("");
  const [editMode, setEditMode] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [manualOrder, setManualOrder] = useState<string[]>([]);
  const [categoryOverrides, setCategoryOverrides] = useState<Record<string, string>>({});
  const [scrollState, setScrollState] = useState({ up: false, down: false });
  const clickTimerRef = useRef<number | null>(null);
  const longPressTimerRef = useRef<number | null>(null);
  const longPressTriggeredRef = useRef(false);
  const openGuardRef = useRef<string | null>(null);
  const openGuardTimerRef = useRef<number | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const sortMenuRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const storedOrder = JSON.parse(window.localStorage.getItem(launcherOrderStorageKey) ?? "[]");
      if (Array.isArray(storedOrder) && storedOrder.every((value) => typeof value === "string")) setManualOrder(storedOrder);
    } catch {
      setManualOrder([]);
    }
    try {
      const storedCategories = JSON.parse(window.localStorage.getItem(launcherCategoryStorageKey) ?? "{}");
      if (storedCategories && typeof storedCategories === "object" && !Array.isArray(storedCategories)) setCategoryOverrides(storedCategories as Record<string, string>);
    } catch {
      setCategoryOverrides({});
    }
    try {
      const storedSort = window.localStorage.getItem(launcherSortStorageKey);
      if (storedSort === "category") {
        // Migrate the former temporary category mode to the persistent automatic mode.
        setSortMode("category-auto");
        window.localStorage.setItem(launcherSortStorageKey, "category-auto");
      } else if (storedSort === "manual" || storedSort === "name" || storedSort === "category-auto" || storedSort === "status") {
        setSortMode(storedSort);
      }
    } catch {
      // Keep the in-memory default when local storage is unavailable.
    }
  }, []);

  const items = useMemo<AppLauncherItem[]>(() => {
    const toolItems = tools.map((tool) => {
      const parentSummary = tool.parentAppId ? summaryMap.get(tool.parentAppId) : undefined;
      const parentConnected = tool.parentAppId ? parentSummary?.connection === "connected" : true;
      const connection: OperationsSummary["connection"] = offline
        ? "pending"
        : parentConnected ? "connected" : tool.parentAppId ? "warning" : "connected";
      const statusLabel = offline
        ? "Chưa xác minh"
        : tool.parentAppId
          ? parentConnected ? `${tool.parentLabel ?? "Ứng dụng cha"} · live` : `${tool.parentLabel ?? "Ứng dụng cha"} · fallback`
          : "Sẵn sàng";
      const runtimeLabel = offline
        ? "—"
        : parentSummary?.runtimeConnected === true
          ? "Live"
          : parentSummary?.runtimeConnected === false
            ? "Chưa live"
            : "—";
      return {
        id: tool.id,
        name: tool.name,
        shortName: tool.name,
        iconAppId: tool.id,
        category: tool.category,
        description: tool.note,
        kind: "tool" as const,
        href: tool.href,
        manageHref: tool.manageHref ?? tool.href,
        parentAppId: tool.parentAppId,
        parentLabel: tool.parentLabel,
        connection,
        statusLabel,
        contractLabel: offline ? "—" : parentSummary?.contractReadiness ?? "—",
        runtimeLabel,
        onlineCount: null,
        pendingCount: null,
        tags: tool.parentLabel ? [tool.parentLabel] : [],
        canOpen: true,
      };
    });

    const appItems = apps.map((app) => {
      const summary = summaryMap.get(app.id);
      const counts = operationalCounts(app.id, summary, devices);
      const canOpen = webAccessAvailable(app, summary, localRuntime);
      const runtimeLabel = offline
        ? "—"
        : summary?.runtimeConnected === true
          ? "Live"
          : summary?.runtimeConnected === false
            ? "Chưa live"
            : summary?.managementMode ?? "—";
      return {
        id: app.id,
        name: app.name,
        shortName: app.shortName,
        iconAppId: app.id,
        category: categoryOverrides[app.id] || app.category,
        description: app.scope,
        kind: "app" as const,
        href: canOpen ? summary?.webHref ?? app.publicUrl ?? (localRuntime ? app.localUrl : undefined) : undefined,
        manageHref: app.href,
        connection: offline ? "pending" : connectionFor(app, summary),
        statusLabel: offline ? "Chưa xác minh" : connectionLabel(connectionFor(app, summary), summary),
        contractLabel: offline ? "—" : summary?.contractReadiness ?? app.contractState,
        runtimeLabel,
        onlineCount: offline ? null : counts.online,
        pendingCount: offline ? null : counts.pending,
        tags: [...app.capabilities],
        canOpen,
      };
    });

    return [...appItems, ...toolItems];
  }, [apps, tools, summaryMap, devices, localRuntime, offline, categoryOverrides]);

  const categories = useMemo(() => {
    const present = new Set(items.map((item) => item.category));
    const preferred = ["Tool", "Học tập", "Kỹ thuật", "Hệ thống"];
    return [
      ...preferred.filter((category) => present.has(category)),
      ...[...present].filter((category) => !preferred.includes(category)).sort((a, b) => a.localeCompare(b, "vi")),
    ];
  }, [items]);

  const visibleItems = useMemo(() => {
    const query = launcherSearch.trim().toLocaleLowerCase("vi");
    const result = items.filter((item) => {
      if (categoryFilter !== "all" && item.category !== categoryFilter) return false;
      if (!query) return true;
      return [
        item.name,
        item.shortName ?? "",
        item.category,
        item.description,
        item.parentLabel ?? "",
        ...item.tags,
      ].join(" ").toLocaleLowerCase("vi").includes(query);
    });

    const defaultOrder = items.map((item) => item.id);
    const effectiveOrder = [
      ...manualOrder.filter((id) => defaultOrder.includes(id)),
      ...defaultOrder.filter((id) => !manualOrder.includes(id)),
    ];
    const rank = new Map(effectiveOrder.map((id, index) => [id, index]));

    return [...result].sort((a, b) => {
      // Application clients always stay above Tools. Manual movement is scoped
      // inside each group so the Overview and Applications surfaces agree.
      if (a.kind !== b.kind) return a.kind === "app" ? -1 : 1;
      if (sortMode === "manual") return (rank.get(a.id) ?? 9999) - (rank.get(b.id) ?? 9999);
      if (sortMode === "category-auto") {
        const category = a.category.localeCompare(b.category, "vi", { sensitivity: "base" });
        return category || a.name.localeCompare(b.name, "vi", { sensitivity: "base" });
      }
      if (sortMode === "status") {
        const status = a.statusLabel.localeCompare(b.statusLabel, "vi");
        return status || a.name.localeCompare(b.name, "vi");
      }
      return a.name.localeCompare(b.name, "vi");
    });
  }, [items, launcherSearch, categoryFilter, sortMode, manualOrder]);

  const selectedItem = selectedId ? items.find((item) => item.id === selectedId) ?? null : null;
  const editableCategories = useMemo(
    () => [...new Set([...staticApps.map((app) => app.category), ...Object.values(categoryOverrides)])].filter(Boolean).sort((a, b) => a.localeCompare(b, "vi")),
    [categoryOverrides],
  );

  function cancelSingleClick() {
    if (clickTimerRef.current !== null) {
      window.clearTimeout(clickTimerRef.current);
      clickTimerRef.current = null;
    }
  }

  function clearLongPressTimer() {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }

  function closePopover() {
    cancelSingleClick();
    setSelectedId(null);
    setAnchorElement(null);
    setDetailOpen(false);
    setCategoryEditing(false);
  }

  function persistManualOrder(next: string[]) {
    setManualOrder(next);
    try {
      window.localStorage.setItem(launcherOrderStorageKey, JSON.stringify(next));
    } catch {
      // Layout preference remains in memory when storage is unavailable.
    }
  }

  function changeSortMode(next: AppLauncherSort) {
    setSortMode(next);
    setSortMenuOpen(false);
    if (next !== "manual") {
      setEditMode(false);
      setDraggingId(null);
      longPressTriggeredRef.current = false;
    }
    try {
      window.localStorage.setItem(launcherSortStorageKey, next);
    } catch {
      // Sorting preference remains in memory when storage is unavailable.
    }
  }

  function saveCategoryOverride(item: AppLauncherItem, nextValue: string) {
    if (item.kind !== "app") return;
    const canonical = apps.find((app) => app.id === item.id)?.category ?? "";
    const nextCategory = nextValue.trim();
    setCategoryOverrides((current) => {
      const updated = { ...current };
      if (!nextCategory || nextCategory === canonical) delete updated[item.id];
      else updated[item.id] = nextCategory;
      try {
        window.localStorage.setItem(launcherCategoryStorageKey, JSON.stringify(updated));
      } catch {
        // Category preference remains in memory when storage is unavailable.
      }
      return updated;
    });
    setCategoryEditing(false);
  }

  async function openLauncherItem(item: AppLauncherItem) {
    if (openGuardRef.current === item.id) return;
    openGuardRef.current = item.id;
    if (openGuardTimerRef.current !== null) window.clearTimeout(openGuardTimerRef.current);
    openGuardTimerRef.current = window.setTimeout(() => {
      openGuardRef.current = null;
      openGuardTimerRef.current = null;
    }, 650);

    if (item.kind === "tool") {
      if (item.href) window.location.assign(item.href);
      return;
    }
    await launchWeb(item.id);
  }

  function handleCardClick(event: React.MouseEvent<HTMLButtonElement>, item: AppLauncherItem) {
    if (editMode || longPressTriggeredRef.current) {
      event.preventDefault();
      longPressTriggeredRef.current = false;
      return;
    }
    const anchor = event.currentTarget;
    cancelSingleClick();
    clickTimerRef.current = window.setTimeout(() => {
      setDetailOpen(false);
      setCategoryEditing(false);
      setCategoryDraft(item.category);
      setSelectedId(item.id);
      setAnchorElement(anchor);
      clickTimerRef.current = null;
    }, 240);
  }

  function handleCardDoubleClick(event: React.MouseEvent<HTMLButtonElement>, item: AppLauncherItem) {
    event.preventDefault();
    event.stopPropagation();
    if (editMode || longPressTriggeredRef.current) {
      longPressTriggeredRef.current = false;
      return;
    }
    cancelSingleClick();
    closePopover();
    void openLauncherItem(item);
  }

  function handleCardPointerDown(event: React.PointerEvent<HTMLButtonElement>, item: AppLauncherItem) {
    if (mode !== "grid") return;
    if (event.pointerType === "mouse" && event.button !== 0) return;
    clearLongPressTimer();
    longPressTriggeredRef.current = false;

    if (editMode) {
      event.preventDefault();
      setDraggingId(item.id);
      try { event.currentTarget.setPointerCapture(event.pointerId); } catch {}
      return;
    }

    const card = event.currentTarget;
    const pointerId = event.pointerId;
    longPressTimerRef.current = window.setTimeout(() => {
      longPressTriggeredRef.current = true;
      cancelSingleClick();
      closePopover();
      changeSortMode("manual");
      setEditMode(true);
      setDraggingId(item.id);
      try { card.setPointerCapture(pointerId); } catch {}
      longPressTimerRef.current = null;
    }, 3000);
  }

  function handleCardPointerMove(event: React.PointerEvent<HTMLButtonElement>, item: AppLauncherItem) {
    if (!editMode || draggingId !== item.id) return;
    event.preventDefault();
    const hit = document.elementFromPoint(event.clientX, event.clientY) as HTMLElement | null;
    const targetCard = hit?.closest<HTMLElement>("[data-launcher-id]");
    const targetId = targetCard?.dataset.launcherId;
    if (!targetId || targetId === item.id) return;
    const targetItem = items.find((candidate) => candidate.id === targetId);
    if (!targetItem || targetItem.kind !== item.kind) return;

    const base = [
      ...manualOrder.filter((id) => items.some((candidate) => candidate.id === id)),
      ...items.map((candidate) => candidate.id).filter((id) => !manualOrder.includes(id)),
    ];
    const from = base.indexOf(item.id);
    const to = base.indexOf(targetId);
    if (from < 0 || to < 0 || from === to) return;
    const next = [...base];
    next.splice(from, 1);
    next.splice(to, 0, item.id);
    persistManualOrder(next);
  }

  function handleCardPointerUp(event: React.PointerEvent<HTMLButtonElement>) {
    clearLongPressTimer();
    if (draggingId) {
      try { event.currentTarget.releasePointerCapture(event.pointerId); } catch {}
      setDraggingId(null);
    }
  }

  function handleCardPointerCancel(event: React.PointerEvent<HTMLButtonElement>) {
    clearLongPressTimer();
    if (draggingId) {
      try { event.currentTarget.releasePointerCapture(event.pointerId); } catch {}
      setDraggingId(null);
    }
  }

  function updateScrollState() {
    const target = gridRef.current;
    if (!target || mode !== "grid") {
      setScrollState({ up: false, down: false });
      return;
    }
    const maxScroll = Math.max(0, target.scrollHeight - target.clientHeight);
    setScrollState({
      up: target.scrollTop > 6,
      down: maxScroll - target.scrollTop > 6,
    });
  }

  function rollGrid(direction: -1 | 1) {
    const target = gridRef.current;
    if (!target) return;
    target.scrollBy({
      top: direction * Math.max(260, Math.round(target.clientHeight * .76)),
      behavior: "smooth",
    });
  }

  useEffect(() => {
    return () => {
      cancelSingleClick();
      clearLongPressTimer();
      if (openGuardTimerRef.current !== null) window.clearTimeout(openGuardTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (selectedId && !visibleItems.some((item) => item.id === selectedId)) closePopover();
  }, [selectedId, visibleItems]);

  useEffect(() => {
    const target = gridRef.current;
    const frame = window.requestAnimationFrame(updateScrollState);
    if (!target || mode !== "grid") return () => window.cancelAnimationFrame(frame);
    const handle = () => updateScrollState();
    target.addEventListener("scroll", handle, { passive: true });
    window.addEventListener("resize", handle);
    return () => {
      window.cancelAnimationFrame(frame);
      target.removeEventListener("scroll", handle);
      window.removeEventListener("resize", handle);
    };
  }, [mode, visibleItems.length]);

  useEffect(() => {
    if (!selectedId || !anchorElement) return;
    const reposition = () => {
      const anchorRect = anchorElement.getBoundingClientRect();
      const popoverRect = popoverRef.current?.getBoundingClientRect();
      const margin = 12;
      const gap = 12;
      const width = popoverRect?.width ?? Math.min(390, window.innerWidth - margin * 2);
      const height = popoverRect?.height ?? 430;

      if (window.innerWidth <= 760) {
        setPopoverPlacement({
          left: margin,
          top: Math.max(margin, window.innerHeight - height - margin),
          side: "mobile",
        });
        return;
      }

      let side: AppLauncherPlacement["side"] = "right";
      let left = anchorRect.right + gap;
      if (left + width > window.innerWidth - margin) {
        side = "left";
        left = anchorRect.left - width - gap;
      }
      left = Math.max(margin, Math.min(left, window.innerWidth - width - margin));
      const top = Math.max(margin, Math.min(anchorRect.top, window.innerHeight - height - margin));
      setPopoverPlacement({ left, top, side });
    };

    const frame = window.requestAnimationFrame(reposition);
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
    };
  }, [selectedId, anchorElement, detailOpen]);

  useEffect(() => {
    if (!sortMenuOpen) return;
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target || sortMenuRef.current?.contains(target)) return;
      setSortMenuOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSortMenuOpen(false);
    };
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [sortMenuOpen]);

  useEffect(() => {
    if (!selectedId) return;
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (popoverRef.current?.contains(target) || anchorElement?.contains(target)) return;
      closePopover();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closePopover();
    };
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [selectedId, anchorElement]);

  return <section className="amv2-page-panel amv2-launcher-panel">
    <div className="amv2-launcher">
      <div className="amv2-launcher-toolbar">
        <label className="amv2-launcher-search">
          <span aria-hidden="true">⌕</span>
          <input
            value={launcherSearch}
            onChange={(event) => setLauncherSearch(event.target.value)}
            placeholder="Tìm ứng dụng..."
            aria-label="Tìm ứng dụng theo tên, loại, mô tả, ứng dụng cha hoặc capability"
          />
        </label>
        <div className="amv2-launcher-mode" role="group" aria-label="Kiểu hiển thị ứng dụng">
          <button type="button" data-active={mode === "grid"} onClick={() => setMode("grid")}>▦</button>
          <button type="button" data-active={mode === "list"} onClick={() => setMode("list")}>☷</button>
        </div>
        <div className="amv2-launcher-sort" ref={sortMenuRef}>
          <span>Sắp xếp:</span>
          <button
            type="button"
            className="amv2-launcher-sort-trigger"
            aria-haspopup="listbox"
            aria-expanded={sortMenuOpen}
            onClick={() => setSortMenuOpen((current) => !current)}
          >
            <b>{launcherSortOptions.find((option) => option.id === sortMode)?.label ?? "Thủ công"}</b>
            <i aria-hidden="true">⌄</i>
          </button>
          {sortMenuOpen ? <div className="amv2-launcher-sort-menu" role="listbox" aria-label="Sắp xếp ứng dụng">
            {launcherSortOptions.map((option) => <button
              type="button"
              role="option"
              aria-selected={sortMode === option.id}
              data-active={sortMode === option.id}
              key={option.id}
              onClick={() => changeSortMode(option.id)}
            >
              <span>{option.label}</span>
              {sortMode === option.id ? <i aria-hidden="true">✓</i> : null}
            </button>)}
          </div> : null}
        </div>
      </div>

      <div className="amv2-launcher-subbar">
        <div className="amv2-launcher-chips" aria-label="Lọc theo phân loại">
          <button type="button" data-active={categoryFilter === "all"} onClick={() => setCategoryFilter("all")}>Tất cả</button>
          {categories.map((category) => <button type="button" key={category} data-active={categoryFilter === category} onClick={() => setCategoryFilter(category)}>{category}</button>)}
        </div>
        {editMode
          ? <div className="amv2-launcher-editbar"><span>↕ Kéo icon để đổi vị trí · App và Tool giữ thành hai nhóm riêng</span><button type="button" onClick={() => { setEditMode(false); setDraggingId(null); longPressTriggeredRef.current = false; }}>Xong</button></div>
          : sortMode === "category-auto"
            ? <p className="amv2-launcher-help" data-auto-sort="true"><b>✓ Tự động theo phân loại</b><i/> sửa phân loại → icon tự chuyển nhóm</p>
            : <p className="amv2-launcher-help"><b>1 lần</b>: thông tin <i/> <b>2 lần</b>: mở <i/> <b>Giữ 3 giây</b>: sắp xếp</p>}
      </div>

      {mode === "grid" ? <div className="amv2-launcher-grid-wrap">
        <div ref={gridRef} className="amv2-launcher-grid" data-testid="app-launcher-grid" data-editing={editMode}>
          {visibleItems.map((item) => <button
            type="button"
            key={item.id}
            className="amv2-launcher-card"
            data-kind={item.kind}
            data-parent-app={item.parentAppId ?? ""}
            data-launcher-id={item.id}
            data-selected={selectedId === item.id}
            data-dragging={draggingId === item.id}
            aria-expanded={selectedId === item.id}
            aria-controls={selectedId === item.id ? "amv2-app-launcher-popover" : undefined}
            onPointerDown={(event) => handleCardPointerDown(event, item)}
            onPointerMove={(event) => handleCardPointerMove(event, item)}
            onPointerUp={handleCardPointerUp}
            onPointerCancel={handleCardPointerCancel}
            onContextMenu={(event) => event.preventDefault()}
            onClick={(event) => handleCardClick(event, item)}
            onDoubleClick={(event) => handleCardDoubleClick(event, item)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && event.altKey) {
                event.preventDefault();
                cancelSingleClick();
                closePopover();
                void openLauncherItem(item);
              }
            }}
            title={editMode ? "Kéo để đổi vị trí" : "Nhấn 1 lần: thông tin · 2 lần: mở · giữ 3 giây: sắp xếp"}
          >
            <span className="amv2-launcher-card-top">
              <AppIcon appId={item.iconAppId}/>
              <i className="amv2-launcher-app-badge" data-state={item.connection} aria-label={item.statusLabel} title={item.statusLabel}/>
            </span>
            <span className="amv2-launcher-card-copy"><strong>{item.shortName ?? item.name}</strong></span>
            <span className="amv2-launcher-card-foot"><b>{item.parentLabel ? `${item.category} · ${item.parentLabel}` : item.category}</b></span>
          </button>)}
          {!visibleItems.length ? <div className="amv2-launcher-empty"><strong>Không tìm thấy ứng dụng hoặc Tool phù hợp.</strong><small>Thử đổi từ khóa hoặc phân loại.</small></div> : null}
        </div>
        {scrollState.up || scrollState.down ? <div className="amv2-launcher-scroll-controls" aria-label="Cuộn danh sách ứng dụng">
          <button type="button" disabled={!scrollState.up} aria-label="Cuộn lên" title="Cuộn lên" onClick={() => rollGrid(-1)}>⌃</button>
          <button type="button" disabled={!scrollState.down} aria-label="Cuộn xuống" title="Cuộn xuống" onClick={() => rollGrid(1)}>⌄</button>
        </div> : null}
      </div> : <div className="amv2-app-table full amv2-launcher-list" data-testid="app-launcher-list">
        <div className="amv2-app-head"><span>Ứng dụng</span><span>Nhóm nghiệp vụ</span><span>Việc chờ xử lý</span><span>Thiết bị online</span><span>Trạng thái</span><span>Website</span><span>Quản Trị</span></div>
        {visibleItems.map((item) => {
          if (item.kind === "tool") {
            const tool = tools.find((candidate) => candidate.id === item.id);
            return tool ? <ToolRow key={tool.id} tool={tool} parentSummary={tool.parentAppId ? summaryMap.get(tool.parentAppId) : undefined} offline={offline}/> : null;
          }
          const app = apps.find((candidate) => candidate.id === item.id);
          if (!app) return null;
          const summary = summaryMap.get(app.id);
          const counts = operationalCounts(app.id, summary, devices);
          const hasWeb = webAccessAvailable(app, summary, localRuntime);
          return <div className="amv2-app-row" key={app.id}><AppCell appId={app.id} name={app.shortName}/><span>{item.category}</span><strong title={counts.pending === null ? "Client chưa cung cấp dữ liệu thiết bị." : undefined}>{offline ? "—" : countText(counts.pending)}</strong><strong title={counts.online === null ? "Client chưa cung cấp dữ liệu online." : undefined}>{offline ? "—" : countText(counts.online)}</strong><StatusCell app={app} summary={summary} offline={offline}/><button className="amv2-web-action" disabled={!hasWeb || webBusy === app.id} onClick={() => void launchWeb(app.id)}>{webActionLabel(summary, hasWeb, webBusy === app.id)}</button><Link className="amv2-manage-action" href={app.href}>Quản trị</Link></div>;
        })}
        {!visibleItems.length ? <div className="amv2-empty"><strong>Không tìm thấy ứng dụng hoặc Tool phù hợp.</strong></div> : null}
      </div>}

      {selectedItem ? <div
        ref={popoverRef}
        id="amv2-app-launcher-popover"
        className="amv2-launcher-popover"
        role="dialog"
        aria-label={`Thông tin ${selectedItem.name}`}
        data-side={popoverPlacement.side}
        style={{ top: popoverPlacement.top, left: popoverPlacement.left }}
      >
        <header>
          <div><AppIcon appId={selectedItem.iconAppId}/><span><strong>{selectedItem.name}</strong><small>{selectedItem.parentLabel ? `${selectedItem.category} · ${selectedItem.parentLabel}` : selectedItem.category}</small></span></div>
          <button type="button" aria-label="Đóng thông tin ứng dụng" onClick={closePopover}>×</button>
        </header>

        <div className="amv2-launcher-facts">
          <p><span>Trạng thái</span><strong data-state={selectedItem.connection}>● {selectedItem.statusLabel}</strong></p>
          <p><span>Online</span><strong>{selectedItem.onlineCount === null ? "—" : countText(selectedItem.onlineCount)}</strong></p>
          <p><span>Chờ xử lý</span><strong>{selectedItem.pendingCount === null ? "—" : countText(selectedItem.pendingCount)}</strong></p>
          <p>
            <span>Phân loại</span>
            {selectedItem.kind === "app"
              ? <button type="button" className="amv2-category-edit-trigger" onClick={() => { setCategoryDraft(selectedItem.category); setCategoryEditing((current) => !current); }}>{selectedItem.category} ✎</button>
              : <strong>{selectedItem.parentLabel ? `Tool · ${selectedItem.parentLabel}` : "Tool"}</strong>}
          </p>
          {selectedItem.kind === "app" && categoryEditing ? <div className="amv2-category-editor">
            <label htmlFor="amv2-category-input">Phân loại hiển thị</label>
            <div>
              <input id="amv2-category-input" list="amv2-category-options" value={categoryDraft} onChange={(event) => setCategoryDraft(event.target.value)} placeholder="Ví dụ: Học tập"/>
              <datalist id="amv2-category-options">{editableCategories.map((category) => <option value={category} key={category}/>)}</datalist>
              <button type="button" onClick={() => saveCategoryOverride(selectedItem, categoryDraft)}>Lưu</button>
              <button type="button" onClick={() => {
                const canonical = apps.find((app) => app.id === selectedItem.id)?.category ?? selectedItem.category;
                setCategoryDraft(canonical);
                saveCategoryOverride(selectedItem, canonical);
              }}>Mặc định</button>
            </div>
            <small>Chỉ thay đổi cách phân loại/hiển thị trong App Manager, không đổi contract của client.</small>
          </div> : null}
          <p><span>Liên kết quản trị</span>{selectedItem.manageHref ? <Link href={selectedItem.manageHref}>{selectedItem.parentAppId ? "Bauman-Admin ↗" : "Quản trị ↗"}</Link> : <strong>—</strong>}</p>
        </div>

        {detailOpen ? <div className="amv2-launcher-more">
          {selectedItem.parentLabel ? <p><span>Parent app</span><strong>{selectedItem.parentLabel}</strong></p> : null}
          <p><span>Contract</span><strong>{selectedItem.contractLabel || "—"}</strong></p>
          <p><span>Runtime</span><strong>{selectedItem.runtimeLabel || "—"}</strong></p>
          <p><span>Lần đồng bộ</span><strong>{lastUpdatedAt ? relativeTime(lastUpdatedAt) : "—"}</strong></p>
          <p><span>Website/runtime</span><code title={selectedItem.href}>{selectedItem.href ?? "—"}</code></p>
          <div className="amv2-launcher-description">{selectedItem.description || "Chưa có dữ liệu"}</div>
          {selectedItem.tags.length ? <div className="amv2-launcher-tags">{selectedItem.tags.slice(0, 6).map((tag) => <span key={tag}>{tag}</span>)}</div> : null}
        </div> : null}

        <footer>
          <button type="button" className="primary" disabled={!selectedItem.canOpen || webBusy === selectedItem.id} onClick={() => { closePopover(); void openLauncherItem(selectedItem); }}>{webBusy === selectedItem.id ? "Đang mở…" : "↗ Mở"}</button>
          {selectedItem.manageHref ? <Link href={selectedItem.manageHref} onClick={closePopover}>⚙ Quản trị</Link> : <button type="button" disabled>⚙ Quản trị</button>}
          <button type="button" aria-expanded={detailOpen} onClick={() => setDetailOpen((current) => !current)}>ⓘ {detailOpen ? "Thu gọn" : "Xem chi tiết"}</button>
        </footer>
      </div> : null}
    </div>
  </section>;
}

function DevicesView({ devices, actionBusy, manageDevice, bulkRemovePendingDevices, openAutomation }: {
  devices: OperationsDevice[];
  actionBusy: string;
  manageDevice: (device: OperationsDevice, operation: "approve" | "remove") => Promise<void>;
  bulkRemovePendingDevices: (devices: OperationsDevice[]) => Promise<void>;
  openAutomation: () => void;
}) {
  const bulkTargets = devices.filter((device) => device.status === "pending" && device.canRemove && device.appId !== "boi-ech").slice(0, 24);
  return <section className="amv2-page-panel">
    <div className="amv2-device-bulk-toolbar">
      <div><strong>Hàng đợi kiểm duyệt</strong><small>Chỉ hiển thị thiết bị đang chờ duyệt. Sau khi được duyệt, mọi thay đổi quyền, khóa hoặc xóa phải thực hiện trong Quản trị của từng app. Bơi ếch là xóa vĩnh viễn nên không được xử lý hàng loạt.</small></div>
      <div className="amv2-device-bulk-actions"><button disabled={Boolean(actionBusy)} onClick={openAutomation}>⚙ Tự động</button><button data-danger="true" aria-label="Từ chối và khóa các thiết bị chờ kiểm duyệt đang hiển thị" disabled={!bulkTargets.length || Boolean(actionBusy)} onClick={() => void bulkRemovePendingDevices(devices)}>{actionBusy === "bulk-pending" ? "Đang xử lý…" : `Từ chối & khóa (${bulkTargets.length})`}</button></div>
    </div>
    <div className="amv2-view-table devices"><div className="head"><span>Ứng dụng</span><span>Thiết bị</span><span>Người dùng</span><span>Trạng thái</span><span>Hoạt động</span><span>Thao tác</span></div>{devices.map((device) => { const rowBusy = actionBusy === `${device.appId}:${device.deviceId}` || actionBusy === "bulk-pending"; return <div className="row" key={`${device.appId}:${device.deviceId}`}><AppCell appId={device.appId} name={device.appName}/><div><strong>{deviceKind(device)}</strong><small>{device.deviceCode}</small></div><span>{device.userLabel}</span><b>Chờ kiểm duyệt</b><span>{device.active ? "● Online" : relativeTime(device.lastSeenAt)}</span><div>{device.canApprove ? <button disabled={rowBusy} onClick={() => void manageDevice(device, "approve")}>{device.appId === "boi-ech" ? "Phân quyền" : "Duyệt"}</button> : null}{device.canRemove ? <button data-danger="true" disabled={rowBusy} onClick={() => void manageDevice(device, "remove")}>{device.appId === "boi-ech" ? "Xóa vĩnh viễn" : "Từ chối & khóa"}</button> : null}<Link href={device.href}>Quản trị</Link></div></div>; })}{!devices.length ? <div className="amv2-empty"><strong>Không có thiết bị chờ kiểm duyệt.</strong><small>Hàng đợi hiện đã sạch hoặc bộ lọc không có kết quả phù hợp.</small></div> : null}</div>
  </section>;
}

function AlertsView({ apps, summaryMap, workItems, lastUpdated, offline }: { apps: ApplicationConfig[]; summaryMap: Map<string, OperationsSummary>; workItems: OperationsWorkItem[]; lastUpdated: string; offline: boolean }) {
  if (offline) return <section className="amv2-page-panel alerts"><div className="amv2-empty"><strong>Cảnh báo chưa được xác minh online.</strong><small>Bật Kiểm duyệt truy cập để đọc cảnh báo trực tiếp từ các ứng dụng.</small></div></section>;
  const appAlerts = apps.filter((app) => {
    const summary = summaryMap.get(app.id);
    if (intentionalNonRemoteMode(summary)) return false;
    return connectionFor(app, summary) !== "connected";
  });
  return <section className="amv2-page-panel alerts"><div className="amv2-alert-list">{appAlerts.map((app) => { const summary = summaryMap.get(app.id); const state = connectionFor(app, summary); return <article key={app.id}><AppCell appId={app.id} name={app.shortName}/><b data-state={state}>{connectionLabel(state, summary)}</b><p>{summary?.note ?? app.contractNote}</p><time>{lastUpdated}</time></article>; })}{workItems.map((item) => <article key={item.id}><AppCell appId={item.appId} name={item.appName}/><b data-state={item.priority === "high" ? "unavailable" : "warning"}>{item.priority === "high" ? "Cần xử lý" : "Theo dõi"}</b><p>{item.title} · {item.detail}</p><time>{relativeTime(item.occurredAt)}</time></article>)}{!appAlerts.length && !workItems.length ? <div className="amv2-empty"><strong>Không có cảnh báo cần xử lý.</strong><small>Các trạng thái local-first hoặc metadata-only đã xác minh không bị tính là lỗi kết nối.</small></div> : null}</div></section>;
}

const auditActionLabels: Record<string, string> = {
  control_device_approved: "Cấp quyền thiết bị quản trị",
  control_device_blocked: "Khóa thiết bị quản trị",
  control_member_deactivated: "Thu hồi tài khoản quản trị",
  control_member_deleted: "Xóa tài khoản quản trị",
};

function auditActionLabel(action: string) {
  return auditActionLabels[action] ?? action.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function AuditView({ center }: { center: CenterBootstrap }) {
  return <section className="amv2-page-panel">
    <div className="amv2-audit-report-head"><div><small>NHẬT KÝ QUẢN TRỊ</small><h2>100 sự kiện gần nhất</h2><p>Hiển thị thời gian, hành động, người thực hiện và đối tượng tác động theo thứ tự mới nhất.</p></div><strong>{center.auditLog.length} sự kiện</strong></div>
    <div className="amv2-audit-list">{center.auditLog.map((entry) => <article key={entry.id}><time>{new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(new Date(entry.createdAt))}</time><div><strong>{auditActionLabel(entry.action)}</strong><small>{entry.actor} · {entry.source}</small></div><code title={entry.target}>{entry.target}</code></article>)}{!center.auditLog.length ? <div className="amv2-empty"><strong>Chưa có sự kiện audit.</strong></div> : null}</div>
  </section>;
}

function SettingsView({ center, access, actionBusy, fontScale, changeFontScale, manageControlDevice, approvalGateEnabled, changeApprovalGate }: {
  center: CenterBootstrap;
  access: AdminAccess;
  actionBusy: string;
  fontScale: FontScale;
  changeFontScale: (next: FontScale) => void;
  manageControlDevice: (device: ControlAdminDevice, operation: ControlDeviceOperation, selectedRole?: "reviewer" | "publisher") => Promise<void>;
  approvalGateEnabled: boolean;
  changeApprovalGate: (next: boolean) => void;
}) {
  const [roles, setRoles] = useState<Record<string, "reviewer" | "publisher">>({});
  return <section className="amv2-settings-grid">
    <div className="amv2-page-panel amv2-standalone-settings">
      <h2>Chế độ truy cập khi phát triển</h2>
      <p>Standalone Mode cho phép mở thẳng web-app và dùng dữ liệu local. Internet chỉ cần khi bạn muốn lấy quyền, đồng bộ thiết bị hoặc thao tác quản trị online.</p>
      <button className="amv2-standalone-toggle" data-enabled={approvalGateEnabled} onClick={() => changeApprovalGate(!approvalGateEnabled)}>
        <span>{approvalGateEnabled ? "🔒" : "⚡"}</span>
        <div><strong>Kiểm duyệt truy cập</strong><small>{approvalGateEnabled ? "Đang BẬT · cần xác minh quyền/thiết bị" : "Đang TẮT · vào thẳng, local-first"}</small></div>
        <b>{approvalGateEnabled ? "TẮT" : "BẬT"}</b>
      </button>
      <small>Đến giai đoạn Release, bật lại chế độ này để khôi phục luồng kiểm duyệt đầy đủ.</small>
    </div>
    <div className="amv2-page-panel">
      <h2>Thiết bị quản trị Trung tâm</h2>
      <div className="amv2-control-list">{center.controlDevices.map((device) => {
        const protectedDevice = device.owner || device.deviceId === access.deviceId;
        const rowBusy = actionBusy === `control:${device.deviceId}`;
        const role = roles[device.deviceId] ?? (device.role === "publisher" ? "publisher" : "reviewer");
        return <article key={device.deviceId}><i data-online={device.active}/><div><strong>{device.displayName || device.email}</strong><small>{device.email}</small><code>{device.deviceCode}</code></div><span>{roleLabels[device.role]}</span><b>{device.status === "approved" ? "Đã cấp quyền" : device.status === "pending" ? "Chờ duyệt" : "Đã khóa"}</b><div>{protectedDevice ? <em>Được bảo vệ</em> : access.role !== "owner" ? <em>Chỉ Owner được sửa</em> : device.status === "pending" ? <><select value={role} onChange={(event) => setRoles((current) => ({ ...current, [device.deviceId]: event.target.value as "reviewer" | "publisher" }))}><option value="reviewer">Kiểm duyệt viên</option><option value="publisher">Người xuất bản</option></select><button disabled={rowBusy} onClick={() => void manageControlDevice(device, "approve", role)}>Cấp quyền</button><button data-danger="true" disabled={rowBusy} onClick={() => void manageControlDevice(device, "block")}>Từ chối</button></> : device.memberStatus === "inactive" ? <button data-danger="true" disabled={rowBusy} onClick={() => void manageControlDevice(device, "delete-member")}>Xóa tài khoản</button> : <><button disabled={rowBusy} onClick={() => void manageControlDevice(device, "block")}>Khóa máy</button><button data-danger="true" disabled={rowBusy} onClick={() => void manageControlDevice(device, "deactivate-member")}>Thu hồi</button></>}</div></article>;
      })}</div>
    </div>
    <div className="amv2-page-panel">
      <h2>Giao diện trên thiết bị này</h2>
      <div className="amv2-appearance-settings">
        <p>Cỡ chữ chỉ được lưu trên trình duyệt hiện tại. Mức <strong>Gọn</strong> giữ bố cục hiện tại; các mức sau tăng dần khả năng đọc mà không thay đổi dữ liệu hay quyền.</p>
        <div className="amv2-font-scale-options">{fontScaleOptions.map((option) => <button key={option.id} data-active={fontScale === option.id} onClick={() => changeFontScale(option.id)}><strong>{option.label}</strong><small>{option.hint}</small></button>)}</div>
      </div>
      <h2>Nguyên tắc vận hành</h2>
      <div className="amv2-rules"><article><b>01</b><div><strong>Client sở hữu dữ liệu</strong><p>Registry thiết bị, phiên truy cập và dữ liệu nghiệp vụ vẫn nằm tại ứng dụng tương ứng.</p></div></article><article><b>02</b><div><strong>Trung tâm điều phối</strong><p>Application Management đọc contract và gửi lệnh quản trị có xác minh.</p></div></article><article><b>03</b><div><strong>Không hiển thị dữ liệu giả</strong><p>Chỉ số và trạng thái chỉ xuất hiện từ dữ liệu thật hoặc thể hiện rõ chưa có dữ liệu.</p></div></article></div>
    </div>
  </section>;
}
