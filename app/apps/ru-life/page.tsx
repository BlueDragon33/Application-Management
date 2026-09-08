import { requireChatGPTUser } from "../../chatgpt-auth";
import RuLifeAdmin from "./ru-life-admin";

export const dynamic = "force-dynamic";

export default async function RuLifeAdminPage() {
  const user = await requireChatGPTUser("/apps/ru-life");
  return <RuLifeAdmin user={{ displayName: user.displayName, email: user.email }} />;
}
