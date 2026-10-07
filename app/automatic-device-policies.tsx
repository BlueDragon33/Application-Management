"use client";

import { useState } from "react";
import type { OperationsAutomationPolicy, OperationsSettings } from "./admin-device-client";
import styles from "./automatic-device-policies.module.css";

export type AutomationSelection = {
  appIds: string[];
  autoBlockAppIds: string[];
  pendingBlockAfterHoursByApp: Record<string, number>;
  defaultAccessDays: number;
  defaultDeviceLimit: number;
};

type AutomationApp = {
  id: string;
  shortName: string;
};

type AutomationAppDraft = {
  autoApprove: boolean;
  autoBlock: boolean;
  pendingBlockAfterHours: number;
};

function policyFor(settings: OperationsSettings | undefined, appId: string): OperationsAutomationPolicy {
  const explicit = settings?.automationPolicies?.find((policy) => policy.appId === appId);
  if (explicit) return explicit;
  const autoApproveSupported = settings?.autoApproveSupportedAppIds.includes(appId) ?? false;
  const autoBlockSupported = settings?.autoBlockPendingSupportedAppIds?.includes(appId) ?? false;
  const live = autoApproveSupported || autoBlockSupported;
  return {
    appId,
    support: {
      autoApprove: autoApproveSupported,
      autoBlockPending: autoBlockSupported,
      freeAccessPolicy: appId === "boi-ech" && autoApproveSupported,
    },
    current: {
      autoApprove: settings?.autoApproveAppIds.includes(appId),
      autoBlockPending: settings?.autoBlockPendingAppIds?.includes(appId),
      pendingBlockAfterHours: settings?.pendingBlockAfterHoursByApp?.[appId],
      freeAccessDays: settings?.freeAccessDaysByApp?.[appId],
      freeDeviceLimit: settings?.freeDeviceLimitByApp?.[appId],
    },
    verification: {
      state: live ? "live" : "unsupported",
      source: live ? "legacy operations settings" : "managed-app inventory",
      errorCode: live ? undefined : "AUTOMATION_CONTRACT_NOT_PUBLISHED",
    },
    mutation: {
      autoApprove: autoApproveSupported,
      autoBlockPending: autoBlockSupported,
      reason: live ? undefined : "Ứng dụng chưa công bố contract automation có readback.",
    },
  };
}

function initialDrafts(apps: readonly AutomationApp[], settings: OperationsSettings | undefined) {
  return Object.fromEntries(apps.map((app) => {
    const policy = policyFor(settings, app.id);
    return [app.id, {
      autoApprove: policy.current.autoApprove === true,
      autoBlock: policy.current.autoBlockPending === true,
      pendingBlockAfterHours: policy.current.pendingBlockAfterHours ?? 168,
    }];
  })) as Record<string, AutomationAppDraft>;
}

function verificationLabel(policy: OperationsAutomationPolicy) {
  if (policy.verification.state === "live") return "LIVE";
  if (policy.verification.state === "fallback") return "LAST KNOWN";
  if (policy.verification.state === "unavailable") return "UNAVAILABLE";
  return "READ-ONLY";
}

function approvalLabel(policy: OperationsAutomationPolicy, appId: string) {
  if (!policy.support.autoApprove) return "Không hỗ trợ";
  if (policy.current.autoApprove === undefined) return "Chưa xác minh";
  if (appId === "boi-ech") return policy.current.autoApprove ? "Miễn phí · tự động duyệt" : "Có phí · xác minh thủ công";
  return policy.current.autoApprove ? "Tự động duyệt" : "Duyệt thủ công";
}

function expirationLabel(policy: OperationsAutomationPolicy) {
  if (!policy.support.autoBlockPending) return "Không hỗ trợ";
  if (policy.current.autoBlockPending === undefined) return "Chưa xác minh";
  if (!policy.current.autoBlockPending) return "Giữ chờ · thủ công";
  const hours = policy.current.pendingBlockAfterHours ?? 168;
  return hours === 24 ? "Từ chối & khóa sau 24 giờ" : hours === 720 ? "Từ chối & khóa sau 30 ngày" : "Từ chối & khóa sau 7 ngày";
}

