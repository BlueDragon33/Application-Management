import { requireChatGPTUser } from "../../chatgpt-auth";
import HealthCareAdmin from "./health-care-admin";

export const dynamic = "force-dynamic";

export default async function HealthCareAdminPage() {
  const user = await requireChatGPTUser("/apps/health-care");
  return <HealthCareAdmin user={{ displayName: user.displayName, email: user.email }} />;
}
