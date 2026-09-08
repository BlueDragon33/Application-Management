"use client";

/* eslint-disable @next/next/no-html-link-for-pages -- full navigation is intentional between independently deployed Sites. */

import { useEffect, useMemo, useState } from "react";
import { signedControlPost, type ControlAccess } from "../control-device.client";
import { integrationRussiaSiteUrl } from "../site-links";

type MedicalBootstrap = {
  actor: ControlAccess;
  stats: { total: number; pending: number; needsDocuments: number; resolved: number };
  rules: { id: string; enabled: boolean; level: number }[];
  reviews: { id: string; status: string; createdAt: string }[];
  meta: { version: string; updatedAt: string; jurisdiction: string };
  auditLog: { id: number; action: string; actor: string; createdAt: string }[];
  error?: string;
};

type ManagedDevice = {
  appId: "hoa-nhap-nga";
  deviceId: string;
  deviceCode: string;
  status: "pending" | "approved" | "blocked";
  label: string | null;
  deviceClass: "computer" | "phone" | "tablet" | "unknown";
  osName: string;
  browserName: string;
  modelHint: string | null;
  screen: string | null;
  createdAt: string;
  approvedAt: string | null;
  blockedAt: string | null;
  lastSeenAt: string;
  approvedBy: string | null;
  active: boolean;
};

type DeviceBootstrap = {
  actor: ControlAccess;
  app: { id: "hoa-nhap-nga"; name: string };
  devices: ManagedDevice[];
  error?: string;
};

type DeviceActionResult = { ok?: boolean; device?: ManagedDevice; devices?: ManagedDevice[]; error?: string };
type TabId = "devices" | "access" | "content" | "rules" | "audit";
type DeviceFilter = "all" | "pending" | "approved" | "blocked" | "online";

const roleLabel = {
  viewer: "Chỉ xem",
  reviewer: "Kiểm duyệt viên",
  publisher: "Người xuất bản",
  owner: "Chủ hệ thống",
} as const;

const deviceClassLabel = {
  computer: "Máy tính",
  phone: "Điện thoại",
  tablet: "Máy tính bảng",
  unknown: "Thiết bị khác",
} as const;

const statusLabel = {
  pending: "Chờ cấp quyền",
  approved: "Đã cấp quyền",
  blocked: "Đã khóa",
} as const;

const navItems: { id: TabId; icon: string; label: string; note: string }[] = [
  { id: "devices", icon: "⌘", label: "Thiết bị · người dùng", note: "Nhận diện và trạng thái" },
  { id: "access", icon: "⌁", label: "Quyền truy cập", note: "Duyệt, thu hồi, khóa" },
  { id: "content", icon: "✦", label: "Kiểm duyệt nội dung", note: "Hàng đợi và quyết định" },
  { id: "rules", icon: "≋", label: "Quy tắc · cảnh báo", note: "Bộ quy tắc đang áp dụng" },
  { id: "audit", icon: "◎", label: "Nhật ký hoạt động", note: "Theo dõi thay đổi" },
];

function formatTime(value: string | null | undefined) {
  if (!value) return "Chưa có";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", year: "numeric" });
}

function deviceTitle(device: ManagedDevice) {
  return device.label || `${deviceClassLabel[device.deviceClass]} · ${device.osName}`;
}

function StatCard({ label, value, note, tone = "default" }: { label: string; value: number | string; note: string; tone?: "default" | "good" | "warn" | "danger" }) {
  return <article className={`russia-stat tone-${tone}`}><span>{label}</span><strong>{value}</strong><small>{note}</small><i aria-hidden="true" /></article>;
}

