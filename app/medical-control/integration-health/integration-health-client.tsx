"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { signedControlPost, type ControlAccess } from "../../control-device.client";

type Integration = {
  overall: "healthy" | "degraded" | "down";
  checkedAt: string;
  targetUrl: string;
  expectedOrigin: string;
  configuredOrigin: string;
  originMatches: boolean;
  reachable: boolean;
  latencyMs: number | null;
  httpStatus: number | null;
  runtime: string | null;
  protocol: string | null;
  secretHandshake: "ok" | "mismatch" | "unavailable" | "failed";
  capabilities: Record<string, boolean>;
  code: string;
  message: string;
};

type Session = {
  sessionId: string;
  deviceId: string;
  deviceCode: string;
  issuedAt: string;
  expiresAt: number;
  lastSeenAt: string;
  revokedAt: string | null;
  revokeReason: string | null;
  state: "active" | "revoked" | "expired";
};

type Incident = {
  id: number;
  severity: "degraded" | "down";
  code: string;
  message: string;
  targetUrl: string;
  startedAt: string;
  lastSeenAt: string;
  resolvedAt: string | null;
  occurrences: number;
};

type HealthResponse = {
  ok: boolean;
  actor: ControlAccess;
  integration: Integration;
  registry: {
    total: number;
    pending: number;
    approved: number;
    blocked: number;
    active: number;
    activeSessions: number;
    unknownClass: number;
    missingUserProfile: number;
  };
  sessions: Session[];
  incidents: Incident[];
};

const capabilityLabel: Record<string, string> = {
  independentRuntime: "Runtime độc lập",
  deviceRegistration: "Đăng ký thiết bị",
  p256Challenge: "P-256 challenge",
  serverSession: "Session phía server",
  heartbeat: "Heartbeat thiết bị",
  remoteRevocation: "Thu hồi quyền từ xa",
  deviceClassificationSignals: "Tín hiệu phân loại thiết bị",
  pwaBoundary: "Ranh giới PWA riêng",
};

function formatTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatExpiry(value: number) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function overallLabel(value: Integration["overall"]) {
  if (value === "healthy") return "KẾT NỐI TỐT";
  if (value === "degraded") return "CẦN KIỂM TRA";
  return "MẤT KẾT NỐI";
}

function sessionLabel(value: Session["state"]) {
  if (value === "active") return "ĐANG HOẠT ĐỘNG";
  if (value === "revoked") return "ĐÃ THU HỒI";
  return "ĐÃ HẾT HẠN";
}

