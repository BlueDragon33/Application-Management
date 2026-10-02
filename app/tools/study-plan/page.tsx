import type { Metadata } from "next";
import { requireChatGPTUser } from "../../chatgpt-auth";
import StudyPlanTool from "./study-plan";
import { loadBaumanStudyModules } from "./bauman-module-registry";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Phân tích lịch học Bauman · Application Management",
  description: "Công cụ phân tích kế hoạch đào tạo Bauman 09.04.01/11 theo tuần, tháng, học kỳ và năm; hỗ trợ tiếng Việt và tiếng Anh.",
};

export default async function StudyPlanPage() {
  const [user, baumanRegistry] = await Promise.all([
    requireChatGPTUser("/tools/study-plan"),
    loadBaumanStudyModules(),
  ]);
  return (
    <StudyPlanTool
      user={{ displayName: user.displayName, email: user.email }}
      baumanModules={baumanRegistry.modules}
      baumanRegistryStatus={baumanRegistry.status}
      mayOpenLearningRuntimeDirectly={baumanRegistry.mayOpenLearningRuntimeDirectly}
    />
  );
}
