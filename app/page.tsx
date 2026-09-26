import { applicationAccessMode, applicationAuthMode, requireChatGPTUser, standaloneDevelopmentUser } from "./chatgpt-auth";
import ManagementEntry from "./management-entry";
import "./management-dashboard-v2.css";
import "./management-dashboard-v2-reference.css";
import "./management-dashboard-v2-views.css";
import "./management-dashboard-v2-final.css";
import "./management-dashboard-v2-compact-tables.css";
import "./management-dashboard-v2-typography.css";
import LocalQuickAccess from "./local-quick-access";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [accessMode, authMode] = await Promise.all([applicationAccessMode(), applicationAuthMode()]);
  const user = accessMode === "managed"
    ? await requireChatGPTUser("/")
    : await standaloneDevelopmentUser();
  return <>
    <ManagementEntry user={{ displayName: user.displayName, email: user.email }} authMode={authMode} defaultApprovalGate={accessMode === "managed"} />
    <LocalQuickAccess />
  </>;
}
