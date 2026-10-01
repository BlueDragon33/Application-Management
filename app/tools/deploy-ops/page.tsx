import type { Metadata } from "next";
import { requireChatGPTUser } from "../../chatgpt-auth";
import DeployOpsTool from "./deploy-ops";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Deploy & Ops · Application Management",
  description: "Điều phối mapping Vercel, Neon và TinyFish; kiểm tra điều kiện Safe Publish mà không lưu secret.",
};

export default async function DeployOpsPage() {
  const user = await requireChatGPTUser("/tools/deploy-ops");
  return <DeployOpsTool user={{ displayName: user.displayName, email: user.email }} />;
}
