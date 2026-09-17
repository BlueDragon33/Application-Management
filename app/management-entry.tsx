"use client";

import ManagementDashboardV2 from "./management-dashboard-v2";

/* One persistent shell owns every tab. The approved image layout is now the
   production/local management UI, so tab changes only swap the content view
   inside the same mounted shell and never repaint a second dashboard on top. */
export default function ManagementEntry({ user }: { user: { displayName: string; email: string } }) {
  return <ManagementDashboardV2 user={user} />;
}
