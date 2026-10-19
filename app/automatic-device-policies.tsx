"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import type { OperationsAutomationPolicy, OperationsSettings } from "./admin-device-client";
import styles from "./automatic-device-policies.module.css";
import { readAutomationDraft, writeAutomationDraft, clearAutomationDraft } from "./device-automation-draft.mjs";

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

function verificationLabel(policy: OperationsAutomationPolicy, verified: boolean) {
  if (!verified && policy.verification.state === "live") return "CACHED";
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

function draftChanged(policy: OperationsAutomationPolicy, draft: AutomationAppDraft, appId: string, days: number, limit: number) {
  if (policy.mutation.autoApprove && policy.current.autoApprove !== draft.autoApprove) return true;
  if (policy.mutation.autoBlockPending && policy.current.autoBlockPending !== draft.autoBlock) return true;
  if (policy.mutation.autoBlockPending && draft.autoBlock && policy.current.pendingBlockAfterHours !== draft.pendingBlockAfterHours) return true;
  return appId === "boi-ech"
    && policy.mutation.autoApprove
    && (policy.current.freeAccessDays !== days || policy.current.freeDeviceLimit !== limit);
}

export default function AutomaticDevicePolicies({ apps, settings, verified, busy, close, sync, save, verifyAuthenticatorHref }: {
  apps: readonly AutomationApp[];
  settings: OperationsSettings | undefined;
  verified: boolean;
  busy: boolean;
  sync: () => Promise<unknown>;
  close: () => void;
  save: (selection: AutomationSelection) => Promise<OperationsSettings | null | undefined>;
  verifyAuthenticatorHref?: string;
}) {
  const [drafts, setDrafts] = useState<Record<string, AutomationAppDraft>>(() => initialDrafts(apps, settings));
  const submitLockRef = useRef(false);
  const draftEditedRef = useRef(false);
  const dialogRef = useRef<HTMLElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [draftNotice, setDraftNotice] = useState("");
  const boiPolicy = policyFor(settings, "boi-ech");
  const [days, setDays] = useState(boiPolicy.current.freeAccessDays ?? settings?.freeAccessDaysByApp?.["boi-ech"] ?? 0);
  const [limit, setLimit] = useState(boiPolicy.current.freeDeviceLimit ?? settings?.freeDeviceLimitByApp?.["boi-ech"] ?? 0);
  const policies = apps.map((app) => policyFor(settings, app.id));
  const hasWritablePolicy = verified && policies.some((policy) => policy.mutation.autoApprove || policy.mutation.autoBlockPending);
  const hasUnverifiedPolicy = policies.some((policy) => policy.verification.state === "fallback" || policy.verification.state === "unavailable");
  const hasChanges = apps.some((app) => draftChanged(
    policyFor(settings, app.id),
    drafts[app.id] ?? { autoApprove: false, autoBlock: false, pendingBlockAfterHours: 168 },
    app.id,
    days,
    limit,
  ));
  const locked = busy || submitting;
  const boiDraft = drafts["boi-ech"] ?? { autoApprove: false, autoBlock: false, pendingBlockAfterHours: 168 };
  const boiChanged = apps.some((app) => app.id === "boi-ech")
    && draftChanged(boiPolicy, boiDraft, "boi-ech", days, limit);
  const boiLimitsValid = !boiChanged || (
    Number.isInteger(days) && days >= 1 && days <= 365
    && Number.isInteger(limit) && limit >= 1 && limit <= 1_000
  );
  const canSave = Boolean(settings) && verified && !locked && hasWritablePolicy && hasChanges && boiLimitsValid;
  const canSaveLocalDraft = !locked && (hasChanges || draftEditedRef.current);

  // A modal may be opened on a cached snapshot while live bootstrap is in flight.
  // Rebase only untouched drafts; never overwrite an actual user edit.
  useEffect(() => {
    if (draftEditedRef.current) return;
    setDrafts(initialDrafts(apps, settings));
    const latestBoi = policyFor(settings, "boi-ech");
    setDays(latestBoi.current.freeAccessDays ?? settings?.freeAccessDaysByApp?.["boi-ech"] ?? 0);
    setLimit(latestBoi.current.freeDeviceLimit ?? settings?.freeDeviceLimitByApp?.["boi-ech"] ?? 0);
  }, [apps, settings]);

  // Restore desired settings only. This is not a readback from any client.
  useEffect(() => {
    let saved;
    try { saved = readAutomationDraft(window.localStorage); }
    catch { setDraftNotice("Trình duyệt không cho truy cập kho bản nháp; không thay đổi dữ liệu ứng dụng."); return; }
    if (!saved) return;
    const availableIds = new Set(apps.map((app) => app.id));
    const restored = Object.fromEntries(Object.entries(saved.drafts)
      .filter(([appId]) => availableIds.has(appId)));
    if (!Object.keys(restored).length) return;
    draftEditedRef.current = true;
    setDrafts((current) => ({ ...current, ...restored }));
    setDays(saved.days);
    setLimit(saved.limit);
    setDraftNotice("Đã khôi phục bản nháp trình duyệt. Chưa ghi vào ứng dụng nguồn.");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeButtonRef.current?.focus();
    return () => {
      openerRef.current?.focus();
    };
  }, []);

  function handleDialogKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      if (!locked) close();
      return;
    }
    if (event.key !== "Tab") return;

    const root = dialogRef.current;
    if (!root) return;
    const focusable = [...root.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
    )].filter((element) => element.getAttribute("aria-hidden") !== "true");
    if (!focusable.length) {
      event.preventDefault();
      root.focus();
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function updateDraft(appId: string, patch: Partial<AutomationAppDraft>) {
    draftEditedRef.current = true;
    setDraftNotice("Có thay đổi chưa lưu bản nháp hoặc áp dụng.");
    setDrafts((current) => ({
      ...current,
      [appId]: { ...(current[appId] ?? { autoApprove: false, autoBlock: false, pendingBlockAfterHours: 168 }), ...patch },
    }));
  }

  function saveLocalDraft() {
    if (!canSaveLocalDraft) return;
    let result;
    try { result = writeAutomationDraft(window.localStorage, { drafts, days, limit }); }
    catch { result = { saved: false, reason: "LOCAL_STORAGE_UNAVAILABLE" }; }
    setDraftNotice(result.saved
      ? "Đã lưu bản nháp trên trình duyệt, đọc lại khớp. CHƯA áp dụng vào client. Khi kết nối LIVE được xác minh, chọn Áp dụng & kiểm tra."
      : "Không thể lưu bản nháp: " + result.reason + ". Cấu hình ứng dụng nguồn không thay đổi.");
  }

  async function submit() {
    if (!canSave || submitLockRef.current) return;
    submitLockRef.current = true;
    setSubmitting(true);
    try {
      const appIds = apps.filter((app) => drafts[app.id]?.autoApprove).map((app) => app.id);
      const autoBlockAppIds = apps.filter((app) => drafts[app.id]?.autoBlock).map((app) => app.id);
      const pendingBlockAfterHoursByApp = Object.fromEntries(
        apps.map((app) => [app.id, drafts[app.id]?.pendingBlockAfterHours ?? 168]),
      ) as Record<string, number>;
      const readback = await save({ appIds, autoBlockAppIds, pendingBlockAfterHoursByApp, defaultAccessDays: days, defaultDeviceLimit: limit });
      if (!readback) {
        setDraftNotice("Chưa xác minh áp dụng. Bản chỉnh sửa vẫn còn; hãy lưu bản nháp để thử lại.");
        return;
      }
      let saved;
      try { saved = readAutomationDraft(window.localStorage); }
      catch { saved = null; }
      const stillPending = Object.entries(saved?.drafts ?? {}).filter(([appId, proposed]) => {
        const policy = policyFor(readback, appId);
        if (policy.verification.state !== "live") return true;
        if (!policy.support.autoApprove || policy.current.autoApprove !== proposed.autoApprove) return true;
        if (!policy.support.autoBlockPending || policy.current.autoBlockPending !== proposed.autoBlock) return true;
        if (proposed.autoBlock && policy.current.pendingBlockAfterHours !== proposed.pendingBlockAfterHours) return true;
        if (appId === "boi-ech" && (policy.current.freeAccessDays !== saved?.days ||
            policy.current.freeDeviceLimit !== saved?.limit)) return true;
        return false;
      });
      let cleared = false;
      if (stillPending.length === 0) {
        try { cleared = clearAutomationDraft(window.localStorage); }
        catch { cleared = false; }
      }
      const rebased = initialDrafts(apps, readback);
      for (const [appId, proposed] of stillPending) {
        if (apps.some((item) => item.id === appId)) rebased[appId] = proposed;
      }
      draftEditedRef.current = stillPending.length > 0;
      setDrafts(rebased);
      setDraftNotice(stillPending.length > 0
        ? "Đã xác minh phần ghi LIVE; vẫn giữ " + stillPending.length + " chính sách nháp chưa được client xác nhận. Không xóa bản nháp."
        : cleared
          ? "Đã áp dụng, đọc lại từ client và xóa bản nháp trình duyệt."
          : "Client đã readback nhưng chưa xóa được bản nháp trình duyệt; sẽ không tự nhận là hết bản nháp.");
      const nextBoi = policyFor(readback, "boi-ech");
      const boiPending = stillPending.some(([appId]) => appId === "boi-ech");
      setDays(boiPending && saved ? saved.days :
        nextBoi.current.freeAccessDays ?? readback.freeAccessDaysByApp?.["boi-ech"] ?? days);
      setLimit(boiPending && saved ? saved.limit :
        nextBoi.current.freeDeviceLimit ?? readback.freeDeviceLimitByApp?.["boi-ech"] ?? limit);
    } finally {
      submitLockRef.current = false;
      setSubmitting(false);
    }
  }

  return <div className={styles.scrim} onMouseDown={(event) => { if (event.currentTarget === event.target && !locked) close(); }}>
    <section ref={dialogRef} className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="device-auto-title" tabIndex={-1} onKeyDown={handleDialogKeyDown}>
      <header className={styles.dialogHeader}>
        <div><small>KIỂM DUYỆT THIẾT BỊ</small><h2 id="device-auto-title">Quy tắc theo từng ứng dụng</h2></div>
        <button ref={closeButtonRef} onClick={close} disabled={locked} aria-label="Đóng">×</button>
      </header>
      <p className={styles.intro}><strong>Đang áp dụng</strong> là dữ liệu readback. Các ô bên dưới là bản nháp; sau khi lưu thành công chúng tự đồng bộ lại đúng trạng thái client.</p>
      {!verified ? <p className={styles.warning}>Chưa xác minh LIVE. Có thể chỉnh và lưu bản nháp cục bộ, nhưng áp dụng vào client chỉ khi có contract và quyền hợp lệ.</p> : null}
      {draftNotice ? <p className={styles.draftNotice} role="status">{draftNotice}</p> : null}
      {verifyAuthenticatorHref ? <p className={styles.authHelp}>Thao tác duyệt và lưu cấu hình nhạy cảm cần Google Authenticator. <a href={verifyAuthenticatorHref} target="_blank" rel="noopener noreferrer">Mở xác minh Authenticator ↗</a> ở tab riêng, rồi quay lại lưu.</p> : null}
      {hasUnverifiedPolicy ? <p className={styles.warning}>Ứng dụng LAST KNOWN/UNAVAILABLE chỉ hiển thị tham chiếu và không được ghi mù. READ-ONLY là app chưa công bố automation contract an toàn.</p> : null}

      <div className={styles.list}>
        {apps.map((app) => {
          const policy = policyFor(settings, app.id);
          const draft = drafts[app.id] ?? { autoApprove: false, autoBlock: false, pendingBlockAfterHours: 168 };
          const approveWritable = verified && policy.mutation.autoApprove;
          const blockWritable = verified && policy.mutation.autoBlockPending;
          const approvalValue = draft.autoApprove ? "auto" : "manual";
          const blockValue = draft.autoBlock ? "block" : "keep";
          const timeValue = draft.autoBlock ? draft.pendingBlockAfterHours : 0;
          const changed = draftChanged(policy, draft, app.id, days, limit);

          return <article key={app.id} className={styles.app} data-changed={changed}>
            <div className={styles.appHeader}>
              <div className={styles.appIdentity}>
                <strong>{app.shortName}</strong>
                <small className={styles.source}>{policy.verification.source}</small>
              </div>
              <div className={styles.appMeta}>
                {changed ? <span className={styles.changedBadge}>CHƯA LƯU</span> : null}
                <b className={styles.verificationBadge} data-state={policy.verification.state}>{verificationLabel(policy, verified)}</b>
              </div>
            </div>

            <div className={styles.applied}>
              <div><span>Đang áp dụng · kiểm duyệt</span><strong>{approvalLabel(policy, app.id)}</strong></div>
              <div><span>Đang áp dụng · quá hạn</span><strong>{expirationLabel(policy)}</strong></div>
              {app.id === "boi-ech" && policy.support.freeAccessPolicy
                ? <div><span>Miễn phí hiện tại</span><strong>{policy.current.freeAccessDays ?? "—"} ngày · tối đa {policy.current.freeDeviceLimit ?? "—"} thiết bị</strong></div>
                : null}
            </div>

            <div className={styles.sectionTitle}>Thiết lập</div>
            <div className={styles.policyGrid}>
              <label className={styles.field}>
                <span>{app.id === "boi-ech" ? "Chế độ đăng ký mới" : "Kiểm duyệt thiết bị"}</span>
                <select
                  aria-label={app.shortName + " - chế độ kiểm duyệt"}
                  value={approvalValue}
                  disabled={locked}
                  onChange={(event) => updateDraft(app.id, { autoApprove: event.target.value === "auto" })}
                >
                  <option value="manual">{app.id === "boi-ech" ? "Có phí · xác minh thủ công" : "Duyệt thủ công"}</option>
                  <option value="auto">{app.id === "boi-ech" ? "Miễn phí · tự động duyệt" : "Tự động duyệt"}</option>
                </select>
                <small>{approveWritable ? "Có thể áp dụng và readback LIVE." : "Chỉ lưu bản nháp; client chưa cho phép ghi LIVE."}</small>
              </label>

              <label className={styles.field}>
                <span>Yêu cầu chờ quá hạn</span>
                <select
                  aria-label={app.shortName + " - xử lý quá hạn"}
                  value={blockValue}
                  disabled={locked}
                  onChange={(event) => updateDraft(app.id, { autoBlock: event.target.value === "block" })}
                >
                  <option value="keep">Giữ chờ · xử lý thủ công</option>
                  <option value="block">Tự động từ chối & khóa</option>
                </select>
                <small>{blockWritable ? "Có thể áp dụng và readback LIVE." : "Chỉ lưu bản nháp; client chưa cho phép ghi LIVE."}</small>
              </label>

              <label className={styles.field}>
                <span>Thời gian chờ</span>
                <select
                  aria-label={app.shortName + " - thời gian chờ"}
                  value={timeValue}
                  disabled={locked || !draft.autoBlock}
                  onChange={(event) => updateDraft(app.id, { pendingBlockAfterHours: Number(event.target.value) })}
                >
                  <option value={0}>Không áp dụng</option>
                  <option value={24}>24 giờ</option>
                  <option value={168}>7 ngày</option>
                  <option value={720}>30 ngày</option>
                </select>
                <small>{draft.autoBlock && blockWritable ? "Áp dụng riêng cho app này." : "Chỉ dùng khi tự động xử lý quá hạn."}</small>
              </label>
            </div>

            {app.id === "boi-ech" ? <div className={styles.limits} data-disabled={!approveWritable}>
              <label>Thời hạn miễn phí <select value={days} disabled={locked} onChange={(event) => { draftEditedRef.current = true; setDays(Number(event.target.value)); }}><option value={0}>Chưa xác minh</option>{[30, 60, 90, 180, 365].map((value) => <option key={value} value={value}>{value} ngày</option>)}</select></label>
              <label>Tối đa thiết bị <input type="number" min={1} max={1000} value={limit} disabled={locked} onChange={(event) => { draftEditedRef.current = true; setLimit(Number(event.target.value)); }}/></label>
              <small>Chỉ áp dụng cho Miễn phí · tự động duyệt. Luồng trả phí vẫn phải xác minh thanh toán.</small>
            </div> : null}

            {(!approveWritable && !blockWritable) && policy.mutation.reason
              ? <p className={styles.appReason}>{policy.mutation.reason}</p>
              : null}
          </article>;
        })}
      </div>

      <footer className={styles.dialogFooter}>
        <span className={styles.saveState}>{locked ? "Đang ghi và đọc lại client…" : !verified ? "Chưa xác minh LIVE" : hasChanges ? "Có thay đổi chưa lưu; chưa công nhận đã ghi" : "Cấu hình đang khớp trạng thái đã đọc"}</span>
        <div><button type="button" onClick={() => void sync()} disabled={locked}>Đồng bộ LIVE</button><button type="button" onClick={saveLocalDraft} disabled={!canSaveLocalDraft}>Lưu bản nháp</button><button onClick={close} disabled={locked}>Đóng</button><button className={styles.save} disabled={!canSave} onClick={() => void submit()}>{locked ? "Đang áp dụng…" : "Áp dụng & kiểm tra"}</button></div>
      </footer>
    </section>
  </div>;
}
