"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
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
};

const fontScaleStorageKey = "application-management:font-scale:v1";
const approvalGateStorageKey = "application-management:approval-gate:v1";
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
];
const validViews: readonly View[] = ["overview", "approvals", "applications", "devices", "access", "alerts", "audit", "settings"];

const navItems: Array<{ view: View; label: string; icon: string }> = [
  { view: "overview", label: "Tổng quan", icon: "⌂" },
  { view: "approvals", label: "Hộp việc", icon: "▱" },
  { view: "applications", label: "Ứng dụng", icon: "▦" },
  { view: "devices", label: "Thiết bị mới", icon: "▣" },
  { view: "access", label: "Thanh toán & Quyền", icon: "◈" },
  { view: "alerts", label: "Cảnh báo", icon: "△" },
  { view: "audit", label: "Nhật ký", icon: "≣" },
];

const viewTitles: Record<View, { title: string; subtitle: string }> = {
  overview: {
    title: "Bảng điều phối quản trị ứng dụng",
    subtitle: "Kiểm soát tập trung các ứng dụng, thiết bị, người dùng, phê duyệt và điều phối hệ thống.",
  },
  approvals: { title: "Hộp việc", subtitle: "Các yêu cầu và sự kiện cần xử lý được gom về một hàng đợi thống nhất." },
  applications: { title: "Ứng dụng", subtitle: "Quản trị client và mở đúng website sử dụng của từng ứng dụng." },
  devices: { title: "Thiết bị mới", subtitle: "Duyệt, khóa hoặc loại bỏ thiết bị bằng dữ liệu registry thật của từng client." },
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
  if (appId === "tool-secret-generator") return "⌘";
  if (appId === "tool-managed-apps") return "⊕";
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
  if (summary?.managementMode === "local-first" && summary.contractConnected === true) return "Local-first · contract live";
  if (summary?.managementMode === "local-first" && summary.metadataVerified) return "Local-first · metadata đã xác minh";
  if (summary?.managementMode === "metadata-only" && summary.metadataVerified) return "Metadata đã xác minh · chưa có runtime";
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
  if (hasWeb) return "Mở";
  if (summary?.managementMode === "local-first") return "Chỉ cục bộ";
  if (summary?.managementMode === "metadata-only") return "Chưa có web";
  return "Chưa sẵn sàng";
}

function intentionalNonRemoteMode(summary?: OperationsSummary) {
  return Boolean((summary?.contractConnected === true || summary?.metadataVerified) && (summary.managementMode === "local-first" || summary.managementMode === "metadata-only"));
}

