"use client";

import { useEffect, useState } from "react";
import ManagementDashboard from "./management-dashboard";
import ManagementModernOverview from "./management-modern-overview";

const OPERATIONS_CACHE_KEY = "application-management:operations:v1";

type EntryMode = "overview" | "legacy";

export default function ManagementEntry({ user }: { user: { displayName: string; email: string } }) {
  const [mode, setMode] = useState<EntryMode | null>(null);

  useEffect(() => {
    try { window.sessionStorage.removeItem(OPERATIONS_CACHE_KEY); } catch { /* local cache is optional */ }

    const resolve = () => {
      const view = new URLSearchParams(window.location.search).get("view");
      setMode(!view || view === "overview" ? "overview" : "legacy");
    };

    const history = window.history;
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;

    history.pushState = function pushState(data: unknown, unused: string, url?: string | URL | null) {
      originalPushState.call(history, data, unused, url);
      resolve();
    };

    history.replaceState = function replaceState(data: unknown, unused: string, url?: string | URL | null) {
      originalReplaceState.call(history, data, unused, url);
      resolve();
    };

    resolve();
    window.addEventListener("popstate", resolve);
    window.addEventListener("management:view-change", resolve);

    return () => {
      window.removeEventListener("popstate", resolve);
      window.removeEventListener("management:view-change", resolve);
      history.pushState = originalPushState;
      history.replaceState = originalReplaceState;
    };
  }, []);

  if (mode === null) {
    return <div className="managementEntryLoading" aria-label="Đang mở giao diện quản trị" />;
  }

  /* Keep both shells mounted. Switching tabs only toggles visibility, so the
     browser never tears down one complete dashboard and mounts another on top
     of it. State, cached data and layout remain warm between tab changes. */
  return <>
    <div hidden={mode !== "overview"} aria-hidden={mode !== "overview"}>
      <ManagementModernOverview user={user} />
    </div>
    <div hidden={mode !== "legacy"} aria-hidden={mode !== "legacy"}>
      <ManagementDashboard user={user} />
    </div>
  </>;
}
