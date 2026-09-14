import { requireChatGPTUser } from "../chatgpt-auth";
import ProjectsCatalog from "./projects-catalog";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  await requireChatGPTUser("/projects");
  return <ProjectsCatalog />;
}
