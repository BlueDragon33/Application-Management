import type { Metadata } from "next";
import { requireChatGPTUser } from "../../chatgpt-auth";
import StudyPlanTool from "./study-plan";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Phân tích lịch học Bauman · Application Management",
  description: "Công cụ phân tích kế hoạch đào tạo Bauman 09.04.01/11 theo tuần, tháng, học kỳ và năm; hỗ trợ tiếng Việt và tiếng Anh.",
};

export default async function StudyPlanPage() {
  const user = await requireChatGPTUser("/tools/study-plan");
  return <StudyPlanTool user={{ displayName: user.displayName, email: user.email }} />;
}
