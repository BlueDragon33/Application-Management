import { requireChatGPTUser } from "../../chatgpt-auth";
import { getApplicationConfig } from "../../application-registry";
import ApplicationWorkspace from "../../application-workspace";

export const dynamic = "force-dynamic";

export default async function EcadAdminPage() {
  const user = await requireChatGPTUser("/apps/ecad-design");
  const application = getApplicationConfig("ecad-design");
  if (!application) throw new Error("Không tìm thấy cấu hình ECAD Design.");

  return (
    <ApplicationWorkspace
      application={application}
      user={{ displayName: user.displayName, email: user.email }}
    />
  );
}
