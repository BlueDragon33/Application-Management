export const BAUMAN_HUB_URL = "https://bauman-sub-web-app.dinhnam3391.chatgpt.site";

export type BaumanSubject = {
  id: string;
  title: string;
  detail: string;
  href: string;
};

export const BAUMAN_SUBJECTS: BaumanSubject[] = [
  { id: "russian", title: "Tiếng Nga", detail: "Giao tiếp học thuật, đọc đề và báo cáo", href: "https://bauman-subject-russian.dinhnam3391.chatgpt.site/subjects/russian/index.html?mode=academic" },
  { id: "foundation", title: "Nền tảng", detail: "Đơn vị, mô hình và đo lường", href: "https://bauman-subject-foundation.dinhnam3391.chatgpt.site/subjects/foundation/index.html?mode=academic" },
  { id: "math", title: "Toán", detail: "Giải tích, đại số và xác suất", href: "https://bauman-subject-math.dinhnam3391.chatgpt.site/subjects/math/index.html?mode=academic" },
  { id: "programming", title: "Lập trình", detail: "Python, dữ liệu và kiểm thử", href: "https://bauman-subject-programming.dinhnam3391.chatgpt.site/subjects/programming/index.html?mode=academic" },
  { id: "ai", title: "Trí tuệ nhân tạo", detail: "Mô hình, huấn luyện và đánh giá", href: "https://bauman-subject-ai.dinhnam3391.chatgpt.site/subjects/ai/index.html?mode=academic" },
  { id: "systems", title: "Hệ thống", detail: "Kiến trúc, điều khiển và độ tin cậy", href: "https://bauman-subject-systems.dinhnam3391.chatgpt.site/subjects/systems/index.html?mode=academic" },
  { id: "signal", title: "Tín hiệu", detail: "Lấy mẫu, Fourier và ước lượng", href: "https://bauman-subject-signal.dinhnam3391.chatgpt.site/subjects/signal/index.html?mode=academic" },
  { id: "research", title: "Nghiên cứu", detail: "Thiết kế nghiên cứu, НИР và ВКР", href: "https://bauman-subject-research.dinhnam3391.chatgpt.site/subjects/research/index.html?mode=academic" },
];
