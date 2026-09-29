type ReportMetrics = {
  interactions30Days: number;
  learners30Days: number;
  averageResponseMs: number;
  adaptivePassRate: number;
  openReports: number;
  learnersAtRisk: number;
  costMicros: number;
};

type ReportLearner = {
  learnerName: string | null;
  className: string | null;
  deviceCode: string;
  averageMastery: number;
  interactionCount: number;
  alerts: Array<{ level: string; text: string }>;
};

export function csvCell(value: unknown): string {
  const cleaned = String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, " ");
  const safe = /^\s*[=+\-@]/.test(cleaned) ? `'${cleaned}` : cleaned;
  return `"${safe.replaceAll('"', '""')}"`;
}

function html(value: unknown): string {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[char] ?? char);
}

function number(value: number | undefined): string {
  return typeof value === "number" && Number.isFinite(value) ? value.toLocaleString("vi-VN") : "—";
}

export function buildAiOperationsReport(input: {
  generatedAt: Date;
  metrics?: Partial<ReportMetrics>;
  learners?: ReportLearner[];
  engine?: { name?: string; version?: string };
}): string {
  const generated = new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Ho_Chi_Minh" }).format(input.generatedAt);
  const date = new Intl.DateTimeFormat("vi-VN", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "Asia/Ho_Chi_Minh" });
  const periodStart = new Date(input.generatedAt.getTime() - 30 * 24 * 60 * 60 * 1000);
  const metrics = input.metrics;
  const atRisk = (input.learners ?? []).filter((item) => item.alerts.length > 0);
  const rows = atRisk.slice(0, 50).map((item, index) => `<tr><td>${index + 1}</td><td>${html(item.learnerName || item.deviceCode)}<small>${html(item.className || "Chưa có lớp")}</small></td><td>${html(number(item.averageMastery))}%</td><td>${html(number(item.interactionCount))}</td><td>${html(item.alerts.map((alert) => alert.text).join("; "))}</td></tr>`).join("");
  const stat = (label: string, value: string) => `<div class="stat"><span>${label}</span><strong>${html(value)}</strong></div>`;
  return `<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Báo cáo vận hành AI · Bơi ếch</title><style>
    @page { size: A4; margin: 17mm; }
    *{box-sizing:border-box}body{font:14px/1.5 Arial,sans-serif;color:#17302b;margin:0;background:#f3f7f5}main{max-width:210mm;margin:24px auto;padding:28px;background:white;box-shadow:0 8px 35px #143f3020}
    header{border-bottom:3px solid #147d62;padding-bottom:16px}header small{color:#147d62;font-weight:700;letter-spacing:.1em}h1{font-size:25px;margin:5px 0}h2{font-size:17px;margin:26px 0 9px}p{margin:5px 0;color:#4e6860}.meta{display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap}.stats{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:20px 0}.stat{padding:12px;border:1px solid #d7e6df;border-radius:8px}.stat span{display:block;font-size:12px;color:#536e64}.stat strong{display:block;font-size:19px;margin-top:4px}table{width:100%;border-collapse:collapse;font-size:12px}th{text-align:left;background:#e9f4ef}th,td{padding:8px;border-bottom:1px solid #dbe7e1;vertical-align:top}td small{display:block;color:#60786e}tr{break-inside:avoid}footer{border-top:1px solid #dbe7e1;margin-top:24px;padding-top:9px;font-size:11px;color:#60786e}
    @media(max-width:650px){main{margin:0;padding:16px}.stats{grid-template-columns:repeat(2,1fr)}table{display:block;overflow-x:auto}}@media print{body{background:white}main{margin:0;padding:0;box-shadow:none}.stats{grid-template-columns:repeat(3,1fr)}}
  </style></head><body><main><header><small>APPLICATION MANAGEMENT · BƠI ẾCH</small><h1>BÁO CÁO VẬN HÀNH AI</h1><div class="meta"><p>Kỳ thống kê: ${date.format(periodStart)} – ${date.format(input.generatedAt)} (30 ngày)</p><p>Xuất lúc: ${html(generated)} (GMT+7)</p></div><p>Động cơ: ${html(input.engine?.name || "Chưa xác định")} ${html(input.engine?.version || "")}</p></header>
  <h2>Tổng quan</h2><section class="stats">${stat("Tương tác AI", number(metrics?.interactions30Days))}${stat("Học viên sử dụng", number(metrics?.learners30Days))}${stat("Học viên cần hỗ trợ", number(metrics?.learnersAtRisk))}${stat("Phản hồi chờ xử lý", number(metrics?.openReports))}${stat("Tỷ lệ đạt bài thích ứng", metrics?.adaptivePassRate === undefined ? "—" : `${number(metrics.adaptivePassRate)}%`)}${stat("Thời gian phản hồi TB", metrics?.averageResponseMs === undefined ? "—" : `${number(metrics.averageResponseMs)} ms`)}</section>
  <h2>Học viên cần hỗ trợ tại thời điểm xuất</h2><p>${atRisk.length ? `Hiển thị ${Math.min(atRisk.length, 50)} trong ${atRisk.length} hồ sơ có cảnh báo.` : "Không có hồ sơ cảnh báo trong dữ liệu hiện tại."}</p>${atRisk.length ? `<table><thead><tr><th>STT</th><th>Học viên</th><th>Nắm vững</th><th>Tương tác</th><th>Nhận định</th></tr></thead><tbody>${rows}</tbody></table>` : ""}
  <footer>Nguồn: dữ liệu quản trị AI tại thời điểm xuất. Chỉ dùng nội bộ; kiểm tra hồ sơ gốc trước khi đưa ra quyết định cho học viên. Báo cáo không chứa nội dung trao đổi AI hoặc số điện thoại.</footer></main></body></html>`;
}
