import { getApplicationConfig } from "../../application-registry";
import { requireChatGPTUser } from "../../chatgpt-auth";

export const dynamic = "force-dynamic";

export default async function RussianDailyControlPage() {
  await requireChatGPTUser("/apps/russian-daily");
  const application = getApplicationConfig("russian-daily");
  const siteUrl = application?.publicUrl;

  return (
    <main style={{ maxWidth: 840, margin: "0 auto", padding: "28px 20px", lineHeight: 1.6 }}>
      <p style={{ fontSize: 13, opacity: 0.75 }}>Application Management / Web-app riêng</p>
      <h1>Russian Daily — Contrast Lab</h1>
      <p>
        Đây là mục danh mục/quản trị, không phải nơi lưu mã ứng dụng. Russian Daily Contrast Lab
        học tiếng Nga bằng cặp từ, trọng âm, hình ảnh riêng cho mỗi nghĩa và hai nút nghe;
        màn hình học không dịch từ sang tiếng Việt. Lịch học là tính năng phụ.
        Ứng dụng độc lập không cần phát hành lại App-Management cho mỗi lần sửa giao diện.
      </p>
      <section aria-label="Trạng thái triển khai" style={{ border: "1px solid #8a9baa", borderRadius: 16, padding: 18 }}>
        <h2>Trạng thái hiện tại: CÓ PREVIEW ĐỂ OWNER ĐÁNH GIÁ / CHƯA PHÁT HÀNH</h2>
        <p>Vercel Hobby hiện có URL QA riêng, đã bật Vercel Authentication; chưa kiểm thử Safari thực tế, chưa có Control API hoặc reviewer. Không coi URL QA là địa chỉ Production được phê duyệt.</p>
        <p>Blueprint OS 1.3.0: REVIEW BLOCKED; không có quyền tự phê duyệt, merge, publish hay công nhận RU03.</p>
        {siteUrl ? (
          <p><a href={siteUrl} target="_blank" rel="noopener noreferrer">Mở web-app độc lập</a></p>
        ) : (
          <p>URL QA có bảo vệ hiện chỉ phục vụ đánh giá đầu ra. Chưa đăng ký URL Production được duyệt cho hệ thống quản lý.</p>
        )}
        <p>
          <a href="https://github.com/BlueDragon33/Bauman-Russian-iOS/tree/candidate/russian-daily-standalone-sites-pwa-20261103-v2/web/russian-daily-standalone" target="_blank" rel="noopener noreferrer">
            Xem nguồn Russian Daily đã tách
          </a>
        </p>
      </section>
      <section aria-label="Chuyển đổi từ phiên bản cũ" style={{ marginTop: 18 }}>
        <h2>Bảo toàn dữ liệu khi thay ứng dụng</h2>
        <p>Bản STANKIN cũ vẫn còn và không được tự chuyển dữ liệu sang Contrast Lab. Hai ứng dụng có cấu trúc dữ liệu khác nhau: không nhập chéo JSON cũ khi chưa có trình chuyển đổi được kiểm thử. Giữ bản sao dữ liệu riêng và không khẳng định đồng bộ tự động.</p>
        <p><a href="/tools/russian-daily">Mở bản STANKIN cũ (chỉ dùng khi cần dữ liệu cũ)</a></p>
      </section>
    </main>
  );
}
