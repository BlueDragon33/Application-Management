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
      <h1>Russian Daily — STANKIN</h1>
      <p>
        Đây là mục quản trị / danh mục ứng dụng. Mã nguồn học tiếng Nga và lịch STANKIN
        thuộc ứng dụng riêng, không còn yêu cầu phát hành lại App-Management để sửa giao diện
        sau khi Site độc lập được đưa vào hoạt động.
      </p>
      <section aria-label="Trạng thái triển khai" style={{ border: "1px solid #8a9baa", borderRadius: 16, padding: 18 }}>
        <h2>Trạng thái hiện tại: SOURCE CANDIDATE / CHƯA PHÁT HÀNH</h2>
        <p>Hosting dự kiến: ChatGPT Sites. Chưa được cấp URL thật, chưa kiểm thử Safari thật, chưa có SSO hoặc Control API để điều hành từ xa.</p>
        <p>Blueprint OS 1.3.0: REVIEW BLOCKED; không có quyền tự phê duyệt, merge, publish hay công nhận RU03.</p>
        {siteUrl ? (
          <p><a href={siteUrl} target="_blank" rel="noopener noreferrer">Mở web-app độc lập</a></p>
        ) : (
          <p>Liên kết web-app độc lập sẽ chỉ hiển thị sau khi chủ dự án cấp URL thật và QA đọc lại thành công.</p>
        )}
        <p>
          <a href="https://github.com/BlueDragon33/Bauman-Russian-iOS/tree/candidate/russian-daily-standalone-chatgpt-sites-20261103/web/russian-daily" target="_blank" rel="noopener noreferrer">
            Xem nguồn Russian Daily đã tách
          </a>
        </p>
      </section>
      <section aria-label="Chuyển đổi từ phiên bản cũ" style={{ marginTop: 18 }}>
        <h2>Chuyển dữ liệu cá nhân an toàn</h2>
        <p>Bản Russian Daily hiện tại vẫn nằm ở Application-Management, chưa bị xóa hoặc chuyển hướng. Trước khi dùng Site mới, cần xuất bản sao JSON từ bản cũ rồi nhập thủ công vào Site mới và xác minh lịch học.</p>
        <p><a href="/tools/russian-daily">Dùng tạm bản Russian Daily hiện tại</a></p>
      </section>
    </main>
  );
}
