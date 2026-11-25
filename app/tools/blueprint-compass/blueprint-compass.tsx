"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import styles from "./blueprint-compass.module.css";
import BlueprintNeuralOverview from "./blueprint-neural-overview";
import HubGraphContractAdmission from "./hub-graph-contract-admission";

type Project = { id: string; name: string; repository: string; group: string; state: string; summary: string };
type Row = { number: number; title: string; url: string; draft: boolean; headSha: string | null; labels: string[] };
type Verdict = { status: string; title: string; description: string; nextStep: string; qaPassed: false; productionAuthorized: false };
type Snapshot = { ok: boolean; repository: string; checkedAt?: string; head?: string | null; branch?: string; pullRequests?: Row[]; issues?: Row[]; verdict: Verdict; error?: string; limitations?: string; evidenceClass?: string; canonicalGateVerified?: false; humanReviewVerified?: false };

// Read-only presentation of the pinned Hub successor proposal. No local policy authority.
const directionOptions = [
  { id: "ONE_STEP", label: "1 bước", stop: "Hoàn thành một bước đã kiểm thử rồi dừng." },
  { id: "ONE_PACKAGE", label: "1 gói", stop: "Hoàn thành gói hiện tại, không mở gói khác." },
  { id: "UNTIL_REQUIRED_GATE", label: "Liên tục", stop: "Tiếp tục mọi gói đủ quyền; dừng ở cổng bắt buộc sau khi hết việc độc lập đủ điều kiện." },
  { id: "FINISH_PRODUCT", label: "Hoàn thiện sản phẩm", stop: "Hoàn thiện toàn bộ phạm vi sản phẩm, QA và rollback; chờ Owner quyết định publish đúng SHA. Nghiệm thu thực tế, sửa phản hồi, rồi xin quyền merge riêng." },
] as const;
const proposalRevision = "af9af58c1a4bb05f2b8bd9e8c63a5e89eacfbf9f";
export default function BlueprintCompass({ projects }: { projects: Project[] }) {
  const [guideOpen, setGuideOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [direction, setDirection] = useState<(typeof directionOptions)[number]["id"]>("UNTIL_REQUIRED_GATE");
  const selectedDirection = directionOptions.find(option => option.id === direction)!;
  const [selection, setSelection] = useState({ id: projects.find(project => project.id === "software-blueprint-hub")?.id ?? projects[0]?.id ?? "", request: 0 });
  const { id: selected, request: requested } = selection;
  const setSelected = (id: string) => setSelection(current => current.id === id ? current : { id, request: current.request + 1 });
  const refresh = () => setSelection(current => ({ ...current, request: current.request + 1 }));
  const [loaded, setLoaded] = useState<{ request: number; snapshot: Snapshot } | null>(null);
  const [unmanaged, setUnmanaged] = useState<Array<{ name: string; repository: string; url: string }>>([]);
  const [catalogStatus, setCatalogStatus] = useState("Đang đối chiếu danh mục công khai…");
  const entry = projects.find(project => project.id === selected);
  const repository = entry?.repository;
  // Derive pending state synchronously from the request identity. Never flash stale evidence.
  const snapshot = loaded && loaded.request === requested && loaded.snapshot.repository === repository ? loaded.snapshot : null;
  const loading = Boolean(entry && !snapshot);
  const observedHead = snapshot?.ok && typeof snapshot.head === "string" && /^[0-9a-f]{40}$/.test(snapshot.head)
    ? snapshot.head : null;
  const directionPrompt = entry && observedHead
    ? `BLUEPRINT OS — ${direction}\nRepository: ${entry.repository}\nObserved default HEAD: ${observedHead}\nVerify live ACTIVE Constitution, approved objective, authorized draft HEAD and exact evidence before edits. Default HEAD is not candidate or deployment authority.\n${selectedDirection.stop}\nFINISH_PRODUCT is proposed in Hub #178, not ACTIVE law. Retain all current protected gates. No routine permission requests, no automatic publish/merge, no paid resources or hosted Preview. No background execution promise.`
    : "";
  const visible = useMemo(() => projects.filter(project =>
    `${project.name} ${project.repository} ${project.group}`.toLowerCase().includes(query.trim().toLowerCase()),
  ), [projects, query]);
  const matchingProjectIds = query.trim() ? visible.map(project => project.id) : undefined;

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
    if (!selected || !repository) return;
    const controller = new AbortController();
    void fetch(`/api/tools/blueprint-compass?id=${encodeURIComponent(selected)}`,
      { cache: "no-store", signal: controller.signal })
      .then(async response => {
        const data = await response.json() as Snapshot;
        if (controller.signal.aborted) return;
        if (!data?.verdict || data.repository !== repository)
          throw new Error("GitHub readback không trùng dự án đã chọn.");
        setLoaded({ request: requested, snapshot: data });
      })
      .catch(error => {
        if (controller.signal.aborted) return;
        setLoaded({ request: requested, snapshot: { ok: false, repository, error: error instanceof Error ? error.message : "Không thể tải dữ liệu", verdict: {
          status: "UNVERIFIED", title: "Chưa xác minh", description: "Không có bằng chứng GitHub.",
          nextStep: "Kiểm tra kết nối và đối chiếu HEAD GitHub.", qaPassed: false, productionAuthorized: false,
        }}});
      });
    return () => controller.abort();
  }, [selected, requested, repository]);

  return <main className={styles.shell}>
    <header className={styles.header}>
      <div><small>APPLICATION MANAGEMENT · TOOL NỘI BỘ · READ-ONLY</small><h1>Blueprint OS · Neural Command Center</h1>
        <p>Điểm truy cập kỹ thuật toàn hệ sinh thái. Đây là bản Tool đọc metadata GitHub và danh mục thật; Hiến pháp, WorkPackage và QualityGate vẫn thuộc Hub.</p></div>
      <div className={styles.actions}>
        <button type="button" className={styles.guideButton} aria-expanded={guideOpen}
          aria-controls="blueprint-tool-guide" onClick={() => setGuideOpen(open => !open)}>
          {guideOpen ? "Ẩn Hướng dẫn" : "❔ Hướng dẫn"}
        </button>
        <Link href="/">Quản trị Ứng dụng</Link><Link href="/projects">Danh mục dự án</Link>
        <a href="https://github.com/BlueDragon33/Software-Blueprint-Hub" target="_blank" rel="noopener noreferrer">Mở nguồn Blueprint Hub</a>
      </div>
    </header>
    <section id="blueprint-tool-guide" className={styles.guidePanel} hidden={!guideOpen} role="region" aria-labelledby="blueprint-tool-guide-heading">
      <h2 id="blueprint-tool-guide-heading">Hướng dẫn theo Hiến pháp Blueprint OS</h2>
      <p>Chế độ hiện tại: <strong>đọc nguồn và đề xuất bước tiếp</strong>. Phần mềm không tự chạy Agent, duyệt QA, thay đổi dữ liệu dự án, merge hoặc phát hành.</p>
      <ol className={styles.guideSteps}>
        <li><strong>1 · Chọn dự án</strong> Xem bản đồ phân loại L0/L1, tìm repository trong danh sách, mở một dự án.</li>
        <li><strong>2 · Đối chiếu nguồn</strong> Nhấn “Đọc lại GitHub”, kiểm tra default HEAD, PR HEAD riêng và thời điểm quan sát. Không xem nhãn Issue là kết luận đã được kiểm chứng.</li>
        <li><strong>3 · Xem nhiệm vụ</strong> Mở PR/Issue liên quan rồi đối chiếu WorkPackage, QualityGate và Evidence tại Hub. Kiểm tra riêng cổng contract Graph: metadata-only không đồng nghĩa đã kết nối Graph. Nếu nguồn lỗi, giữ UNVERIFIED.</li>
        <li><strong>4 · Tiếp tục an toàn</strong> Chỉ đề xuất Next Action trong phạm vi quyền thật; chưa có backend runner đã xác minh nên không coi nút điều hướng là lệnh thực thi.</li>
      </ol>
      <p><strong>Nguyên tắc:</strong> tách dữ liệu đề xuất, quan sát và QA thực; không nhân bản ledger. Mọi quyền reviewer, phê chuẩn Constitution và Production giữ nguyên human gates. Khi đóng trang, Tool không tiếp tục chạy công việc.</p>
      <a href="https://github.com/BlueDragon33/Software-Blueprint-Hub/blob/main/docs/UNIVERSAL-CONSTITUTION.md" target="_blank" rel="noopener noreferrer">Đọc Hiến pháp ACTIVE tại nguồn chính GitHub</a>
    </section>
    <div className={styles.neuralSearch}>
      <label htmlFor="compass-search">Tìm dự án</label>
      <input id="compass-search" type="search" value={query} onChange={event=>setQuery(event.target.value)} placeholder="Tên hoặc repository" />
      <span role="status">{visible.length}/{projects.length} dự án trong danh mục{query.trim() ? " khớp tìm kiếm" : ""}</span>
    </div>
    <BlueprintNeuralOverview projects={projects} selectedProjectId={selected} onSelectProject={setSelected} matchingProjectIds={matchingProjectIds}/>
    {entry?.id === "software-blueprint-hub" ? <HubGraphContractAdmission/> : null}
    <section className={styles.layout}>
      <aside className={styles.side} aria-label="Chọn dự án">
        <p>Danh sách dự án · dùng ô tìm kiếm ở trên bản đồ.</p>
        <div className={styles.list}>{visible.map(project => <button type="button" key={project.id} data-selected={selected===project.id} onClick={() => setSelected(project.id)}><strong>{project.name}</strong><small>{project.repository}</small></button>)}</div>
        {!visible.length ? <p>Không tìm thấy trong registry. Dự án mới phải được đưa vào danh mục canonical trước khi sử dụng.</p> : null}
        <section className={styles.discovered}>
          <h3>Repository chưa được quản trị ({unmanaged.length})</h3>
          <p>{catalogStatus}</p>
          {unmanaged.slice(0, 25).map(repo => <a key={repo.repository} href={`https://github.com/${repo.repository}`} target="_blank" rel="noreferrer">{repo.name || repo.repository} · Cần đăng ký</a>)}
        </section>
      </aside>
      <section id="compass-project-detail" className={styles.body} aria-live="polite">
        {entry ? <><div className={styles.topline}><div><small>PROJECT · {entry.group}</small><h2>{entry.name}</h2><code>{entry.repository}</code></div><button type="button" onClick={refresh} disabled={loading}>{loading ? "Đang đối chiếu…" : "↻ Đọc lại GitHub"}</button></div>
          <p className={styles.summary}>{entry.summary}</p>
          <div className={styles.status}><span>Trạng thái registry: <strong>{entry.state}</strong></span><span>Default branch HEAD: <code>{snapshot?.ok && snapshot.head ? snapshot.head : "UNVERIFIED"}</code></span><span>Nguồn QA: <strong>{snapshot?.evidenceClass ?? "UNVERIFIED"}</strong></span><span>Đối chiếu: <strong>{snapshot?.checkedAt ? new Date(snapshot.checkedAt).toLocaleString("vi-VN") : "UNVERIFIED"}</strong></span></div>
          {snapshot?.verdict ? <article className={styles.verdict} data-status={snapshot.verdict.status}><small>GỢI Ý XỬ LÝ · KHÔNG PHẢI QA APPROVAL</small><h3>{snapshot.verdict.title}</h3><p>{snapshot.verdict.description}</p><strong>Hướng xử lý tiếp</strong><p>{snapshot.verdict.nextStep}</p></article> : <p>Đang xác minh bằng chứng GitHub…</p>}
          {snapshot?.error ? <div role="alert" className={styles.warning}>GitHub chưa xác minh: {snapshot.error}. Không được suy ra PASS.</div> : null}
          <section className={styles.directionPanel} aria-labelledby="compass-direction-heading">
            <h3 id="compass-direction-heading">Định hướng thực hiện</h3>
            <p>Đề xuất R37/R38 · Chưa phải Hiến pháp ACTIVE. <a href={`https://github.com/BlueDragon33/Software-Blueprint-Hub/blob/${proposalRevision}/projects/blueprint-os/END_TO_END_COMPLETION_PROGRAM.v1.md`} target="_blank" rel="noopener noreferrer">Đọc quy tắc ứng viên</a></p>
            <div className={styles.directionButtons} role="group" aria-label="Chọn định hướng">
              {directionOptions.map(option => <button type="button" key={option.id} aria-pressed={direction === option.id} onClick={() => setDirection(option.id)}>{option.label}</button>)}
            </div>
            <p role="status">{selectedDirection.stop}</p>
            {directionPrompt ? <><label htmlFor="compass-direction-prompt">Prompt bàn giao · chỉ đọc, không tự thực thi</label>
              <textarea id="compass-direction-prompt" rows={6} readOnly value={directionPrompt}/>
              <button type="button" className={styles.directionSelect} onClick={() => { const field = document.getElementById("compass-direction-prompt"); if (field instanceof HTMLTextAreaElement) { field.focus(); field.select(); } }}>Chọn nội dung để sao chép</button>
            </> : <p>UNVERIFIED — cần đọc lại GitHub trước khi tạo prompt có nguồn.</p>}
          </section>
          <div className={styles.columns}><section><h3>Pull Requests mở (tối đa 20)</h3>{snapshot?.pullRequests?.map(pr=><a key={pr.number} href={pr.url} target="_blank" rel="noopener noreferrer">#{pr.number} {pr.title}{pr.draft ? " · Draft" : ""} · HEAD {pr.headSha?.slice(0, 12) ?? "UNVERIFIED"}</a>)}{snapshot?.ok && !snapshot.pullRequests?.length ? <p>Chưa thấy PR mở trong trang dữ liệu đã tải.</p> : null}</section><section><h3>Issues mở (tối đa 20)</h3>{snapshot?.issues?.map(issue=><a key={issue.number} href={issue.url} target="_blank" rel="noopener noreferrer">#{issue.number} {issue.title}</a>)}{snapshot?.ok && !snapshot.issues?.length ? <p>Chưa thấy Issue mở trong trang dữ liệu đã tải.</p> : null}</section></div>
          <footer className={styles.footer}><a href={`https://github.com/${entry.repository}`} target="_blank" rel="noopener noreferrer">Mở repository GitHub</a><p>{snapshot?.checkedAt ? `Đọc lại lúc ${new Date(snapshot.checkedAt).toLocaleString("vi-VN")}. ` : ""}{snapshot?.limitations ?? "Chỉ đọc. Không tự tạo WorkPackage, tự chạy CI, phê duyệt, merge hoặc deploy."}</p></footer>
        </> : <p>Chưa đăng ký dự án.</p>}
      </section>
    </section>
  </main>;
}
