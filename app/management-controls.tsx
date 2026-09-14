"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { applicationRegistry } from "./application-registry";
import { operationsAction, type OperationsSettings } from "./admin-device-client";
import styles from "./center-admin.module.css";

export type AppearanceFont = "Inter" | "Times New Roman" | "Arial" | "Georgia" | "Verdana";
export type AppearanceBackground = "standard" | "emerald" | "navy" | "graphite" | "burgundy";
export type AppearanceFontSize = 14 | 16 | 18 | 20;
export type AppearanceSettings = { font: AppearanceFont; background: AppearanceBackground; fontSize: AppearanceFontSize };

export type ExtendedOperationsSettings = OperationsSettings & {
  autoBlockPendingAppIds?: string[];
  autoBlockPendingSupportedAppIds?: string[];
  pendingBlockAfterHoursByApp?: Record<string, number>;
  autoRejectAppIds?: string[];
  autoRejectSupportedAppIds?: string[];
};

const appearanceStorageKey = "application-management:appearance:v2";
const appearanceFonts: AppearanceFont[] = ["Inter", "Times New Roman", "Arial", "Georgia", "Verdana"];
const appearanceFontSizes: Array<{ value: AppearanceFontSize; label: string; hint: string }> = [
  { value: 14, label: "Nhỏ", hint: "14 px" },
  { value: 16, label: "Mặc định", hint: "16 px · dễ đọc" },
  { value: 18, label: "Lớn", hint: "18 px" },
  { value: 20, label: "Rất lớn", hint: "20 px" },
];
const appearanceBackgrounds: Array<{ id: AppearanceBackground; label: string; value: string }> = [
  { id: "standard", label: "Xanh vàng chuẩn", value: "radial-gradient(circle at 73% 6%, rgba(123,112,26,.17), transparent 30%), radial-gradient(circle at 28% 70%, rgba(37,91,55,.12), transparent 33%), linear-gradient(132deg,#0d1a13 0%,#172019 56%,#201d0e 100%)" },
  { id: "emerald", label: "Lục bảo sâu", value: "radial-gradient(circle at 76% 8%,rgba(25,122,91,.26),transparent 31%),linear-gradient(135deg,#071b15,#0d2f24 58%,#102219)" },
  { id: "navy", label: "Xanh đêm", value: "radial-gradient(circle at 75% 8%,rgba(37,91,142,.26),transparent 31%),linear-gradient(135deg,#08131b,#102635 58%,#111b24)" },
  { id: "graphite", label: "Than chì", value: "radial-gradient(circle at 74% 8%,rgba(117,127,127,.14),transparent 31%),linear-gradient(135deg,#111514,#1d2421 58%,#191c1b)" },
  { id: "burgundy", label: "Đỏ rượu", value: "radial-gradient(circle at 76% 7%,rgba(139,67,66,.23),transparent 31%),linear-gradient(135deg,#1b1012,#2d191b 58%,#1c1815)" },
];

export function useAdminAppearance() {
  const [appearance, setAppearance] = useState<AppearanceSettings>({ font: "Inter", background: "standard", fontSize: 16 });
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(appearanceStorageKey);
      if (raw) {
        const saved = JSON.parse(raw) as Partial<AppearanceSettings>;
        const font = appearanceFonts.includes(saved.font as AppearanceFont) ? saved.font as AppearanceFont : "Inter";
        const background = appearanceBackgrounds.some((item) => item.id === saved.background) ? saved.background as AppearanceBackground : "standard";
        const savedSize = Number(saved.fontSize);
        const fontSize = appearanceFontSizes.some((item) => item.value === savedSize) ? savedSize as AppearanceFontSize : 16;
        setAppearance({ font, background, fontSize });
      }
    } catch { /* Device-local preference is optional. */ }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try { window.localStorage.setItem(appearanceStorageKey, JSON.stringify(appearance)); } catch { /* optional */ }
  }, [appearance, hydrated]);

  const background = appearanceBackgrounds.find((item) => item.id === appearance.background) ?? appearanceBackgrounds[0];
  const style = {
    "--qt-user-font": appearance.font,
    "--qt-user-font-size": `${appearance.fontSize}px`,
    "--qt-user-background": background.value,
  } as CSSProperties;
  return { appearance, setAppearance, style };
}

