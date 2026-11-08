import type { Metadata } from "next";
import { requireChatGPTUser } from "../../chatgpt-auth";
import CourseworkWorkbench from "./coursework-workbench";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Coursework Workbench · Курсовая работа · Application Management",
  description: "Ứng dụng độc lập quản lý nhiều bài tập lớn và đồ án môn học Bauman.",
};

export default async function CourseworkWorkbenchPage() {
  const user = await requireChatGPTUser("/apps/coursework-workbench");
  return <CourseworkWorkbench user={{ email: user.email, displayName: user.displayName }} />;
}
