import type { Metadata } from "next";
import { requireChatGPTUser } from "../../../chatgpt-auth";
import CloudflarePreviewConnection from "./connection";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Cloudflare Preview · Bơi ếch · Application Management" };
export default async function PreviewConnectionPage() {
  await requireChatGPTUser("/apps/boi-ech/cloudflare-preview");
  return <CloudflarePreviewConnection />;
}
