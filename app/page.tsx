import Link from "next/link";
import { requireChatGPTUser } from "./chatgpt-auth";
import ApplicationHub from "./application-hub";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await requireChatGPTUser("/");
  return <>
    <ApplicationHub user={{ displayName: user.displayName, email: user.email }} />
    <Link
      href="/tools/secret-generator"
      aria-label="Mở công cụ tạo Key và Secret"
      style={{
        position: "fixed",
        right: 22,
        bottom: 22,
        zIndex: 90,
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "12px 16px",
        borderRadius: 14,
        background: "rgba(13, 119, 96, 0.96)",
        color: "#fff",
        fontWeight: 800,
        textDecoration: "none",
        boxShadow: "0 10px 30px rgba(0,0,0,.28)",
        border: "1px solid rgba(255,255,255,.16)",
      }}
    >
      Tạo Key / Secret
    </Link>
  </>;
}
