"use client";

import { useEffect, useState } from "react";
import ManagementDashboard from "./management-dashboard";
import ManagementModernOverview from "./management-modern-overview";
import ManagementQuickActions from "./management-quick-actions";

export default function ManagementEntry({ user }: { user: { displayName: string; email: string } }) {
  const [mode, setMode] = useState<"overview" | "legacy" | null>(null);

  useEffect(() => {
    const resolve = () => {
      const view = new URLSearchParams(window.location.search).get("view");
      setMode(!view || view === "overview" ? "overview" : "legacy");
    };
    resolve();
    window.addEventListener("popstate", resolve);
    return () => window.removeEventListener("popstate", resolve);
  }, []);

  if (mode === null) return <div className="managementEntryLoading" aria-label="Đang mở giao diện quản trị"/>;
  if (mode === "overview") return <ManagementModernOverview user={user}/>;
  return <><ManagementDashboard user={user}/><ManagementQuickActions/></>;
}
