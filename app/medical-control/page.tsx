import type { Metadata } from "next";
import { requireChatGPTUser } from "../chatgpt-auth";
import MedicalControlClient from "./medical-control-client";
import "./medical-control.css";
import "./medical-control-access.css";

export const metadata: Metadata = { title: "Y tế · QUẢN TRỊ ỨNG DỤNG" };
export const dynamic = "force-dynamic";

export default async function MedicalControlPage() {
  const user = await requireChatGPTUser("/medical-control");
  return <MedicalControlClient user={{ displayName: user.displayName, email: user.email }} />;
}
