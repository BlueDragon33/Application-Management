import { requireChatGPTUser } from "../../chatgpt-auth";
import ApplicationWorkspace from "../../application-workspace";
import { getApplicationConfig } from "../../application-registry";

export const dynamic = "force-dynamic";

export default async function RuLifeAdminPage() {
  const user = await requireChatGPTUser("/apps/ru-life");
  const application = getApplicationConfig("ru-life");
  if (!application) throw new Error("Không tìm thấy cấu hình Hòa nhập Nga.");
  return <ApplicationWorkspace application={application} user={{ displayName: user.displayName, email: user.email }} />;
}
