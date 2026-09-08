import type { Metadata } from "next";
import { requireChatGPTUser } from "../../chatgpt-auth";
import AccessPreflightClient from "./access-preflight-client";
import "./access-preflight.css";

export const metadata: Metadata = { title: "Preflight cấp quyền · Hòa nhập Nga" };
export const dynamic = "force-dynamic";

export default async function AccessPreflightPage() {
  const user = await requireChatGPTUser("/medical-control/access-preflight");
  return <AccessPreflightClient user={{ displayName: user.displayName, email: user.email }} />;
}
