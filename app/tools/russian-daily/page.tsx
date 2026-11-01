import type { Metadata } from "next";
import { requireChatGPTUser } from "../../chatgpt-auth";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Russian Daily · Application Management",
  description: "Lịch học STANKIN và từ vựng tiếng Nga · công cụ thử nghiệm local-first.",
};

export default async function RussianDailyEntry() {
  await requireChatGPTUser("/tools/russian-daily");
  return (
    <main style={{ minHeight: "100vh", padding: "24px 16px", maxWidth: 680, margin: "0 auto" }}>
      <h1 style={{ fontSize: 26, marginBottom: 8 }}>Russian Daily · STANKIN</h1>
      <p>
        Công cụ lịch học và từ vựng tiếng Nga chạy trên thiết bị, sử dụng
        website Application-Management hiện có. Không cần đăng ký dịch vụ khác.
      </p>
      <p>
        <strong>Chế độ:</strong> USER TEST · dữ liệu cục bộ. Không có đồng bộ
        Calendar tự động, nhận dạng ảnh Telegram hay WidgetKit iOS native.
      </p>
      <a
        href="/russian-daily/index.html"
        style={{
          display: "inline-block",
          borderRadius: 12,
          padding: "14px 19px",
          background: "#1764a1",
          color: "white",
          fontWeight: 700,
          textDecoration: "none",
        }}
      >
        HƯỚNG DẪN / MỞ RUSSIAN DAILY
      </a>
      <p style={{ fontSize: 14, marginTop: 20 }}>
        Khi website đã được cập nhật và mở được địa chỉ HTTPS này trong Safari,
        hãy chọn Chia sẻ → Thêm vào Màn hình chính. Trước khi nhập lịch .ics,
        kiểm tra sự kiện đã có trong Google/Apple Calendar để tránh trùng.
      </p>
      <p style={{ fontSize: 13, color: "#65778b" }}>
        Russian Daily là bản thử nghiệm độc lập với chương trình học liệu
        Bauman-Russian-iOS. Các cổng P0/RU03 chưa được phê duyệt.
      </p>
    </main>
  );
}
