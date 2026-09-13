import { requireChatGPTUser } from "./chatgpt-auth";
import ApplicationHub from "./management-dashboard";
import "./management-dashboard-mobile-overrides.css";
import LocalQuickAccess from "./local-quick-access";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await requireChatGPTUser("/");
  return <>
    <ApplicationHub user={{ displayName: user.displayName, email: user.email }} />
    <LocalQuickAccess />
  </>;
}
