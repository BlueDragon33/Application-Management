"use client";

/**
 * Five visual lanes on exactly two trusted REGISTRY ontology levels.
 * Every link is an explicit source fact from projectRepositories:
 * registered in category, project has repository, repository has registry state.
 * No canonical dependency, Graph/Agent event or QA result is fabricated.
 */
import { useMemo, useRef, useState } from "react";
import { buildRegistryNeuralGraph, centerNeuralViewport } from "../../blueprint-neural-registry-graph.mjs";
import styles from "./blueprint-compass.module.css";

export type NeuralProject = {
  id: string; name: string; repository: string;
  group: string; state: string; summary: string;
};

const groupLabels: Record<string,string> = {
  core: "Lõi quản trị", learning: "Học tập", health: "Y tế",
  family: "Gia đình", accounting: "Kế toán", robotics: "Robot",
  control: "Điều khiển", simulation: "Mô phỏng", cad: "CAD/CAE",
};
const stateLabels: Record<string,string> = {
  operational: "Operational", developing: "Developing",
  prototype: "Prototype", scaffold: "Scaffold",
};

export default function BlueprintNeuralOverview({
  projects, selectedProjectId, onSelectProject,
}: { projects: readonly NeuralProject[]; selectedProjectId: string; onSelectProject: (projectId: string) => void }) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const diagram = useMemo(
    () => buildRegistryNeuralGraph(projects, selectedProjectId),
    [projects, selectedProjectId],
  );
  const highlightedEdges = [...diagram.links].sort((a, b) => Number(a.selected) - Number(b.selected));
  const focusedProject = diagram.projects.find(project => project.selected);
  const selectedLinks = diagram.links.filter(link => link.selected);
  const relationLabels: Record<string, string> = {
    "registry-group": "Nguồn registry → nhóm",
    "group-project": "Nhóm → dự án",
    "project-repository": "Dự án → repository",
    "repository-state": "Repository → trạng thái",
  };

  return <section className={styles.neuralAtlas} aria-labelledby="neural-atlas-heading">
    <div className={styles.neuralHead}>
      <div><small>NEURAL ATLAS · REGISTRY L0/L1 · NĂM DẢI TRỰC QUAN</small>
        <h2 id="neural-atlas-heading">Toàn cảnh mạng dự án</h2>
        <p>Mạng nhiều lớp lấy từ <strong>App Management project registry</strong>.
          Các đường cong biểu diễn quan hệ nhóm, đăng ký repository và trạng thái,
          <strong> không phải dependency hay QA đã kiểm thử</strong>.
          Nhấn node hoặc dùng Tab/Enter để mở chi tiết dự án ở bên dưới.</p>
      </div>
      <div className={styles.neuralStats}>
        <span><strong>{diagram.groups.length}</strong> nhóm</span>
        <span><strong>{diagram.projects.length}</strong> dự án</span>
        <span><strong>{diagram.links.length}</strong> cạnh có nguồn</span>
      </div>
    </div>
    {diagram.projects.length > 0 ? <>
      <div className={styles.neuralToolbar}>
        <div className={styles.neuralZoom} role="group" aria-label="Thu phóng mạng dự án">
          <button type="button" aria-label="Thu nhỏ mạng" disabled={zoom <= 0.75} onClick={() => setZoom(value => Math.max(0.75, value - 0.25))}>−</button>
          <button type="button" aria-label="Khôi phục tỷ lệ mạng" onClick={() => setZoom(1)}>{Math.round(zoom * 100)}%</button>
          <button type="button" aria-label="Phóng to mạng" disabled={zoom >= 1.5} onClick={() => setZoom(value => Math.min(1.5, value + 0.25))}>+</button>
        </div>
        <button type="button" onClick={() => {
          const track = trackRef.current;
          const node = track?.querySelector<HTMLButtonElement>('button[aria-pressed="true"]');
          if (!track || !node) return;
          const target = centerNeuralViewport(
            (node.offsetLeft + node.offsetWidth / 2) * zoom,
            (node.offsetTop + node.offsetHeight / 2) * zoom,
            track.scrollWidth, track.scrollHeight, track.clientWidth, track.clientHeight,
          );
          if (!target) return;
          track.scrollTo({ ...target, behavior: "auto" });
          node.focus({ preventScroll: true });
        }}>◎ Đến node dự án</button>
        <span>Tab để chọn dự án · Cuộn ngang/dọc · Thu phóng chỉ đổi tỷ lệ hiển thị</span>
      </div>
      <div ref={trackRef} className={styles.neuralTrack} tabIndex={0} role="region"
      aria-label="Sơ đồ 5 dải nguồn registry, nhóm, dự án, repository, trạng thái. Cuộn ngang để xem và Tab để chọn node">
      <div className={styles.neuralStage} style={{ width: diagram.width, height: diagram.height, zoom }}>
        <svg className={styles.neuralCanvas}
          viewBox={`0 0 ${diagram.width} ${diagram.height}`}
          width={diagram.width} height={diagram.height} aria-hidden="true" focusable="false">
          <defs>
            <linearGradient id="neural-source-gradient" x1="0%" y1="0%" x2="100%" y2="20%">
              <stop offset="0%" stopColor="#36e0cb"/>
              <stop offset="48%" stopColor="#839cff"/>
              <stop offset="100%" stopColor="#f09af2"/>
            </linearGradient>
            <filter id="neural-source-halo" x="-150%" y="-150%" width="400%" height="400%">
              <feGaussianBlur stdDeviation="4"/>
            </filter>
          </defs>
          <g className={styles.neuralLayerLegends}>
            <text x="26" y="35">L0 · NGUỒN</text>
            <text x="235" y="35">L1 · NHÓM</text>
            <text x="615" y="35">L1 · DỰ ÁN</text>
            <text x="1000" y="35">METADATA · REPO</text>
            <text x="1400" y="35">TRẠNG THÁI</text>
          </g>
          <g className={styles.neuralEdges}>
            {highlightedEdges.map(link => {
              const delta = (link.toX - link.fromX) * .46;
              const d = `M${link.fromX} ${link.fromY} C${link.fromX + delta} ${link.fromY},${link.toX - delta} ${link.toY},${link.toX} ${link.toY}`;
              return <path key={link.id} d={d} fill="none"
                stroke="url(#neural-source-gradient)"
                strokeWidth={link.selected ? 2.7 : .85}
                strokeOpacity={link.selected ? .98 : .30}
                data-relation={link.kind}/>;
            })}
          </g>
          <g>
            <circle cx="99" cy={diagram.sourceY} r="27" fill="#2dd4bf" opacity=".17" filter="url(#neural-source-halo)"/>
            <circle cx="99" cy={diagram.sourceY} r="14" fill="#2dd4bf" opacity=".22"/>
            <circle cx="99" cy={diagram.sourceY} r="6" fill="#5eead4"/>
            <text x="99" y={diagram.sourceY - 33} textAnchor="middle" className={styles.neuralSourceLabel}>APP REGISTRY</text>
            <text x="99" y={diagram.sourceY + 39} textAnchor="middle" className={styles.neuralSmallLabel}>source-only</text>
          </g>
          {diagram.groups.map(group => {
            const active = diagram.projects.some(project => project.selected && project.group === group.id);
            return <g key={"group:" + group.id}>
              {active ? <circle cx="245" cy={group.y} r="16" opacity=".18" fill="#5eead4" filter="url(#neural-source-halo)"/> : null}
              <circle cx="245" cy={group.y} r={active ? 7 : 5} fill={active ? "#f4d382" : "#55dfcf"}/>
              <text x="258" y={group.y - 12} className={styles.neuralGroupLabel}>{groupLabels[group.id] ?? group.id}</text>
            </g>;
          })}
          {diagram.projects.map(project => <g key={"project:" + project.id}>
            {project.selected ? <circle cx="613" cy={project.y} r="18" fill="#ffe19a" opacity=".2" filter="url(#neural-source-halo)"/> : null}
            <circle cx="613" cy={project.y} r={project.selected ? 8 : 5} fill={project.selected ? "#ffe19a" : "#9daaff"}/>
            <title>{`Node: ${project.name}; Nhóm: ${project.group}; Trạng thái: ${project.state}; Nguồn: project-registry.ts`}</title>
            <circle cx="1008" cy={project.y} r={project.selected ? 7 : 4} fill={project.selected ? "#ffe19a" : "#a78bfa"}/>
            <text x="1024" y={project.y + 4} className={project.selected ? styles.neuralSelectedLabel : styles.neuralRepoLabel}>
              {project.repository.replace(/^BlueDragon33\//, "").slice(0, 29)}
            </text>
          </g>)}
          {diagram.states.map(state => {
            const active = diagram.projects.some(project => project.selected && project.state === state.id);
            return <g key={"state:" + state.id}>
              <circle cx="1424" cy={state.y} r={active ? 9 : 6} fill={active ? "#ffe19a" : "#f09af2"}/>
              <text x="1442" y={state.y + 4} className={styles.neuralStateLabel}>{stateLabels[state.id] ?? state.id}</text>
            </g>;
          })}
        </svg>
        {diagram.projects.map(project => <button key={"select:" + project.id} type="button"
          className={styles.neuralNodeButton}
          style={{ top: project.y - 15, left: 601 }}
          title={`Chọn ${project.name} · ${project.repository}`}
          aria-pressed={project.id === selectedProjectId}
          aria-controls="compass-project-detail"
          onClick={() => onSelectProject(project.id)}>
          {project.name}
        </button>)}
      </div>
    </div>
    </> : <p>Registry chưa có dự án hợp lệ. Không hiển thị Graph giả.</p>}
    {focusedProject ? <aside className={styles.neuralReadback} id="neural-selected-readback"
      aria-label="Đường kết nối có nguồn cho dự án đang chọn" aria-live="polite">
      <div>
        <small>ĐANG CHỌN · THÔNG TIN REGISTRY</small>
        <strong>{focusedProject.name}</strong>
        <span>Nhóm: {groupLabels[focusedProject.group] ?? focusedProject.group}</span>
        <span>Repository: <code>{focusedProject.repository}</code></span>
        <span>Trạng thái danh mục: {stateLabels[focusedProject.state] ?? focusedProject.state}</span>
      </div>
      <div>
        <small>ĐƯỜNG KẾT NỐI CÓ NGUỒN</small>
        <ol>{selectedLinks.map(link => <li key={link.id}>
          {relationLabels[link.kind] ?? "Quan hệ phân loại"} <span>· project-registry.ts</span>
        </li>)}</ol>
        <span>Không suy diễn QA, Agent hay dependency từ các cạnh này.</span>
      </div>
    </aside> : <p className={styles.neuralReadback}>Chưa chọn được dự án đã đăng ký. Không suy diễn trạng thái.</p>}
    <p className={styles.neuralFootnote}>
      Nguồn: <code>{diagram.provenance}</code>. Dải hình trực quan không mở rộng quyền Graph.
      Đây <strong>không phải Graph Intelligence live của Hub #173</strong>.
      Trạng thái Agent, chạy thử, model, training, toán học và thuật toán chỉ được hiển thị sau khi có contract và evidence thật.
    </p>
  </section>;
}
