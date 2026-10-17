import { requireChatGPTUser } from "../../chatgpt-auth";
import ZeroSpendViewer from "./zero-spend-viewer";

export const dynamic = "force-dynamic";

export default async function ZeroSpendLocalQAPage() {
  // Same authentication boundary as /projects. No production session bypass.
  await requireChatGPTUser("/projects/zero-spend");
  return <ZeroSpendViewer />;
}
