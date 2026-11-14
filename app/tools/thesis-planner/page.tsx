import type { Metadata } from "next";
import { requireChatGPTUser } from "../../chatgpt-auth";
import ThesisPlanner from "./thesis-planner";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Thesis Planner · Luận văn Bauman · Application Management",
  description: "Lộ trình nghiên cứu luận văn thạc sĩ có minh chứng, tiến độ và bản sao lưu cục bộ.",
};

export default async function ThesisPlannerPage() {
  const user = await requireChatGPTUser("/tools/thesis-planner");
  return <ThesisPlanner user={{ email: user.email, displayName: user.displayName }} />;
}
