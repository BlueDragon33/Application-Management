import type { Metadata } from "next";
import { requireChatGPTUser } from "../chatgpt-auth";
import MedicineControlClient from "./medicine-control-client";
import "./medicine-control.css";

export const metadata: Metadata = { title: "Kiểm duyệt thuốc Nga · QUẢN TRỊ ỨNG DỤNG · Y tế" };
export const dynamic = "force-dynamic";

export default async function MedicineControlPage() {
  const user = await requireChatGPTUser("/medicine-control");
  return <MedicineControlClient user={{ displayName: user.displayName, email: user.email }} />;
}
