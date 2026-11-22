import { redirect } from "next/navigation";
import { requireChatGPTUser } from "../../chatgpt-auth";

export const dynamic = "force-dynamic";

/**
 * Backwards-compatible admin bookmark. Blueprint engineering authority remains
 * in Software-Blueprint-Hub; this does not delegate QA/release rights to App.
 */
export default async function SoftwareBlueprintHubAdminPage() {
  await requireChatGPTUser("/apps/software-blueprint-hub");
  redirect("/tools/blueprint-compass");
}
