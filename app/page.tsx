import { requireChatGPTUser } from "./chatgpt-auth";
import AdminHub from "./admin-hub";
import "./admin-hub.css";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await requireChatGPTUser("/");
  return <AdminHub user={{ displayName: user.displayName, email: user.email }} />;
}
