"use client";

import ManagementDashboardV2 from "./management-dashboard-v2";

/* One persistent shell owns every tab. The approved image layout is now the
   production/local management UI, so tab changes only swap the content view
   inside the same mounted shell and never repaint a second dashboard on top. */
export default function ManagementEntry({ user, authMode, defaultApprovalGate }: {
  user: { displayName: string; email: string };
  authMode: "chatgpt-sites" | "cloudflare-preview" | "cloudflare-production" | "local";
  defaultApprovalGate: boolean;
}) {
  return <ManagementDashboardV2 user={user} authMode={authMode} defaultApprovalGate={defaultApprovalGate} />;
}
