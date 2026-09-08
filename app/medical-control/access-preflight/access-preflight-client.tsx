"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { signedControlPost, type ControlAccess } from "../../control-device.client";

type Check = {
  key: string;
  label: string;
  status: "pass" | "warn" | "fail";
  blocking: boolean;
  message: string;
};

type Report = {
  deviceId: string;
  deviceCode: string;
  ready: boolean;
  checks: Check[];
};

type Device = {
  deviceId: string;
  deviceCode: string;
  status: "pending" | "approved" | "blocked";
  label: string | null;
  deviceClass: "computer" | "phone" | "tablet" | "unknown";
  lastSeenAt: string;
  profile: {
    personName: string | null;
    personCode: string | null;
    groupName: string | null;
  } | null;
};

type PreflightResponse = {
  actor: ControlAccess;
  integration: {
    overall: "healthy" | "degraded" | "down";
    code: string;
    message: string;
  };
  devices: Device[];
  preflight: Report[];
  summary: { ready: number; blocked: number; warnings: number };
};

type Filter = "all" | "ready" | "blocked" | "warnings";

const classLabel = {
  computer: "Máy tính",
  phone: "Điện thoại",
  tablet: "Máy tính bảng",
  unknown: "Chưa xác định",
} as const;

function formatTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export default function AccessPreflightClient({ user }: { user: { displayName: string; email: string } }) {
  const [data, setData] = useState<PreflightResponse | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const refresh = useCallback(async (quiet = false) => {
    if (!quiet) {
      setLoading(true);
      setError("");
    }
    try {
      const next = await signedControlPost<PreflightResponse>("/api/apps/hoa-nhap-nga/control", { action: "preflight" });
      setData(next);
    } catch (reason) {
      if (!quiet) setError(reason instanceof Error ? reason.message : "Không thể chạy preflight Hòa nhập Nga.");
    } finally {
      if (!quiet) setLoading(false);
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

  async function approve(deviceId: string) {
    setBusyId(deviceId);
    setError("");
    try {
      await signedControlPost("/api/apps/hoa-nhap-nga/control", { action: "approve", deviceId });
      await refresh(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể cấp quyền thiết bị.");
    } finally {
      setBusyId(null);
    }
  }

  const rows = useMemo(() => {
    if (!data) return [];
    const normalized = query.trim().toLocaleLowerCase("vi");
    return data.preflight.map((report) => ({
      report,
      device: data.devices.find((device) => device.deviceId === report.deviceId) || null,
    })).filter(({ report, device }) => {
      const warning = report.checks.some((item) => item.status === "warn");
      if (filter === "ready" && !report.ready) return false;
      if (filter === "blocked" && report.ready) return false;
      if (filter === "warnings" && !warning) return false;
      if (!normalized) return true;
      return [report.deviceCode, device?.label, device?.profile?.personName, device?.profile?.personCode, device?.profile?.groupName]
        .filter(Boolean).join(" ").toLocaleLowerCase("vi").includes(normalized);
    }).sort((a, b) => Number(a.report.ready) - Number(b.report.ready));
  }, [data, filter, query]);

  if (!data) {
    return <main className="preflight-loading"><div><span>HN</span><h1>{error || "Đang chạy preflight cấp quyền…"}</h1><p>Kiểm tra kết nối RU_LIFE, hồ sơ người dùng, phân loại thiết bị và trạng thái registry.</p><button onClick={() => void refresh()} disabled={loading}>Thử lại</button><a href="/medical-control">← Quay lại Hòa nhập Nga</a></div></main>;
  }

  const canApprove = ["publisher", "owner"].includes(data.actor.role);

  return <main className="preflight-shell">
    <aside className="preflight-side">
      <a className="preflight-brand" href="/medical-control"><span>HN</span><div><small>HÒA NHẬP NGA · QUẢN TRỊ</small><strong>Preflight cấp quyền</strong></div></a>
      <nav>
        <button className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}><span>Tất cả</span><b>{data.preflight.length}</b></button>
        <button className={filter === "blocked" ? "active danger" : "danger"} onClick={() => setFilter("blocked")}><span>Đang bị chặn</span><b>{data.summary.blocked}</b></button>
        <button className={filter === "ready" ? "active" : ""} onClick={() => setFilter("ready")}><span>Sẵn sàng duyệt</span><b>{data.summary.ready}</b></button>
        <button className={filter === "warnings" ? "active warn" : "warn"} onClick={() => setFilter("warnings")}><span>Có cảnh báo</span><b>{data.summary.warnings}</b></button>
      </nav>
      <section className={`preflight-integration ${data.integration.overall}`}><span>RU_LIFE</span><strong>{data.integration.overall === "healthy" ? "Kết nối tốt" : "Chưa sẵn sàng"}</strong><p>{data.integration.code}</p></section>
      <div className="preflight-user"><strong>{user.displayName}</strong><span>{data.actor.role}</span></div>
    </aside>

    <section className="preflight-main">
      <header className="preflight-head">
        <div><span>PRE-APPROVAL GATE · RU_LIFE</span><h1>Kiểm tra trước khi cấp quyền</h1><p>Thiết bị chỉ được duyệt khi toàn bộ điều kiện chặn đã PASS. Cảnh báo hoạt động gần đây không tự động chặn nhưng cần quản trị viên lưu ý.</p></div>
        <div><a href="/medical-control/integration-health">Kết nối & phiên →</a><button onClick={() => void refresh()} disabled={loading}>{loading ? "Đang kiểm tra…" : "Chạy lại preflight"}</button></div>
      </header>

      {error ? <div className="preflight-error">{error}</div> : null}

      <section className="preflight-stats">
        <article><span>Tổng thiết bị</span><strong>{data.preflight.length}</strong></article>
        <article className="ok"><span>Sẵn sàng</span><strong>{data.summary.ready}</strong></article>
        <article className={data.summary.blocked ? "bad" : ""}><span>Đang bị chặn</span><strong>{data.summary.blocked}</strong></article>
        <article className={data.summary.warnings ? "warn" : ""}><span>Có cảnh báo</span><strong>{data.summary.warnings}</strong></article>
      </section>

      <section className="preflight-tools"><div><span>HÀNG ĐỢI PRELIGHT</span><h2>{rows.length} thiết bị phù hợp</h2></div><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm mã HN, họ tên, mã người dùng, nhóm…" /></section>

      <section className="preflight-list">
        {rows.map(({ report, device }) => {
          const warnings = report.checks.filter((item) => item.status === "warn").length;
          return <article key={report.deviceId} className={`preflight-card ${report.ready ? "ready" : "blocked"}`}>
            <header><div><strong>{report.deviceCode}</strong><span>{device?.status || "—"}</span></div><b>{report.ready ? "SẴN SÀNG" : "CHƯA ĐƯỢC DUYỆT"}</b></header>
            <section className="preflight-device"><div><h3>{device?.label || device?.profile?.personName || report.deviceCode}</h3><p>{device?.profile?.personName ? `${device.profile.personName}${device.profile.personCode ? ` · ${device.profile.personCode}` : ""}` : "Chưa gắn đầy đủ người sử dụng"}</p></div><span>{device ? classLabel[device.deviceClass] : "—"}</span></section>
            <div className="preflight-checks">
              {report.checks.map((item) => <div key={item.key} className={item.status}><i>{item.status === "pass" ? "✓" : item.status === "warn" ? "!" : "×"}</i><section><strong>{item.label}{item.blocking ? <small> BẮT BUỘC</small> : null}</strong><p>{item.message}</p></section></div>)}
            </div>
            <footer><div><span>{warnings ? `${warnings} cảnh báo` : "Không có cảnh báo"}</span>{device ? <small>Hoạt động {formatTime(device.lastSeenAt)}</small> : null}</div>{canApprove && report.ready && device?.status !== "approved" ? <button onClick={() => void approve(report.deviceId)} disabled={busyId === report.deviceId}>{busyId === report.deviceId ? "Đang cấp…" : "Cấp quyền"}</button> : device?.status === "approved" ? <b>Đã được cấp quyền</b> : null}</footer>
          </article>;
        })}
        {!rows.length ? <div className="preflight-empty">Không có thiết bị phù hợp với bộ lọc hiện tại.</div> : null}
      </section>
    </section>
  </main>;
}
