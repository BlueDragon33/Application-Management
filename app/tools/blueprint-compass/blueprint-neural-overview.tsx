"use client";

/**
 * Registry-only L0/L1 neural atlas.
 * A curve means only a documented catalog classification (group or state).
 * Do not portray these arcs as tested code dependencies, verified runtime
 * telemetry, Agent execution or canonical QualityGate evidence.
 */
import { useMemo } from "react";
import styles from "./blueprint-compass.module.css";

export type NeuralProject = {
  id: string; name: string; repository: string;
  group: string; state: string; summary: string;
};

const W = 1040;
const groupLabels: Record<string, string> = {
  core: "Lõi quản trị", learning: "Học tập", health: "Y tế",
  family: "Gia đình", accounting: "Kế toán", robotics: "Robot",
  control: "Điều khiển", simulation: "Mô phỏng", cad: "CAD/CAE",
};
const stateLabels: Record<string, string> = {
  operational: "Operational", developing: "Developing",
  prototype: "Prototype", scaffold: "Scaffold",
};

export default function BlueprintNeuralOverview({
  projects, selectedProjectId,
}: { projects: readonly NeuralProject[]; selectedProjectId: string }) {
  const diagram = useMemo(() => {
    const sorted = [...projects].sort((a, b) => a.id.localeCompare(b.id));
    const groups = [...new Set(sorted.map(p => p.group))].sort();
    const states = [...new Set(sorted.map(p => p.state))].sort();
    const height = Math.max(520, sorted.length * 37 + 100, groups.length * 60 + 90);
    const distribute = (i: number, count: number) => count <= 1 ? height / 2 : 65 + i * (height - 130) / (count - 1);
    const groupY = new Map(groups.map((key, i) => [key, distribute(i, groups.length)]));
    const projectY = new Map(sorted.map((p, i) => [p.id, distribute(i, sorted.length)]));
    const stateY = new Map(states.map((key, i) => [key, distribute(i, states.length)]));
    return { sorted, groups, states, height, groupY, projectY, stateY };
  }, [projects]);

  return <section className={styles.neuralAtlas} aria-labelledby="neural-atlas-heading">
    <div className={styles.neuralHead}>
      <div><small>NEURAL ATLAS · L0/L1 · NGUỒN REGISTRY</small>
        <h2 id="neural-atlas-heading">Toàn cảnh hệ sinh thái</h2>
        <p>Đường cong biểu diễn <strong>nhóm và trạng thái đăng ký</strong>, không phải dependency đã kiểm thử. Chọn dự án ở danh sách phía dưới để đối chiếu GitHub.</p>
      </div>
      <div className={styles.neuralStats}>
        <span><strong>{diagram.groups.length}</strong> nhóm</span>
        <span><strong>{diagram.sorted.length}</strong> dự án</span>
        <span><strong>{diagram.sorted.length * 2}</strong> liên hệ phân loại</span>
      </div>
    </div>
    {diagram.sorted.length ? <div className={styles.neuralTrack} tabIndex={0} role="region" aria-label="Bản đồ thần kinh phân loại dự án; cuộn ngang để xem đầy đủ">
      <svg className={styles.neuralCanvas} viewBox={`0 0 ${W} ${diagram.height}`} width={W} height={diagram.height} aria-hidden="true">
        <defs>
          <linearGradient id="blueprint-neural-curve" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#2dd4bf"/>
            <stop offset="55%" stopColor="#8b9dff"/>
            <stop offset="100%" stopColor="#ee8ff7"/>
          </linearGradient>
          <filter id="blueprint-neural-glow" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="4"/>
          </filter>
        </defs>
        <text x="48" y="29" className={styles.neuralLegend}>L0 · Nhóm lĩnh vực</text>
        <text x="455" y="29" className={styles.neuralLegend}>L1 · Dự án được đăng ký</text>
        <text x="830" y="29" className={styles.neuralLegend}>Trạng thái registry</text>
        {diagram.sorted.map(project => {
          const gy = diagram.groupY.get(project.group) ?? diagram.height / 2;
          const py = diagram.projectY.get(project.id) ?? diagram.height / 2;
          const sy = diagram.stateY.get(project.state) ?? diagram.height / 2;
          const active = project.id === selectedProjectId;
          return <g key={"edge:" + project.id}>
            <path d={`M188 ${gy} C285 ${gy},310 ${py},428 ${py}`}
              fill="none" stroke="url(#blueprint-neural-curve)" strokeWidth={active ? 2.8 : 1.15} strokeOpacity={active ? .94 : .36}/>
            <path d={`M492 ${py} C605 ${py},690 ${sy},822 ${sy}`}
              fill="none" stroke="url(#blueprint-neural-curve)" strokeWidth={active ? 2.5 : 1} strokeOpacity={active ? .84 : .27}/>
          </g>;
        })}
        {diagram.groups.map(group => <g key={"group:" + group}>
          <circle cx="167" cy={diagram.groupY.get(group)} r="14" fill="#2dd4bf" opacity=".18" filter="url(#blueprint-neural-glow)"/>
          <circle cx="167" cy={diagram.groupY.get(group)} r="5.8" fill="#2dd4bf"/>
          <text x="149" y={(diagram.groupY.get(group) ?? 0) - 13} textAnchor="end" className={styles.neuralGroupLabel}>{groupLabels[group] ?? group}</text>
        </g>)}
        {diagram.sorted.map(project => {
          const active = project.id === selectedProjectId, y = diagram.projectY.get(project.id) ?? 0;
          return <g key={"node:" + project.id}>
            <circle cx="460" cy={y} r={active ? 15 : 9} fill="#8a8fff" opacity={active ? ".20" : ".09"} filter="url(#blueprint-neural-glow)"/>
            <circle cx="460" cy={y} r={active ? 7.4 : 4.2} fill={active ? "#f4d382" : "#9daaff"}/>
            <text x="482" y={y + 4} className={active ? styles.neuralSelectedLabel : styles.neuralProjectLabel}>
              {project.name.length > 29 ? project.name.slice(0, 28) + "…" : project.name}
            </text>
          </g>;
        })}
        {diagram.states.map(state => <g key={"state:" + state}>
          <circle cx="840" cy={diagram.stateY.get(state)} r="12" fill="#ee8ff7" opacity=".17" filter="url(#blueprint-neural-glow)"/>
          <circle cx="840" cy={diagram.stateY.get(state)} r="5.5" fill="#ee8ff7"/>
          <text x="859" y={(diagram.stateY.get(state) ?? 0) + 4} className={styles.neuralGroupLabel}>{stateLabels[state] ?? state}</text>
        </g>)}
      </svg>
    </div> : <p>Registry chưa có dự án đã xác minh. Không hiển thị sơ đồ giả.</p>}
    <p className={styles.neuralFootnote}>Đây là phép chiếu danh mục từ Application Management, <strong>không phải Graph Intelligence live của Hub #173</strong>. Đồ thị dependency, Agent và lịch sử chạy thật chỉ được kích hoạt sau khi kết nối contract đã nghiệm thu.</p>
  </section>;
}
