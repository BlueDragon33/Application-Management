/* eslint-disable @next/next/no-html-link-for-pages -- full reload keeps the supervised HTTP preview stable. */
import type { Metadata } from "next";
import { requireChatGPTUser } from "../chatgpt-auth";
import ControlCenter from "../control-center";
import "./learning-control.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Bơi ếch · QUẢN TRỊ ỨNG DỤNG" };

export default async function LearningControlPage() {
  const user = await requireChatGPTUser("/learning-control");

  return (
    <div className="learning-domain-shell">
      <div className="learning-domain-nav">
        <a href="/">← QUẢN TRỊ ỨNG DỤNG</a>
        <a href="/system-control">Hệ thống dùng chung</a>
      </div>
      <ControlCenter user={{ displayName: user.displayName, email: user.email }} />
    </div>
  );
}
