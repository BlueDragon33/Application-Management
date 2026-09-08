import type { Metadata } from "next";
import { requireChatGPTUser } from "../../chatgpt-auth";
import IntegrationHealthClient from "./integration-health-client";
import "./integration-health.css";
import "./integration-health-operations.css";

export const metadata: Metadata = { title: "Kết nối RU_LIFE · Hòa nhập Nga" };
export const dynamic = "force-dynamic";

export default async function IntegrationHealthPage() {
  const user = await requireChatGPTUser("/medical-control/integration-health");
  return <IntegrationHealthClient user={{ displayName: user.displayName, email: user.email }} />;
}
