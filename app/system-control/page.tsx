import type { Metadata } from "next";
import { requireChatGPTUser } from "../chatgpt-auth";
import SystemControlClient from "./system-control-client";
import "./system-control.css";

export const metadata: Metadata = { title: "Hệ thống · QUẢN TRỊ ỨNG DỤNG" };
export const dynamic = "force-dynamic";

export default async function SystemControlPage() {
  const user = await requireChatGPTUser("/system-control");
  return <SystemControlClient user={{ displayName: user.displayName, email: user.email }} />;
}