function DeviceCard({ device, busy, canGrant, onRename, onChange }: {
  device: ManagedDevice;
  busy: boolean;
  canGrant: boolean;
  onRename: (device: ManagedDevice) => void;
  onChange: (deviceId: string, action: "approve" | "block" | "pending") => void;
}) {
  return <article className={`russia-device-card status-${device.status}`}>
    <div className="russia-device-identity">
      <div className="russia-device-code"><strong>{device.deviceCode}</strong><span>{statusLabel[device.status]}</span>{device.active ? <b>ONLINE</b> : null}</div>
      <h3>{deviceTitle(device)}</h3>
      <p>{deviceClassLabel[device.deviceClass]} · {device.osName} · {device.browserName}{device.modelHint ? ` · ${device.modelHint}` : ""}{device.screen ? ` · ${device.screen}` : ""}</p>
      <div className="russia-device-meta"><span>Đăng ký: {formatTime(device.createdAt)}</span><span>Lần cuối: {formatTime(device.lastSeenAt)}</span>{device.approvedBy ? <span>Duyệt bởi: {device.approvedBy}</span> : null}</div>
    </div>
    <div className="russia-device-actions">
      <button onClick={() => onRename(device)} disabled={busy || !canGrant}>Đặt tên</button>
      {device.status !== "approved" ? <button className="approve" onClick={() => onChange(device.deviceId, "approve")} disabled={busy || !canGrant}>Cấp quyền</button> : <button onClick={() => onChange(device.deviceId, "pending")} disabled={busy || !canGrant}>Thu hồi tạm</button>}
      {device.status !== "blocked" ? <button className="danger" onClick={() => onChange(device.deviceId, "block")} disabled={busy || !canGrant}>Khóa</button> : <button onClick={() => onChange(device.deviceId, "pending")} disabled={busy || !canGrant}>Bỏ khóa</button>}
    </div>
  </article>;
}

