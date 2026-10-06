import { requireChatGPTUser } from "../../chatgpt-auth";
import PcManagerAdmin from "./pc-manager-admin";

export const dynamic = "force-dynamic";

export default async function PcManagerAdminPage() {
  const user = await requireChatGPTUser("/apps/pc-manager");
  return (
    <PcManagerAdmin
      user={{ displayName: user.displayName, email: user.email }}
    />
  );
}