export default function AutomaticDevicePolicies({ apps, settings, busy, close, save }: {
  apps: readonly AutomationApp[];
  settings: OperationsSettings | undefined;
  busy: boolean;
  close: () => void;
  save: (selection: AutomationSelection) => void;
}) {
  const [drafts, setDrafts] = useState<Record<string, AutomationAppDraft>>(() => initialDrafts(apps, settings));
  const boiPolicy = policyFor(settings, "boi-ech");
  const [days, setDays] = useState(boiPolicy.current.freeAccessDays ?? settings?.freeAccessDaysByApp?.["boi-ech"] ?? 60);
  const [limit, setLimit] = useState(boiPolicy.current.freeDeviceLimit ?? settings?.freeDeviceLimitByApp?.["boi-ech"] ?? 20);
  const policies = apps.map((app) => policyFor(settings, app.id));
  const hasWritablePolicy = policies.some((policy) => policy.mutation.autoApprove || policy.mutation.autoBlockPending);
  const hasUnverifiedPolicy = policies.some((policy) => policy.verification.state === "fallback" || policy.verification.state === "unavailable");
  const canSave = Boolean(settings) && !busy && hasWritablePolicy
    && Number.isInteger(days) && days >= 1 && days <= 365
    && Number.isInteger(limit) && limit >= 1 && limit <= 1_000;

  function updateDraft(appId: string, patch: Partial<AutomationAppDraft>) {
    setDrafts((current) => ({
      ...current,
      [appId]: { ...(current[appId] ?? { autoApprove: false, autoBlock: false, pendingBlockAfterHours: 168 }), ...patch },
    }));
  }

  function submit() {
    const appIds = apps.filter((app) => drafts[app.id]?.autoApprove).map((app) => app.id);
    const autoBlockAppIds = apps.filter((app) => drafts[app.id]?.autoBlock).map((app) => app.id);
    const pendingBlockAfterHoursByApp = Object.fromEntries(
      apps.map((app) => [app.id, drafts[app.id]?.pendingBlockAfterHours ?? 168]),
    ) as Record<string, number>;
    save({ appIds, autoBlockAppIds, pendingBlockAfterHoursByApp, defaultAccessDays: days, defaultDeviceLimit: limit });
  }

  return <div className={styles.scrim} onMouseDown={(event) => { if (event.currentTarget === event.target && !busy) close(); }}>
    <section className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="device-auto-title">
      <header><div><small>KIỂM DUYỆT THIẾT BỊ</small><h2 id="device-auto-title">Quy tắc theo từng ứng dụng</h2></div><button onClick={close} disabled={busy} aria-label="Đóng">×</button></header>
      <p><strong>Đang áp dụng</strong> luôn lấy từ policy đã được client xác minh hoặc được ghi rõ là bản gần nhất. Phần <strong>Thay đổi</strong> chỉ là bản nháp cho tới khi bạn bấm Lưu thay đổi.</p>
      {hasUnverifiedPolicy ? <p className={styles.warning}>Một số ứng dụng chưa đọc được policy live. Giá trị LAST KNOWN chỉ để tham chiếu và bị khóa chỉnh sửa cho tới khi contract live được xác minh lại.</p> : null}
      <div className={styles.list}>
        {apps.map((app) => {
          const policy = policyFor(settings, app.id);
          const draft = drafts[app.id] ?? { autoApprove: false, autoBlock: false, pendingBlockAfterHours: 168 };
          const approveWritable = policy.mutation.autoApprove;
          const blockWritable = policy.mutation.autoBlockPending;
          return <article key={app.id} className={styles.app}>
            <div className={styles.appTitle}>
              <strong>{app.shortName}</strong>
              <small>{policy.verification.source}</small>
              <b className={styles.verificationBadge} data-state={policy.verification.state}>{verificationLabel(policy)}</b>
            </div>
            <div className={styles.choices}>
              <div className={styles.applied}>
                <div><span>Đang áp dụng · kiểm duyệt</span><strong>{approvalLabel(policy, app.id)}</strong></div>
                <div><span>Đang áp dụng · quá hạn</span><strong>{expirationLabel(policy)}</strong></div>
                {app.id === "boi-ech" && policy.support.freeAccessPolicy ? <div><span>Miễn phí hiện tại</span><strong>{policy.current.freeAccessDays ?? "—"} ngày · tối đa {policy.current.freeDeviceLimit ?? "—"} thiết bị</strong></div> : null}
                <small>{policy.verification.state === "live"
                  ? "Đã đọc trực tiếp từ client."
                  : policy.mutation.reason ?? policy.verification.errorCode ?? "Chưa có policy live để xác minh."}</small>
              </div>

              <div className={styles.sectionTitle}>Thay đổi</div>
              <div className={styles.policyGrid}>
                <label className={styles.field}>
                  <span>{app.id === "boi-ech" ? "Chế độ đăng ký mới" : "Kiểm duyệt thiết bị"}</span>
                  <select
                    aria-label={app.shortName + " - chế độ kiểm duyệt"}
                    value={draft.autoApprove ? "auto" : "manual"}
                    disabled={busy || !approveWritable}
                    onChange={(event) => updateDraft(app.id, { autoApprove: event.target.value === "auto" })}
                  >
                    <option value="manual">{app.id === "boi-ech" ? "Có phí · xác minh thủ công" : "Duyệt thủ công"}</option>
                    <option value="auto">{app.id === "boi-ech" ? "Miễn phí · tự động duyệt" : "Tự động duyệt"}</option>
                  </select>
                  <small>{approveWritable
                    ? "Chỉ ghi khi bấm Lưu thay đổi; không ảnh hưởng ứng dụng khác."
                    : policy.mutation.reason ?? "Client chưa công bố auto-approval có readback."}</small>
                </label>

                <label className={styles.field}>
                  <span>Yêu cầu chờ quá hạn</span>
                  <select
                    aria-label={app.shortName + " - xử lý quá hạn"}
                    value={draft.autoBlock ? "block" : "keep"}
                    disabled={busy || !blockWritable}
                    onChange={(event) => updateDraft(app.id, { autoBlock: event.target.value === "block" })}
                  >
                    <option value="keep">Giữ chờ · xử lý thủ công</option>
                    <option value="block">Tự động từ chối & khóa</option>
                  </select>
                  <small>{blockWritable
                    ? "Chỉ áp dụng cho registry của ứng dụng này."
                    : "Client chưa công bố auto-block pending an toàn có readback."}</small>
                </label>

                <label className={styles.field}>
                  <span>Thời gian chờ</span>
                  <select
                    aria-label={app.shortName + " - thời gian chờ"}
                    value={draft.pendingBlockAfterHours}
                    disabled={busy || !blockWritable || !draft.autoBlock}
                    onChange={(event) => updateDraft(app.id, { pendingBlockAfterHours: Number(event.target.value) })}
                  >
                    <option value={24}>24 giờ</option>
                    <option value={168}>7 ngày</option>
                    <option value={720}>30 ngày</option>
                  </select>
                  <small>{draft.autoBlock && blockWritable ? "Áp dụng riêng cho ứng dụng này." : "Không áp dụng khi đang giữ chờ thủ công hoặc contract chưa hỗ trợ."}</small>
                </label>
              </div>

              {app.id === "boi-ech" ? <div className={styles.limits} data-disabled={!draft.autoApprove || !approveWritable}>
                <label>Thời hạn miễn phí <select value={days} disabled={busy || !approveWritable || !draft.autoApprove} onChange={(event) => setDays(Number(event.target.value))}>{[30, 60, 90, 180, 365].map((value) => <option key={value} value={value}>{value} ngày</option>)}</select></label>
                <label>Tối đa thiết bị <input type="number" min={1} max={1000} value={limit} disabled={busy || !approveWritable || !draft.autoApprove} onChange={(event) => setLimit(Number(event.target.value))}/></label>
                <small>Chỉ áp dụng cho luồng Miễn phí · tự động duyệt. Luồng trả phí vẫn phải xác minh thanh toán.</small>
              </div> : null}
            </div>
          </article>;
        })}
      </div>
      <footer><button onClick={close} disabled={busy}>Đóng</button><button className={styles.save} disabled={!canSave} onClick={submit}>{busy ? "Đang lưu & đọc lại…" : "Lưu thay đổi"}</button></footer>
    </section>
  </div>;
}
