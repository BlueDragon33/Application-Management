"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { githubRepositoryUrl, projectRepositories, type ProjectRepositoryGroup } from "../project-registry";
import styles from "./projects-catalog.module.css";

const groupLabels: Record<ProjectRepositoryGroup, string> = {
  core: "Lõi hệ thống",
  learning: "Học tập",
  health: "Sức khỏe",
  family: "Gia đình",
  robotics: "Robot / ROS",
  control: "Điều khiển",
  simulation: "Mô phỏng",
  cad: "CAD / CAM",
};

const stateLabels = {
  operational: "Đang vận hành",
  developing: "Đang phát triển",
  prototype: "Prototype",
  scaffold: "Khung dự án",
} as const;

type LiveRepository = {
  name: string;
  repository: string;
  url: string;
  defaultBranch: string;
  archived: boolean;
  fork: boolean;
  visibility: string;
  updatedAt: string | null;
};

type LiveCatalog = {
  ok: boolean;
  checkedAt: string;
  totalPublicRepositories: number;
  registeredRepositories: number;
  repositories: LiveRepository[];
  unmanaged: LiveRepository[];
  notVisiblePublicly: Array<{ id: string; name: string; repository: string }>;
  error?: string;
};

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "PR";
}

export default function ProjectsCatalog() {
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState<ProjectRepositoryGroup | "all">("all");
  const [checking, setChecking] = useState(false);
  const [live, setLive] = useState<LiveCatalog | null>(null);
  const [liveError, setLiveError] = useState("");
  const normalized = query.trim().toLowerCase();
  const projects = useMemo(() => projectRepositories.filter((project) => {
    const matchesGroup = group === "all" || project.group === group;
    const matchesQuery = !normalized || `${project.name} ${project.repository} ${project.summary} ${project.relatedTo ?? ""}`.toLowerCase().includes(normalized);
    return matchesGroup && matchesQuery;
  }), [group, normalized]);

  const managed = projectRepositories.filter((project) => Boolean(project.managementHref)).length;
  const active = projectRepositories.filter((project) => project.state === "operational" || project.state === "developing").length;
  const technical = projectRepositories.filter((project) => ["robotics", "control", "simulation", "cad"].includes(project.group)).length;

  async function checkGitHub() {
    setChecking(true);
    setLiveError("");
    try {
      const response = await fetch("/api/projects/repositories", { cache: "no-store" });
      const payload = await response.json() as LiveCatalog;
      if (!response.ok || !payload.ok) throw new Error(payload.error || "Không thể đối chiếu danh mục GitHub.");
      setLive(payload);
    } catch (caught) {
      setLiveError(caught instanceof Error ? caught.message : "Không thể đối chiếu danh mục GitHub.");
    } finally {
      setChecking(false);
    }
  }

  return <main className={styles.shell}>
    <header className={styles.topbar}>
      <div><span className={styles.eyebrow}>APPLICATION MANAGEMENT · GITHUB PROJECT CATALOG</span><h1>Toàn bộ dự án GitHub</h1><p>Một danh mục duy nhất cho mọi repo. Repo có contract quản trị thật sẽ mở khu quản trị nội bộ; repo kỹ thuật vẫn được theo dõi đầy đủ nhưng không tạo nút điều khiển giả.</p></div>
      <div className={styles.topActions}><button type="button" onClick={() => void checkGitHub()} disabled={checking}>{checking ? "Đang kiểm tra…" : "↻ Kiểm tra GitHub"}</button><Link className={styles.back} href="/">← Quản trị Ứng dụng</Link></div>
    </header>

    <section className={styles.summary}>
      <article><span>Repo đã đăng ký</span><strong>{projectRepositories.length}</strong></article>
      <article><span>Có khu quản trị</span><strong>{managed}</strong></article>
      <article><span>Đang vận hành/phát triển</span><strong>{active}</strong></article>
      <article><span>Kỹ thuật & R&D</span><strong>{technical}</strong></article>
      <article><span>GitHub công khai</span><strong>{live ? live.totalPublicRepositories : "—"}</strong></article>
    </section>

    {liveError ? <section className={styles.liveWarning}><strong>Không kiểm tra được GitHub</strong><span>{liveError}</span></section> : null}
    {live ? <section className={live.unmanaged.length || live.notVisiblePublicly.length ? styles.liveWarning : styles.liveOk}>
      <div><strong>{live.unmanaged.length || live.notVisiblePublicly.length ? "Danh mục cần kiểm tra" : "Danh mục GitHub đã khớp"}</strong><span>Đối chiếu lúc {new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "medium" }).format(new Date(live.checkedAt))}.</span></div>
      {!live.unmanaged.length && !live.notVisiblePublicly.length ? <p>Tất cả repo GitHub công khai hiện thấy đều đã nằm trong registry quản lý.</p> : null}
      {live.unmanaged.length ? <div className={styles.liveIssueBlock}><h2>Repo mới chưa đưa vào quản lý ({live.unmanaged.length})</h2>{live.unmanaged.map((repo) => <article key={repo.repository}><div><strong>{repo.repository}</strong><small>branch: {repo.defaultBranch || "—"}{repo.fork ? " · fork" : ""}{repo.archived ? " · archived" : ""}</small></div><a href={repo.url || githubRepositoryUrl(repo.repository)} target="_blank" rel="noreferrer">Mở GitHub ↗</a></article>)}</div> : null}
      {live.notVisiblePublicly.length ? <div className={styles.liveIssueBlock}><h2>Repo đã đăng ký nhưng không còn thấy công khai ({live.notVisiblePublicly.length})</h2>{live.notVisiblePublicly.map((repo) => <article key={repo.repository}><div><strong>{repo.repository}</strong><small>{repo.name} · Có thể đã đổi tên, chuyển private hoặc bị xóa.</small></div><a href={githubRepositoryUrl(repo.repository)} target="_blank" rel="noreferrer">Kiểm tra ↗</a></article>)}</div> : null}
    </section> : null}

    <section className={styles.toolbar}>
      <input className={styles.search} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm repo, dự án, lĩnh vực…" />
      <div className={styles.filters}>
        <button data-active={group === "all"} onClick={() => setGroup("all")}>Tất cả</button>
        {(Object.keys(groupLabels) as ProjectRepositoryGroup[]).map((key) => <button key={key} data-active={group === key} onClick={() => setGroup(key)}>{groupLabels[key]}</button>)}
      </div>
    </section>

    <section className={styles.grid}>
      {projects.map((project) => <article className={styles.card} key={project.id}>
        <div className={styles.cardHead}><span className={styles.mark}>{initials(project.name)}</span><span className={styles.state} data-state={project.state}>{stateLabels[project.state]}</span></div>
        <h2>{project.name}</h2>
        <span className={styles.repo}>{project.repository}</span>
        <p>{project.summary}</p>
        <div className={styles.meta}><span>{groupLabels[project.group]}</span><span>branch: {project.defaultBranch}</span>{project.relatedTo ? <span>Thuộc {project.relatedTo}</span> : null}</div>
        <div className={styles.actions}>
          {project.managementHref ? <Link href={project.managementHref}>Quản trị</Link> : <a href={githubRepositoryUrl(project.repository)} target="_blank" rel="noreferrer">Mở repo</a>}
          <a href={githubRepositoryUrl(project.repository)} target="_blank" rel="noreferrer">GitHub ↗</a>
        </div>
      </article>)}
      {!projects.length ? <div className={styles.empty}>Không có dự án phù hợp bộ lọc.</div> : null}
    </section>
  </main>;
}
