"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import styles from "./coursework-workbench.module.css";
import { createCourseworkBackup, parseCourseworkBackup, validateCourseworkProjects, type Coursework } from "./coursework-domain.mjs";

type StageStatus = "todo" | "doing" | "evidence";
type Stage = { status: StageStatus; evidence: string };
const workTypes = [
  { value: "coursework", label: "Курсовая работа · Bài tập lớn" },
  { value: "course-project", label: "Курсовой проект · Đồ án môn học" },
  { value: "rgr", label: "РГР · Bài tính / đồ họa" },
  { value: "homework", label: "Домашнее задание · Bài tập" },
  { value: "research", label: "НИР · Bài nghiên cứu môn học" },
] as const;
const steps = [
  { id: "brief", name: "Nhận và đọc đề bài gốc", output: "Đề bài, rubric, quy định giảng viên" },
  { id: "scope", name: "Phân tích yêu cầu và xác nhận phạm vi", output: "Input, output, giới hạn, tiêu chí nghiệm thu" },
  { id: "references", name: "Tìm và đối chiếu tài liệu", output: "Nguồn được xác minh, trích dẫn" },
  { id: "design", name: "Lập phương pháp, mô hình hoặc thuật toán", output: "Sơ đồ và giải thích lựa chọn" },
  { id: "implementation", name: "Làm bài / hiện thực mã nguồn, bản vẽ", output: "Tệp công việc có phiên bản" },
  { id: "tests", name: "Kiểm tra, mô phỏng, đối chứng", output: "Test, dữ liệu thật, kết quả và sai số" },
  { id: "report", name: "Viết báo cáo và kiểm tra định dạng", output: "Bản PDF/DOCX do người học kiểm tra" },
  { id: "submit", name: "Nộp bài / bảo vệ và lưu xác nhận", output: "Biên nhận hoặc nhận xét giảng viên" },
] as const;
const statuses: {value: StageStatus; label: string}[] = [
  { value: "todo", label: "Chưa làm" }, { value: "doing", label: "Đang làm" }, { value: "evidence", label: "Có minh chứng" },
];
function exportJson(data: Coursework[]) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(createCourseworkBackup(data), null, 2)], {type:"application/json"}));
  const anchor = document.createElement("a"); anchor.href = url; anchor.download = "bauman-coursework-v1.json";
  document.body.appendChild(anchor); anchor.click(); anchor.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 0);
}
function localDate(iso: string) { return iso ? new Date(iso + "T23:59:59").getTime() : null; }

