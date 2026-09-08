import { requireChatGPTUser } from "../../chatgpt-auth";
import ApplicationWorkspace from "../../application-workspace";
import { getApplicationConfig } from "../../application-registry";

export const dynamic = "force-dynamic";

export default async function BaumanAdminPage() {
  const user = await requireChatGPTUser("/apps/bauman-master-ai");
  const application = getApplicationConfig("bauman-master-ai");
  if (!application) throw new Error("Không tìm thấy cấu hình Bauman Master AI.");
  return <ApplicationWorkspace application={application} user={{ displayName: user.displayName, email: user.email }} />;
}
