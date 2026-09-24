import { requireChatGPTUser } from "../../chatgpt-auth";
import { getApplicationConfig } from "../../application-registry";
import ApplicationWorkspace from "../../application-workspace";

export const dynamic = "force-dynamic";

export default async function Nc03ModemAdminPage() {
  const user = await requireChatGPTUser("/apps/nc03-modem");
  const application = getApplicationConfig("nc03-modem");
  if (!application) throw new Error("Không tìm thấy cấu hình NC03 Control Center.");

  return (
    <ApplicationWorkspace
      application={application}
      user={{ displayName: user.displayName, email: user.email }}
    />
  );
}
