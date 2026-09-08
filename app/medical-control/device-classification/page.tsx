import type { Metadata } from "next";
import { requireChatGPTUser } from "../../chatgpt-auth";
import DeviceClassificationClient from "./device-classification-client";
import "./device-classification.css";

export const metadata: Metadata = { title: "Phân loại thiết bị HN · QUẢN TRỊ ỨNG DỤNG" };
export const dynamic = "force-dynamic";

export default async function DeviceClassificationPage() {
  const user = await requireChatGPTUser("/medical-control/device-classification");
  return <DeviceClassificationClient user={{ displayName: user.displayName, email: user.email }} />;
}
