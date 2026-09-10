import { requireChatGPTUser } from "../../chatgpt-auth";
import HealthCareAdmin from "./health-care-admin";
import reference from "./health-care-admin-pixel-match.module.css";

export const dynamic = "force-dynamic";

export default async function HealthCareAdminPage() {
  const user = await requireChatGPTUser("/apps/health-care");
  return <div className={reference.scope}><HealthCareAdmin user={{ displayName: user.displayName, email: user.email }} /></div>;
}
