import { requireChatGPTUser } from "./chatgpt-auth";
import ControlCenter from "./control-center";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await requireChatGPTUser("/");

  return (
    <>
      <a
        href="/logout?return_to=/login"
        style={{
          position: "fixed",
          top: 12,
          right: 12,
          zIndex: 1000,
          padding: "8px 11px",
          borderRadius: 9,
          background: "rgba(23,59,51,.94)",
          color: "white",
          textDecoration: "none",
          fontSize: 13,
          fontWeight: 700,
          boxShadow: "0 6px 18px rgba(0,0,0,.15)",
        }}
      >
        Đăng xuất
      </a>
      <ControlCenter user={{ displayName: user.displayName, email: user.email }} />
    </>
  );
}
