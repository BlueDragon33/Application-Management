"use client";

import { useEffect, useRef, useState } from "react";
import { localOpsPullAll, localOpsStatus, type LocalOpsStatus, type OperatingMode } from "./offline-ops-client";
import "./offline-ops-panel.css";

export default function OfflineOpsPanel({ local, mode, onModeChange }: {
  local: boolean;
  mode: OperatingMode;
  onModeChange: (mode: OperatingMode) => void;
}) {
  const [status, setStatus] = useState<LocalOpsStatus | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);

  useEffect(() => {
    if (!local) return;
    let active = true;
    const refresh = async () => {
      try {
        const next = await localOpsStatus();
        if (active) { setStatus(next); setError(""); }
      } catch (caught) {
        if (active) { setStatus(null); setError(caught instanceof Error ? caught.message : "Local Ops không phản hồi."); }
      }
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 3500);
    return () => { active = false; window.clearInterval(timer); };
  }, [local]);

  if (!local) return null;

  async function pullAll() {
    if (lock.current || busy || status?.busy) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      await localOpsPullAll();
      setStatus(await localOpsStatus());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Pull all thất bại.");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  const ready = status?.apps.filter((app) => app.ready).length ?? 0;
  const supported = status?.apps.filter((app) => Boolean(app.port)).length ?? 0;
  const results = status?.pull?.results ?? [];
  const updated = results.filter((row) => row.state === "updated").length;
  const skipped = results.filter((row) => row.state === "skipped" || row.state === "error").length;

  return <section className="amv2-local-ops" aria-label="Điều khiển Offline và Online">
    <div className="amv2-local-mode" role="group" aria-label="Môi trường mở ứng dụng">
      <button type="button" data-selected={mode === "offline"} aria-pressed={mode === "offline"} onClick={() => onModeChange("offline")}>◉ Offline · main đã Pull</button>
      <button type="button" data-selected={mode === "online"} aria-pressed={mode === "online"} onClick={() => onModeChange("online")}>↗ Online · bản đã publish</button>
    </div>
    {status?.restartRequired ? <small className="amv2-local-error" role="alert">Mã nguồn đã cập nhật nhưng runtime đang chạy bản cũ. Hãy đóng và mở lại START_BAUMANWEB.vbs sau khi dừng stack cũ; không coi trạng thái HTTP 200 là phiên bản mới.</small> : null}
    <div className="amv2-local-summary">
      <span>{status ? ready + "/" + supported + " runtime local sẵn sàng" : "Chưa kết nối Local Ops"}</span>
      <button type="button" disabled={busy || !status || Boolean(status.busy)} onClick={() => void pullAll()}>{busy || status?.busy === "pull-all" ? "↻ Đang Pull…" : "↓ Pull all"}</button>
    </div>
    {error ? <small role="status" className="amv2-local-error">{error}</small> : null}
    {status?.pull ? <details className="amv2-local-pull">
      <summary>{status.pull.status === "running" ? "Đang đồng bộ mã nguồn…" : "Kết quả Pull all"} · {results.length} repo · {updated} cập nhật · {skipped} cần xem</summary>
      <div>{results.map((row) => <p key={row.name}><strong>{row.name}</strong> · {row.state}{row.from ? " · từ " + row.from : ""}{row.sha ? " · HEAD " + row.sha : ""}{row.restartRequired ? " · cần khởi động lại" : ""}{row.reason ? " · " + row.reason : ""}</p>)}</div>
      {status.pull.status === "finished" ? <small>Các runtime đang chạy phải khởi động lại để sử dụng code mới; không tự ý hot reload production.</small> : null}
    </details> : null}
  </section>;
}
