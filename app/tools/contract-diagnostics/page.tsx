"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { connectOperationsDashboard, type OperationsBootstrap } from "../../admin-device-client";

const stateLabel: Record<string, string> = {
  connected: "Đã kết nối",
  warning: "Có cảnh báo",
  pending: "Chờ backend",
  unavailable: "Mất kết nối",
};

export default function ContractDiagnosticsPage() {
  const [data, setData] = useState<OperationsBootstrap | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const result = await connectOperationsDashboard();
      if (!result.bootstrap) throw new Error("Thiết bị quản trị chưa được cấp quyền.");
      setData(result.bootstrap);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không đọc được trạng thái contract.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  return (
    <main style={{ minHeight: "100vh", background: "#081b15", color: "#ecfff8", padding: "28px 22px", fontFamily: "Inter, Arial, sans-serif" }}>
      <section style={{ maxWidth: 1050, margin: "0 auto" }}>
        <header style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 22 }}>
          <div>
            <small style={{ color: "#65d9ba", fontWeight: 800, letterSpacing: ".08em" }}>LOCAL SYSTEM DOCTOR</small>
            <h1 style={{ margin: "6px 0 8px", fontSize: 30 }}>Chẩn đoán contract ứng dụng</h1>
            <p style={{ margin: 0, color: "#a8c4ba", maxWidth: 760, lineHeight: 1.55 }}>
              Trang này hiển thị nguyên nhân thật mà Trung tâm nhận được từ từng client. Trạng thái “Chờ contract” ở dashboard không được giả lập thành “Đã kết nối”.
            </p>
          </div>
          <Link href="/" style={{ color: "#eafff7", textDecoration: "none", padding: "10px 14px", border: "1px solid #285647", borderRadius: 10 }}>← Quản trị</Link>
        </header>

        <div style={{ display: "flex", gap: 10, marginBottom: 18, flexWrap: "wrap" }}>
          <button onClick={() => void load()} disabled={loading} style={{ border: 0, borderRadius: 10, padding: "10px 14px", background: "#13785f", color: "white", fontWeight: 800, cursor: "pointer" }}>
            {loading ? "Đang kiểm tra…" : "Kiểm tra lại"}
          </button>
          <a href="http://127.0.0.1:3004/" target="_blank" rel="noopener noreferrer" style={linkStyle}>Bơi ếch ↗</a>
          <a href="http://127.0.0.1:3001/suc-khoe-tre" target="_blank" rel="noopener noreferrer" style={linkStyle}>Sức khỏe ↗</a>
          <a href="http://127.0.0.1:3002/" target="_blank" rel="noopener noreferrer" style={linkStyle}>Hòa nhập Nga ↗</a>
          <a href="http://127.0.0.1:3005/" target="_blank" rel="noopener noreferrer" style={linkStyle}>Bauman ↗</a>
          <Link href="/tools/secret-generator" style={linkStyle}>Tạo Key / Secret</Link>
        </div>

        {error ? <div style={{ padding: 16, borderRadius: 12, background: "#431b1b", border: "1px solid #7d3636", marginBottom: 16 }}><strong>Lỗi Trung tâm:</strong> {error}</div> : null}

        <div style={{ display: "grid", gap: 12 }}>
          {(data?.summaries ?? []).map((item) => (
            <article key={item.appId} style={{ background: "#0d2a20", border: "1px solid #20483a", borderRadius: 14, padding: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginBottom: 9 }}>
                <strong style={{ fontSize: 17 }}>{item.appName}</strong>
                <span style={{ fontSize: 12, fontWeight: 800, color: item.connection === "connected" ? "#74e0bd" : item.connection === "unavailable" ? "#ff8e8e" : "#ffd778" }}>
                  {stateLabel[item.connection] ?? item.connection}
                </span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "minmax(120px, 180px) 1fr", gap: "7px 12px", fontSize: 13 }}>
                <span style={muted}>Web runtime</span><code style={codeStyle}>{item.webHref ?? "—"}</code>
                <span style={muted}>Direct web access</span><code style={codeStyle}>{String(item.directWebAccess)}</code>
                <span style={muted}>Managed launch</span><code style={codeStyle}>{String(item.managedWebLaunch)}</code>
                <span style={muted}>Chi tiết</span><span style={{ color: "#d8eee6", lineHeight: 1.5 }}>{item.note || "—"}</span>
              </div>
            </article>
          ))}
        </div>

        {!loading && !error && !(data?.summaries.length) ? <p style={{ color: "#ffd778" }}>Trung tâm chưa trả summary nào.</p> : null}
      </section>
    </main>
  );
}

const linkStyle = { color: "#eafff7", textDecoration: "none", padding: "9px 11px", border: "1px solid #285647", borderRadius: 10, fontSize: 13, fontWeight: 700 } as const;
const muted = { color: "#8eb0a3" } as const;
const codeStyle = { color: "#c9f7e7", overflowWrap: "anywhere" } as const;
