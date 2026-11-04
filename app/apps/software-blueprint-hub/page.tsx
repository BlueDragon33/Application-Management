import { redirect } from "next/navigation";
import { requireChatGPTUser } from "../../chatgpt-auth";

export const dynamic = "force-dynamic";

// Compatibility route for existing bookmarks; never opens the external Blueprint website.
export default async function SoftwareBlueprintHubAdminPage() {
  await requireChatGPTUser("/apps/software-blueprint-hub");
  redirect("/tools/blueprint-compass");
}
