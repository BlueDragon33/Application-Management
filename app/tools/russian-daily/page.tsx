import type { Metadata } from "next";
import { requireChatGPTUser } from "../../chatgpt-auth";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Russian Daily · Application Management · Candidate",
  description: "Lịch học STANKIN và từ vựng tiếng Nga — bản thử nghiệm chưa triển khai Production.",
};

export default async function RussianDailyEntry() {
  await requireChatGPTUser("/tools/russian-daily");
  return (
    <main style={{ minHeight: "100vh", padding: "24px 16px", maxWidth: 680, margin: "0 auto" }}>
      <h1 style={{ fontSize: 26, marginBottom: 8 }}>Russian Daily · iPhone Preview</h1>
      <p>Ứng dụng cục bộ để thử lịch học và từ vựng tiếng Nga. Không có đồng bộ Google/Apple tự động hoặc WidgetKit thật.</p>
      <p><strong>Trạng thái:</strong> CANDIDATE · P0/RU03 BLOCKED · ZERO-SPEND.</p>
      <a href="/russian-daily/index.html" style={{ display: "inline-block", borderRadius: 12, padding: "14px 19px", background: "#1764a1", color: "white", fontWeight: 700, textDecoration: "none" }}>Mở Russian Daily để thử trên iPhone</a>
      <p style={{ fontSize: 14, marginTop: 20 }}>Trong Safari tại địa chỉ HTTPS đã được phê duyệt, mở ứng dụng trực tiếp rồi chọn Chia sẻ → Thêm vào Màn hình chính. Chưa có link Preview online được xác minh.</p>
    </main>
  );
}
