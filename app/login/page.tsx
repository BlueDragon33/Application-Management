import { chatGPTSignInPath, safeReturnPath } from "../chatgpt-auth";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export default async function LoginPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const returnTo = safeReturnPath(first(params.return_to) || "/");
  const signInPath = chatGPTSignInPath(returnTo);

  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24, background: "#f2eee5", color: "#182421" }}>
      <section style={{ width: "min(440px, 100%)", background: "#fffdf8", border: "1px solid #d8d2c6", borderRadius: 18, padding: 28, boxShadow: "0 18px 50px rgba(24,36,33,.12)" }}>
        <p style={{ margin: 0, color: "#58716a", fontSize: 14, fontWeight: 700, letterSpacing: ".04em", textTransform: "uppercase" }}>Quản trị ứng dụng</p>
        <h1 style={{ margin: "8px 0 10px", fontSize: 30 }}>Đăng nhập quản trị</h1>
        <p style={{ margin: "0 0 22px", color: "#64716c", lineHeight: 1.55 }}>Một tài khoản quản trị dùng chung cho Bauman, Bơi ếch, Sức khỏe và những Site sẽ được kết nối sau.</p>

        <a href={signInPath} style={{ display: "block", textAlign: "center", textDecoration: "none", marginTop: 4, padding: "12px 16px", borderRadius: 11, background: "#173b33", color: "white", fontWeight: 800, fontSize: 16 }}>
          Đăng nhập bằng ChatGPT
        </a>
        <p style={{ margin: "14px 0 0", color: "#64716c", fontSize: 13, lineHeight: 1.5 }}>
          Site dùng chính tài khoản ChatGPT đang đăng nhập. Nếu tài khoản đã liên kết Gmail, email liên kết sẽ được dùng làm định danh quản trị; không cần mật khẩu riêng.
        </p>
      </section>
    </main>
  );
}
