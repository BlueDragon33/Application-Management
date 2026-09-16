import { requireChatGPTUser } from "../../chatgpt-auth";
import { getApplicationConfig } from "../../application-registry";
import shared from "../shared-client-admin.module.css";
import BaumanAdmin from "./bauman-admin";

export const dynamic = "force-dynamic";

export default async function BaumanAdminPage() {
  const user = await requireChatGPTUser("/apps/bauman-master-ai");
  const application = getApplicationConfig("bauman-master-ai");
  if (!application) throw new Error("Không tìm thấy cấu hình Bauman Master AI.");
  return <div className={shared.scope}>
    <BaumanAdmin application={application} user={{ displayName: user.displayName, email: user.email }} />
  </div>;
}
