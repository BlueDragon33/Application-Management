import { getApplicationConfig } from "../../application-registry";
import { requireChatGPTUser } from "../../chatgpt-auth";
import shared from "../shared-client-admin.module.css";
import RuLifeAdmin from "./ru-life-admin";

export const dynamic = "force-dynamic";

export default async function RuLifeAdminPage() {
  const user = await requireChatGPTUser("/apps/ru-life");
  const application = getApplicationConfig("ru-life");
  const publicUrl = application?.publicUrl ?? "https://hoa-nhap-nga.dinhnam3391.chatgpt.site";

  return <div className={shared.scope}>
    <RuLifeAdmin
      user={{ displayName: user.displayName, email: user.email }}
      publicUrl={publicUrl}
    />
  </div>;
}