export default function CourseworkWorkbench({ user }: { user: { email: string; displayName: string } }) {
  const storageKey = "application-management:coursework-workbench:v1:" + encodeURIComponent(user.email.trim().toLowerCase());
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [storageBlocked, setStorageBlocked] = useState(false);
  const [projects, setProjects] = useState<Coursework[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [notice, setNotice] = useState("");
  const [draft, setDraft] = useState({title: "", subject: "", kind: "coursework", dueDate: ""});
  useEffect(() => {
    setStorageBlocked(false);
    setNotice("");
    setSelectedId("");
    try {
      const raw = window.localStorage.getItem(storageKey);
      const parsed = raw ? validateCourseworkProjects(JSON.parse(raw) as unknown) : [];
      setProjects(parsed ?? []);
      if (raw && !parsed) { setStorageBlocked(true); setNotice("Bản dữ liệu hiện tại không hợp lệ, chưa ghi đè bản cũ."); }
    } catch { setProjects([]); setStorageBlocked(true); setNotice("Không đọc được dữ liệu localStorage, chưa ghi đè bản cũ."); }
    // Storage writes never run against an account different from the hydrated one.
    setLoadedKey(storageKey);
  }, [storageKey]);
  useEffect(() => {
    if (loadedKey !== storageKey || storageBlocked) return;
    try { window.localStorage.setItem(storageKey, JSON.stringify(projects)); }
    catch { setNotice("Không thể lưu trên thiết bị, hãy xuất JSON."); }
  }, [projects, loadedKey, storageBlocked, storageKey]);
  const selected = useMemo(() => projects.find((p) => p.id === selectedId) ?? projects[0] ?? null, [projects, selectedId]);
  const next = selected ? steps.find((s) => selected.stages[s.id]?.status !== "evidence") : null;
  const completed = selected ? steps.filter((s) => selected.stages[s.id]?.status === "evidence").length : 0;
  function addProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = draft.title.trim(), subject = draft.subject.trim();
    if (!title || !subject) { setNotice("Cần có tên bài và môn học."); return; }
    if (projects.some((p) => p.title.toLocaleLowerCase() === title.toLocaleLowerCase() && p.subject.toLocaleLowerCase() === subject.toLocaleLowerCase())) { setNotice("Bài cùng tên và môn đã tồn tại."); return; }
    const id = window.crypto?.randomUUID?.() ?? (Date.now().toString(36) + Math.random().toString(36).slice(2));
    const created: Coursework = { id, title, subject, kind: draft.kind, teacher: "", dueDate: draft.dueDate, requirements: "", notes: "", stages: {} };
    setProjects((old) => [...old, created]); setSelectedId(id); setDraft({title: "",subject: "",kind: "coursework",dueDate: ""}); setNotice("");
  }
  function updateProject(patch: Partial<Coursework>) {
    if (!selected) return;
    setProjects((old) => old.map((p) => p.id === selected.id ? { ...p, ...patch } : p));
  }
  function updateStage(id: string, key: keyof Stage, value: string) {
    if (!selected) return;
    const prior = selected.stages[id] ?? {status: "todo", evidence: ""};
    if (key === "status" && value === "evidence" && !prior.evidence.trim()) { setNotice("Ghi minh chứng trước khi đánh dấu hoàn thành mốc."); return; }
    const patch = { ...prior, [key]: value };
    if (key === "evidence" && !value.trim() && patch.status === "evidence") patch.status = "doing";
    updateProject({ stages: { ...selected.stages, [id]: patch } });
  }
  function removeProject() {
    if (!selected || !window.confirm("Xóa bài '" + selected.title + "' khỏi thiết bị này? Xuất sao lưu nếu cần.")) return;
    setProjects((old) => old.filter((p) => p.id !== selected.id)); setSelectedId(""); setNotice("Đã xóa khỏi bộ nhớ ứng dụng.");
  }
  async function importFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; event.target.value = ""; if (!file) return;
    if (file.size > 1024 * 1024) { setNotice("Từ chối file lớn hơn 1 MB."); return; }
    try {
      const parsed = JSON.parse(await file.text()) as unknown;
      const list = parseCourseworkBackup(parsed);
      if (!list) throw new Error("Invalid coursework backup");
      if (window.confirm("Thay thế toàn bộ danh sách bài tập trên thiết bị bằng bản sao lưu?")) {
        setStorageBlocked(false); setProjects(list); setSelectedId(""); setNotice("Đã khôi phục dữ liệu cục bộ. Không có đồng bộ server.");
      }
    } catch { setNotice("File JSON không đúng cấu trúc Coursework Workbench v1."); }
  }
  const due = selected ? localDate(selected.dueDate) : null;
  const daysLeft = due === null || !Number.isFinite(due) ? null : Math.ceil((due - Date.now()) / 86400000);
  if (loadedKey !== storageKey) return <main className={styles.shell} role="status">Đang tải bài tập của tài khoản hiện tại…</main>;
  return <main className={styles.shell}>
    <nav className={styles.nav} aria-label="Academic navigation"><Link href="/">← Application Management</Link><Link href="/tools/study-plan">Kế hoạch học</Link><Link href="/tools/thesis-planner">Thesis Planner</Link></nav>
    <header className={styles.hero}><span className={styles.tag}>ỨNG DỤNG RIÊNG · LOCAL-FIRST · P0</span><h1>Coursework Workbench · Курсовая работа</h1><p>Quản lý bài tập lớn, đồ án và báo cáo theo từng môn; mỗi bài có tiến độ, hạn nộp và minh chứng riêng. Chưa tạo lõi học thuật dùng chung.</p></header>
    <div className={styles.layout}>
      <aside>
        <section className={styles.panel}><h2>Danh sách bài tập · {projects.length}</h2>
          {projects.length ? projects.map((project) => {
            const total = steps.filter((s) => project.stages[s.id]?.status === "evidence").length;
            return <button type="button" key={project.id} className={styles.project + (project.id === selected?.id ? " " + styles.active : "")} onClick={() => setSelectedId(project.id)}><strong>{project.title}</strong><span>{project.subject} · {total}/{steps.length} mốc · {project.dueDate || "Chưa có hạn"}</span></button>;
          }) : <p className={styles.note}>Chưa có bài tập. Tạo bài đầu tiên bên dưới.</p>}
        </section>
        <section className={styles.panel}><h2>Tạo bài tập mới</h2><form className={styles.form} onSubmit={addProject}>
          <label><span className={styles.label}>Tên bài tập *</span><input className={styles.field} required maxLength={300} value={draft.title} onChange={(e) => setDraft((old) => ({...old,title:e.target.value}))} placeholder="Ví dụ: Đồ án hệ thống thông tin" /></label>
          <label><span className={styles.label}>Môn học / Дисциплина *</span><input className={styles.field} required maxLength={300} value={draft.subject} onChange={(e) => setDraft((old) => ({...old,subject:e.target.value}))}/></label>
          <label><span className={styles.label}>Loại bài</span><select className={styles.select} value={draft.kind} onChange={(e) => setDraft((old) => ({...old,kind:e.target.value}))}>{workTypes.map((t) => <option value={t.value} key={t.value}>{t.label}</option>)}</select></label>
          <label><span className={styles.label}>Hạn nộp</span><input className={styles.field} type="date" value={draft.dueDate} onChange={(e) => setDraft((old) => ({...old,dueDate:e.target.value}))}/></label>
          <button className={styles.button} type="submit">+ Tạo bài tập</button>
        </form></section>
        <section className={styles.panel}><h2>Sao lưu riêng biệt</h2><p className={styles.note}>Dữ liệu lưu theo tài khoản trên trình duyệt này. Xuất JSON để chuyển máy; nhập JSON thay thế danh sách hiện tại.</p><div className={styles.actions}><button className={styles.button} type="button" onClick={() => exportJson(projects)}>Xuất JSON</button><label className={styles.button + " " + styles.secondary}>Nhập JSON<input hidden type="file" accept=".json,application/json" onChange={importFile}/></label></div></section>
      </aside>
      <div>
        {!selected ? <section className={styles.panel}><div className={styles.empty}>Chọn hoặc tạo bài tập để mở workspace riêng của môn học.</div></section> : <>
          <section className={styles.panel}><div className={styles.actions} style={{justifyContent:"space-between",alignItems:"center"}}><h2 style={{margin:0}}>Hồ sơ bài tập</h2><button type="button" className={styles.button + " " + styles.danger} onClick={removeProject}>Xóa bài này</button></div>
            <div className={styles.details} style={{marginTop:14}}>
              {([["title","Tên bài"],["subject","Môn học"],["teacher","Giảng viên"]] as const).map(([key,label]) => <label key={key}><span className={styles.label}>{label}</span><input className={styles.field} maxLength={300} value={selected[key]} onChange={(e) => updateProject({[key]:e.target.value})}/></label>)}
              <label><span className={styles.label}>Loại bài</span><select className={styles.select} value={selected.kind} onChange={(e) => updateProject({kind:e.target.value})}>{workTypes.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}</select></label>
              <label><span className={styles.label}>Hạn nộp</span><input className={styles.field} type="date" value={selected.dueDate} onChange={(e) => updateProject({dueDate:e.target.value})}/></label>
              <label className={styles.wide}><span className={styles.label}>Đề bài, rubric và yêu cầu giảng viên</span><textarea className={styles.area} value={selected.requirements} maxLength={12000} onChange={(e) => updateProject({requirements:e.target.value})}/></label>
              <label className={styles.wide}><span className={styles.label}>Ghi chú, câu hỏi cần hỏi giảng viên</span><textarea className={styles.area} value={selected.notes} maxLength={12000} onChange={(e) => updateProject({notes:e.target.value})}/></label>
            </div>
          </section>
          <section className={styles.panel}><h2>Tiến độ & NEXT ACTION</h2><div className={styles.metric}><span>Mốc có minh chứng</span><strong>{completed}/{steps.length} · {Math.round(completed / steps.length * 100)}%</strong></div><div className={styles.metric}><span>Hạn nộp</span><strong>{daysLeft === null ? "Chưa thiết lập" : daysLeft < 0 ? "Đã quá " + Math.abs(daysLeft) + " ngày" : daysLeft === 0 ? "Hôm nay" : "Còn " + daysLeft + " ngày"}</strong></div><div className={styles.next}><strong>Việc nên làm tiếp</strong><p>{next ? next.name : "Đã ghi minh chứng toàn bộ mốc. Vẫn cần giảng viên nghiệm thu."}</p><span className={styles.note}>{next ? "Đầu ra: " + next.output : "Không có phê duyệt tự động"}</span></div></section>
          <section className={styles.panel}><h2>Checklist theo từng bài · Этапы работы</h2>
            {steps.map((step) => { const stage = selected.stages[step.id] ?? {status:"todo",evidence:""}; return <article key={step.id} className={styles.stage}>
              <div className={styles.actions} style={{justifyContent:"space-between"}}><strong>{step.name}</strong><span className={styles.status}>{stage.status === "evidence" ? "● Có minh chứng" : stage.status === "doing" ? "◐ Đang làm" : "○ Chưa làm"}</span></div><p className={styles.note}>Đầu ra: {step.output}</p>
              <div className={styles.stageGrid}><label><span className={styles.label}>Trạng thái</span><select className={styles.select} value={stage.status} onChange={(e) => updateStage(step.id,"status",e.target.value)}>{statuses.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</select></label>
              <label><span className={styles.label}>Minh chứng: file, đường dẫn, DOI, kết quả</span><input className={styles.field} maxLength={8000} value={stage.evidence} onChange={(e) => updateStage(step.id,"evidence",e.target.value)}/></label></div>
            </article>; })}
          </section>
        </>}
        <section className={styles.panel}><p className={styles.alert}>Đây là công cụ theo dõi công việc. “Có minh chứng” do bạn tự ghi, không chứng minh rằng bài đã đúng, đủ nguồn hoặc được giảng viên chấm đạt. Đối chiếu mẫu từng môn và quy tắc AI trực tiếp với giảng viên.</p>{notice ? <p className={styles.note} role="status">{notice}</p> : null}<p className={styles.note}>Trạng thái lưu: {storageBlocked ? "Dữ liệu cũ bị khóa ghi để tránh mất mát" : "Lưu cục bộ trên thiết bị"} · Không upload file · Không tạo tài khoản/billing/hạ tầng mới.</p></section>
      </div>
    </div>
  </main>;
}
