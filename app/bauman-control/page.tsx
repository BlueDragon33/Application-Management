import type { Metadata } from "next";
import { requireChatGPTUser } from "../chatgpt-auth";
import BaumanControlClient from "./bauman-control-client";
import "./bauman-control.css";

export const metadata: Metadata = { title: "Bauman · QUẢN TRỊ ỨNG DỤNG" };
export const dynamic = "force-dynamic";

export default async function BaumanControlPage() {
  const user = await requireChatGPTUser("/bauman-control");
  return <BaumanControlClient user={{ displayName: user.displayName, email: user.email }} />;
}
