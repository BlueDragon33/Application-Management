"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { projectRepositories } from "../../project-registry";
import styles from "./deploy-ops.module.css";

type Mapping = {
  appId: string;
  repository: string;
  sourceSha: string;
  vercelEnabled: boolean;
  vercelProject: string;
  vercelProductionUrl: string;
  previewEvidence: string;
  neonEnabled: boolean;
  neonProjectId: string;
  neonBranch: string;
  databaseEvidence: string;
  tinyfishEnabled: boolean;
  testTargetUrl: string;
  browserEvidence: string;
  productionAuthority: boolean;
};

type Gate = {
  id: string;
  label: string;
  passed: boolean;
  detail: string;
};

const storageKey = "application-management:deploy-ops:v1";

function initialMapping(appId = "application-management"): Mapping {
  const project = projectRepositories.find((item) => item.id === appId) ?? projectRepositories[0];
  return {
    appId: project.id,
    repository: project.repository,
    sourceSha: "",
    vercelEnabled: false,
    vercelProject: "",
    vercelProductionUrl: "",
    previewEvidence: "",
    neonEnabled: false,
    neonProjectId: "",
    neonBranch: "",
    databaseEvidence: "",
    tinyfishEnabled: false,
    testTargetUrl: "",
    browserEvidence: "",
    productionAuthority: false,
  };
}

function looksSensitive(value: string) {
  return /(postgres(?:ql)?:\/\/|database_url|bearer\s+|token\s*=|api[_-]?key\s*=|secret\s*=|password\s*=)/i.test(value);
}

