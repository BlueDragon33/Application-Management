import { requireChatGPTUser } from "./chatgpt-auth";
import ApplicationHub from "./management-dashboard-v2";
import "./management-dashboard-mobile-overrides.css";
import "./management-dashboard-ver2-overrides.css";
import "./management-dashboard-16x9.css";
import "./management-dashboard-device-aspects.css";
import "./quick-management-actions.css";
import LocalQuickAccess from "./local-quick-access";
import QuickManagementActions from "./quick-management-actions";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await requireChatGPTUser("/");
  return <>
    <ApplicationHub user={{ displayName: user.displayName, email: user.email }} />
    <LocalQuickAccess />
    <QuickManagementActions />
  </>;
}
