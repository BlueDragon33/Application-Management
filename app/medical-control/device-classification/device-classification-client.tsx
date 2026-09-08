"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { signedControlPost, type ControlAccess } from "../../control-device.client";

type DeviceClass = "computer" | "phone" | "tablet" | "unknown";
type Filter = "all" | DeviceClass | "needs-review" | "overridden";

type DeviceProfile = {
  personName: string | null;
  personCode: string | null;
  groupName: string | null;
  purpose: string | null;
};

type ManagedDevice = {
  appId: "hoa-nhap-nga";
  deviceId: string;
  deviceCode: string;
  status: "pending" | "approved" | "blocked";
  label: string | null;
  deviceClass: DeviceClass;
  autoDeviceClass: DeviceClass;
  deviceClassOverride: DeviceClass | null;
  classificationConfidence: number;
  classificationSource: string;
  classifierVersion: number;
  classificationDetail: Record<string, unknown>;
  osName: string;
  browserName: string;
  modelHint: string | null;
  screen: string | null;
  createdAt: string;
  lastSeenAt: string;
  active: boolean;
  profile: DeviceProfile | null;
};

type Bootstrap = {
  actor: ControlAccess;
  app: { id: "hoa-nhap-nga"; name: string };
  policy: {
    requireIdentifiedUserBeforeApprove: boolean;
    requireResolvedDeviceClassBeforeApprove: boolean;
    classificationReviewThreshold: number;
  };
  devices: ManagedDevice[];
};

const classLabel: Record<DeviceClass, string> = {
  computer: "Máy tính",
  phone: "Điện thoại",
  tablet: "Máy tính bảng",
  unknown: "Chưa xác định",
};

const statusLabel = {
  pending: "Chờ cấp quyền",
  approved: "Đã cấp quyền",
  blocked: "Đã khóa",
} as const;

function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", year: "numeric" });
}

function signalText(value: unknown) {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Có" : "Không";
  return String(value);
}

function confidenceTone(value: number) {
  if (value >= 90) return "high";
  if (value >= 60) return "medium";
  return "low";
}

