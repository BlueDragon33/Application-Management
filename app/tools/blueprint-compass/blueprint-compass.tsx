"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import styles from "./blueprint-compass.module.css";

type Project = { id: string; name: string; repository: string; group: string; state: string; summary: string };
type Row = { number: number; title: string; url: string; draft: boolean; headSha: string | null; labels: string[] };
type Verdict = { status: string; title: string; description: string; nextStep: string; qaPassed: false; productionAuthorized: false };
type Snapshot = { ok: boolean; repository: string; checkedAt?: string; head?: string | null; branch?: string; pullRequests?: Row[]; issues?: Row[]; verdict: Verdict; error?: string; limitations?: string; evidenceClass?: string; canonicalGateVerified?: false; humanReviewVerified?: false };

export default function BlueprintCompass({ projects }: { projects: Project[] }) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(projects[0]?.id ?? "");
  const [loadedSnapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [requested, setRequested] = useState(0);
  const [unmanaged, setUnmanaged] = useState<Array<{ name: string; repository: string; url: string }>>([]);
  const [catalogStatus, setCatalogStatus] = useState("Đang đối chiếu danh mục công khai…");
  const entry = projects.find(project => project.id === selected);
  // Selection changes render before passive effects run: never show another project's evidence.
  const snapshot = loadedSnapshot?.repository === entry?.repository ? loadedSnapshot : null;
  const visible = useMemo(() => projects.filter(project =>
    `${project.name} ${project.repository} ${project.group}`.toLowerCase().includes(query.trim().toLowerCase()),
  ), [projects, query]);

  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/projects/repositories", { cache: "no-store", signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error("Catalog GitHub chưa khả dụng");
        const data = await response.json() as { ok?: boolean; unmanaged?: Array<{ name: string; repository: string; url: string }> };
        if (!data.ok || !Array.isArray(data.unmanaged)) throw new Error("Catalog GitHub không xác minh được");
        setUnmanaged(data.unmanaged.filter(repo => /^BlueDragon33\/[A-Za-z0-9_.-]+$/.test(repo.repository)));
        setCatalogStatus("Đã đối chiếu danh mục public; repository private chưa được xác minh.");
      })
      .catch(() => { if (!controller.signal.aborted) setCatalogStatus("Không thể xác minh các repository chưa đăng ký."); });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!selected) return;
    const controller = new AbortController();
    setLoading(true);
    setSnapshot(null);
    void fetch(`/api/tools/blueprint-compass?id=${encodeURIComponent(selected)}`,
      { cache: "no-store", signal: controller.signal })
      .then(async response => {
        const data = await response.json() as Snapshot;
        if (controller.signal.aborted) return;
        if (!data?.verdict || data.repository !== projects.find(project => project.id === selected)?.repository)
          throw new Error("GitHub readback không trùng dự án đã chọn.");
        setSnapshot(data);
      })
      .catch(error => {
        if (controller.signal.aborted) return;
        setSnapshot({ ok: false, repository: entry?.repository ?? "", error: error instanceof Error ? error.message : "Không thể tải dữ liệu", verdict: {
          status: "UNVERIFIED", title: "Chưa xác minh", description: "Không có bằng chứng GitHub.",
          nextStep: "Kiểm tra kết nối và đối chiếu HEAD GitHub.", qaPassed: false, productionAuthorized: false,
        }});
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  // Selection is the only request authority; refreshing increments requested.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, requested]);

  return <main className={styles.shell}>
    <header className={styles.header}>
      <div><small>APPLICATION MANAGEMENT · TOOL NỘI BỘ</small><h1>Blueprint Compass</h1>
        <p>Kim chỉ nam kỹ thuật cho toàn bộ dự án. GitHub chuyển giao công việc giữa ChatGPT và Claude; Hiến pháp và WorkPackage canonical vẫn do Software-Blueprint-Hub quản lý.</p></div>
      <div className={styles.actions}><Link href="/">Quản trị Ứng dụng</Link><Link href="/projects">Danh mục dự án</Link></div>
    </header>
    <section className={styles.layout}>
      <aside className={styles.side} aria-label="Chọn dự án">
        <label htmlFor="compass-search">Tìm dự án</label>
        <input id="compass-search" type="search" value={query} onChange={event=>setQuery(event.target.value)} placeholder="Tên hoặc repository" />
        <div className={styles.list}>{visible.map(project => <button type="button" key={project.id} data-selected={selected===project.id} onClick={() => setSelected(project.id)}><strong>{project.name}</strong><small>{project.repository}</small></button>)}</div>
        {!visible.length ? <p>Không tìm thấy trong registry. Dự án mới phải được đưa vào danh mục canonical trước khi sử dụng.</p> : null}
        <section className={styles.discovered}>
          <h3>Repository chưa được quản trị ({unmanaged.length})</h3>
          <p>{catalogStatus}</p>
          {unmanaged.slice(0, 25).map(repo => <a key={repo.repository} href={`https://github.com/${repo.repository}`} target="_blank" rel="noreferrer">{repo.name || repo.repository} · Cần đăng ký</a>)}
        </section>
      </aside>
      <section className={styles.body} aria-live="polite">
        {entry ? <><div className={styles.topline}><div><small>PROJECT · {entry.group}</small><h2>{entry.name}</h2><code>{entry.repository}</code></div><button type="button" onClick={() => setRequested(i=>i+1)} disabled={loading}>{loading ? "Đang đối chiếu…" : "↻ Đọc lại GitHub"}</button></div>
          <p className={styles.summary}>{entry.summary}</p>
          <div className={styles.status}><span>Trạng thái registry: <strong>{entry.state}</strong></span><span>Default branch HEAD: <code>{snapshot?.ok && snapshot.head ? snapshot.head : "UNVERIFIED"}</code></span></div>
          {snapshot?.verdict ? <article className={styles.verdict} data-status={snapshot.verdict.status}><small>GỢI Ý XỬ LÝ · KHÔNG PHẢI QA APPROVAL</small><h3>{snapshot.verdict.title}</h3><p>{snapshot.verdict.description}</p><strong>Hướng xử lý tiếp</strong><p>{snapshot.verdict.nextStep}</p></article> : <p>Đang xác minh bằng chứng GitHub…</p>}
          {snapshot?.error ? <div role="alert" className={styles.warning}>GitHub chưa xác minh: {snapshot.error}. Không được suy ra PASS.</div> : null}
          <div className={styles.columns}><section><h3>Pull Requests mở (tối đa 20)</h3>{snapshot?.pullRequests?.map(pr=><a key={pr.number} href={pr.url} target="_blank" rel="noopener noreferrer">#{pr.number} {pr.title}{pr.draft ? " · Draft" : ""} · HEAD {pr.headSha?.slice(0, 12) ?? "UNVERIFIED"}</a>)}{snapshot?.ok && !snapshot.pullRequests?.length ? <p>Chưa thấy PR mở trong trang dữ liệu đã tải.</p> : null}</section><section><h3>Issues mở (tối đa 20)</h3>{snapshot?.issues?.map(issue=><a key={issue.number} href={issue.url} target="_blank" rel="noopener noreferrer">#{issue.number} {issue.title}</a>)}{snapshot?.ok && !snapshot.issues?.length ? <p>Chưa thấy Issue mở trong trang dữ liệu đã tải.</p> : null}</section></div>
          <footer className={styles.footer}><a href={`https://github.com/${entry.repository}`} target="_blank" rel="noopener noreferrer">Mở repository GitHub</a><p>{snapshot?.checkedAt ? `Đọc lại lúc ${new Date(snapshot.checkedAt).toLocaleString("vi-VN")}. ` : ""}{snapshot?.limitations ?? "Chỉ đọc. Không tự tạo WorkPackage, tự chạy CI, phê duyệt, merge hoặc deploy."}</p></footer>
        </> : <p>Chưa đăng ký dự án.</p>}
      </section>
    </section>
  </main>;
}
