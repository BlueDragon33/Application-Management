import type { Metadata } from "next";
import { requireChatGPTUser } from "../../chatgpt-auth";
import RussianTimeTrainer from "./trainer";
import { russianTimeTrainerTool } from "./tool-entry";
import { trainerStoragePrefix } from "./progress";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: russianTimeTrainerTool.name,
  description: russianTimeTrainerTool.description,
};

export default async function RussianTimeTrainerPage() {
  const user = await requireChatGPTUser(russianTimeTrainerTool.href);
  return <RussianTimeTrainer key={user.userId} storagePrefix={trainerStoragePrefix(user.userId)} />;
}
