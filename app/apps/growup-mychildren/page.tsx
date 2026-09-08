import { requireChatGPTUser } from "../../chatgpt-auth";
import GrowUpAdmin from "./growup-admin";

export const dynamic = "force-dynamic";

export default async function GrowUpAdminPage() {
  const user = await requireChatGPTUser("/apps/growup-mychildren");
  return <GrowUpAdmin user={{ displayName: user.displayName, email: user.email }} />;
}