export function appearanceReadableCss(classNames: {
  shell: string;
  nav?: string;
  search?: string;
  pageText?: string;
  title?: string;
  small?: string;
}) {
  const selectors = [classNames.nav, classNames.search, classNames.pageText].filter(Boolean).map((item) => `.${item}`).join(",");
  const smaller = classNames.small ? `.${classNames.small}` : "";
  const title = classNames.title ? `.${classNames.title}` : "";
  return `
    .${classNames.shell}{font-family:var(--qt-user-font,Inter),ui-sans-serif,system-ui,sans-serif!important;font-size:var(--qt-user-font-size,16px);line-height:1.55;background:var(--qt-user-background)!important}
    ${selectors}{font-size:var(--qt-user-font-size,16px)!important}
    ${smaller}{font-size:calc(var(--qt-user-font-size,16px) - 2px)!important}
    ${title}{font-size:calc(var(--qt-user-font-size,16px) + 6px)!important}
  `;
}

function AppBadge({ appId, initials }: { appId: string; initials: string }) {
  const colors: Record<string, string> = {
    "boi-ech": "#0f766e",
    "health-care": "#9f4740",
    "ru-life": "#126a87",
    "bauman-master-ai": "#1f5f70",
    "growup-mychildren": "#76661d",
  };
  return <span style={{ display: "grid", placeItems: "center", width: 38, height: 38, borderRadius: 10, background: colors[appId] ?? "#345", color: "white", fontSize: 12, fontWeight: 800 }}>{initials}</span>;
}

export function AppearanceDialog({ open, value, close, change }: { open: boolean; value: AppearanceSettings; close: () => void; change: (next: AppearanceSettings) => void }) {
  if (!open) return null;
  return <div className={styles.dialogScrim} role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) close(); }}>
    <section className={`${styles.dialogCard} ${styles.appearanceCard}`} role="dialog" aria-modal="true" aria-labelledby="appearance-title">
      <header><div><span>CÁ NHÂN HÓA</span><h2 id="appearance-title">Giao diện</h2></div><button onClick={close} aria-label="Đóng">×</button></header>
      <div className={styles.appearanceSection}><strong>Phông chữ</strong><div className={styles.fontChoices}>{appearanceFonts.map((font) => <button key={font} data-active={value.font === font} style={{ fontFamily: font }} onClick={() => change({ ...value, font })}>{font}</button>)}</div></div>
      <div className={styles.appearanceSection}><strong>Cỡ chữ</strong><div className={styles.fontChoices} style={{ gridTemplateColumns: "repeat(4,minmax(0,1fr))" }}>{appearanceFontSizes.map((option) => <button key={option.value} data-active={value.fontSize === option.value} onClick={() => change({ ...value, fontSize: option.value })}><strong>{option.label}</strong><small style={{ display: "block", marginTop: 4, opacity: .72 }}>{option.hint}</small></button>)}</div></div>
      <div className={styles.appearanceSection}><strong>Background</strong><div className={styles.backgroundChoices}>{appearanceBackgrounds.map((background) => <button key={background.id} data-active={value.background === background.id} onClick={() => change({ ...value, background: background.id })}><i style={{ background: background.value }}/><span>{background.label}</span></button>)}</div></div>
      <footer><button onClick={() => change({ font: "Inter", background: "standard", fontSize: 16 })}>Khôi phục mặc định</button><button className={styles.primaryButton} onClick={close}>Xong</button></footer>
    </section>
  </div>;
}

export function AppearanceTrigger({ onClick }: { onClick: () => void }) {
  return <button className={styles.appearanceButton} onClick={onClick}><span>Aa</span> Giao diện</button>;
}

