"use client";

import ManagementDashboard from "./management-dashboard";

/*
 * One persistent management shell owns every tab, including Tổng quan.
 *
 * Previously the root swapped between ManagementModernOverview and
 * ManagementDashboard. Even when both trees were kept mounted, changing from
 * Tổng quan to Hộp việc changed the entire shell, which produced the visible
 * flash/overlay effect reported in local use. The dashboard already owns its
 * view state and updates the URL with history.pushState, so keeping this one
 * shell mounted gives tab changes the same visual/layout context and preserves
 * loaded state between views.
 */
export default function ManagementEntry({ user }: { user: { displayName: string; email: string } }) {
  return <ManagementDashboard user={user} />;
}
