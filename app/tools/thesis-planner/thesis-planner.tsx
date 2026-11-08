"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import styles from "./thesis-planner.module.css";
import { createThesisBackup, parseThesisBackup, validateThesisState, type ThesisState } from "./thesis-domain.mjs";

type Progress = "todo" | "doing" | "evidence";
type StepState = { progress: Progress; evidence: string; note: string };
type ResearchStep = { id: string; name: string; output: string };
const phases: ReadonlyArray<{ semester: string; steps: ReadonlyArray<ResearchStep> }> = [
  { semester: "HK 1 · Định hướng", steps: [
    { id: "scope", name: "Xác nhận đề tài, phạm vi và yêu cầu кафедра", output: "Phạm vi + xác nhận người hướng dẫn" },
    { id: "sources", name: "Tìm, đọc và kiểm tra tài liệu học thuật", output: "Danh mục DOI/URL và ghi chú nguồn" },
    { id: "question", name: "Đặt câu hỏi nghiên cứu và giả thuyết", output: "Research question + giả thuyết có thể kiểm thử" },
  ] },
  { semester: "HK 2 · Thiết kế nghiên cứu", steps: [
    { id: "method", name: "Chọn phương pháp, baseline và bộ đo", output: "Giao thức thí nghiệm + tiêu chí đối chứng" },
    { id: "data", name: "Xác minh dữ liệu, quyền sử dụng và đạo đức", output: "Mô tả bộ dữ liệu + nguồn gốc + phân quyền" },
    { id: "prototype", name: "Hiện thực nguyên mẫu, kiểm thử đơn vị", output: "Code có phiên bản + test và hướng dẫn chạy" },
  ] },
  { semester: "HK 3 · Thực nghiệm", steps: [
    { id: "experiments", name: "Chạy baseline và phương pháp đề xuất", output: "Số liệu thực tế và cấu hình chạy" },
    { id: "analysis", name: "Phân tích sai số, độ ổn định, khả năng tái lập", output: "Bảng so sánh + đồ thị + hạn chế" },
    { id: "novelty", name: "Đánh giá đóng góp riêng với giảng viên", output: "Nhật ký trao đổi, phản biện và sửa đổi" },
  ] },
  { semester: "HK 4 · Viết và bảo vệ", steps: [
    { id: "writing", name: "Viết luận văn và kiểm chứng mọi trích dẫn", output: "Bản thảo + danh mục nguồn đã đối chiếu" },
    { id: "normcontrol", name: "Kiểm tra mẫu khoa, normcontrol, chính sách AI", output: "Checklist theo quy định được xác nhận" },
    { id: "defense", name: "Tập bảo vệ, phản biện và nộp bản chính thức", output: "Slide + câu hỏi hội đồng + xác nhận nộp" },
  ] },
];
const allSteps = phases.flatMap((phase) => phase.steps);
const emptyState: ThesisState = {
  topic: "", department: "ИУ-5 · 09.04.01 (dự kiến)", advisor: "", targetDate: "",
  problem: "", hypothesis: "", metrics: "", policy: "Chưa xác nhận với giảng viên/khoa", steps: {},
};
const statuses: { value: Progress; text: string }[] = [
  { value: "todo", text: "Chưa bắt đầu" },
  { value: "doing", text: "Đang thực hiện" },
  { value: "evidence", text: "Đã ghi minh chứng" },
];
function exportJson(name: string, value: unknown) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }));
  const link = document.createElement("a"); link.href = url; link.download = name; document.body.appendChild(link); link.click(); link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}
