"use client";

const hub = "https://bauman-sub-web-app.dinhnam3391.chatgpt.site";
const subjects = [
  ["russian", "Tiếng Nga", "Giao tiếp học thuật, đọc đề và báo cáo"],
  ["foundation", "Nền tảng", "Đơn vị, mô hình và đo lường"],
  ["math", "Toán", "Giải tích, đại số và xác suất"],
  ["programming", "Lập trình", "Python, dữ liệu và kiểm thử"],
  ["ai", "Trí tuệ nhân tạo", "Mô hình, huấn luyện và đánh giá"],
  ["systems", "Hệ thống", "Kiến trúc, điều khiển và độ tin cậy"],
  ["signal", "Tín hiệu", "Lấy mẫu, Fourier và ước lượng"],
  ["research", "Nghiên cứu", "Thiết kế nghiên cứu, НИР và ВКР"],
] as const;

export default function BaumanHubCenter() {
  return <div className="bauman-hub-center">
    <section className="bauman-hub-overview">
      <span className="eyebrow">Ứng dụng trong trung tâm</span>
      <h2>BAUMAN MASTER HUB</h2>
      <p>Điều phối lộ trình, lịch học, học liệu và tiến độ của tám môn Bauman.</p>
      <div className="bauman-hub-actions">
        <a className="button primary" href={hub} target="_blank" rel="noopener noreferrer">Mở Hub ↗</a>
        <a className="button" href={`${hub}/?page=admin`} target="_blank" rel="noopener noreferrer">Quản trị Hub ↗</a>
        <a className="button" href={`${hub}/?page=deep`} target="_blank" rel="noopener noreferrer">Tuyến học sâu ↗</a>
        <a className="button" href={`${hub}/?install=1`} target="_blank" rel="noopener noreferrer">Cài ứng dụng & Offline ↗</a>
      </div>
      <dl className="bauman-hub-facts"><div><dt>Hệ thống</dt><dd>1 Hub · 8 môn</dd></div><div><dt>Học sâu đã biên soạn</dt><dd>32 chuyên đề</dd></div><div><dt>Kết nối trung tâm</dt><dd>Điều hướng quản trị</dd></div></dl>
      <p className="bauman-hub-boundary">Các liên kết không cấp thêm quyền truy cập. Hub và các môn vẫn dùng quyền riêng tư của Sites. Tiến độ Bauman hiện lưu trên thiết bị và trao đổi trong phiên Hub; chưa đồng bộ dữ liệu người học, thiết bị hoặc phân quyền với cơ sở dữ liệu của trung tâm. Số chuyên đề là danh mục phát hành, không phải số liệu hoạt động trực tiếp.</p>
    </section>
    <section aria-labelledby="bauman-subject-heading"><h2 id="bauman-subject-heading">Danh mục môn học</h2><p>Mở từ Hub để chuyển cả ngữ cảnh tài khoản và nhiệm vụ. Các liên kết dưới đây mở môn độc lập.</p>
      <div className="bauman-managed-grid">{subjects.map(([id, name, detail]) => <article key={id}><span>4 chuyên đề học sâu</span><h3>{name}</h3><p>{detail}</p><a className="button" href={`https://bauman-subject-${id}.dinhnam3391.chatgpt.site/subjects/${id}/index.html?mode=academic`} target="_blank" rel="noopener noreferrer">Mở môn ↗</a></article>)}</div>
    </section>
  </div>;
}
