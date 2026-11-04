import type { Metadata } from "next";
import { requireChatGPTUser } from "../../chatgpt-auth";
import { projectRepositories } from "../../project-registry";
import BlueprintCompass from "./blueprint-compass";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Blueprint Compass · Application Management",
  description: "Kim chỉ nam kỹ thuật dùng chung cho các dự án GitHub; không tự phê duyệt hoặc phát hành.",
};
export default async function BlueprintCompassPage() {
  await requireChatGPTUser("/tools/blueprint-compass");
  return <BlueprintCompass projects={projectRepositories.map(project => ({
    id: project.id, name: project.name, repository: project.repository,
    group: project.group, state: project.state, summary: project.summary,
  }))}/>;
}
