"use client";

import { useEffect, useState } from "react";
import ManagementDashboard from "./management-dashboard";
import ManagementModernOverview from "./management-modern-overview";

const OPERATIONS_CACHE_KEY = "application-management:operations:v1";

export default function ManagementEntry({ user }: { user: { displayName: string; email: string } }) {
  const [mode, setMode] = useState<"overview" | "legacy" | null>(null);

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

  if (mode === "overview") {
    return <ManagementModernOverview user={user} />;
  }

  return <ManagementDashboard user={user} />;
}
