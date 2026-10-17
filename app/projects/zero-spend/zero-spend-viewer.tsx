"use client";

import Link from "next/link";
import { useMemo, useState, type ChangeEvent } from "react";
import { parseZeroSpendReport, type ZeroSpendSummary } from "./zero-spend-report.mjs";
import styles from "./zero-spend.module.css";

const labels: Record<string, string> = {
  PRIVATE_AUTO_REVIEW: "Repo private: workflow tự động — cần xem xét",
  UNKNOWN_TRIGGER_REVIEW: "Không nhận diện được sự kiện",
  UNKNOWN_RUNNER_REVIEW: "Không rõ runner / cấu hình động",
  POTENTIAL_BILLING_REVIEW: "Runner có thể phát sinh phí",
  SELF_HOSTED_SECURITY_REVIEW: "Self-hosted: cần thẩm định bảo mật",
  MANUAL_NOT_COST_FREE: "Chạy thủ công vẫn có thể tính phí",
  PUBLIC_STANDARD_CANDIDATE: "Repo public, runner tiêu chuẩn — cần xác nhận",
  NO_WORKFLOWS_FOUND: "Không có workflow được phát hiện",
  NOT_CHECKED: "BLOCKED — Chưa có mã nguồn local",
};

export default function ZeroSpendViewer() {
  const [report, setReport] = useState<ZeroSpendSummary | null>(null);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");

  async function openFile(event: ChangeEvent<HTMLInputElement>) {
    setError("");
    setReport(null);
    setQuery("");
    const file = event.currentTarget.files?.[0];
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) {
      setError("BLOCKED: Báo cáo vượt 4 MB; không đọc hoặc tải lên.");
      return;
    }
    try {
      setReport(parseZeroSpendReport(await file.text()));
    } catch {
      setError("BLOCKED: Tệp JSON không đúng cấu trúc/nguồn ZERO-SPEND. Không chấp nhận là QA PASS.");
    }
    event.currentTarget.value = "";
  }

  const rows = useMemo(() =>
    report?.rows.filter(row => row.name.toLowerCase().includes(query.toLowerCase().trim()) ||
      row.workflows.some(w => w.file.toLowerCase().includes(query.toLowerCase().trim()))) ?? [],
  [report, query]);

  return <main className={styles.page}>
    <header className={styles.header}>
      <div>
        <span className={styles.overline}>APPLICATION MANAGEMENT · LOCAL QA PILOT</span>
        <h1>ZERO-SPEND · Kiểm kê workflow</h1>
        <p>Chỉ đọc báo cáo tạo tại Windows. Không kích hoạt runner, không chạy script của dự án con, không đăng ký quyền quản trị và không truyền tệp lên máy chủ.</p>
      </div>
      <Link className={styles.back} href="/projects">← Danh mục dự án</Link>
    </header>

    <section className={styles.instructions}>
      <h2>1. Chọn báo cáo trên Windows</h2>
      <p>Chạy <code>RUN_ZERO_SPEND_AUDIT.cmd</code> trong worktree ứng viên Blueprint trước. Sau đó chọn <code>E:\BaumanWeb\zero-spend-audit.json</code> bằng nút bên dưới. Trình duyệt đọc tệp ngay tại máy của bạn, không gửi qua API.</p>
      <label className={styles.pick}>Chọn zero-spend-audit.json <input aria-label="Chọn báo cáo ZERO-SPEND JSON từ máy Windows" type="file" accept=".json,application/json" onChange={e => void openFile(e)}/></label>
      {error ? <p role="alert" className={styles.error}>{error}</p> : null}
    </section>

    {report ? <>
      <section className={styles.summary} aria-label="Phạm vi kiểm kê">
        <article><small>Repo trong danh mục</small><strong>{report.inventoryCount}</strong></article>
        <article><small>Repo có tệp được quét</small><strong>{report.scanned}</strong></article>
        <article><small>Workflow YAML được đọc</small><strong>{report.workflowCount}</strong></article>
        <article><small>Repo chưa có local</small><strong>{report.unchecked}</strong></article>
      </section>

      <p role="status" className={styles.warning}><strong>Đây là kiểm kê tĩnh từ tệp bạn chọn, KHÔNG phải chứng cứ CI hoặc Billing hiện tại.</strong> GitHub source SHA chưa được đọc lại; không có workflow nào được thực thi. Missing/unknown vẫn BLOCKED hoặc REVIEW. Quy tắc Hiến pháp 1.3.0 vẫn có hiệu lực.</p>

      <section className={styles.results}>
        <div className={styles.resultsTitle}>
          <h2>2. Xác định workflow cần xem xét</h2>
          <input aria-label="Lọc repository hoặc tên workflow" placeholder="Lọc repo / tên workflow…" value={query} onChange={e => setQuery(e.target.value)}/>
        </div>
        {rows.length ? rows.map(r => <details className={styles.repo} key={r.name}>
          <summary>
            <strong>{r.name}</strong>
            <span>{r.status === "NOT_CHECKED_LOCAL_REPO_MISSING" ? "BLOCKED · Chưa quét" : labels[r.risk] ?? "REVIEW · Chưa phân loại"} · {r.workflows.length} YAML</span>
          </summary>
          {r.workflows.length ? <div className={styles.tableWrap}><table>
            <thead><tr><th>Workflow</th><th>Kích hoạt</th><th>Runner</th><th>Đánh giá</th></tr></thead>
            <tbody>{r.workflows.map(w => <tr key={w.file}><td><code>{w.file}</code></td><td>{w.events.join(", ") || "UNKNOWN"}</td><td>{w.runnerTypes.join(", ") || "UNKNOWN"}</td><td>{labels[w.risk] ?? "REVIEW"}</td></tr>)}</tbody>
          </table></div> : <p>Không có dữ liệu workflow có thể xác minh cho repo này. Không kết luận PASS.</p>}
        </details>) : <p>Không có kết quả phù hợp với bộ lọc.</p>}
      </section>
    </> : <section className={styles.empty}><h2>Chưa có báo cáo</h2><p>BLOCKED — chưa có dữ liệu Windows để kết luận workflow nào cần xử lý.</p></section>}

    <footer className={styles.footer}>
      <strong>Ranh giới pilot:</strong> chỉ trình bày báo cáo tĩnh. Không chạy QA của ứng dụng con, không thực thi shell, không bật self-hosted runner, không thay đổi ngân sách/CI/GitHub, không merge, publish, ratify hay ghi PASS giả.
    </footer>
  </main>;
}
