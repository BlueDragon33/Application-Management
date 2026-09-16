import { requireChatGPTUser } from "../../chatgpt-auth";
import { probeGrowUpManagementContract } from "../../growup.server";
import shared from "../shared-client-admin.module.css";
import GrowUpAdmin from "./growup-admin";

export const dynamic = "force-dynamic";

export default async function GrowUpAdminPage() {
  const user = await requireChatGPTUser("/apps/growup-mychildren");
  let siteUrl = "";
  let siteError = "";
  let remoteAdminReady = false;
  try {
    const contract = await probeGrowUpManagementContract();
    siteUrl = contract.baseUrl;
    remoteAdminReady = contract.remoteAdminReady;
  } catch (error) {
    siteError = error instanceof Error ? error.message : "Không thể xác minh Site GrowUP.";
  }
  return <div className={shared.scope}>
    <GrowUpAdmin
      user={{ displayName: user.displayName, email: user.email }}
      site={{ url: siteUrl, error: siteError, remoteAdminReady }}
    />
  </div>;
}