export default function IntegrationHealthClient({ user }: { user: { displayName: string; email: string } }) {
  const [data, setData] = useState<HealthResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async (quiet = false) => {
    if (!quiet) {
      setLoading(true);
      setError("");
    }
    try {
      const next = await signedControlPost<HealthResponse>("/api/apps/hoa-nhap-nga/health", { action: "health" });
      setData(next);
    } catch (reason) {
      if (!quiet) setError(reason instanceof Error ? reason.message : "Không thể kiểm tra kết nối RU_LIFE.");
    } finally {
      if (!quiet) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const initial = window.setTimeout(() => void refresh(), 0);
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh(true);
    }, 60_000);
    const onVisible = () => { if (document.visibilityState === "visible") void refresh(true); };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh]);

  const capabilities = useMemo(() => {
    if (!data) return [];
    return Object.entries(data.integration.capabilities).map(([key, value]) => ({
      key,
      label: capabilityLabel[key] || key,
      ok: value,
    }));
  }, [data]);

  if (!data) {
    return <main className="health-loading"><div><span>HN</span><h1>{error || "Đang kiểm tra kết nối RU_LIFE…"}</h1><p>Quản trị ứng dụng đang kiểm tra runtime, shared secret, registry thiết bị và phiên quyền.</p><button onClick={() => void refresh()} disabled={loading}>Thử lại</button><a href="/medical-control">← Quay lại Hòa nhập Nga</a></div></main>;
  }

  const integration = data.integration;
  const appBaseUrl = integration.targetUrl.replace(/\/api\/integration\/health$/, "");
  const secretOk = integration.secretHandshake === "ok";
  const openIncidents = data.incidents.filter((incident) => !incident.resolvedAt).length;

  return <main className="health-shell">
    <aside className="health-side">
      <a className="health-brand" href="/medical-control"><span>HN</span><div><small>HÒA NHẬP NGA · QUẢN TRỊ</small><strong>Kiểm tra kết nối</strong></div></a>
      <nav>
        <a className="active" href="/medical-control/integration-health">Kết nối · phiên · sự cố</a>
        <a href="/medical-control/access-preflight">Preflight cấp quyền</a>
        <a href="/medical-control">Thiết bị · người dùng</a>
        <a href="/medical-control/device-classification">Phân loại thiết bị</a>
        <a href={appBaseUrl} target="_blank" rel="noreferrer">Mở RU_LIFE ↗</a>
      </nav>
      <section className="health-side-note"><span>KIỂM TRA 2 CHIỀU</span><p>Không chỉ ping URL. Trung tâm ký challenge bằng shared secret và xác minh proof do RU_LIFE trả lại.</p></section>
      <div className="health-user"><strong>{user.displayName}</strong><span>{data.actor.role}</span></div>
    </aside>

    <section className="health-main">
      <header className="health-head">
        <div><span>APPLICATION MANAGEMENT ↔ RU_LIFE</span><h1>Trạng thái kết nối Hòa nhập Nga</h1><p>{integration.message}</p></div>
        <div className="health-head-actions"><span className={`health-overall ${integration.overall}`}>{overallLabel(integration.overall)}</span><button onClick={() => void refresh()} disabled={loading}>{loading ? "Đang kiểm tra…" : "Kiểm tra lại"}</button></div>
      </header>

      {error ? <div className="health-error">{error}</div> : null}

      <section className="health-grid primary">
        <article className={integration.reachable ? "ok" : "bad"}><span>01 · Runtime RU_LIFE</span><strong>{integration.reachable ? "Online" : "Không phản hồi"}</strong><small>{integration.runtime || "—"} · HTTP {integration.httpStatus ?? "—"} · {integration.latencyMs ?? "—"} ms</small></article>
        <article className={secretOk ? "ok" : "warn"}><span>02 · Shared secret</span><strong>{secretOk ? "Đã xác minh" : integration.secretHandshake}</strong><small>Challenge-response HMAC · không lộ secret ra client</small></article>
        <article className={integration.originMatches ? "ok" : "warn"}><span>03 · Origin cấu hình</span><strong>{integration.originMatches ? "Khớp" : "Không khớp"}</strong><small>{integration.configuredOrigin}</small></article>
        <article className={integration.protocol === "ru-life-control-health-v1" ? "ok" : "warn"}><span>04 · Protocol</span><strong>{integration.protocol || "Chưa nhận"}</strong><small>Mã chẩn đoán: {integration.code}</small></article>
      </section>

      <section className="health-section">
        <header><div><span>NĂNG LỰC RUNTIME</span><h2>Những lớp đã được RU_LIFE công bố</h2></div><small>Cập nhật {formatTime(integration.checkedAt)}</small></header>
        <div className="health-capabilities">
          {capabilities.map((item) => <article key={item.key} className={item.ok ? "ok" : "bad"}><i>{item.ok ? "✓" : "!"}</i><span>{item.label}</span></article>)}
          {!capabilities.length ? <p>Chưa nhận được danh sách capability từ RU_LIFE.</p> : null}
        </div>
      </section>

      <section className="health-section">
        <header><div><span>REGISTRY HÒA NHẬP NGA</span><h2>Thiết bị và phiên quyền do Trung tâm đang giữ</h2></div><a href="/medical-control/access-preflight">Mở preflight →</a></header>
        <div className="health-grid registry">
          <article><span>Tổng thiết bị</span><strong>{data.registry.total}</strong><small>managed_app_devices</small></article>
          <article><span>Thiết bị online</span><strong>{data.registry.active}</strong><small>heartbeat trong 5 phút</small></article>
          <article className={data.registry.activeSessions ? "ok" : ""}><span>Phiên quyền active</span><strong>{data.registry.activeSessions}</strong><small>token quyền chưa hết hạn/thu hồi</small></article>
          <article><span>Chờ duyệt</span><strong>{data.registry.pending}</strong><small>chưa được truy cập</small></article>
          <article><span>Đã cấp quyền</span><strong>{data.registry.approved}</strong><small>được phép challenge</small></article>
          <article><span>Đã khóa</span><strong>{data.registry.blocked}</strong><small>không được tạo phiên</small></article>
          <article className={data.registry.unknownClass ? "warn" : ""}><span>Chưa phân loại</span><strong>{data.registry.unknownClass}</strong><small>cần xác minh loại thiết bị</small></article>
          <article className={data.registry.missingUserProfile ? "warn" : ""}><span>Thiếu hồ sơ người dùng</span><strong>{data.registry.missingUserProfile}</strong><small>không được cấp quyền</small></article>
        </div>
      </section>

      <section className="health-section health-operations">
        <header><div><span>PHIÊN QUYỀN RU_LIFE</span><h2>Access token được Trung tâm phát gần đây</h2></div><small>{data.registry.activeSessions} phiên đang hoạt động</small></header>
        <div className="health-session-list">
          {data.sessions.slice(0, 20).map((session) => <article key={session.sessionId} className={`session-${session.state}`}>
            <div><strong>{session.deviceCode}</strong><span>{sessionLabel(session.state)}</span></div>
            <dl><div><dt>Phát lúc</dt><dd>{formatTime(session.issuedAt)}</dd></div><div><dt>Hết hạn</dt><dd>{formatExpiry(session.expiresAt)}</dd></div><div><dt>Session ID</dt><dd>{session.sessionId.slice(0, 12)}…</dd></div><div><dt>Lý do kết thúc</dt><dd>{session.revokeReason || (session.state === "expired" ? "expired" : "—")}</dd></div></dl>
          </article>)}
          {!data.sessions.length ? <div className="health-empty-ops">Chưa có access session nào được phát.</div> : null}
        </div>
      </section>

      <section className="health-section health-operations">
        <header><div><span>LỊCH SỬ SỰ CỐ KẾT NỐI</span><h2>Chỉ ghi khi RU_LIFE degraded hoặc down</h2></div><small>{openIncidents} sự cố đang mở</small></header>
        <div className="health-incident-list">
          {data.incidents.map((incident) => <article key={incident.id} className={incident.resolvedAt ? "resolved" : incident.severity}>
            <div><strong>{incident.code}</strong><span>{incident.resolvedAt ? "ĐÃ KHÔI PHỤC" : incident.severity === "down" ? "ĐANG MẤT KẾT NỐI" : "ĐANG CẦN KIỂM TRA"}</span></div>
            <p>{incident.message}</p>
            <footer><span>Bắt đầu {formatTime(incident.startedAt)}</span><span>Lặp {incident.occurrences} lần</span><span>{incident.resolvedAt ? `Khôi phục ${formatTime(incident.resolvedAt)}` : `Gần nhất ${formatTime(incident.lastSeenAt)}`}</span></footer>
          </article>)}
          {!data.incidents.length ? <div className="health-empty-ops">Chưa ghi nhận sự cố kết nối RU_LIFE.</div> : null}
        </div>
      </section>

      <section className="health-diagnostic">
        <span>CHI TIẾT CHẨN ĐOÁN</span>
        <dl>
          <div><dt>Endpoint kiểm tra</dt><dd>{integration.targetUrl}</dd></div>
          <div><dt>Origin mong đợi</dt><dd>{integration.expectedOrigin}</dd></div>
          <div><dt>Origin đang cấu hình</dt><dd>{integration.configuredOrigin}</dd></div>
          <div><dt>Mã trạng thái</dt><dd>{integration.code}</dd></div>
          <div><dt>Lần kiểm tra</dt><dd>{formatTime(integration.checkedAt)}</dd></div>
        </dl>
      </section>
    </section>
  </main>;
}
