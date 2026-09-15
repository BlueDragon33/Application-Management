import { requireChatGPTUser } from "./chatgpt-auth";
import ManagementEntry from "./management-entry";
import "./management-dashboard-mobile-overrides.css";
import "./management-dashboard-reference-layout.css";
import "./management-quick-actions.css";
import "./management-modern-overview.css";
import LocalQuickAccess from "./local-quick-access";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await requireChatGPTUser("/");
  return <>
    <ManagementEntry user={{ displayName: user.displayName, email: user.email }} />
    <LocalQuickAccess />
  </>;
}
