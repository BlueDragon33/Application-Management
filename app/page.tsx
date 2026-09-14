import { requireChatGPTUser } from "./chatgpt-auth";
import ApplicationHub from "./management-dashboard-v2";
import "./management-dashboard-mobile-overrides.css";
import "./management-dashboard-ver2-overrides.css";
import "./quick-management-actions.css";
import LocalQuickAccess from "./local-quick-access";
import QuickManagementActions from "./quick-management-actions";
import ReleaseLabelCleanup from "./release-label-cleanup";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await requireChatGPTUser("/");
  return <>
    <ApplicationHub user={{ displayName: user.displayName, email: user.email }} />
    <LocalQuickAccess />
    <QuickManagementActions />
    <ReleaseLabelCleanup />
  </>;
}
