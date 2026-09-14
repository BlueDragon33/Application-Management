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

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "PR";
}

export default function ProjectsCatalog() {
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState<ProjectRepositoryGroup | "all">("all");
  const normalized = query.trim().toLowerCase();
  const projects = useMemo(() => projectRepositories.filter((project) => {
    const matchesGroup = group === "all" || project.group === group;
    const matchesQuery = !normalized || `${project.name} ${project.repository} ${project.summary} ${project.relatedTo ?? ""}`.toLowerCase().includes(normalized);
    return matchesGroup && matchesQuery;
  }), [group, normalized]);

  const managed = projectRepositories.filter((project) => Boolean(project.managementHref)).length;
  const active = projectRepositories.filter((project) => project.state === "operational" || project.state === "developing").length;
  const technical = projectRepositories.filter((project) => ["robotics", "control", "simulation", "cad"].includes(project.group)).length;

  return <main className={styles.shell}>
    <header className={styles.topbar}>
      <div><span className={styles.eyebrow}>APPLICATION MANAGEMENT · GITHUB PROJECT CATALOG</span><h1>Toàn bộ dự án GitHub</h1><p>Một danh mục duy nhất cho mọi repo. Repo có contract quản trị thật sẽ mở khu quản trị nội bộ; repo kỹ thuật vẫn được theo dõi đầy đủ nhưng không tạo nút điều khiển giả.</p></div>
      <Link className={styles.back} href="/">← Quản trị Ứng dụng</Link>
    </header>

    <section className={styles.summary}>
      <article><span>Tổng repo</span><strong>{projectRepositories.length}</strong></article>
      <article><span>Có khu quản trị</span><strong>{managed}</strong></article>
      <article><span>Đang vận hành/phát triển</span><strong>{active}</strong></article>
      <article><span>Kỹ thuật & R&D</span><strong>{technical}</strong></article>
    </section>

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
