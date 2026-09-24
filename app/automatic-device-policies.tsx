"use client";

import { useState } from "react";
import { applicationRegistry } from "./application-registry";
import type { OperationsSettings } from "./admin-device-client";
import styles from "./automatic-device-policies.module.css";

export type AutomationSelection = {
  appIds: string[];
  autoBlockAppIds: string[];
  pendingBlockAfterHoursByApp: Record<string, number>;
  defaultAccessDays: number;
  defaultDeviceLimit: number;
};

export default function AutomaticDevicePolicies({ settings, busy, close, save }: {
  settings: OperationsSettings | undefined;
  busy: boolean;
  close: () => void;
  save: (selection: AutomationSelection) => void;
}) {
  const [selected, setSelected] = useState<string[]>(settings?.autoApproveAppIds ?? []);
  const [blocked, setBlocked] = useState<string[]>(settings?.autoBlockPendingAppIds ?? []);
  const [hours, setHours] = useState(settings?.pendingBlockAfterHoursByApp?.["health-care"] ?? 168);
  const [days, setDays] = useState(settings?.freeAccessDaysByApp?.["boi-ech"] ?? 60);
  const [limit, setLimit] = useState(settings?.freeDeviceLimitByApp?.["boi-ech"] ?? 20);
  const supported = new Set(settings?.autoApproveSupportedAppIds ?? []);
  const blockSupported = new Set(settings?.autoBlockPendingSupportedAppIds ?? []);
  const unavailableEnabled = (settings?.autoApproveAppIds ?? []).some((id) => !supported.has(id))
    || (settings?.autoBlockPendingAppIds ?? []).some((id) => !blockSupported.has(id));
  const canSave = Boolean(settings) && !busy && !unavailableEnabled && Number.isInteger(limit) && limit >= 1 && limit <= 1_000;

  function select(appId: string, enabled: boolean) {
    setSelected((current) => enabled ? [...new Set([...current, appId])] : current.filter((id) => id !== appId));
  }

  return <div className={styles.scrim} onMouseDown={(event) => { if (event.currentTarget === event.target && !busy) close(); }}>
    <section className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="device-auto-title">
      <header><div><small>THIẾT BỊ MỚI</small><h2 id="device-auto-title">Tự động xử lý theo ứng dụng</h2></div><button onClick={close} disabled={busy} aria-label="Đóng">×</button></header>
      <p>Quy tắc chỉ lưu sau khi ứng dụng xác nhận và Trung tâm đọc lại trạng thái. Thiết bị trả phí không được mở chỉ vì đã nộp ảnh.</p>
      {unavailableEnabled ? <p className={styles.warning}>Có quy tắc đang bật nhưng client chưa trả lời. Đồng bộ lại trước khi sửa để tránh ghi đè trạng thái chưa xác minh.</p> : null}
      <div className={styles.list}>
        {applicationRegistry.map((app) => {
          const ready = supported.has(app.id);
          const cancellationReady = blockSupported.has(app.id);
          const free = selected.includes(app.id);
          return <article key={app.id} className={styles.app}>
            <div className={styles.appTitle}><strong>{app.shortName}</strong><small>{ready || cancellationReady ? "Contract đang hoạt động" : "Chờ contract tự động xử lý"}</small></div>
            {app.id === "boi-ech" ? <div className={styles.choices}>
              <label><input type="radio" name="boi-auto-mode" checked={!free} disabled={busy || !ready} onChange={() => select(app.id, false)}/><span><strong>Có phí</strong><small>Chỉ mở trả phí sau khi xác minh thanh toán; thời hạn chọn trong Thanh toán & Quyền.</small></span></label>
              <label><input type="radio" name="boi-auto-mode" checked={free} disabled={busy || !ready} onChange={() => select(app.id, true)}/><span><strong>Miễn phí · tự động duyệt</strong><small>Đăng ký mới chưa vào luồng trả phí sẽ được cấp miễn phí theo hạn mức. Yêu cầu đã nộp chứng từ vẫn phải xác minh.</small></span></label>
              {free && ready ? <div className={styles.limits}><label>Thời hạn miễn phí <select value={days} disabled={busy} onChange={(event) => setDays(Number(event.target.value))}>{[30, 60, 90, 180, 365].map((value) => <option key={value} value={value}>{value} ngày</option>)}</select></label><label>Tối đa thiết bị <input type="number" min={1} max={1000} value={limit} disabled={busy} onChange={(event) => setLimit(Number(event.target.value))}/></label></div> : null}
              <span className={styles.unavailable}>Tự động hủy Bơi ếch: chờ contract an toàn; không xóa vĩnh viễn thiết bị.</span>
            </div> : <div className={styles.choices}>
              <label><input type="checkbox" checked={free} disabled={busy || !ready} onChange={(event) => select(app.id, event.target.checked)}/><span><strong>Tự động duyệt</strong><small>{ready ? "Theo quy tắc và registry của chính ứng dụng" : "Chờ contract duyệt tự động"}</small></span></label>
              <label><input type="checkbox" checked={blocked.includes(app.id)} disabled={busy || !cancellationReady} onChange={(event) => setBlocked((current) => event.target.checked ? [...new Set([...current, app.id])] : current.filter((id) => id !== app.id))}/><span><strong>Tự động hủy yêu cầu quá hạn</strong><small>{cancellationReady ? "Khóa pending và giữ nhật ký" : "Chờ contract hủy an toàn"}</small></span></label>
              {cancellationReady && blocked.includes(app.id) ? <label className={styles.delay}>Sau <select value={hours} disabled={busy} onChange={(event) => setHours(Number(event.target.value))}><option value={24}>24 giờ</option><option value={168}>7 ngày</option><option value={720}>30 ngày</option></select></label> : null}
              {app.id !== "health-care" ? <span className={styles.unavailable}>Có phí: chờ contract xác minh thanh toán của ứng dụng.</span> : null}
            </div>}
          </article>;
        })}
      </div>
      <footer><button onClick={close} disabled={busy}>Đóng</button><button className={styles.save} disabled={!canSave} onClick={() => save({ appIds: selected, autoBlockAppIds: blocked, pendingBlockAfterHoursByApp: { "health-care": hours }, defaultAccessDays: days, defaultDeviceLimit: limit })}>{busy ? "Đang lưu…" : "Lưu và kiểm tra lại"}</button></footer>
    </section>
  </div>;
}
