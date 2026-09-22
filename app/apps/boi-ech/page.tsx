import { requireChatGPTUser } from "../../chatgpt-auth";
import BoiEchControlCenter from "./boi-ech-control-center";
import shell from "./boi-ech-shell.module.css";

export const dynamic = "force-dynamic";

export default async function BoiEchAdminPage() {
  const user = await requireChatGPTUser("/apps/boi-ech");
  return <div className={shell.scope}>
    <BoiEchControlCenter user={{ displayName: user.displayName, email: user.email }} />
  </div>;
}
