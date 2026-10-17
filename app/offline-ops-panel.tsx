"use client";

import { useEffect, useRef, useState } from "react";
import { localOpsAutoRestart, localOpsPullAll, localOpsRestart, localOpsStart, localOpsStatus, type LocalOpsStatus, type OperatingMode } from "./offline-ops-client";
import "./offline-ops-panel.css";

export default function OfflineOpsPanel({ local, mode, onModeChange }: {
  local: boolean;
  mode: OperatingMode;
  onModeChange: (mode: OperatingMode) => void;
}) {
  const [status, setStatus] = useState<LocalOpsStatus | null>(null);
  const [error, setError] = useState("");
  const [actionInfo, setActionInfo] = useState("");
  const [busy, setBusy] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
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

  if (!local) return <section className="amv2-local-ops" aria-label="Chế độ Offline của Application Management">
    <div className="amv2-local-mode" role="group" aria-label="Môi trường mở ứng dụng">
      <button type="button" data-selected={mode === "offline"} aria-pressed={mode === "offline"} onClick={() => onModeChange("offline")}>◉ Run Offline</button>
      <button type="button" data-selected={mode === "online"} aria-pressed={mode === "online"} onClick={() => onModeChange("online")}>↗ Online · chọn thủ công</button>
    </div>
    <small role="status">Website online không thể tự mở các cổng trên Windows. Để chạy app offline, khởi động Local Ops rồi mở <a href="http://127.0.0.1:3000">App Management localhost:3000</a>. Không tự fallback sang app online.</small>
    <div className="amv2-local-guidance">
      <button type="button" data-blueprint-required="next-action" aria-expanded={guideOpen}
        aria-controls="amv2-blueprint-guide" onClick={() => setGuideOpen((current) => !current)}> ? Hướng dẫn · Next Action </button>
      {guideOpen ? <div id="amv2-blueprint-guide" role="region"><strong>Blueprint OS 1.3.0</strong><p>Phiên website online không được phép điều khiển Local Ops trên Windows. Mở trung tâm trên localhost và giữ runtime chưa kiểm định ở trạng thái BLOCKED.</p></div> : null}
    </div>
  </section>;

  // Explicit pre-warm request; code never claims that an unreviewed child stack is ready.
  async function runAll() {
    if (lock.current || busy || status?.busy || status?.runtime === "running") return;
    lock.current = true;
    setBusy(true);
    setError("");
    setActionInfo("");
    onModeChange("offline");
    try {
      const result = await localOpsStart();
      if (result.runtime !== "starting") throw new Error("Không nhận được trạng thái khởi động từ Local Ops.");
      setActionInfo("Run All đã được yêu cầu. Đang xác minh cổng và SHA; chỉ dùng ứng dụng khi báo sẵn sàng.");
      setStatus(await localOpsStatus());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Run All bị chặn.");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  async function pullAll() {
    if (lock.current || busy || status?.busy) return;
    lock.current = true;
    setBusy(true);
    setError("");
    setActionInfo("");
    try {
      await localOpsPullAll();
      setStatus(await localOpsStatus());
      setActionInfo("Đã gửi yêu cầu Pull origin/main. Xem kết quả của từng repo; không tự ghi đè nhánh có thay đổi.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Pull origin thất bại.");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  async function restartIfSafe() {
    if (lock.current || busy || status?.busy) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      await localOpsRestart();
      setStatus(await localOpsStatus());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Restart bị chặn vì chưa an toàn.");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function tryAutoRestart() {
    if (lock.current || busy || status?.busy) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      await localOpsAutoRestart();
      setStatus(await localOpsStatus());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không thể kiểm tra điều kiện shutdown.");
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
      <button type="button" data-selected={mode === "offline"} aria-pressed={mode === "offline"} onClick={() => onModeChange("offline")}>◉ Run Offline · chọn app</button>
      <button type="button" data-selected={mode === "online"} aria-pressed={mode === "online"} onClick={() => onModeChange("online")}>↗ Online · bản đã publish</button>
    </div>
    {status?.restartRequired ? <small className="amv2-local-error" role="alert">Mã nguồn hoặc runtime chưa được chứng thực. {status.runtimePid ? "Stack cũ còn chạy: phải dừng an toàn trước; không tự ép tắt D1." : "Chỉ khởi động lại khi các cổng 3000–3010 đã được giải phóng."}</small> : null}
    <div className="amv2-local-guidance">
      <button type="button" data-blueprint-required="next-action" aria-expanded={guideOpen}
        aria-controls="amv2-blueprint-guide" onClick={() => setGuideOpen((current) => !current)}>
        ? Hướng dẫn · Next Action
      </button>
      {guideOpen ? <div id="amv2-blueprint-guide" role="region" aria-label="Hướng dẫn Blueprint OS">
        <strong>Blueprint OS 1.3.0 · Hướng dẫn thực hiện</strong>
        <p>Chỉ tiếp tục những bước có bằng chứng thật. Khi shutdown D1, exit, SHA hoặc cổng chưa xác minh, phải giữ BLOCKED; không ép tắt hay tự publish.</p>
        <a href="/?view=audit">Xem bằng chứng và nhật ký →</a>
        <button type="button" onClick={() => void navigator.clipboard?.writeText(
          "Tiếp tục Application-Management PR #360 theo Blueprint OS 1.3.0: xác minh HEAD thật, xử lý blocker ưu tiên, test Windows/D1/exit, ghi bằng chứng; giữ fail-closed, không tự merge/publish/phê duyệt."
        ).catch(() => setError("Không thể sao chép hướng dẫn tự động."))}>Sao chép lệnh tiếp tục</button>
      </div> : null}
    </div>
    <div className="amv2-local-summary">
      <span>{status ? ready + "/" + supported + " runtime local sẵn sàng" : "Chưa kết nối Local Ops"}</span>
      <button type="button" disabled={busy || !status || Boolean(status.busy) || status.runtime === "running" || status.restartRequired}
        onClick={() => void runAll()}>{status?.runtime === "starting" || status?.busy === "starting" ? "▶ Đang Run All…" : status?.runtime === "running" ? "✓ Run All đã mở" : "▶ Run All · mở sẵn"}</button>
      {status?.restartRequired ? <button type="button" disabled={busy || Boolean(status.busy) || Boolean(status.runtimePid)} onClick={() => void restartIfSafe()}>↻ Khởi động lại khi an toàn</button> : null}
      {status?.restartRequired && status.runtimePid ? <button type="button" disabled={busy || Boolean(status.busy)} onClick={() => void tryAutoRestart()}>Kiểm tra điều kiện tự restart</button> : null}
      <button type="button" disabled={busy || !status || Boolean(status.busy)} onClick={() => void pullAll()}>{busy || status?.busy === "pull-all" ? "↻ Đang Pull…" : "↓ Pull origin · tất cả main"}</button>
    </div>
    {status?.sourceVerified ? <small>Đã đối chiếu SHA tại thời điểm khởi động và readback Git · {Object.keys(status.sourceSnapshot ?? {}).length} repo. Không phải chứng thực SHA HTTP từng app.</small> : null}
    {status?.restartControl?.status === "blocked" ? <small role="alert" className="amv2-local-error">Không tự restart: {status.restartControl.reason || "Chưa có bằng chứng drain D1 đầy đủ."}</small> : null}
    {status?.runtime === "blocked" && status.error ? <small role="alert" className="amv2-local-error">Run All BLOCKED: {status.error}</small> : null}
    {actionInfo ? <small role="status">{actionInfo}</small> : null}
    {error ? <small role="alert" className="amv2-local-error">{error}</small> : null}
    {status?.pull ? <details className="amv2-local-pull">
      <summary>{status.pull.status === "running" ? "Đang đồng bộ mã nguồn…" : "Kết quả Pull all"} · {results.length} repo · {updated} cập nhật · {skipped} cần xem</summary>
      <div>{results.map((row) => <p key={row.name}><strong>{row.name}</strong> · {row.state}{row.from ? " · từ " + row.from : ""}{row.sha ? " · HEAD " + row.sha : ""}{row.restartRequired ? " · cần khởi động lại" : ""}{row.reason ? " · " + row.reason : ""}</p>)}</div>
      {status.pull.status === "finished" ? <small>Repo được fast-forward mới nhận mã merge trên origin/main. Nếu runtime đang chạy phải restart an toàn để nhận mã mới; không tắt D1 cưỡng bức.</small> : null}
    </details> : null}
  </section>;
}
