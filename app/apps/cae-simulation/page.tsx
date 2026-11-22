import { requireChatGPTUser } from "../../chatgpt-auth";
import { getApplicationConfig } from "../../application-registry";
import ApplicationWorkspace from "../../application-workspace";

export const dynamic = "force-dynamic";

export default async function CaeAdminPage() {
  const user = await requireChatGPTUser("/apps/cae-simulation");
  const application = getApplicationConfig("cae-simulation");
  if (!application) throw new Error("Không tìm thấy cấu hình CAE Simulation.");

  return (
    <ApplicationWorkspace
      application={application}
      user={{ displayName: user.displayName, email: user.email }}
    />
  );
}
