import type { Metadata } from "next";
import { requireChatGPTUser } from "../../chatgpt-auth";
import WebAppGuide from "./web-app-guide";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Hướng dẫn lập trình Web-App · Application Management",
  description: "Web-App Engineering Playbook: xây dựng, kiểm thử và phát hành Cloudflare theo Blueprint OS G0–G8, có vòng xử lý và tiêu chí dừng."
};

export default async function WebAppGuidePage() {
  const user = await requireChatGPTUser("/tools/web-app-guide");
  return <WebAppGuide displayName={user.displayName} />;
}
