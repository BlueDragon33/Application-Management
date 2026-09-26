import { requireChatGPTUser } from "../../chatgpt-auth";
import { getApplicationConfig } from "../../application-registry";
import ApplicationWorkspace from "../../application-workspace";

export const dynamic = "force-dynamic";

export default async function SoftwareBlueprintHubAdminPage() {
  const user = await requireChatGPTUser("/apps/software-blueprint-hub");
  const application = getApplicationConfig("software-blueprint-hub");
  if (!application) throw new Error("Không tìm thấy cấu hình Software Blueprint Hub.");

  return (
    <ApplicationWorkspace
      application={application}
      user={{ displayName: user.displayName, email: user.email }}
    />
  );
}
