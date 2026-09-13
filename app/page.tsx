import { requireChatGPTUser } from "./chatgpt-auth";
import ManagementDashboard from "./management-dashboard";
import LocalQuickAccess from "./local-quick-access";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await requireChatGPTUser("/");
  return <>
    <ManagementDashboard user={{ displayName: user.displayName, email: user.email }} />
    <LocalQuickAccess />
  </>;
}
