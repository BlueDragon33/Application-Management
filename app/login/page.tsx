export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export default async function LoginPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const error = first(params.error);
  const returnTo = first(params.return_to) || "/";

  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24, background: "#f2eee5", color: "#182421" }}>
      <section style={{ width: "min(440px, 100%)", background: "#fffdf8", border: "1px solid #d8d2c6", borderRadius: 18, padding: 28, boxShadow: "0 18px 50px rgba(24,36,33,.12)" }}>
        <p style={{ margin: 0, color: "#58716a", fontSize: 14, fontWeight: 700, letterSpacing: ".04em", textTransform: "uppercase" }}>Learning Management</p>
        <h1 style={{ margin: "8px 0 10px", fontSize: 30 }}>Đăng nhập quản trị</h1>
        <p style={{ margin: "0 0 22px", color: "#64716c", lineHeight: 1.55 }}>Chỉ tài khoản quản trị đã được cấp quyền mới có thể truy cập hệ thống.</p>

        {error ? (
          <div role="alert" style={{ marginBottom: 18, padding: "11px 13px", borderRadius: 10, background: "#fff0ee", border: "1px solid #e4b9b2", color: "#8b2d21", fontSize: 14 }}>
            Email hoặc mật khẩu không đúng.
          </div>
        ) : null}

        <form method="post" action="/api/auth/login" style={{ display: "grid", gap: 14 }}>
          <input type="hidden" name="returnTo" value={returnTo} />
          <label style={{ display: "grid", gap: 7, fontWeight: 700 }}>
            Email quản trị
            <input name="email" type="email" autoComplete="username" required style={{ width: "100%", boxSizing: "border-box", padding: "12px 13px", borderRadius: 10, border: "1px solid #b8c2bd", background: "white", color: "#182421", font: "inherit" }} />
          </label>
          <label style={{ display: "grid", gap: 7, fontWeight: 700 }}>
            Mật khẩu
            <input name="password" type="password" autoComplete="current-password" required minLength={10} style={{ width: "100%", boxSizing: "border-box", padding: "12px 13px", borderRadius: 10, border: "1px solid #b8c2bd", background: "white", color: "#182421", font: "inherit" }} />
          </label>
          <button type="submit" style={{ marginTop: 4, padding: "12px 16px", borderRadius: 11, border: 0, background: "#173b33", color: "white", fontWeight: 800, fontSize: 16, cursor: "pointer" }}>
            Đăng nhập
          </button>
        </form>
      </section>
    </main>
  );
}
