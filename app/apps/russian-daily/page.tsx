import { getApplicationConfig } from "../../application-registry";
import { requireChatGPTUser } from "../../chatgpt-auth";
import { PublicReleaseLink } from "./public-release-link";

export const dynamic = "force-dynamic";

export default async function RussianDailyControlPage() {
  await requireChatGPTUser("/apps/russian-daily");
  const application = getApplicationConfig("russian-daily");
  const url = application?.publicUrl;
  const siteUrl = url && URL.canParse(url) && new URL(url).protocol === "https:" ? url : undefined;

  return (
    <main style={{ maxWidth: 840, margin: "0 auto", padding: "28px 20px", lineHeight: 1.6 }}>
      <p style={{ fontSize: 13, opacity: 0.75 }}>App-Manager / Danh mục ứng dụng</p>
      <h1>{application?.name ?? "Russian Display-Master"}</h1>
      <p>Bản web học tiếng Nga cho iPhone và Android.</p>
      <section aria-labelledby="release-heading" style={{ border: "1px solid #8a9baa", borderRadius: 16, padding: 18 }}>
        <h2 id="release-heading">{siteUrl ? "Đường dẫn phát hành" : "Chờ phát hành"}</h2>
        {siteUrl ? (
          <PublicReleaseLink url={siteUrl} />
        ) : (
          <p>Đường dẫn sẽ xuất hiện sau khi bản web có địa chỉ HTTPS được xác minh.</p>
        )}
        <p>
          <a href="https://github.com/BlueDragon33/Bauman-Russian-iOS" target="_blank" rel="noopener noreferrer">
            Xem mã nguồn
          </a>
        </p>
      </section>
      <section aria-labelledby="device-heading" style={{ marginTop: 18 }}>
        <h2 id="device-heading">Quyền sử dụng theo thiết bị</h2>
        <p>Duyệt, khóa và mở lại quyền sử dụng đang chờ Russian Display-Master kết nối Device Gate.</p>
        <p><a href="/tools/managed-apps">Kiểm tra kết nối ứng dụng</a></p>
      </section>
      <section aria-labelledby="data-heading" style={{ marginTop: 18 }}>
        <h2 id="data-heading">Tiến độ trên thiết bị</h2>
        <p>Khi chuyển thiết bị, xuất bản sao JSON trong Cài đặt của Display-Master rồi nhập trên máy mới.</p>
        <p><a href="/tools/russian-daily">Mở công cụ lịch STANKIN</a></p>
      </section>
    </main>
  );
}