export default function ThesisPlanner({ user }: { user: { email: string; displayName: string } }) {
  const storageKey = "application-management:thesis-planner:v1:" + encodeURIComponent(user.email.trim().toLowerCase());
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [storageBlocked, setStorageBlocked] = useState(false);
  const [model, setModel] = useState<ThesisState>(emptyState);
  const [notice, setNotice] = useState("");
  useEffect(() => {
    setStorageBlocked(false);
    setNotice("");
    try {
      const raw = window.localStorage.getItem(storageKey);
      const saved = raw ? validateThesisState(JSON.parse(raw) as unknown) : null;
      setModel(saved ?? emptyState);
      if (raw && !saved) { setStorageBlocked(true); setNotice("Dữ liệu cũ không hợp lệ. Chưa ghi đè; hãy kiểm tra bản sao lưu."); }
    } catch { setModel(emptyState); setStorageBlocked(true); setNotice("Không đọc được bộ nhớ cục bộ. Dữ liệu cũ được giữ nguyên để khôi phục."); }
    // Writes are allowed only after this exact account's data has been hydrated.
    setLoadedKey(storageKey);
  }, [storageKey]);
  useEffect(() => {
    if (loadedKey !== storageKey || storageBlocked) return;
    try { window.localStorage.setItem(storageKey, JSON.stringify(model)); }
    catch { setNotice("Không lưu được dữ liệu trên thiết bị. Hãy xuất JSON ngay."); }
  }, [model, loadedKey, storageBlocked, storageKey]);
  const done = allSteps.filter((step) => model.steps[step.id]?.progress === "evidence").length;
  const next = allSteps.find((step) => model.steps[step.id]?.progress !== "evidence");
  const currentSemester = useMemo(() => phases.find((phase) => phase.steps.some((step) => step.id === next?.id))?.semester ?? "Đối chiếu toàn bộ minh chứng", [next]);
  function field(key: Exclude<keyof ThesisState, "steps">, value: string) { setModel((old) => ({ ...old, [key]: value })); }
  function stepField(id: string, key: keyof StepState, value: string) {
    setModel((old) => {
      const current = old.steps[id] ?? { progress: "todo", evidence: "", note: "" };
      if (key === "progress" && value === "evidence" && !current.evidence.trim()) {
        setNotice("Cần ghi đường dẫn hoặc mô tả minh chứng trước khi đánh dấu hoàn thành hồ sơ.");
        return old;
      }
      const patch = { ...current, [key]: value };
      if (key === "evidence" && !value.trim() && patch.progress === "evidence") patch.progress = "doing";
      return { ...old, steps: { ...old.steps, [id]: patch } };
    });
  }
  async function importFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; event.target.value = ""; if (!file) return;
    if (file.size > 1024 * 1024) { setNotice("File lớn hơn 1 MB, từ chối nhập."); return; }
    try {
      const data = JSON.parse(await file.text()) as unknown;
      const parsed = parseThesisBackup(data);
      if (!parsed) throw new Error("Invalid backup schema");
      if (window.confirm("Thay thế kế hoạch luận văn trên thiết bị bằng file vừa chọn?")) { setStorageBlocked(false); setModel(parsed); setNotice("Đã nhập bản sao lưu, chưa có đồng bộ đám mây."); }
    } catch { setNotice("File JSON không đúng định dạng Thesis Planner v1."); }
  }
  if (loadedKey !== storageKey) return <main className={styles.shell} role="status">Đang tải kế hoạch của tài khoản hiện tại…</main>;
  return <main className={styles.shell}>
    <nav className={styles.nav} aria-label="Academic navigation"><Link href="/">← Application Management</Link><Link href="/tools/study-plan">Kế hoạch học tập</Link><Link href="/apps/coursework-workbench">Ứng dụng bài tập lớn</Link></nav>
    <header className={styles.hero}><span className={styles.badge}>LOCAL-FIRST · DỰ THẢO NGHIÊN CỨU</span><h1>Thesis Planner · Luận văn Bauman</h1><p>Quản lý quá trình nghiên cứu trong 4 học kỳ: mục tiêu, bằng chứng và việc tiếp theo. Mẫu tham khảo, không thay quy định кафедра hoặc phê duyệt của giảng viên.</p></header>
    <div className={styles.stats}>
      <div className={styles.stat}><strong>{done}/{allSteps.length}</strong><span>Mốc đã ghi minh chứng</span></div>
      <div className={styles.stat}><strong>{Math.round(done / allSteps.length * 100)}%</strong><span>Độ phủ hồ sơ, không phải điểm số</span></div>
      <div className={styles.stat}><strong>{storageBlocked ? "Lỗi lưu" : "Cục bộ"}</strong><span>Dữ liệu trên thiết bị</span></div>
    </div>
    <div className={styles.grid}><div>
      <section className={styles.panel}><h2>Thông tin đề tài · Тема диссертации</h2>
        <div className={styles.fields}>
          {([["topic","Tên đề tài / Тема"],["department","Khoa và chương trình"],["advisor","Giảng viên hướng dẫn"],["targetDate","Ngày dự kiến bảo vệ"]] as const).map(([key, label]) => <label key={key}><span className={styles.label}>{label}</span><input className={styles.input} type={key === "targetDate" ? "date" : "text"} value={model[key]} maxLength={300} onChange={(e) => field(key, e.target.value)} placeholder={key === "topic" ? "Chưa chốt đề tài" : ""} /></label>)}
          {([["problem","Bài toán, phạm vi và tính cấp thiết"],["hypothesis","Giả thuyết / đóng góp dự kiến"],["metrics","Baseline, dữ liệu và các chỉ số đo"],["policy","Quy định AI, trích dẫn, normcontrol đã xác nhận"]] as const).map(([key,label]) => <label key={key} className={styles.wide}><span className={styles.label}>{label}</span><textarea className={styles.textarea} maxLength={12000} value={model[key]} onChange={(e) => field(key, e.target.value)} /></label>)}
        </div>
      </section>
      <section className={styles.panel}><h2>Lộ trình & minh chứng · План работы</h2><div className={styles.progress}><div className={styles.bar} style={{width: String(done / allSteps.length * 100) + "%"}} /></div>
        {phases.map((phase) => <div key={phase.semester}><h3>{phase.semester}</h3>
          {phase.steps.map((step) => { const value = model.steps[step.id] ?? { progress: "todo", evidence: "", note: "" }; return <article className={styles.milestone} key={step.id}>
            <div className={styles.row}><strong>{step.name}</strong><span className={styles.meta}>{value.progress === "evidence" ? "● Có minh chứng" : value.progress === "doing" ? "◐ Đang làm" : "○ Chưa làm"}</span></div>
            <div className={styles.meta}>Đầu ra cần đối chiếu: {step.output}</div>
            <div className={styles.controls}><label><span className={styles.label}>Tiến độ hồ sơ</span><select className={styles.select} value={value.progress} onChange={(e) => stepField(step.id, "progress", e.target.value)}>{statuses.map((status) => <option key={status.value} value={status.value}>{status.text}</option>)}</select></label>
              <label><span className={styles.label}>Minh chứng (tên file / DOI / đường dẫn)</span><input className={styles.input} value={value.evidence} maxLength={8000} onChange={(e) => stepField(step.id, "evidence", e.target.value)} placeholder="Không tự xác minh nguồn" /></label></div>
            <label><span className={styles.label}>Ghi chú, phản biện, việc cần sửa</span><textarea className={styles.textarea} rows={2} maxLength={8000} value={value.note} onChange={(e) => stepField(step.id, "note", e.target.value)} /></label>
          </article>; })}
        </div>)}
      </section>
    </div><aside>
      <section className={styles.panel}><h2>HƯỚNG DẪN / NEXT ACTION</h2><div className={styles.action}><strong>{currentSemester}</strong><p>{next ? next.name : "Đã ghi minh chứng cho toàn bộ mốc. Kiểm tra lại với giảng viên và hội đồng trước khi xác nhận đạt."}</p><span className={styles.meta}>{next ? "Đầu ra: " + next.output : "Không có phê duyệt tự động"}</span></div></section>
      <section className={styles.panel}><h2>Sao lưu và khôi phục</h2><p className={styles.hint}>Dữ liệu chỉ ở trình duyệt của tài khoản này. Xóa Safari/Chrome hoặc đổi máy có thể làm mất dữ liệu nếu không sao lưu.</p><div className={styles.actions}><button type="button" className={styles.btn} onClick={() => exportJson("bauman-thesis-planner-v1.json",createThesisBackup(model))}>Xuất JSON</button><label className={styles.btn + " " + styles.btnSecondary}>Nhập JSON<input hidden type="file" accept=".json,application/json" onChange={importFile} /></label></div></section>
      <section className={styles.panel}><h2>Cổng học thuật</h2><p className={styles.notice}>Trạng thái “Đã ghi minh chứng” chỉ là xác nhận của người dùng, <strong>không phải PASS khoa học, phê duyệt của khoa hay xác nhận trích dẫn</strong>. Không đưa dữ liệu mật hoặc dữ liệu cá nhân vào công cụ AI ngoài phạm vi cho phép.</p>{notice ? <p role="status" className={styles.hint}>{notice}</p> : null}</section>
    </aside></div>
  </main>;
}
