import { getChatGPTUser } from "./chatgpt-auth";
import ControlCenter from "./control-center";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getChatGPTUser();

  if (!user) {
    return (
      <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
        <section style={{ maxWidth: 560 }}>
          <h1>Không có quyền truy cập trang quản trị</h1>
          <p>
            Trang này chỉ hoạt động sau khi người dùng được xác thực bởi Cloudflare Access.
          </p>
        </section>
      </main>
    );
  }

  return <ControlCenter user={{ displayName: user.displayName, email: user.email }} />;
}