export function AutomationDialog({ open, settings, busy, close, save }: {
  open: boolean;
  settings: ExtendedOperationsSettings | undefined;
  busy: boolean;
  close: () => void;
  save: (autoApproveAppIds: string[], autoRejectAppIds: string[], pendingBlockAfterHoursByApp: Record<string, number>) => void;
}) {
  const extended = settings ?? { autoApproveAppIds: [], autoApproveSupportedAppIds: [], autoRejectAppIds: [], autoRejectSupportedAppIds: [] };
  const [selected, setSelected] = useState<string[]>(extended.autoApproveAppIds ?? []);
  const [autoRejectSelected, setAutoRejectSelected] = useState<string[]>(extended.autoRejectAppIds ?? extended.autoBlockPendingAppIds ?? []);
  const [pendingBlockHours, setPendingBlockHours] = useState<Record<string, number>>(extended.pendingBlockAfterHoursByApp ?? {});
  useEffect(() => {
    if (!open) return;
    setSelected(extended.autoApproveAppIds ?? []);
    setAutoRejectSelected(extended.autoRejectAppIds ?? extended.autoBlockPendingAppIds ?? []);
    setPendingBlockHours(extended.pendingBlockAfterHoursByApp ?? {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  if (!open) return null;
  const supported = new Set(extended.autoApproveSupportedAppIds ?? []);
  const autoRejectSupported = new Set(extended.autoRejectSupportedAppIds ?? extended.autoBlockPendingSupportedAppIds ?? []);
  return <div className={styles.dialogScrim} role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) close(); }}>
    <section className={styles.dialogCard} role="dialog" aria-modal="true" aria-labelledby="automation-title">
      <header><div><span>QUY TẮC CHỜ DUYỆT</span><h2 id="automation-title">Tự động xử lý theo ứng dụng</h2></div><button onClick={close} aria-label="Đóng">×</button></header>
      <p>Mọi ứng dụng đều được hiển thị. Chỉ policy đã có contract backend thật mới được bật; mục chưa sẵn sàng không bị xóa khỏi giao diện.</p>
      <div className={styles.dialogChoices}>
        <strong>Tự động duyệt theo ứng dụng</strong>
        {applicationRegistry.map((application) => {
          const enabled = supported.has(application.id);
          return <label key={`approve:${application.id}`} data-disabled={!enabled}>
            <input type="checkbox" disabled={!enabled || busy} checked={selected.includes(application.id)} onChange={(event) => setSelected((current) => event.target.checked ? [...new Set([...current, application.id])] : current.filter((id) => id !== application.id))}/>
            <AppBadge appId={application.id} initials={application.initials}/><span><strong>{application.shortName}</strong><small>{enabled ? "Đã có contract duyệt tự động" : "Chờ contract duyệt tự động"}</small></span>
          </label>;
        })}
      </div>
      <div className={styles.dialogChoices}>
        <strong>Tự động từ chối theo ứng dụng</strong>
        {applicationRegistry.map((application) => {
          const enabled = autoRejectSupported.has(application.id);
          const checked = autoRejectSelected.includes(application.id);
          const hours = pendingBlockHours[application.id] ?? 168;
          return <label key={`reject:${application.id}`} data-disabled={!enabled}>
            <input type="checkbox" disabled={!enabled || busy} checked={checked} onChange={(event) => setAutoRejectSelected((current) => event.target.checked ? [...new Set([...current, application.id])] : current.filter((id) => id !== application.id))}/>
            <AppBadge appId={application.id} initials={application.initials}/><span><strong>{application.shortName}</strong><small>{enabled ? "Tự động từ chối/khóa yêu cầu pending theo policy" : application.id === "boi-ech" ? "Không tự động xóa vĩnh viễn thiết bị" : "Chờ contract tự động từ chối an toàn"}</small>{enabled && checked && application.id === "health-care" ? <select value={hours} disabled={busy} onClick={(event) => event.stopPropagation()} onChange={(event) => setPendingBlockHours((current) => ({ ...current, [application.id]: Number(event.target.value) }))}><option value={24}>Sau 24 giờ</option><option value={168}>Sau 7 ngày</option><option value={720}>Sau 30 ngày</option></select> : null}</span>
          </label>;
        })}
      </div>
      <footer><button onClick={close} disabled={busy}>Hủy</button><button className={styles.primaryButton} onClick={() => save(selected, autoRejectSelected, pendingBlockHours)} disabled={busy}>{busy ? "Đang lưu…" : "Lưu quy tắc"}</button></footer>
    </section>
  </div>;
}

export async function saveAutomationRules(settings: ExtendedOperationsSettings | undefined, autoApproveAppIds: string[], autoRejectAppIds: string[], pendingBlockAfterHoursByApp: Record<string, number>) {
  await operationsAction({ action: "set-auto-approval", appIds: autoApproveAppIds });
  const rejectSupported = new Set(settings?.autoRejectSupportedAppIds ?? []);
  if (rejectSupported.size) await operationsAction({ action: "set-auto-reject", appIds: autoRejectAppIds.filter((id) => rejectSupported.has(id)) });

  const blockSupported = settings?.autoBlockPendingSupportedAppIds ?? [];
  const blockBefore = new Set(settings?.autoBlockPendingAppIds ?? []);
  for (const appId of blockSupported) {
    if (rejectSupported.has(appId)) continue;
    const enabled = autoRejectAppIds.includes(appId);
    const pendingBlockAfterHours = pendingBlockAfterHoursByApp[appId] ?? settings?.pendingBlockAfterHoursByApp?.[appId] ?? 168;
    const previousHours = settings?.pendingBlockAfterHoursByApp?.[appId] ?? 168;
    if (blockBefore.has(appId) === enabled && previousHours === pendingBlockAfterHours) continue;
    await operationsAction({ action: "set-auto-block-pending", appId, enabled, pendingBlockAfterHours });
  }
}