function statusAxes(app: ApplicationConfig, summary?: OperationsSummary) {
  const state = connectionFor(app, summary);
  const localFirst = summary?.managementMode === "local-first";
  const metadataOnly = summary?.managementMode === "metadata-only";
  const repositoryOnly = summary?.issueCode === "REPOSITORY_METADATA_ONLY";
  const runtimeLive = !repositoryOnly && (state === "connected" || summary?.contractConnected === true);

  const runtime = localFirst
    ? { label: "Local-first", tone: "good" as const }
    : metadataOnly
      ? { label: "Chưa có cloud", tone: "idle" as const }
      : state === "unavailable"
        ? { label: "Mất kết nối", tone: "bad" as const }
        : runtimeLive
          ? { label: "Live", tone: "good" as const }
          : state === "warning"
            ? { label: "Có cảnh báo", tone: "warn" as const }
            : { label: "Chưa live", tone: "idle" as const };

  const contract = summary?.contractConnected === true
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

function StatusCell({ app, summary }: { app: ApplicationConfig; summary?: OperationsSummary }) {
  const state = connectionFor(app, summary);
  const axes = statusAxes(app, summary);
  const title = summary?.note ?? app.contractNote;
  const visualState = summary?.managementMode === "local-first" ? "connected" : state;
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
  const [actionBusy, setActionBusy] = useState("");
  const [webBusy, setWebBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [syncError, setSyncError] = useState("");
  const [clock, setClock] = useState<Date | null>(null);
  const [webMenu, setWebMenu] = useState(false);
  const [autoPolicyOpen, setAutoPolicyOpen] = useState(false);
  const [accountSecurityOpen, setAccountSecurityOpen] = useState(false);
  const [fontScale, setFontScale] = useState<FontScale>("compact");
  const [localRuntime, setLocalRuntime] = useState(false);
  const [approvalGateEnabled, setApprovalGateEnabled] = useState(defaultApprovalGate);

  async function refreshOperations(silent = false) {
    if (!silent) setSyncing(true);
    setSyncError("");
    if (!approvalGateEnabled) {
      const cached = readCachedOperations();
      if (cached) setOperations(cached);
      if (!silent) setNotice("Standalone Mode: dữ liệu local được ưu tiên. Bật Kiểm duyệt truy cập khi cần đồng bộ quyền/thiết bị online.");
      if (!silent) setSyncing(false);
      return cached;
    }
    try {
      const result = await connectOperationsDashboard();
      if (result.bootstrap) setOperations(result.bootstrap);
      return result.bootstrap ?? null;
    } catch (caught) {
      setSyncError(caught instanceof Error ? caught.message : "Không thể đồng bộ dữ liệu ứng dụng.");
      return null;
    } finally {
      if (!silent) setSyncing(false);
    }
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
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 5_500);
    return () => window.clearTimeout(timer);
  }, [notice]);

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
  const notificationCount = workItems.length;
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
    return !searchValue || `${tool.name} ${tool.category} ${tool.note}`.toLowerCase().includes(searchValue);
  });
  const filteredDevices = devices.filter((device) => {
    if (appFilter !== "all" && device.appId !== appFilter) return false;
    return !searchValue || `${device.appName} ${device.deviceCode} ${device.userLabel} ${device.deviceTypeLabel}`.toLowerCase().includes(searchValue);
  });
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

  async function manageDevice(device: OperationsDevice, operation: "approve" | "remove") {
    if (!requireManagedAccess("Quản lý thiết bị")) return;
    if (operation === "approve" && device.appId === "boi-ech") {
      setAppFilter("boi-ech");
      switchView("access");
      setNotice("Bơi ếch cần chọn rõ Miễn phí hoặc Trả phí trong Thanh toán & Quyền; không tự động cấp miễn phí từ danh sách thiết bị.");
      return;
    }
    if (operation === "remove") {
      const destructive = device.appId === "boi-ech";
      const message = destructive ? `Xóa vĩnh viễn thiết bị ${device.deviceCode} khỏi registry Bơi ếch?` : `Khóa thiết bị ${device.deviceCode} của ${device.appName}?`;
      if (!window.confirm(message)) return;
    }
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
      setNotice(result.code === "STALE_DEVICE_REMOVED"
        ? `Thiết bị ${device.deviceCode} không còn trong registry; danh sách đã được đồng bộ lại.`
        : operation === "approve" ? `Đã duyệt ${device.deviceCode}.` : `Đã xử lý ${device.deviceCode}.`);
    } catch (caught) {
      const code = caught instanceof AdminApiError ? caught.data.code : undefined;
      const growUpStale = device.appId === "growup-mychildren"
        && (code === "DEVICE_NOT_FOUND" || code === "GROWUP_REGISTRY_INSTANCE_MISMATCH");
      await refreshOperations(true);
      if (growUpStale) {
        setNotice(code === "GROWUP_REGISTRY_INSTANCE_MISMATCH"
          ? "Registry GrowUP vừa thay đổi; danh sách thiết bị đã được đồng bộ lại."
          : `Thiết bị ${device.deviceCode} không còn trong registry GU-; dòng dữ liệu cũ đã được loại khỏi danh sách.`);
      } else {
        setNotice(caught instanceof Error ? caught.message : "Không thể cập nhật thiết bị.");
      }
    } finally {
      setActionBusy("");
    }
  }

  async function bulkRemovePendingDevices(visibleDevices: OperationsDevice[]) {
    if (!requireManagedAccess("Xử lý hàng loạt thiết bị")) return;
    const targets = visibleDevices.filter((device) => device.status === "pending" && device.canRemove).slice(0, 24);
    if (!targets.length) {
      setNotice("Không có thiết bị chờ duyệt nào hỗ trợ xử lý trực tiếp trong phạm vi đang hiển thị.");
      return;
    }
    const destructive = targets.filter((device) => device.appId === "boi-ech");
    const blocking = targets.length - destructive.length;
    const summary = [
      `Xử lý ${targets.length} thiết bị chờ duyệt đang hiển thị?`,
      blocking ? `${blocking} thiết bị sẽ bị khóa và giữ registry/audit.` : "",
      destructive.length ? `${destructive.length} thiết bị Bơi ếch sẽ bị XÓA VĨNH VIỄN khỏi registry.` : "",
      targets.length === 24 ? "Mỗi lượt xử lý tối đa 24 thiết bị để tránh thao tác hàng loạt quá lớn." : "",
    ].filter(Boolean).join("\n");
    if (!window.confirm(summary)) return;
    if (destructive.length && !window.confirm(`Xác nhận lần cuối: xóa vĩnh viễn ${destructive.length} thiết bị Bơi ếch trong lượt này?`)) return;

    setActionBusy("bulk-pending");
    setNotice("");
    let succeeded = 0;
    const failed: string[] = [];
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
      ? `Đã xử lý ${succeeded}/${targets.length} thiết bị. Lỗi: ${failed.slice(0, 5).join(", ")}${failed.length > 5 ? ` và ${failed.length - 5} thiết bị khác` : ""}.`
      : `Đã xử lý và xác minh ${succeeded} thiết bị chờ duyệt.`);
    setActionBusy("");
  }

  async function launchWeb(appId: string) {
    const app = appFor(activeApps, appId);
    const summary = summaryMap.get(appId);
    const fallback = app?.publicUrl ?? (localRuntime ? app?.localUrl : undefined);
    if (!summary?.webHref && !fallback) {
      setNotice("Ứng dụng chưa công bố URL website hợp lệ.");
      return;
    }
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
    setActionBusy("clear");
    try {
      await operationsAction({ action: "dismiss-notifications", workItemIds: ids });
      await refreshOperations(true);
      setNotice("Đã dọn thông báo hiển thị; dữ liệu gốc được giữ nguyên.");
    } catch (caught) {
      setNotice(caught instanceof Error ? caught.message : "Không thể xóa thông báo.");
    } finally {
      setActionBusy("");
    }
  }

  async function saveAutomation(selection: AutomationSelection) {
    if (!requireManagedAccess("Lưu quy tắc tự động")) return;
    const current = operations?.settings;
    if (!current) return;
    const supported = new Set(current.autoApproveSupportedAppIds);
    const blockSupported = new Set(current.autoBlockPendingSupportedAppIds ?? []);
    if (selection.appIds.some((id) => !supported.has(id) && !current.autoApproveAppIds.includes(id))
      || selection.autoBlockAppIds.some((id) => !blockSupported.has(id) && !current.autoBlockPendingAppIds?.includes(id))) {
      setNotice("Có ứng dụng chưa công bố contract tự động xử lý.");
      return;
    }
    if (selection.appIds.includes("boi-ech") && !current.autoApproveAppIds.includes("boi-ech") &&
      !window.confirm("Bật tự động MIỄN PHÍ cho đăng ký Bơi ếch mới chưa vào luồng trả phí? Thiết bị phù hợp sẽ được mở theo thời hạn và hạn mức đã chọn.")) return;
    setActionBusy("auto-policy");
    setNotice("");
    try {
      if (current.autoApproveSupportedAppIds.length) {
        await operationsAction({ action: "set-auto-approval", appIds: selection.appIds,
          targetAppIds: current.autoApproveSupportedAppIds,
          defaultAccessDays: selection.defaultAccessDays, defaultDeviceLimit: selection.defaultDeviceLimit });
      }
      for (const appId of current.autoBlockPendingSupportedAppIds ?? []) {
        const enabled = selection.autoBlockAppIds.includes(appId);
        const hours = selection.pendingBlockAfterHoursByApp[appId] ?? current.pendingBlockAfterHoursByApp?.[appId] ?? 168;
        if (current.autoBlockPendingAppIds?.includes(appId) === enabled && current.pendingBlockAfterHoursByApp?.[appId] === hours) continue;
        await operationsAction({ action: "set-auto-block-pending", appId, enabled, pendingBlockAfterHours: hours });
      }
      const synced = await refreshOperations(true);
      if (!synced || selection.appIds.some((id) => !synced.settings.autoApproveAppIds.includes(id)) ||
        current.autoApproveSupportedAppIds.some((id) => !selection.appIds.includes(id) && synced.settings.autoApproveAppIds.includes(id)) ||
        selection.autoBlockAppIds.some((id) => !synced.settings.autoBlockPendingAppIds?.includes(id)) ||
        (current.autoBlockPendingSupportedAppIds ?? []).some((id) => !selection.autoBlockAppIds.includes(id) && synced.settings.autoBlockPendingAppIds?.includes(id)) ||
        selection.autoBlockAppIds.some((id) => synced.settings.pendingBlockAfterHoursByApp?.[id] !== selection.pendingBlockAfterHoursByApp[id]) ||
        (selection.appIds.includes("boi-ech") && (synced.settings.freeAccessDaysByApp?.["boi-ech"] !== selection.defaultAccessDays ||
          synced.settings.freeDeviceLimitByApp?.["boi-ech"] !== selection.defaultDeviceLimit))) {
        throw new Error("Chưa đọc lại được quy tắc từ client; hãy đồng bộ trước khi kết luận đã lưu.");
      }
      setAutoPolicyOpen(false);
      setNotice("Đã lưu và đọc lại quy tắc tự động theo từng ứng dụng.");
    } catch (caught) {
      void refreshOperations(true);
      setNotice(caught instanceof Error ? caught.message : "Không thể cập nhật quy tắc tự động.");
    } finally {
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
    setActionBusy(`control:${device.deviceId}`);
    try {
      const result = await centerAdminAction({ action: "manage-control-device", operation, targetDeviceId: device.deviceId, role: selectedRole ?? "reviewer", displayName: device.displayName });
      setCenter((current) => current ? { ...current, controlDevices: result.controlDevices ?? current.controlDevices, auditLog: result.auditLog ?? current.auditLog } : current);
      setNotice("Đã cập nhật thiết bị quản trị.");
    } catch (caught) {
      setNotice(caught instanceof Error ? caught.message : "Không thể cập nhật thiết bị quản trị.");
    } finally {
      setActionBusy("");
    }
  }

  if (approvalGateEnabled && (!access || access.status !== "approved" || !center)) return <Gate busy={busy} error={error} access={access} retry={() => void initialize()}/>;
  if (!access || !center) return <Gate busy={busy} error={error} access={access} retry={() => void initialize()}/>;

  const title = viewTitles[view];
  const lastUpdated = operations?.generatedAt ? relativeTime(operations.generatedAt) : "Chưa có dữ liệu";

  return <main className="amv2-shell" data-font-scale={fontScale}>
    {accountSecurityOpen ? <AccountSecurityDialog user={user} role={roleLabels[access.role]} authMode={authMode} close={() => setAccountSecurityOpen(false)}/> : null}
    {autoPolicyOpen ? <AutomaticDevicePolicies key={operations?.generatedAt ?? "loading"} settings={operations?.settings} busy={actionBusy === "auto-policy"} close={() => setAutoPolicyOpen(false)} save={(selection) => void saveAutomation(selection)}/> : null}
    <aside className="amv2-sidebar">
      <div className="amv2-brand"><div>QT</div><span><small>TRUNG TÂM ĐIỀU PHỐI</small><strong>QUẢN TRỊ ỨNG DỤNG</strong><em>Kết nối · Kiểm soát · Phát triển</em></span></div>
      <nav aria-label="Điều hướng quản trị">{navItems.map((item) => <button key={item.view} data-active={view === item.view} onClick={() => switchView(item.view)}><i>{item.icon}</i><span>{item.label}</span>{item.view === "devices" && pendingDevices.length ? <b>{pendingDevices.length}</b> : null}{item.view === "approvals" && approvalCount ? <b>{approvalCount}</b> : null}</button>)}</nav>
      <section className="amv2-system-card"><header><span>▣</span><div><small>Trạng thái hệ thống</small><strong>{unavailableCount ? "Cần kiểm tra" : "Đã cập nhật dữ liệu"}</strong></div></header><p><span>Ứng dụng & Tool</span><b>{activeApps.length + systemTools.length}</b></p><p><span>Kết nối tốt</span><b>{onlineApps}</b></p><p><span>Thiết bị chờ duyệt</span><b>{pendingDevices.length}</b></p><p><span>Lần cập nhật</span><b>{clock ? new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(clock) : "—"}</b></p></section>
      <blockquote>Quản trị tập trung<br/>Vận hành an toàn<br/>Phát triển bền vững</blockquote>
      <footer><i/>Hệ thống hoạt động</footer>
    </aside>

    <section className="amv2-workspace">
      <header className="amv2-topbar">
        <label className="amv2-search"><span>⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm theo ứng dụng, thiết bị, người dùng…"/></label>
        <label className="amv2-filter"><span>▽</span><select value={appFilter} onChange={(event) => setAppFilter(event.target.value)}><option value="all">Bộ lọc nhanh</option>{activeApps.map((app) => <option key={app.id} value={app.id}>{app.shortName}</option>)}{systemTools.map((tool) => <option key={tool.id} value={tool.id}>Tool · {tool.name}</option>)}</select></label>
        <button className="amv2-access-mode" data-enabled={approvalGateEnabled} onClick={() => changeApprovalGate(!approvalGateEnabled)} title="Bật/tắt kiểm duyệt quyền và thiết bị"><span>{approvalGateEnabled ? "🔒" : "⚡"}</span><div><small>Kiểm duyệt truy cập</small><strong>{approvalGateEnabled ? "BẬT" : "TẮT · Vào thẳng"}</strong></div></button>
        <button className="amv2-bell" aria-label={notificationCount ? `Mở Cảnh báo: ${notificationCount} thông báo` : "Mở Cảnh báo"} onClick={() => switchView("alerts")}>♧{notificationCount ? <b>{notificationCount}</b> : null}</button>
        <span className="amv2-online" data-standalone={!approvalGateEnabled}><i/><strong>{approvalGateEnabled ? "Hệ thống kết nối" : "Standalone · Local-first"}</strong><small>{syncing ? "Đang đồng bộ…" : approvalGateEnabled ? "Dữ liệu đã cập nhật" : "Internet chỉ cần khi lấy quyền/sync"}</small></span>
        <details className="amv2-account"><summary><span>{initials(user.displayName)}</span><div><strong>{user.displayName}</strong><small>{approvalGateEnabled ? roleLabels[access.role] : "Standalone Owner"}</small></div><b>⌄</b></summary><div><small>{user.email}</small>{authMode === "cloudflare-production" ? <a href="/__account">Tài khoản & bảo mật</a> : <button onClick={() => setAccountSecurityOpen(true)}>Tài khoản & bảo mật</button>}<button onClick={() => switchView("settings")}>Cấu hình</button>{authMode === "cloudflare-production" ? <form method="post" action="/__logout"><button type="submit">Đăng xuất</button></form> : <a href="/signout-with-chatgpt?return_to=%2F">Đăng xuất</a>}</div></details>
      </header>

      <div className="amv2-content">
        <header className="amv2-page-head"><div><h1>{title.title}</h1><p>{title.subtitle}</p></div>{view === "overview" ? <section className="amv2-clock"><span>▣</span><div><small>{clock ? new Intl.DateTimeFormat("vi-VN", { weekday: "short", day: "2-digit", month: "2-digit", year: "numeric" }).format(clock) : ""}</small><strong>{clock ? new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(clock) : ""}</strong></div><i/><div><small>Hệ thống</small><strong>{unavailableCount ? "Cần kiểm tra" : "Hoạt động ổn định"}</strong></div></section> : <button className="amv2-sync" disabled={syncing} onClick={() => void refreshOperations()}>{syncing ? "Đang đồng bộ…" : "↻ Đồng bộ"}</button>}</header>
        {syncError ? <div className="amv2-warning"><strong>Cảnh báo đồng bộ:</strong> {syncError}</div> : null}
        {notice ? <div className="amv2-notice" role="status" aria-live="polite"><span>{notice}</span><button type="button" aria-label="Đóng thông báo" onClick={() => setNotice("")}>×</button></div> : null}

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
            refreshOperations={refreshOperations}
            localRuntime={localRuntime}
          /> : null}
          {view === "approvals" ? <ApprovalView devices={filteredApprovalDevices} actionBusy={actionBusy} manageDevice={manageDevice}/> : null}
          {view === "applications" ? <ApplicationsView apps={filteredApps} tools={filteredTools} summaryMap={summaryMap} devices={devices} webBusy={webBusy} launchWeb={launchWeb} localRuntime={localRuntime}/> : null}
          {view === "devices" ? <DevicesView devices={filteredDevices} actionBusy={actionBusy} manageDevice={manageDevice} bulkRemovePendingDevices={bulkRemovePendingDevices} openAutomation={() => setAutoPolicyOpen(true)}/> : null}
          {view === "access" ? <BoiAccessView query={search}/> : null}
          {view === "alerts" ? <AlertsView apps={filteredApps} summaryMap={summaryMap} workItems={filteredWork} lastUpdated={lastUpdated}/> : null}
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

