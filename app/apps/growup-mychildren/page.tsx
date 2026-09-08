import { requireChatGPTUser } from "../../chatgpt-auth";
import ApplicationWorkspace from "../../application-workspace";
import { getApplicationConfig } from "../../application-registry";

export const dynamic = "force-dynamic";

export default async function GrowUpAdminPage() {
  const user = await requireChatGPTUser("/apps/growup-mychildren");
  const application = getApplicationConfig("growup-mychildren");
  if (!application) throw new Error("Không tìm thấy cấu hình GrowUP MyChildren.");
  return <ApplicationWorkspace application={application} user={{ displayName: user.displayName, email: user.email }} />;
}
