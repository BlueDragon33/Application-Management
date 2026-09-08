import { requireChatGPTUser } from "../../chatgpt-auth";
import ApplicationWorkspace from "../../application-workspace";
import { getApplicationConfig } from "../../application-registry";

export const dynamic = "force-dynamic";

export default async function HealthCareAdminPage() {
  const user = await requireChatGPTUser("/apps/health-care");
  const application = getApplicationConfig("health-care");
  if (!application) throw new Error("Không tìm thấy cấu hình Sức khỏe Y tế.");
  return <ApplicationWorkspace application={application} user={{ displayName: user.displayName, email: user.email }} />;
}