function isHttpsUrl(value: string) {
  if (!value.trim()) return false;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

function readStored(): Record<string, Mapping> {
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, Mapping>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function providerCount(mapping: Mapping) {
  return Number(mapping.vercelEnabled) + Number(mapping.neonEnabled) + Number(mapping.tinyfishEnabled);
}

function gatesFor(mapping: Mapping): Gate[] {
  const immutableSource = /^[a-f0-9]{7,40}$/i.test(mapping.sourceSha.trim());
  const vercelReady = !mapping.vercelEnabled || (
    Boolean(mapping.vercelProject.trim()) &&
    isHttpsUrl(mapping.vercelProductionUrl) &&
    Boolean(mapping.previewEvidence.trim())
  );
  const neonReady = !mapping.neonEnabled || (
    Boolean(mapping.neonProjectId.trim()) &&
    Boolean(mapping.neonBranch.trim()) &&
    Boolean(mapping.databaseEvidence.trim())
  );
  const tinyfishReady = !mapping.tinyfishEnabled || (
    isHttpsUrl(mapping.testTargetUrl) &&
    Boolean(mapping.browserEvidence.trim())
  );
  return [
    {
      id: "source",
      label: "Source bất biến",
      passed: immutableSource,
      detail: immutableSource ? "Đã khóa theo commit SHA." : "Nhập commit SHA cụ thể; không dùng “latest”.",
    },
    {
      id: "provider",
      label: "Có ít nhất một lớp vận hành",
      passed: providerCount(mapping) > 0,
      detail: providerCount(mapping) > 0 ? "Đã chọn lớp cần điều phối." : "Bật Vercel, Neon hoặc TinyFish theo app thực tế.",
    },
    {
      id: "vercel",
      label: "Vercel / Preview",
      passed: vercelReady,
      detail: mapping.vercelEnabled ? (vercelReady ? "Có project, Production URL và evidence Preview." : "Thiếu mapping hoặc evidence Preview.") : "Không dùng cho app này.",
    },
    {
      id: "neon",
      label: "Neon / Database",
      passed: neonReady,
      detail: mapping.neonEnabled ? (neonReady ? "Có project/branch và evidence kiểm tra DB." : "Thiếu mapping hoặc evidence DB.") : "Không dùng cho app này.",
    },
    {
      id: "tinyfish",
      label: "TinyFish / Browser test",
      passed: tinyfishReady,
      detail: mapping.tinyfishEnabled ? (tinyfishReady ? "Có URL mục tiêu và evidence browser test." : "Thiếu URL hoặc evidence kiểm thử.") : "Không dùng cho app này.",
    },
    {
      id: "authority",
      label: "Production authority",
      passed: mapping.productionAuthority,
      detail: mapping.productionAuthority ? "Owner đã xác nhận gate người thật." : "Chưa xác nhận quyền phát hành Production.",
    },
  ];
}

export default function DeployOpsTool({ user }: { user: { displayName: string; email: string } }) {
  const [mapping, setMapping] = useState<Mapping>(() => initialMapping());
  const [stored, setStored] = useState<Record<string, Mapping>>({});
  const [message, setMessage] = useState("");
  const [evaluated, setEvaluated] = useState(false);

  useEffect(() => {
    const cache = readStored();
    setStored(cache);
    const existing = cache[mapping.appId];
    if (existing) setMapping(existing);
  }, []);

  const gates = useMemo(() => gatesFor(mapping), [mapping]);
  const ready = gates.every((gate) => gate.passed);
  const hasSensitiveInput = useMemo(
    () => Object.entries(mapping).some(([key, value]) => key !== "productionAuthority" && typeof value === "string" && looksSensitive(value)),
    [mapping],
  );

  function chooseApp(appId: string) {
    const cache = readStored();
    setStored(cache);
    setMapping(cache[appId] ?? initialMapping(appId));
    setMessage("");
    setEvaluated(false);
  }

  function patch(patchValue: Partial<Mapping>) {
    setMapping((current) => ({ ...current, ...patchValue }));
    setMessage("");
    setEvaluated(false);
  }

  function save() {
    if (hasSensitiveInput) {
      setMessage("Không lưu: phát hiện chuỗi có dạng secret/token/DATABASE_URL. Chỉ nhập ID, slug, URL công khai và evidence.");
      return;
    }
    const next = { ...stored, [mapping.appId]: mapping };
    window.localStorage.setItem(storageKey, JSON.stringify(next));
    setStored(next);
    setMessage("Đã lưu mapping cục bộ trên trình duyệt. Không có secret nào được yêu cầu hoặc lưu.");
  }

  function reset() {
    const next = { ...stored };
    delete next[mapping.appId];
    window.localStorage.setItem(storageKey, JSON.stringify(next));
    setStored(next);
    setMapping(initialMapping(mapping.appId));
    setMessage("Đã xóa mapping cục bộ của app này.");
    setEvaluated(false);
  }

  function evaluate() {
    setEvaluated(true);
    if (hasSensitiveInput) {
      setMessage("Safe Publish bị khóa vì phát hiện dữ liệu có dạng secret.");
      return;
    }
    setMessage(ready
      ? "READY: các gate đã đủ. Bản thử chỉ đánh giá readiness; chưa tự phát hành Production."
      : "BLOCKED: còn gate chưa đạt. Hoàn thiện evidence trước khi phát hành.");
  }

  const selected = projectRepositories.find((item) => item.id === mapping.appId);

  return <main className={styles.shell}>
    <div className={styles.wrap}>
      <header className={styles.header}>
        <div>
          <small>DEPLOY & OPS · VERCEL · NEON · TINYFISH</small>
          <h1>Safe Publish Control</h1>
          <p>Điều phối source → deploy → database → browser test theo evidence. Tool này không nhận hoặc lưu API key, token, mật khẩu hay DATABASE_URL.</p>
        </div>
        <Link className={styles.back} href="/">← Trung tâm</Link>
      </header>

      <section className={styles.boundary}>
        <strong>Ranh giới an toàn của bản thử</strong>
        <span>Mapping và evidence chỉ lưu cục bộ trong trình duyệt.</span>
        <span>Không gọi API Vercel/Neon/TinyFish từ website.</span>
        <span>Safe Publish hiện là rule engine kiểm tra điều kiện, không phải nút phát hành thật.</span>
      </section>

      <section className={styles.panel}>
        <div className={styles.panelTitle}>
          <div><small>01 · TARGET</small><h2>Ứng dụng cần điều phối</h2></div>
          <span>{user.displayName}</span>
        </div>
        <div className={styles.grid2}>
          <label>
            <span>Ứng dụng</span>
            <select value={mapping.appId} onChange={(event) => chooseApp(event.target.value)}>
              {projectRepositories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>
          <label>
            <span>Repository</span>
            <input value={mapping.repository} onChange={(event) => patch({ repository: event.target.value })} placeholder="owner/repository"/>
          </label>
          <label className={styles.full}>
            <span>Commit SHA cần phát hành</span>
            <input value={mapping.sourceSha} onChange={(event) => patch({ sourceSha: event.target.value.trim() })} placeholder="Ví dụ: f472b7fb8603d6352d66a05276d7de87e255d86b"/>
            <em>Không dùng “latest”; mỗi lần phát hành phải gắn với một SHA cụ thể.</em>
          </label>
        </div>
        {selected ? <p className={styles.projectNote}>{selected.summary}</p> : null}
      </section>

      <section className={styles.providers}>
        <ProviderCard
          title="Vercel"
          role="Deploy / Hosting"
          enabled={mapping.vercelEnabled}
          onToggle={(value) => patch({ vercelEnabled: value })}
        >
          <label><span>Project slug</span><input disabled={!mapping.vercelEnabled} value={mapping.vercelProject} onChange={(event) => patch({ vercelProject: event.target.value })} placeholder="my-project"/></label>
          <label><span>Production URL</span><input disabled={!mapping.vercelEnabled} value={mapping.vercelProductionUrl} onChange={(event) => patch({ vercelProductionUrl: event.target.value })} placeholder="https://example.vercel.app"/></label>
          <label><span>Preview evidence</span><input disabled={!mapping.vercelEnabled} value={mapping.previewEvidence} onChange={(event) => patch({ previewEvidence: event.target.value })} placeholder="Deployment ID / CI run / ghi chú PASS"/></label>
        </ProviderCard>

        <ProviderCard
          title="Neon"
          role="PostgreSQL / Data"
          enabled={mapping.neonEnabled}
          onToggle={(value) => patch({ neonEnabled: value })}
        >
          <label><span>Project ID / tên project</span><input disabled={!mapping.neonEnabled} value={mapping.neonProjectId} onChange={(event) => patch({ neonProjectId: event.target.value })} placeholder="project-id"/></label>
          <label><span>Branch database</span><input disabled={!mapping.neonEnabled} value={mapping.neonBranch} onChange={(event) => patch({ neonBranch: event.target.value })} placeholder="preview / production"/></label>
          <label><span>DB evidence</span><input disabled={!mapping.neonEnabled} value={mapping.databaseEvidence} onChange={(event) => patch({ databaseEvidence: event.target.value })} placeholder="Migration/check ID / ghi chú PASS"/></label>
        </ProviderCard>

        <ProviderCard
          title="TinyFish"
          role="Browser / UX Test"
          enabled={mapping.tinyfishEnabled}
          onToggle={(value) => patch({ tinyfishEnabled: value })}
        >
          <label><span>URL cần kiểm thử</span><input disabled={!mapping.tinyfishEnabled} value={mapping.testTargetUrl} onChange={(event) => patch({ testTargetUrl: event.target.value })} placeholder="https://preview.example.com"/></label>
          <label><span>Browser evidence</span><input disabled={!mapping.tinyfishEnabled} value={mapping.browserEvidence} onChange={(event) => patch({ browserEvidence: event.target.value })} placeholder="Test run / checklist / ghi chú PASS"/></label>
          <div className={styles.hint}>TinyFish chỉ nên kiểm thử qua UI/API công khai của app; không cấp trực tiếp credential database.</div>
        </ProviderCard>
      </section>

      <section className={styles.panel}>
        <div className={styles.panelTitle}>
          <div><small>02 · SAFE PUBLISH</small><h2>Release gates</h2></div>
          <b data-ready={ready}>{ready ? "READY" : "BLOCKED"}</b>
        </div>
        <div className={styles.gates}>
          {gates.map((gate) => <article key={gate.id} data-pass={gate.passed}>
            <i>{gate.passed ? "✓" : "!"}</i>
            <div><strong>{gate.label}</strong><span>{gate.detail}</span></div>
          </article>)}
        </div>
        <label className={styles.authority}>
          <input type="checkbox" checked={mapping.productionAuthority} onChange={(event) => patch({ productionAuthority: event.target.checked })}/>
          <span><strong>Tôi xác nhận Production release authority cho đúng SHA ở trên.</strong><em>Đây là gate người thật. Việc đánh dấu không tự chạy deploy trong bản thử.</em></span>
        </label>
        {hasSensitiveInput ? <div className={styles.danger}>Phát hiện chuỗi có dạng secret/token/DATABASE_URL. Hãy xóa khỏi form.</div> : null}
        {message ? <div className={styles.message} aria-live="polite">{message}</div> : null}
        {evaluated && ready ? <div className={styles.flow}>GitHub / Source SHA → Vercel Preview → Neon DB check → TinyFish browser test → Human authority → Production</div> : null}
        <div className={styles.actions}>
          <button onClick={save}>Lưu mapping</button>
          <button className={styles.primary} onClick={evaluate}>Safe Publish · kiểm tra điều kiện</button>
          <button className={styles.secondary} onClick={reset}>Xóa cấu hình cục bộ</button>
        </div>
      </section>
    </div>
  </main>;
}

function ProviderCard({
  title,
  role,
  enabled,
  onToggle,
  children,
}: {
  title: string;
  role: string;
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  children: React.ReactNode;
}) {
  return <section className={styles.provider} data-enabled={enabled}>
    <header>
      <div><small>{role}</small><h2>{title}</h2></div>
      <label className={styles.switch}><input type="checkbox" checked={enabled} onChange={(event) => onToggle(event.target.checked)}/><span>{enabled ? "Dùng" : "Không dùng"}</span></label>
    </header>
    <div className={styles.providerBody}>{children}</div>
  </section>;
}
