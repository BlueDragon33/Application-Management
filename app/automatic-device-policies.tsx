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

type AutomationAppDraft = {
  autoApprove: boolean;
  autoBlock: boolean;
  pendingBlockAfterHours: number;
};

function initialDrafts(settings: OperationsSettings | undefined) {
  const approved = new Set(settings?.autoApproveAppIds ?? []);
  const blocked = new Set(settings?.autoBlockPendingAppIds ?? []);
  return Object.fromEntries(applicationRegistry.map((app) => [app.id, {
    autoApprove: approved.has(app.id),
    autoBlock: blocked.has(app.id),
    pendingBlockAfterHours: settings?.pendingBlockAfterHoursByApp?.[app.id] ?? 168,
  }])) as Record<string, AutomationAppDraft>;
}

export default function AutomaticDevicePolicies({ settings, busy, close, save }: {
  settings: OperationsSettings | undefined;
  busy: boolean;
  close: () => void;
  save: (selection: AutomationSelection) => void;
}) {
  const [drafts, setDrafts] = useState<Record<string, AutomationAppDraft>>(() => initialDrafts(settings));
  const [days, setDays] = useState(settings?.freeAccessDaysByApp?.["boi-ech"] ?? 60);
  const [limit, setLimit] = useState(settings?.freeDeviceLimitByApp?.["boi-ech"] ?? 20);
  const supported = new Set(settings?.autoApproveSupportedAppIds ?? []);
  const blockSupported = new Set(settings?.autoBlockPendingSupportedAppIds ?? []);
  const unavailableEnabled = (settings?.autoApproveAppIds ?? []).some((id) => !supported.has(id))
    || (settings?.autoBlockPendingAppIds ?? []).some((id) => !blockSupported.has(id));
  const canSave = Boolean(settings) && !busy && (supported.size > 0 || blockSupported.size > 0)
    && Number.isInteger(days) && days >= 1 && days <= 365
    && Number.isInteger(limit) && limit >= 1 && limit <= 1_000;

  function updateDraft(appId: string, patch: Partial<AutomationAppDraft>) {
    setDrafts((current) => ({
      ...current,
      [appId]: { ...(current[appId] ?? { autoApprove: false, autoBlock: false, pendingBlockAfterHours: 168 }), ...patch },
    }));
  }

  function submit() {
    const appIds = applicationRegistry.filter((app) => drafts[app.id]?.autoApprove).map((app) => app.id);
    const autoBlockAppIds = applicationRegistry.filter((app) => drafts[app.id]?.autoBlock).map((app) => app.id);
    const pendingBlockAfterHoursByApp = Object.fromEntries(
      [...blockSupported].map((appId) => [appId, drafts[appId]?.pendingBlockAfterHours ?? 168]),
    ) as Record<string, number>;
    save({ appIds, autoBlockAppIds, pendingBlockAfterHoursByApp, defaultAccessDays: days, defaultDeviceLimit: limit });
  }

  return <div className={styles.scrim} onMouseDown={(event) => { if (event.currentTarget === event.target && !busy) close(); }}>
    <section className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="device-auto-title">
      <header><div><small>KIỂM DUYỆT THIẾT BỊ</small><h2 id="device-auto-title">Quy tắc theo từng ứng dụng</h2></div><button onClick={close} disabled={busy} aria-label="Đóng">×</button></header>
      <p>Mỗi ứng dụng giữ một bản nháp riêng. Bạn có thể thay đổi nhiều ứng dụng cùng lúc; chưa có dữ liệu nào được ghi cho đến khi bấm <strong>Lưu thay đổi</strong>.</p>
      {unavailableEnabled ? <p className={styles.warning}>Quy tắc đang hoạt động của ứng dụng mất kết nối được giữ nguyên và khóa chỉnh sửa. Các ứng dụng còn kết nối vẫn lưu độc lập, không ghi đè lẫn nhau.</p> : null}
      <div className={styles.list}>
        {applicationRegistry.map((app) => {
          const ready = supported.has(app.id);
          const cancellationReady = blockSupported.has(app.id);
          const draft = drafts[app.id] ?? { autoApprove: false, autoBlock: false, pendingBlockAfterHours: 168 };
          return <article key={app.id} className={styles.app}>
            <div className={styles.appTitle}><strong>{app.shortName}</strong><small>{ready || cancellationReady ? "Contract đang hoạt động" : "Chờ contract tự động xử lý"}</small></div>
            <div className={styles.choices}>
              <div className={styles.policyGrid}>
                <label className={styles.field}>
                  <span>{app.id === "boi-ech" ? "Chế độ đăng ký mới" : "Kiểm duyệt thiết bị"}</span>
                  <select
                    aria-label={app.shortName + " - chế độ kiểm duyệt"}
                    value={draft.autoApprove ? "auto" : "manual"}
                    disabled={busy || !ready}
                    onChange={(event) => updateDraft(app.id, { autoApprove: event.target.value === "auto" })}
                  >
                    <option value="manual">{app.id === "boi-ech" ? "Có phí · xác minh thủ công" : "Duyệt thủ công"}</option>
                    <option value="auto">{app.id === "boi-ech" ? "Miễn phí · tự động duyệt" : "Tự động duyệt"}</option>
                  </select>
                  <small>{ready ? (draft.autoApprove ? "Tự động theo policy và registry của chính ứng dụng." : "Giữ yêu cầu chờ quản trị viên xác nhận.") : "Giữ nguyên cấu hình hiện tại cho đến khi contract hoạt động."}</small>
                </label>

                <label className={styles.field}>
                  <span>Yêu cầu chờ quá hạn</span>
                  <select
                    aria-label={app.shortName + " - xử lý quá hạn"}
                    value={draft.autoBlock ? "block" : "keep"}
                    disabled={busy || !cancellationReady}
                    onChange={(event) => updateDraft(app.id, { autoBlock: event.target.value === "block" })}
                  >
                    <option value="keep">Giữ chờ · xử lý thủ công</option>
                    <option value="block">Tự động từ chối & khóa</option>
                  </select>
                  <small>{cancellationReady ? "Khóa yêu cầu pending quá hạn và giữ đầy đủ nhật ký." : app.id === "boi-ech" ? "Không có contract hủy an toàn; không tự xóa thiết bị." : "Chờ contract xử lý quá hạn của ứng dụng."}</small>
                </label>

                <label className={styles.field}>
                  <span>Thời gian chờ</span>
                  <select
                    aria-label={app.shortName + " - thời gian chờ"}
                    value={draft.pendingBlockAfterHours}
                    disabled={busy || !cancellationReady || !draft.autoBlock}
                    onChange={(event) => updateDraft(app.id, { pendingBlockAfterHours: Number(event.target.value) })}
                  >
                    <option value={24}>24 giờ</option>
                    <option value={168}>7 ngày</option>
                    <option value={720}>30 ngày</option>
                  </select>
                  <small>{draft.autoBlock ? "Áp dụng riêng cho ứng dụng này." : "Không áp dụng khi đang giữ chờ thủ công."}</small>
                </label>
              </div>

              {app.id === "boi-ech" ? <div className={styles.limits} data-disabled={!draft.autoApprove || !ready}>
                <label>Thời hạn miễn phí <select value={days} disabled={busy || !ready || !draft.autoApprove} onChange={(event) => setDays(Number(event.target.value))}>{[30, 60, 90, 180, 365].map((value) => <option key={value} value={value}>{value} ngày</option>)}</select></label>
                <label>Tối đa thiết bị <input type="number" min={1} max={1000} value={limit} disabled={busy || !ready || !draft.autoApprove} onChange={(event) => setLimit(Number(event.target.value))}/></label>
                <small>Các thông số này chỉ dùng khi Bơi ếch ở chế độ Miễn phí · tự động duyệt; luồng trả phí vẫn phải xác minh thanh toán.</small>
              </div> : null}

              {app.id !== "boi-ech" && app.id !== "health-care" ? <span className={styles.unavailable}>Thanh toán: chỉ hiển thị khi ứng dụng công bố contract xác minh thanh toán thật.</span> : null}
            </div>
          </article>;
        })}
      </div>
      <footer><button onClick={close} disabled={busy}>Đóng</button><button className={styles.save} disabled={!canSave} onClick={submit}>{busy ? "Đang lưu…" : "Lưu thay đổi"}</button></footer>
    </section>
  </div>;
}
