import type { Metadata } from "next";
import { requireChatGPTUser } from "../../chatgpt-auth";
import KdMidVisaTool from "./kd-mid-visa";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "KD-MID Visa VN · Application Management",
  description: "Tool chuẩn bị hồ sơ visa Nga: form tiếng Nga, hướng dẫn tiếng Việt, dữ liệu dùng chung và bản ghi mở lại hồ sơ.",
};

export default async function KdMidVisaPage() {
  const user = await requireChatGPTUser("/tools/kd-mid-visa");
  return <KdMidVisaTool user={{ displayName: user.displayName, email: user.email }} />;
}
