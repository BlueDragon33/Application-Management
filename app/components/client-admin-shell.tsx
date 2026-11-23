"use client";

// Shared PRESENTATION only. Authentication, mutations and source-owned data stay in each app.
// Extracted from Bơi Ếch Owner V18's primary + specialist navigation pattern.
import { useState, type ReactNode } from "react";
import Link from "next/link";
import base from "../application-admin.module.css";
import shell from "./client-admin-shell.module.css";

export type ClientAdminNavItem<T extends string> = {
  id: T;
  label: string;
  description?: string;
  glyph?: string;
};

export type ClientAdminSidebarProps<T extends string> = {
  appId: string;
  appName: string;
  initials: string;
  category: string;
  navTitle: string;
  activeView: T;
  onSelect: (view: T) => void;
  primary: readonly ClientAdminNavItem<T>[];
  specialist?: readonly ClientAdminNavItem<T>[];
  connection: { state: "online" | "warning"; label: string; note: string };
  boundary: { title: string; description: string };
  user: { displayName: string; roleLabel: string; deviceCode?: string };
};

export function ClientAdminSidebar<T extends string>({
  appId, appName, initials, category, navTitle, activeView, onSelect,
  primary, specialist = [], connection, boundary, user,
}: ClientAdminSidebarProps<T>) {
  const [specialistOpen, setSpecialistOpen] = useState(() =>
    specialist.some((item) => item.id === activeView));
  const specialistActive = specialist.some((item) => item.id === activeView);

  function selectView(next: T) {
    onSelect(next);
    setSpecialistOpen(specialist.some((item) => item.id === next));
  }

  function renderItem(item: ClientAdminNavItem<T>, index: number) {
    return <button
      type="button"
      key={item.id}
      data-active={activeView === item.id}
      aria-current={activeView === item.id ? "page" : undefined}
      onClick={() => selectView(item.id)}
    >
      <span aria-hidden="true">{item.glyph ?? String(index + 1).padStart(2, "0")}</span>
      <div><strong>{item.label}</strong>{item.description ? <small>{item.description}</small> : null}</div>
    </button>;
  }

  return <aside className={`${base.clientSidebar} ${shell.sidebar}`} data-admin-shell="boi-owner-shared-v1" data-app-id={appId}>
    <Link href="/" className={base.serverBack}><span aria-hidden="true">←</span><div><small>SERVER</small><strong>Application Management</strong></div></Link>
    <div className={base.clientBrand}><span aria-hidden="true">{initials}</span><div><small>{category}</small><strong>{appName}</strong></div></div>
    <div className={base.clientStatus} role="status" aria-label="Trạng thái quản trị và nguồn dữ liệu">
      <i data-status={connection.state} aria-hidden="true"/>
      <div><strong>{connection.label}</strong><small>{connection.note}</small></div>
    </div>
    <nav className={base.clientNav} aria-label={`Quản trị ${appName}`}>
      <span className={base.navGroup}>{navTitle}</span>
      {primary.map(renderItem)}
      {specialist.length > 0 ? <button
        type="button" className={shell.specialistTrigger}
        aria-expanded={specialistOpen}
        aria-controls={`client-specialist-${appId}`}
        data-active={specialistActive}
        onClick={() => setSpecialistOpen((open) => !open)}
      >
        <span aria-hidden="true">◇</span>
        <div><strong>Công cụ chuyên biệt</strong><small>{specialist.length} mục theo năng lực</small></div>
        <i className={shell.chevron} aria-hidden="true">⌄</i>
      </button> : null}
    </nav>
    {specialist.length ? <nav
      id={`client-specialist-${appId}`}
      className={`${base.clientNav} ${shell.specialistNav}`}
      aria-label={`Công cụ chuyên biệt ${appName}`}
      hidden={!specialistOpen}
      onKeyDown={(event) => {
        if (event.key === "Escape") setSpecialistOpen(false);
      }}
    >{specialist.map((item, index) => renderItem(item, primary.length + index))}</nav> : null}
    <div className={`${base.clientBoundary} ${shell.boundary}`}>
      <span>RANH GIỚI NGUỒN DỮ LIỆU</span>
      <strong>{boundary.title}</strong>
      <p>{boundary.description}</p>
    </div>
    <div className={base.clientUser}>
      <span aria-hidden="true">{user.displayName.slice(0, 1).toUpperCase()}</span>
      <div><strong>{user.displayName}</strong><small>{user.roleLabel}</small>
        {user.deviceCode ? <small title="Mã thiết bị quản trị">{user.deviceCode}</small> : null}
      </div>
    </div>
  </aside>;
}

export function ClientAdminTopbar({
  eyebrow, title, description, actions,
}: { eyebrow: string; title: string; description: string; actions: ReactNode }) {
  return <header className={base.workspaceTopbar} data-admin-shell-header="boi-owner-shared-v1">
    <div><span>{eyebrow}</span><h1>{title}</h1><p>{description}</p></div>
    <div className={base.topbarActions}>{actions}</div>
  </header>;
}
