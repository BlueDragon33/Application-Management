import type { Metadata } from "next";
import { requireChatGPTUser } from "../../chatgpt-auth";
import DeployOpsTool from "./deploy-ops";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Deploy & Ops · Application Management",
  description: "Điều phối Vercel, Neon và TinyFish bằng API server-side; kiểm thử browser thật và Safe Publish theo commit SHA.",
};

export default async function DeployOpsPage() {
  const user = await requireChatGPTUser("/tools/deploy-ops");
  return <DeployOpsTool user={{ displayName: user.displayName, email: user.email }} />;
}