export default function MedicalControlClient({ user }: { user: { displayName: string; email: string } }) {
  const [data, setData] = useState<MedicalBootstrap | null>(null);
  const [devices, setDevices] = useState<ManagedDevice[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<TabId>("devices");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<DeviceFilter>("all");

  async function refresh() {
    setBusy(true);
    setError("");
    try {
      const [medical, appDevices] = await Promise.all([
        signedControlPost<MedicalBootstrap>("/api/medicine/control", { action: "bootstrap" }),
        signedControlPost<DeviceBootstrap>("/api/apps/hoa-nhap-nga/control", { action: "bootstrap" }),
      ]);
      setData(medical);
      setDevices(appDevices.devices || []);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể tải dữ liệu quản trị Hòa nhập Nga.");
    } finally {
      setBusy(false);
    }
  }

  async function changeDevice(deviceId: string, action: "approve" | "block" | "pending") {
    setBusy(true);
    setError("");
    try {
      const next = await signedControlPost<DeviceActionResult>("/api/apps/hoa-nhap-nga/control", { action, deviceId });
      if (next.devices) setDevices(next.devices);
      else await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể cập nhật quyền thiết bị.");
    } finally {
      setBusy(false);
    }
  }

  async function renameDevice(device: ManagedDevice) {
    const label = window.prompt("Tên gợi nhớ cho thiết bị", device.label || "");
    if (label === null) return;
    setBusy(true);
    setError("");
    try {
      const next = await signedControlPost<DeviceActionResult>("/api/apps/hoa-nhap-nga/control", { action: "label", deviceId: device.deviceId, label });
      if (next.devices) setDevices(next.devices);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể đổi tên thiết bị.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(timer);
  }, []);

  const filteredDevices = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("vi");
    return devices.filter((device) => {
      const filterMatch = filter === "all" || (filter === "online" ? device.active : device.status === filter);
      if (!filterMatch) return false;
      if (!normalized) return true;
      return [device.deviceCode, device.label, device.osName, device.browserName, device.modelHint, device.deviceClass]
        .filter(Boolean).join(" ").toLocaleLowerCase("vi").includes(normalized);
    });
  }, [devices, filter, query]);

  if (!data) return <main className="russia-loading"><div><span>HN</span><h1>{error || "Đang xác thực khu quản trị Hòa nhập Nga…"}</h1><a href="/">← QUẢN TRỊ ỨNG DỤNG</a></div></main>;

  const canGrant = ["publisher", "owner"].includes(data.actor.role);
  const pendingDevices = devices.filter((device) => device.status === "pending");
  const approvedDevices = devices.filter((device) => device.status === "approved");
  const blockedDevices = devices.filter((device) => device.status === "blocked");
  const onlineDevices = devices.filter((device) => device.active);
  const computerDevices = devices.filter((device) => device.deviceClass === "computer");
  const mobileDevices = devices.filter((device) => device.deviceClass === "phone" || device.deviceClass === "tablet");
  const unnamedDevices = devices.filter((device) => !device.label);
  const enabledRules = data.rules.filter((rule) => rule.enabled);
  const highRiskRules = enabledRules.filter((rule) => rule.level >= 4);
  const waitingReviews = data.reviews.filter((review) => ["pending", "needs_documents"].includes(review.status));
  const latestAudit = data.auditLog.slice(0, 30);

  const tabHeading: Record<TabId, { eyebrow: string; title: string; description: string }> = {
    devices: { eyebrow: "HÒA NHẬP NGA · QUẢN TRỊ", title: "Thiết bị và người dùng", description: "Kiểm soát thiết bị được phép vào Site Hòa nhập Nga. Site không có màn hình đăng nhập riêng; quyền được quyết định tại đây theo thiết bị HN." },
    access: { eyebrow: "HÒA NHẬP NGA · QUYỀN", title: "Quyền truy cập", description: "Duyệt, thu hồi hoặc khóa quyền theo từng thiết bị. Thiết bị quản trị và thiết bị Hòa nhập Nga là hai miền quyền độc lập." },
    content: { eyebrow: "HÒA NHẬP NGA · KIỂM DUYỆT", title: "Kiểm duyệt nội dung", description: "Theo dõi hàng đợi cần quyết định, trạng thái hồ sơ và điều phối sang Trung tâm kiểm duyệt chuyên sâu." },
    rules: { eyebrow: "HÒA NHẬP NGA · QUY TẮC", title: "Quy tắc và cảnh báo", description: "Tổng hợp bộ quy tắc đang bật, mức rủi ro và phiên bản dữ liệu dùng để kiểm duyệt nội dung liên quan đến Nga." },
    audit: { eyebrow: "HÒA NHẬP NGA · NHẬT KÝ", title: "Nhật ký hoạt động", description: "Theo dõi các thay đổi quản trị để truy vết ai đã thao tác, vào thời điểm nào và trên phạm vi nào." },
  };

  return <main className="russia-admin-shell">
    <aside className="russia-sidebar">
      <a className="russia-brand" href="/"><span>HN</span><div><small>QUẢN TRỊ ỨNG DỤNG</small><strong>Hòa nhập Nga</strong></div></a>
      <nav className="russia-nav" aria-label="Quản trị Hòa nhập Nga">
        {navItems.map((item) => <button key={item.id} className={tab === item.id ? "active" : ""} onClick={() => setTab(item.id)}><i>{item.icon}</i><span><strong>{item.label}</strong><small>{item.note}</small></span></button>)}
      </nav>

      <div className="russia-sidebar-links"><span>LIÊN KẾT RÕ RÀNG</span><a href="/"><b>←</b><div><strong>Quản trị ứng dụng</strong><small>Điều phối các Site</small></div></a><a href="/system-control"><b>⚙</b><div><strong>Hệ thống dùng chung</strong><small>Tài khoản, quyền, nhật ký</small></div></a><a href={integrationRussiaSiteUrl} target="_blank" rel="noreferrer"><b>↗</b><div><strong>Mở Hòa nhập Nga</strong><small>Site người dùng độc lập</small></div></a></div>

      <div className="russia-account"><span>{user.displayName.slice(0, 1).toUpperCase()}</span><div><strong>{user.displayName}</strong><small>{roleLabel[data.actor.role]}</small><a href="/logout?return_to=/login">Đăng xuất</a></div></div>
    </aside>

    <section className="russia-workspace">
      <header className="russia-toolbar"><div className="russia-toolbar-links"><a href="/">← QUẢN TRỊ ỨNG DỤNG</a><a href="/system-control">Hệ thống dùng chung</a></div></header>

      <div className="russia-content">
        <section className="russia-page-head">
          <div><span>{tabHeading[tab].eyebrow}</span><h1>{tabHeading[tab].title}</h1><p>{tabHeading[tab].description}</p></div>
          <div className="russia-sync"><span><i /> ĐÃ ĐỒNG BỘ · THỦ CÔNG</span><button onClick={() => void refresh()} disabled={busy}>{busy ? "Đang cập nhật…" : "Cập nhật thiết bị"}</button></div>
        </section>

        {error ? <div className="russia-alert">{error}</div> : null}

        {tab === "devices" ? <>
          <section className="russia-stat-grid">
            <StatCard label="Tổng thiết bị" value={devices.length} note="Registry Hòa nhập Nga" />
            <StatCard label="Online" value={onlineDevices.length} note="Tín hiệu trong 5 phút" tone="good" />
            <StatCard label="Chờ cấp quyền" value={pendingDevices.length} note="Cần Publisher/Owner xử lý" tone="warn" />
            <StatCard label="Đã cấp quyền" value={approvedDevices.length} note="Có thể xác thực vào Site" tone="good" />
            <StatCard label="Máy tính" value={computerDevices.length} note="Windows · macOS · Linux…" />
            <StatCard label="Điện thoại / tablet" value={mobileDevices.length} note="Thiết bị di động đã nhận diện" />
            <StatCard label="Đã khóa" value={blockedDevices.length} note="Không thể lấy phiên mới" tone="danger" />
            <StatCard label="Chưa đặt tên" value={unnamedDevices.length} note="Nên đặt tên để dễ kiểm soát" tone={unnamedDevices.length ? "warn" : "default"} />
            <StatCard label="Kiểm duyệt chờ" value={waitingReviews.length} note="Nội dung cần quyết định" tone={waitingReviews.length ? "warn" : "default"} />
          </section>

          <section className="russia-inbox">
            <div className="russia-inbox-title"><span>HỘP VIỆC HÒA NHẬP NGA</span><strong>Ưu tiên những việc đang chờ quyết định</strong></div>
            <button onClick={() => { setFilter("pending"); setQuery(""); }}><span>Thiết bị chờ duyệt</span><strong>{pendingDevices.length}</strong></button>
            <button onClick={() => { setFilter("all"); setQuery(""); }}><span>Chưa đặt tên</span><strong>{unnamedDevices.length}</strong></button>
            <button onClick={() => setTab("content")}><span>Kiểm duyệt nội dung</span><strong>{waitingReviews.length}</strong></button>
            <button onClick={() => setTab("rules")}><span>Quy tắc mức cao</span><strong>{highRiskRules.length}</strong></button>
          </section>

          <section className="russia-device-panel">
            <div className="russia-panel-head"><div><span>TRA CỨU THIẾT BỊ HN</span><h2>Danh sách đang có luôn được giữ ổn định</h2><p>Tìm theo mã HN, tên gợi nhớ, hệ điều hành, trình duyệt hoặc model. Thiết bị mới chỉ xuất hiện sau khi Site Hòa nhập Nga gửi yêu cầu đăng ký.</p></div><div className="russia-search"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="HN-… / tên thiết bị / Windows / iPhone…"/><select value={filter} onChange={(event) => setFilter(event.target.value as DeviceFilter)}><option value="all">Tất cả</option><option value="pending">Chờ cấp quyền</option><option value="approved">Đã cấp quyền</option><option value="blocked">Đã khóa</option><option value="online">Đang online</option></select></div></div>
            <div className="russia-result-summary"><span>Hiển thị <b>{filteredDevices.length}</b> / {devices.length} thiết bị</span><small>Mã HN là định danh theo khóa thiết bị; thông tin OS/browser chỉ hỗ trợ nhận diện.</small></div>
            <div className="russia-device-list">{filteredDevices.length ? filteredDevices.map((device) => <DeviceCard key={device.deviceId} device={device} busy={busy} canGrant={canGrant} onRename={(item) => void renameDevice(item)} onChange={(id, action) => void changeDevice(id, action)} />) : <div className="russia-empty">Không có thiết bị phù hợp với bộ lọc hiện tại.</div>}</div>
            {!canGrant ? <p className="russia-role-note">Tài khoản hiện tại chỉ được xem. Cấp/thu hồi quyền thiết bị cần Publisher hoặc Owner.</p> : null}
          </section>
        </> : null}

        {tab === "access" ? <>
          <section className="russia-stat-grid compact">
            <StatCard label="Chờ cấp quyền" value={pendingDevices.length} note="Yêu cầu mới" tone="warn" />
            <StatCard label="Đã cấp quyền" value={approvedDevices.length} note="Thiết bị hợp lệ" tone="good" />
            <StatCard label="Đã khóa" value={blockedDevices.length} note="Bị từ chối phiên mới" tone="danger" />
            <StatCard label="Online" value={onlineDevices.length} note="Có tín hiệu gần đây" tone="good" />
          </section>
          <section className="russia-policy-grid">
            <article><span>01</span><div><strong>Thiết bị tự đăng ký</strong><p>Hòa nhập Nga tạo khóa P-256 trên thiết bị và gửi khóa công khai về Site Quản trị. Trạng thái ban đầu luôn là chờ duyệt.</p></div></article>
            <article><span>02</span><div><strong>Duyệt tại Trung tâm</strong><p>Publisher/Owner quyết định cấp quyền, thu hồi tạm hoặc khóa. Không có màn hình đăng nhập trực tiếp trên Hòa nhập Nga.</p></div></article>
            <article><span>03</span><div><strong>Xác thực đúng thiết bị</strong><p>Thiết bị đã được duyệt phải ký challenge bằng khóa riêng cục bộ trước khi nhận access token ngắn hạn.</p></div></article>
            <article><span>04</span><div><strong>Ranh giới độc lập</strong><p>`control_devices` của Site Quản trị không thay thế `managed_app_devices` của Hòa nhập Nga. Hai miền quyền không kế thừa lẫn nhau.</p></div></article>
          </section>
          <section className="russia-device-panel"><div className="russia-panel-head"><div><span>HÀNG ĐỢI CẤP QUYỀN</span><h2>{pendingDevices.length ? `${pendingDevices.length} thiết bị đang chờ quyết định` : "Không có thiết bị chờ duyệt"}</h2><p>Chỉ cấp quyền khi đã nhận diện được thiết bị và mục đích sử dụng.</p></div></div><div className="russia-device-list">{pendingDevices.length ? pendingDevices.map((device) => <DeviceCard key={device.deviceId} device={device} busy={busy} canGrant={canGrant} onRename={(item) => void renameDevice(item)} onChange={(id, action) => void changeDevice(id, action)} />) : <div className="russia-empty">Hàng đợi hiện trống.</div>}</div></section>
        </> : null}

        {tab === "content" ? <>
          <section className="russia-stat-grid compact"><StatCard label="Tổng hồ sơ" value={data.stats.total} note="Đã ghi nhận" /><StatCard label="Đang chờ" value={data.stats.pending} note="Cần kiểm duyệt" tone="warn" /><StatCard label="Cần bổ sung" value={data.stats.needsDocuments} note="Thiếu căn cứ/hồ sơ" tone="warn" /><StatCard label="Đã xử lý" value={data.stats.resolved} note="Đã có quyết định" tone="good" /></section>
          <section className="russia-review-panel"><div><span>TRUNG TÂM KIỂM DUYỆT</span><h2>Quyết định nội dung tách khỏi quyền thiết bị</h2><p>Quyền vào Site Hòa nhập Nga và việc duyệt nội dung là hai quy trình khác nhau. Thiết bị được phép truy cập không đồng nghĩa được phép xuất bản hoặc sửa nội dung máy chủ.</p><a href="/medicine-control">Mở Trung tâm kiểm duyệt →</a></div><aside><small>Bộ dữ liệu</small><strong>{data.meta.version}</strong><span>{data.meta.jurisdiction}</span><span>Cập nhật {data.meta.updatedAt}</span></aside></section>
          <section className="russia-list-panel"><header><span>HỒ SƠ GẦN ĐÂY</span><h2>{data.reviews.length} hồ sơ trong dữ liệu hiện tại</h2></header><div className="russia-simple-list">{data.reviews.slice(0, 20).map((review) => <article key={review.id}><div><strong>{review.id}</strong><small>{formatTime(review.createdAt)}</small></div><span className={`review-${review.status}`}>{review.status}</span></article>)}{!data.reviews.length ? <div className="russia-empty">Chưa có hồ sơ kiểm duyệt.</div> : null}</div></section>
        </> : null}

        {tab === "rules" ? <>
          <section className="russia-stat-grid compact"><StatCard label="Tổng quy tắc" value={data.rules.length} note="Trong bộ dữ liệu" /><StatCard label="Đang bật" value={enabledRules.length} note="Được áp dụng" tone="good" /><StatCard label="Mức 4–5" value={highRiskRules.length} note="Cần chú ý cao" tone={highRiskRules.length ? "warn" : "default"} /><StatCard label="Phiên bản" value={data.meta.version} note={`Cập nhật ${data.meta.updatedAt}`} /></section>
          <section className="russia-list-panel"><header><span>BỘ QUY TẮC ĐANG ÁP DỤNG</span><h2>Ưu tiên minh bạch trạng thái và mức rủi ro</h2><p>Mỗi quy tắc chỉ có hiệu lực khi đang bật. Các quyết định nội dung cần bám theo nguồn và phiên bản dữ liệu tương ứng.</p></header><div className="russia-rule-grid">{data.rules.map((rule) => <article key={rule.id} className={rule.enabled ? "enabled" : "disabled"}><div><strong>{rule.id}</strong><span>{rule.enabled ? "ĐANG BẬT" : "ĐANG TẮT"}</span></div><b>Mức {rule.level}</b><small>{rule.level >= 4 ? "Ưu tiên kiểm tra thủ công" : "Theo quy trình chuẩn"}</small></article>)}</div></section>
        </> : null}

        {tab === "audit" ? <>
          <section className="russia-stat-grid compact"><StatCard label="Sự kiện gần đây" value={latestAudit.length} note="Đang hiển thị" /><StatCard label="Người quản trị" value={user.displayName} note={roleLabel[data.actor.role]} /><StatCard label="Thiết bị HN" value={devices.length} note="Registry độc lập" /><StatCard label="Trạng thái" value="Theo dõi" note="Không xóa dấu vết thao tác" tone="good" /></section>
          <section className="russia-list-panel"><header><span>NHẬT KÝ HÒA NHẬP NGA</span><h2>Truy vết thay đổi quản trị</h2><p>Nhật ký dùng để đối chiếu thao tác cấp quyền, kiểm duyệt và thay đổi cấu hình. Hệ thống dùng chung vẫn quản lý nhật ký cấp hệ thống.</p></header><div className="russia-audit-list">{latestAudit.map((item) => <article key={item.id}><span>#{item.id}</span><div><strong>{item.action}</strong><small>{item.actor}</small></div><time>{formatTime(item.createdAt)}</time></article>)}{!latestAudit.length ? <div className="russia-empty">Chưa có sự kiện trong phạm vi đang tải.</div> : null}</div><a className="russia-system-link" href="/system-control">Mở Hệ thống dùng chung →</a></section>
        </> : null}

        <section className="russia-boundary"><div><span>RANH GIỚI BẮT BUỘC</span><strong>Hòa nhập Nga là Site độc lập; Trung tâm này chỉ quản trị.</strong><p>Không đưa runtime, đăng nhập người dùng hoặc PWA của Hòa nhập Nga trở lại Site Quản trị. Mọi quyền truy cập phải đi qua registry thiết bị HN.</p></div><a href={integrationRussiaSiteUrl} target="_blank" rel="noreferrer">Mở Site Hòa nhập Nga ↗</a></section>
      </div>
    </section>
  </main>;
}