function ToolRow({ tool }: { tool: SystemTool }) {
  return <div className="amv2-app-row amv2-tool-row" data-kind="tool">
    <AppCell appId={tool.id} name={tool.name}/>
    <span>{tool.category}</span>
    <strong>—</strong>
    <strong>—</strong>
    <b data-state="connected"><i/>Sẵn sàng</b>
    <Link className="amv2-web-action" href={tool.href}>Mở</Link>
    <Link className="amv2-manage-action" href={tool.href}>Quản trị</Link>
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

function Overview({ apps, tools, summaryMap, devices, pendingDevices, approvalDevices, workItems, highAlerts, unavailableCount, environmentCount, contractPending, actionBusy, webBusy, syncing, webMenu, setWebMenu, switchView, launchWeb, manageDevice, clearNotifications, enableAutoApproval, refreshOperations, localRuntime }: {
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
  refreshOperations: (silent?: boolean) => Promise<OperationsBootstrap | null>;
  localRuntime: boolean;
}) {
  const priorityRows = [
    ...approvalDevices.map((device) => ({ key: `device:${device.appId}:${device.deviceId}`, appId: device.appId, appName: device.appName, type: device.attention === "environment" ? "Môi trường" : "Thiết bị", content: `${device.userLabel} · ${device.deviceCode}`, at: device.lastSeenAt ?? device.createdAt, priority: device.attention === "environment" ? "Cao" : "Vừa", status: device.status === "pending" ? "Chờ duyệt" : "Cần xác minh" })),
    ...workItems.filter((item) => item.kind === "connection").map((item) => ({ key: `work:${item.id}`, appId: item.appId, appName: item.appName, type: "Kết nối", content: item.title, at: item.occurredAt, priority: item.priority === "high" ? "Cao" : item.priority === "normal" ? "Vừa" : "Thông tin", status: item.priority === "high" ? "Cần xử lý" : "Theo dõi" })),
  ].slice(0, 4);

  return <>
    <section className="amv2-metrics">
      <button data-tone="teal" onClick={() => switchView("applications")}><i>◇</i><div><small>Tổng ứng dụng</small><strong>{apps.length + tools.length}</strong><em>Ứng dụng & Tool đang quản lý</em></div><b>›</b></button>
      <button data-tone="gold" onClick={() => switchView("devices")}><i>▣</i><div><small>Thiết bị mới chờ duyệt</small><strong>{pendingDevices.length}</strong><em>Thiết bị cần cấp quyền</em></div><b>›</b></button>
      <button data-tone="red" onClick={() => switchView("alerts")}><i>△</i><div><small>Cảnh báo hôm nay</small><strong>{highAlerts}</strong><em>{highAlerts ? "Có cảnh báo cần kiểm tra" : "Không có cảnh báo cao"}</em></div><b>›</b></button>
      <button data-tone="blue" onClick={() => switchView("approvals")}><i>▤</i><div><small>Ca kiểm duyệt cần xử lý</small><strong>{approvalDevices.length}</strong><em>Yêu cầu đang chờ xử lý</em></div><b>›</b></button>
    </section>

    <section className="amv2-overview-grid">
      <section className="amv2-panel amv2-priority-panel"><PanelTitle icon="▱" title="Hộp việc ưu tiên" count={priorityRows.length} onClick={() => switchView("approvals")}/><div className="amv2-priority-table"><div className="amv2-priority-head"><span>Loại công việc</span><span>Ứng dụng</span><span>Nội dung</span><span>Thời gian</span><span>Độ ưu tiên</span><span>Trạng thái</span></div>{priorityRows.map((row) => <div className="amv2-priority-row" key={row.key}><span>{row.type}</span><AppCell appId={row.appId} name={row.appName}/><span title={row.content}>{row.content}</span><span>{relativeTime(row.at)}</span><b data-priority={row.priority}>{row.priority}</b><em>{row.status}</em></div>)}{!priorityRows.length ? <div className="amv2-empty"><span>▱</span><strong>Không có việc phù hợp với bộ lọc hiện tại.</strong><small>Hệ thống sẽ hiển thị các nhiệm vụ cần xử lý tại đây.</small></div> : null}</div></section>

      <section className="amv2-panel amv2-alert-panel"><PanelTitle icon="♧" title="Cảnh báo nhanh" onClick={() => switchView("alerts")}/><div className="amv2-alert-grid"><button onClick={() => switchView("devices")} data-tone="gold"><small>Thiết bị mới</small><strong>{pendingDevices.length}</strong></button><button onClick={() => switchView("alerts")} data-tone="red"><small>App mất kết nối</small><strong>{unavailableCount}</strong></button><button onClick={() => switchView("alerts")} data-tone="olive"><small>Môi trường thay đổi</small><strong>{environmentCount}</strong></button><button onClick={() => switchView("applications")} data-tone="blue"><small>Kết nối chờ hoàn tất</small><strong>{contractPending}</strong></button></div></section>

      <section className="amv2-panel amv2-quick-panel"><header><h2>⚡ Thao tác nhanh</h2></header><div className="amv2-quick-grid"><button onClick={() => switchView("applications")}>◇<span>Quản trị ứng dụng</span></button><button data-active={webMenu} onClick={() => setWebMenu((current) => !current)}>◎<span>Truy cập web</span></button><button onClick={() => switchView("devices")}>▣<span>Duyệt thiết bị</span></button><button onClick={() => switchView("approvals")}>⬡<span>Yêu cầu chờ duyệt</span></button><button data-danger="true" disabled={Boolean(actionBusy)} onClick={() => void clearNotifications()}>⌫<span>{actionBusy === "clear" ? "Đang xóa…" : "Xóa hết thông báo"}</span></button><button disabled={Boolean(actionBusy)} onClick={() => void enableAutoApproval()}>⚙<span>{actionBusy === "auto" ? "Đang lưu…" : "Duyệt tự động"}</span></button><button disabled={syncing} onClick={() => void refreshOperations()}>↻<span>{syncing ? "Đang đồng bộ…" : "Đồng bộ dữ liệu"}</span></button><button onClick={() => switchView("settings")}>▦<span>Giao diện</span></button><button onClick={() => switchView("audit")}>▤<span>Xem nhật ký</span></button></div>{webMenu ? <div className="amv2-web-menu">{apps.map((app) => { const summary = summaryMap.get(app.id); const hasWeb = Boolean(summary?.webHref || app.publicUrl || (localRuntime && app.localUrl)); return <button key={app.id} disabled={!hasWeb || webBusy === app.id} onClick={() => void launchWeb(app.id)}><span className="amv2-web-menu-app"><AppIcon appId={app.id}/><span>{app.shortName}</span></span><b>{webBusy === app.id ? "Đang mở…" : hasWeb ? "Mở ↗" : webActionLabel(summary, false)}</b></button>; })}</div> : null}</section>

      <section className="amv2-panel amv2-apps-panel"><PanelTitle icon="◇" title="Ứng dụng đang quản lý" onClick={() => switchView("applications")}/><div className="amv2-app-table"><div className="amv2-app-head"><span>Ứng dụng</span><span>Nhóm nghiệp vụ</span><span>Việc chờ xử lý</span><span>Thiết bị online</span><span>Trạng thái</span><span>Website</span><span>Quản Trị</span></div>{tools.map((tool) => <ToolRow key={tool.id} tool={tool}/>)}{apps.map((app) => { const summary = summaryMap.get(app.id); const counts = operationalCounts(app.id, summary, devices); const hasWeb = Boolean(summary?.webHref || app.publicUrl || (localRuntime && app.localUrl)); return <div className="amv2-app-row" key={app.id}><AppCell appId={app.id} name={app.shortName}/><span>{appGroup(app)}</span><strong title={counts.pending === null ? "Client chưa cung cấp dữ liệu thiết bị." : undefined}>{countText(counts.pending)}</strong><strong title={counts.online === null ? "Client chưa cung cấp dữ liệu online." : undefined}>{countText(counts.online)}</strong><StatusCell app={app} summary={summary}/><button className="amv2-web-action" disabled={!hasWeb || webBusy === app.id} onClick={() => void launchWeb(app.id)}>{webActionLabel(summary, hasWeb, webBusy === app.id)}</button><Link className="amv2-manage-action" href={app.href}>Quản trị</Link></div>; })}{!apps.length && !tools.length ? <div className="amv2-empty compact"><strong>Không tìm thấy ứng dụng hoặc Tool phù hợp.</strong></div> : null}</div></section>

      <section className="amv2-panel amv2-devices-panel"><PanelTitle icon="▣" title="Thiết bị mới theo ứng dụng" count={pendingDevices.length} onClick={() => switchView("devices")}/><div className="amv2-device-table"><div className="amv2-device-head"><span>Ứng dụng</span><span>Thiết bị</span><span>Người dùng</span><span>Thời gian</span><span>Thao tác</span></div>{pendingDevices.slice(0, 4).map((device) => { const rowBusy = actionBusy === `${device.appId}:${device.deviceId}`; return <div className="amv2-device-row" key={`${device.appId}:${device.deviceId}`}><AppCell appId={device.appId} name={device.appName}/><span>{deviceKind(device)}</span><span title={device.userLabel}>{device.userLabel}</span><span>{relativeTime(device.createdAt)}</span><div>{device.canApprove ? <button disabled={rowBusy} onClick={() => void manageDevice(device, "approve")}>{device.appId === "boi-ech" ? "Phân quyền" : "Duyệt"}</button> : null}{device.canRemove ? <button data-danger="true" disabled={rowBusy} onClick={() => void manageDevice(device, "remove")}>{device.appId === "boi-ech" ? "Xóa" : "Khóa"}</button> : null}</div></div>; })}{!pendingDevices.length ? <div className="amv2-empty compact"><strong>Không có thiết bị chờ duyệt.</strong></div> : null}</div></section>
    </section>
  </>;
}

function ApprovalView({ devices, actionBusy, manageDevice }: { devices: OperationsDevice[]; actionBusy: string; manageDevice: (device: OperationsDevice, operation: "approve" | "remove") => Promise<void> }) {
  return <section className="amv2-page-panel"><div className="amv2-view-table approval"><div className="head"><span>Ứng dụng</span><span>Loại yêu cầu</span><span>Thiết bị / người dùng</span><span>Trạng thái</span><span>Thao tác</span></div>{devices.map((device) => { const rowBusy = actionBusy === `${device.appId}:${device.deviceId}`; return <div className="row" key={`${device.appId}:${device.deviceId}`}><AppCell appId={device.appId} name={device.appName}/><span>{device.status === "pending" ? "Duyệt thiết bị" : "Xác minh môi trường"}</span><div><strong>{device.userLabel}</strong><small>{device.deviceCode}</small></div><b>{device.status === "pending" ? "Chờ duyệt" : "Cần xử lý"}</b><div>{device.canApprove ? <button disabled={rowBusy} onClick={() => void manageDevice(device, "approve")}>{device.appId === "boi-ech" ? "Phân quyền" : "Duyệt"}</button> : null}{device.canRemove ? <button data-danger="true" disabled={rowBusy} onClick={() => void manageDevice(device, "remove")}>{device.appId === "boi-ech" ? "Xóa" : "Khóa"}</button> : null}</div></div>; })}{!devices.length ? <div className="amv2-empty"><strong>Không có yêu cầu cần xử lý.</strong></div> : null}</div></section>;
}

function ApplicationsView({ apps, tools, summaryMap, devices, webBusy, launchWeb, localRuntime }: { apps: ApplicationConfig[]; tools: SystemTool[]; summaryMap: Map<string, OperationsSummary>; devices: OperationsDevice[]; webBusy: string; launchWeb: (appId: string) => Promise<void>; localRuntime: boolean }) {
  return <section className="amv2-page-panel"><div className="amv2-app-table full"><div className="amv2-app-head"><span>Ứng dụng</span><span>Nhóm nghiệp vụ</span><span>Việc chờ xử lý</span><span>Thiết bị online</span><span>Trạng thái</span><span>Website</span><span>Quản Trị</span></div>{tools.map((tool) => <ToolRow key={tool.id} tool={tool}/>)}{apps.map((app) => { const summary = summaryMap.get(app.id); const counts = operationalCounts(app.id, summary, devices); const hasWeb = Boolean(summary?.webHref || app.publicUrl || (localRuntime && app.localUrl)); return <div className="amv2-app-row" key={app.id}><AppCell appId={app.id} name={app.shortName}/><span>{appGroup(app)}</span><strong title={counts.pending === null ? "Client chưa cung cấp dữ liệu thiết bị." : undefined}>{countText(counts.pending)}</strong><strong title={counts.online === null ? "Client chưa cung cấp dữ liệu online." : undefined}>{countText(counts.online)}</strong><StatusCell app={app} summary={summary}/><button className="amv2-web-action" disabled={!hasWeb || webBusy === app.id} onClick={() => void launchWeb(app.id)}>{webActionLabel(summary, hasWeb, webBusy === app.id)}</button><Link className="amv2-manage-action" href={app.href}>Quản trị</Link></div>; })}{!apps.length && !tools.length ? <div className="amv2-empty"><strong>Không tìm thấy ứng dụng hoặc Tool phù hợp.</strong></div> : null}</div></section>;
}

function DevicesView({ devices, actionBusy, manageDevice, bulkRemovePendingDevices, openAutomation }: {
  devices: OperationsDevice[];
  actionBusy: string;
  manageDevice: (device: OperationsDevice, operation: "approve" | "remove") => Promise<void>;
  bulkRemovePendingDevices: (devices: OperationsDevice[]) => Promise<void>;
  openAutomation: () => void;
}) {
  const bulkTargets = devices.filter((device) => device.status === "pending" && device.canRemove).slice(0, 24);
  return <section className="amv2-page-panel">
    <div className="amv2-device-bulk-toolbar">
      <div><strong>Thiết bị đang hiển thị</strong><small>Bulk-action chỉ áp dụng thiết bị chờ duyệt có contract xử lý thật. Bơi ếch xóa vĩnh viễn và luôn cần xác nhận hai lần.</small></div>
      <div className="amv2-device-bulk-actions"><button disabled={Boolean(actionBusy)} onClick={openAutomation}>⚙ Tự động</button><button data-danger="true" aria-label="Khóa hoặc loại toàn bộ thiết bị chờ duyệt đang hiển thị" disabled={!bulkTargets.length || Boolean(actionBusy)} onClick={() => void bulkRemovePendingDevices(devices)}>{actionBusy === "bulk-pending" ? "Đang khóa/loại…" : `Khóa / loại chờ duyệt (${bulkTargets.length})`}</button></div>
    </div>
    <div className="amv2-view-table devices"><div className="head"><span>Ứng dụng</span><span>Thiết bị</span><span>Người dùng</span><span>Trạng thái</span><span>Hoạt động</span><span>Thao tác</span></div>{devices.map((device) => { const rowBusy = actionBusy === `${device.appId}:${device.deviceId}` || actionBusy === "bulk-pending"; return <div className="row" key={`${device.appId}:${device.deviceId}`}><AppCell appId={device.appId} name={device.appName}/><div><strong>{deviceKind(device)}</strong><small>{device.deviceCode}</small></div><span>{device.userLabel}</span><b>{device.status === "approved" ? "Đã duyệt" : device.status === "pending" ? "Chờ duyệt" : device.status === "blocked" ? "Đã khóa" : "Chưa rõ"}</b><span>{device.active ? "● Online" : relativeTime(device.lastSeenAt)}</span><div>{device.canApprove && device.status === "pending" ? <button disabled={rowBusy} onClick={() => void manageDevice(device, "approve")}>{device.appId === "boi-ech" ? "Phân quyền" : "Duyệt"}</button> : null}{device.canRemove ? <button data-danger="true" disabled={rowBusy} onClick={() => void manageDevice(device, "remove")}>{device.appId === "boi-ech" ? "Xóa" : "Khóa"}</button> : null}<Link href={device.href}>Quản trị</Link></div></div>; })}{!devices.length ? <div className="amv2-empty"><strong>Không tìm thấy thiết bị phù hợp.</strong></div> : null}</div>
  </section>;
}

function AlertsView({ apps, summaryMap, workItems, lastUpdated }: { apps: ApplicationConfig[]; summaryMap: Map<string, OperationsSummary>; workItems: OperationsWorkItem[]; lastUpdated: string }) {
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
