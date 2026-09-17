import { requireChatGPTUser } from "./chatgpt-auth";
import ManagementEntry from "./management-entry";
import "./management-dashboard-v2.css";
import "./management-dashboard-v2-reference.css";
import "./management-dashboard-v2-views.css";
import "./management-dashboard-v2-final.css";
import "./management-dashboard-v2-compact-tables.css";
import LocalQuickAccess from "./local-quick-access";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await requireChatGPTUser("/");
  return <>
    <ManagementEntry user={{ displayName: user.displayName, email: user.email }} />
    <LocalQuickAccess />
  </>;
}