export default function DeviceClassificationClient({ user }: { user: { displayName: string; email: string } }) {
  const [data, setData] = useState<Bootstrap | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [lastSync, setLastSync] = useState<string | null>(null);

  const refresh = useCallback(async (quiet = false) => {
    if (!quiet) setError("");
    try {
      const next = await signedControlPost<Bootstrap>("/api/apps/hoa-nhap-nga/control", { action: "bootstrap" });
      setData(next);
      setLastSync(new Date().toISOString());
    } catch (reason) {
      if (!quiet) setError(reason instanceof Error ? reason.message : "Không thể tải dữ liệu phân loại thiết bị.");
    }
  }, []);

  useEffect(() => {
    const initial = window.setTimeout(() => void refresh(), 0);
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh(true);
    }, 60_000);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(interval);
    };
  }, [refresh]);

  async function classify(deviceId: string, deviceClass: "auto" | DeviceClass) {
    setBusyId(deviceId);
    setError("");
    try {
      const next = await signedControlPost<Bootstrap & { ok?: boolean }>("/api/apps/hoa-nhap-nga/control", {
        action: "classify",
        deviceId,
        deviceClass,
      });
      setData(next);
      setLastSync(new Date().toISOString());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể cập nhật phân loại thiết bị.");
    } finally {
      setBusyId(null);
    }
  }

  const canEdit = data ? ["publisher", "owner"].includes(data.actor.role) : false;
  const threshold = data?.policy.classificationReviewThreshold ?? 60;

  const devices = useMemo(() => {
    if (!data) return [];
    const normalized = query.trim().toLocaleLowerCase("vi");
    return data.devices.filter((device) => {
      const needsReview = !device.deviceClassOverride && (device.autoDeviceClass === "unknown" || device.classificationConfidence < threshold);
      const matchesFilter = filter === "all"
        || filter === device.deviceClass
        || (filter === "needs-review" && needsReview)
        || (filter === "overridden" && Boolean(device.deviceClassOverride));
      if (!matchesFilter) return false;
      if (!normalized) return true;
      return [
        device.deviceCode,
        device.label,
        device.osName,
        device.browserName,
        device.modelHint,
        device.profile?.personName,
        device.profile?.personCode,
        device.profile?.groupName,
        device.classificationSource,
      ].filter(Boolean).join(" ").toLocaleLowerCase("vi").includes(normalized);
    }).sort((a, b) => {
      const reviewA = !a.deviceClassOverride && (a.autoDeviceClass === "unknown" || a.classificationConfidence < threshold);
      const reviewB = !b.deviceClassOverride && (b.autoDeviceClass === "unknown" || b.classificationConfidence < threshold);
      if (reviewA !== reviewB) return reviewA ? -1 : 1;
      return a.classificationConfidence - b.classificationConfidence || Date.parse(b.createdAt) - Date.parse(a.createdAt);
    });
  }, [data, filter, query, threshold]);

  if (!data) {
    return <main className="classify-loading"><div><span>HN</span><h1>{error || "Đang tải bộ phân loại thiết bị…"}</h1><a href="/medical-control">← Quay lại Hòa nhập Nga</a></div></main>;
  }

  const computer = data.devices.filter((device) => device.deviceClass === "computer").length;
  const phone = data.devices.filter((device) => device.deviceClass === "phone").length;
  const tablet = data.devices.filter((device) => device.deviceClass === "tablet").length;
  const overridden = data.devices.filter((device) => device.deviceClassOverride).length;
  const needsReview = data.devices.filter((device) => !device.deviceClassOverride && (device.autoDeviceClass === "unknown" || device.classificationConfidence < threshold)).length;

  return <main className="classify-shell">
    <aside className="classify-side">
      <a className="classify-brand" href="/medical-control"><span>HN</span><div><small>HÒA NHẬP NGA · QUẢN TRỊ</small><strong>Phân loại thiết bị</strong></div></a>
      <nav>
        <button className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}><span>Tất cả thiết bị</span><b>{data.devices.length}</b></button>
        <button className={filter === "needs-review" ? "active warn" : "warn"} onClick={() => setFilter("needs-review")}><span>Cần xác minh</span><b>{needsReview}</b></button>
        <button className={filter === "computer" ? "active" : ""} onClick={() => setFilter("computer")}><span>Máy tính</span><b>{computer}</b></button>
        <button className={filter === "phone" ? "active" : ""} onClick={() => setFilter("phone")}><span>Điện thoại</span><b>{phone}</b></button>
        <button className={filter === "tablet" ? "active" : ""} onClick={() => setFilter("tablet")}><span>Máy tính bảng</span><b>{tablet}</b></button>
        <button className={filter === "unknown" ? "active" : ""} onClick={() => setFilter("unknown")}><span>Chưa xác định</span><b>{data.devices.filter((device) => device.deviceClass === "unknown").length}</b></button>
        <button className={filter === "overridden" ? "active" : ""} onClick={() => setFilter("overridden")}><span>Đã chỉnh thủ công</span><b>{overridden}</b></button>
      </nav>
      <section className="classify-boundary"><span>NGUYÊN TẮC</span><p>Phân loại chỉ phục vụ quản trị. Danh tính bảo mật vẫn là khóa P-256 và fingerprint của thiết bị.</p></section>
      <div className="classify-user"><strong>{user.displayName}</strong><span>{data.actor.role}</span></div>
    </aside>

    <section className="classify-main">
      <header className="classify-head">
        <div><span>RU_LIFE → APPLICATION MANAGEMENT</span><h1>Tự động nhận diện và phân loại thiết bị</h1><p>Trung tâm đối chiếu User-Agent, Client Hints, touch, pointer, kích thước màn hình và model. Kết quả tự động được lưu riêng để vẫn nhìn thấy ngay cả khi quản trị viên sửa phân loại thủ công.</p></div>
        <div className="classify-head-actions"><a href="/medical-control">← Thiết bị · người dùng</a><button onClick={() => void refresh()}>{lastSync ? `Cập nhật · ${formatTime(lastSync)}` : "Cập nhật"}</button></div>
      </header>

      {error ? <div className="classify-error">{error}</div> : null}

      <section className="classify-stats">
        <article><span>Máy tính</span><strong>{computer}</strong><small>Desktop / laptop</small></article>
        <article><span>Điện thoại</span><strong>{phone}</strong><small>Phone / mobile</small></article>
        <article><span>Máy tính bảng</span><strong>{tablet}</strong><small>Tablet / iPad</small></article>
        <article className={needsReview ? "attention" : ""}><span>Cần xác minh</span><strong>{needsReview}</strong><small>Unknown hoặc dưới {threshold}%</small></article>
        <article><span>Đã chỉnh thủ công</span><strong>{overridden}</strong><small>Vẫn giữ kết quả tự động</small></article>
      </section>

      <section className="classify-tools">
        <div><span>HÀNG ĐỢI PHÂN LOẠI</span><h2>{devices.length} thiết bị phù hợp</h2></div>
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm mã HN, người dùng, model, OS…" />
      </section>

      <section className="classify-list">
        {devices.map((device) => {
          const review = !device.deviceClassOverride && (device.autoDeviceClass === "unknown" || device.classificationConfidence < threshold);
          const detail = device.classificationDetail || {};
          return <article key={device.deviceId} className={`classify-card ${review ? "needs-review" : ""}`}>
            <header>
              <div className="classify-code"><strong>{device.deviceCode}</strong><span>{statusLabel[device.status]}</span>{device.active ? <b>ONLINE</b> : null}{review ? <em>CẦN XÁC MINH</em> : null}</div>
              <div className={`classify-confidence ${confidenceTone(device.classificationConfidence)}`}><strong>{device.classificationConfidence}%</strong><span>độ tin cậy</span></div>
            </header>

            <div className="classify-title"><div><h3>{device.label || device.profile?.personName || `${classLabel[device.deviceClass]} · ${device.osName}`}</h3><p>{device.profile?.personName ? `${device.profile.personName}${device.profile.personCode ? ` · ${device.profile.personCode}` : ""}` : "Chưa gắn người sử dụng"}</p></div><span className={`class-pill class-${device.deviceClass}`}>{classLabel[device.deviceClass]}</span></div>

            <section className="classify-comparison">
              <div><span>Tự động nhận diện</span><strong>{classLabel[device.autoDeviceClass]}</strong><small>{device.classificationSource} · classifier v{device.classifierVersion}</small></div>
              <i>→</i>
              <div><span>Phân loại đang dùng</span><strong>{classLabel[device.deviceClass]}</strong><small>{device.deviceClassOverride ? "Quản trị viên đã override" : "Theo kết quả tự động"}</small></div>
            </section>

            <dl className="classify-signals">
              <div><dt>OS</dt><dd>{device.osName}</dd></div>
              <div><dt>Browser</dt><dd>{device.browserName}</dd></div>
              <div><dt>Model</dt><dd>{device.modelHint || "—"}</dd></div>
              <div><dt>Màn hình</dt><dd>{device.screen || "—"}</dd></div>
              <div><dt>Platform hint</dt><dd>{signalText(detail.platformHint)}</dd></div>
              <div><dt>Touch points</dt><dd>{signalText(detail.touchPoints)}</dd></div>
              <div><dt>Coarse pointer</dt><dd>{signalText(detail.coarsePointer)}</dd></div>
              <div><dt>Mobile hint</dt><dd>{signalText(detail.mobileHint)}</dd></div>
            </dl>

            <footer>
              <div><small>Đăng ký {formatTime(device.createdAt)}</small><small>Hoạt động {formatTime(device.lastSeenAt)}</small></div>
              <label><span>Phân loại cuối cùng</span><select value={device.deviceClassOverride || "auto"} disabled={!canEdit || busyId === device.deviceId} onChange={(event) => void classify(device.deviceId, event.target.value as "auto" | DeviceClass)}><option value="auto">Tự động · {classLabel[device.autoDeviceClass]}</option><option value="computer">Máy tính</option><option value="phone">Điện thoại</option><option value="tablet">Máy tính bảng</option><option value="unknown">Chưa xác định</option></select></label>
            </footer>
          </article>;
        })}
        {!devices.length ? <div className="classify-empty">Không có thiết bị phù hợp với bộ lọc hiện tại.</div> : null}
      </section>
    </section>
  </main>;
}
