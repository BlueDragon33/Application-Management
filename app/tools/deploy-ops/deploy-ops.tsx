"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { deployOpsAction } from "../../admin-device-client";
import { projectRepositories } from "../../project-registry";
import styles from "./deploy-ops.module.css";

type Providers = { vercel: boolean; neon: boolean; tinyfish: boolean };

type Target = {
  appId: string;
  repository: string;
  vercelEnabled: boolean;
  vercelProjectId: string;
  vercelTeamId: string;
  neonEnabled: boolean;
  neonProjectId: string;
  neonBranch: string;
  tinyfishEnabled: boolean;
  tinyfishTargetUrl: string;
  tinyfishGoal: string;
  updatedAt?: string;
};

type Probe = {
  appId: string;
  sourceSha: string;
  ready: boolean;
  providers: Providers;
  vercel: {
    enabled: boolean; configured: boolean; ready: boolean; deploymentId: string | null;
    deploymentUrl: string | null; state: string | null; target: string | null; message: string;
  };
  neon: {
    enabled: boolean; configured: boolean; ready: boolean; projectId: string | null;
    branchId: string | null; branchName: string | null; message: string;
  };
  tinyfish: {
    enabled: boolean; configured: boolean; ready: boolean; runId: string | null;
    status: string | null; result: Record<string, unknown> | null; message: string;
  };
  gates: Array<{ id: string; passed: boolean; detail: string }>;
};

type Run = {
  id: string;
  appId: string;
  sourceSha: string;
  tinyfishRunId: string | null;
  tinyfishStatus: string | null;
  tinyfishResult: Record<string, unknown> | null;
  status: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
};

type ApiResult = {
  ok?: boolean;
  error?: string;
  code?: string;
  providers?: Providers;
  targets?: Target[];
  target?: Target;
  probe?: Probe;
  runs?: Run[];
  run?: { localRunId?: string; runId?: string; status?: string };
  promoted?: boolean;
  deploymentId?: string;
  deploymentUrl?: string;
};

const defaultGoal = "Kiểm tra website tải được và các chức năng chính có thể sử dụng bình thường. Không thay đổi dữ liệu phá hủy.";

function defaultTarget(appId = "application-management"): Target {
  const project = projectRepositories.find((item) => item.id === appId) ?? projectRepositories[0];
  return {
    appId: project.id,
    repository: project.repository,
    vercelEnabled: false,
    vercelProjectId: "",
    vercelTeamId: "",
    neonEnabled: false,
    neonProjectId: "",
    neonBranch: "",
    tinyfishEnabled: false,
    tinyfishTargetUrl: "",
    tinyfishGoal: defaultGoal,
  };
}

function shortSha(value: string) {
  return value ? value.slice(0, 12) : "—";
}

function resultSummary(value: Record<string, unknown> | null) {
  if (!value) return "";
  return typeof value.summary === "string" ? value.summary : "";
}

export default function DeployOpsTool({ user }: { user: { displayName: string; email: string } }) {
  const [providers, setProviders] = useState<Providers>({ vercel: false, neon: false, tinyfish: false });
  const [targets, setTargets] = useState<Target[]>([]);
  const [target, setTarget] = useState<Target>(() => defaultTarget());
  const [sourceSha, setSourceSha] = useState("");
  const [probe, setProbe] = useState<Probe | null>(null);
  const [runs, setRuns] = useState<Run[]>([]);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [productionAuthority, setProductionAuthority] = useState(false);

  async function bootstrap() {
    setBusy("bootstrap");
    setMessage("");
    try {
      const data = await deployOpsAction({ action: "bootstrap" }) as ApiResult;
      setProviders(data.providers ?? { vercel: false, neon: false, tinyfish: false });
      const nextTargets = data.targets ?? [];
      setTargets(nextTargets);
      const saved = nextTargets.find((item) => item.appId === target.appId);
      if (saved) setTarget(saved);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không đọc được Deploy & Ops.");
    } finally {
      setBusy("");
    }
  }

  useEffect(() => { void bootstrap(); }, []);

  const selectedProject = useMemo(
    () => projectRepositories.find((item) => item.id === target.appId),
    [target.appId],
  );

  function selectApp(appId: string) {
    const saved = targets.find((item) => item.appId === appId);
    setTarget(saved ?? defaultTarget(appId));
    setProbe(null);
    setRuns([]);
    setSourceSha("");
    setProductionAuthority(false);
    setMessage("");
  }

  function patch(value: Partial<Target>) {
    setTarget((current) => ({ ...current, ...value }));
    setProbe(null);
    setProductionAuthority(false);
  }

  async function saveTarget() {
    setBusy("save");
    setMessage("");
    try {
      const data = await deployOpsAction({ action: "save-target", ...target }) as ApiResult;
      if (!data.target) throw new Error(data.error ?? "Không lưu được cấu hình.");
      setTarget(data.target);
      setProviders(data.providers ?? providers);
      setTargets((current) => {
        const rest = current.filter((item) => item.appId !== data.target?.appId);
        return [...rest, data.target as Target].sort((a, b) => a.appId.localeCompare(b.appId));
      });
      setMessage("Đã lưu cấu hình vào D1. Secret vẫn chỉ nằm trong Worker.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không lưu được cấu hình.");
    } finally {
      setBusy("");
    }
  }

  async function liveProbe() {
    setBusy("probe");
    setMessage("");
    try {
      const data = await deployOpsAction({ action: "probe", appId: target.appId, sourceSha }) as ApiResult;
      if (!data.probe) throw new Error(data.error ?? "Không đọc được trạng thái provider.");
      setProbe(data.probe);
      setMessage(data.probe.ready ? "Tất cả gate live đang PASS." : "Còn gate live chưa PASS.");
      await loadRuns();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không kiểm tra được provider.");
    } finally {
      setBusy("");
    }
  }

  async function loadRuns() {
    try {
      const data = await deployOpsAction({ action: "runs", appId: target.appId }) as ApiResult;
      setRuns(data.runs ?? []);
    } catch {
      setRuns([]);
    }
  }

  async function startTinyFish() {
    setBusy("tinyfish-start");
    setMessage("");
    try {
      const data = await deployOpsAction({ action: "start-tinyfish", appId: target.appId, sourceSha }) as ApiResult;
      if (!data.run?.runId) throw new Error(data.error ?? "TinyFish chưa tạo được run.");
      setMessage(`TinyFish đã chạy thật: ${data.run.runId}. Webhook sẽ cập nhật kết quả; có thể bấm Làm mới TinyFish.`);
      await loadRuns();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không khởi động được TinyFish.");
    } finally {
      setBusy("");
    }
  }

  async function refreshTinyFish() {
    setBusy("tinyfish-refresh");
    setMessage("");
    try {
      const data = await deployOpsAction({ action: "refresh-tinyfish", appId: target.appId, sourceSha }) as ApiResult;
      if (data.probe) setProbe(data.probe);
      setMessage(data.probe?.tinyfish.message ?? "Đã làm mới TinyFish.");
      await loadRuns();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không làm mới được TinyFish.");
    } finally {
      setBusy("");
    }
  }

  async function safePublish() {
    if (!productionAuthority) {
      setMessage("Cần xác nhận Production release authority trước khi publish.");
      return;
    }
    if (!window.confirm(`Promote đúng deployment của SHA ${sourceSha} lên Vercel Production?`)) return;
    setBusy("publish");
    setMessage("");
    try {
      const data = await deployOpsAction({
        action: "safe-publish",
        appId: target.appId,
        sourceSha,
        productionAuthority: true,
      }) as ApiResult;
      if (!data.promoted) throw new Error(data.error ?? "Production chưa được promote.");
      if (data.probe) setProbe(data.probe);
      setMessage(`Đã promote deployment ${data.deploymentId ?? ""} lên Production.`);
      setProductionAuthority(false);
      await loadRuns();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Safe Publish bị khóa.");
      try { await liveProbe(); } catch { /* keep primary error */ }
    } finally {
      setBusy("");
    }
  }

  const shaValid = /^[0-9a-f]{40}$/i.test(sourceSha);
  const providerRows: Array<{ id: keyof Providers; label: string; role: string }> = [
    { id: "vercel", label: "Vercel", role: "Deploy / Promote" },
    { id: "neon", label: "Neon", role: "PostgreSQL / Branch" },
    { id: "tinyfish", label: "TinyFish", role: "Browser test" },
  ];

  return <main className={styles.shell}>
    <div className={styles.wrap}>
      <header className={styles.header}>
        <div>
          <small>DEPLOY & OPS · LIVE CONTROL</small>
          <h1>Vercel · Neon · TinyFish</h1>
          <p>Đọc provider thật bằng API server-side, chạy browser test TinyFish thật và chỉ promote Vercel khi đúng SHA + toàn bộ gate PASS.</p>
        </div>
        <Link className={styles.back} href="/">← Trung tâm</Link>
      </header>

      <section className={styles.providerStrip}>
        {providerRows.map((item) => <article key={item.id} data-ready={providers[item.id]}>
          <i>{providers[item.id] ? "✓" : "!"}</i>
          <div><strong>{item.label}</strong><span>{item.role}</span></div>
          <b>{providers[item.id] ? "Secret sẵn sàng" : "Chưa cấu hình secret"}</b>
        </article>)}
      </section>

      <section className={styles.panel}>
        <div className={styles.panelTitle}>
          <div><small>01 · MAPPING</small><h2>Ứng dụng & provider</h2></div>
          <span>{user.displayName}</span>
        </div>

        <div className={styles.grid2}>
          <label>
            <span>Ứng dụng</span>
            <select value={target.appId} onChange={(event) => selectApp(event.target.value)}>
              {projectRepositories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>
          <label>
            <span>Repository</span>
            <input value={target.repository} onChange={(event) => patch({ repository: event.target.value })}/>
          </label>
        </div>
        {selectedProject ? <p className={styles.projectNote}>{selectedProject.summary}</p> : null}

        <div className={styles.providers}>
          <ProviderCard title="Vercel" enabled={target.vercelEnabled} onToggle={(enabled) => patch({ vercelEnabled: enabled })} configured={providers.vercel}>
            <label><span>Project ID hoặc slug</span><input disabled={!target.vercelEnabled} value={target.vercelProjectId} onChange={(event) => patch({ vercelProjectId: event.target.value })} placeholder="prj_... hoặc project-slug"/></label>
            <label><span>Team ID · tùy chọn</span><input disabled={!target.vercelEnabled} value={target.vercelTeamId} onChange={(event) => patch({ vercelTeamId: event.target.value })} placeholder="team_..."/></label>
          </ProviderCard>

          <ProviderCard title="Neon" enabled={target.neonEnabled} onToggle={(enabled) => patch({ neonEnabled: enabled })} configured={providers.neon}>
            <label><span>Project ID</span><input disabled={!target.neonEnabled} value={target.neonProjectId} onChange={(event) => patch({ neonProjectId: event.target.value })} placeholder="late-frost-12345678"/></label>
            <label><span>Branch ID hoặc tên</span><input disabled={!target.neonEnabled} value={target.neonBranch} onChange={(event) => patch({ neonBranch: event.target.value })} placeholder="main hoặc br-..."/></label>
          </ProviderCard>

          <ProviderCard title="TinyFish" enabled={target.tinyfishEnabled} onToggle={(enabled) => patch({ tinyfishEnabled: enabled })} configured={providers.tinyfish}>
            <label><span>URL browser test</span><input disabled={!target.tinyfishEnabled} value={target.tinyfishTargetUrl} onChange={(event) => patch({ tinyfishTargetUrl: event.target.value })} placeholder="https://preview.example.com"/></label>
            <label><span>Mục tiêu kiểm thử</span><textarea disabled={!target.tinyfishEnabled} value={target.tinyfishGoal} onChange={(event) => patch({ tinyfishGoal: event.target.value })}/></label>
          </ProviderCard>
        </div>

        <div className={styles.actions}>
          <button className={styles.primary} disabled={Boolean(busy)} onClick={() => void saveTarget()}>{busy === "save" ? "Đang lưu…" : "Lưu mapping vào D1"}</button>
          <button disabled={Boolean(busy)} onClick={() => void bootstrap()}>{busy === "bootstrap" ? "Đang đọc…" : "Đọc lại cấu hình"}</button>
        </div>
      </section>

      <section className={styles.panel}>
        <div className={styles.panelTitle}>
          <div><small>02 · RELEASE SHA</small><h2>Kiểm tra live</h2></div>
          <b data-ready={Boolean(probe?.ready)}>{probe?.ready ? "READY" : "BLOCKED"}</b>
        </div>
        <label className={styles.shaField}>
          <span>Commit SHA đầy đủ 40 ký tự</span>
          <input value={sourceSha} onChange={(event) => { setSourceSha(event.target.value.trim().toLowerCase()); setProbe(null); setProductionAuthority(false); }} placeholder="38785fa536dc7ad0da930e3712604a0a5dcf3fe9"/>
          <em>{shaValid ? "SHA hợp lệ." : "Safe Publish chỉ nhận SHA đầy đủ."}</em>
        </label>

        <div className={styles.actions}>
          <button disabled={Boolean(busy) || !shaValid} onClick={() => void liveProbe()}>{busy === "probe" ? "Đang probe…" : "Kiểm tra Vercel + Neon + TinyFish"}</button>
          <button disabled={Boolean(busy) || !shaValid || !target.tinyfishEnabled} onClick={() => void startTinyFish()}>{busy === "tinyfish-start" ? "Đang khởi động…" : "Chạy TinyFish test thật"}</button>
          <button disabled={Boolean(busy) || !shaValid || !target.tinyfishEnabled} onClick={() => void refreshTinyFish()}>{busy === "tinyfish-refresh" ? "Đang làm mới…" : "Làm mới TinyFish"}</button>
        </div>

        {probe ? <div className={styles.gates}>
          <Gate label="Source SHA" passed={shaValid} detail={shaValid ? shortSha(sourceSha) : "Không hợp lệ"}/>
          <Gate label="Vercel" passed={probe.vercel.ready} detail={probe.vercel.message}/>
          <Gate label="Neon" passed={probe.neon.ready} detail={probe.neon.message}/>
          <Gate label="TinyFish" passed={probe.tinyfish.ready} detail={probe.tinyfish.message}/>
        </div> : null}

        {probe?.vercel.deploymentUrl ? <div className={styles.evidence}>
          <strong>Vercel deployment</strong>
          <a href={probe.vercel.deploymentUrl} target="_blank" rel="noopener noreferrer">{probe.vercel.deploymentUrl}</a>
          <span>ID: {probe.vercel.deploymentId} · {probe.vercel.state} · {probe.vercel.target ?? "preview"}</span>
        </div> : null}

        {probe?.tinyfish.result ? <div className={styles.evidence}>
          <strong>TinyFish result</strong>
          <span>{resultSummary(probe.tinyfish.result) || "Đã có kết quả structured output."}</span>
          <code>{JSON.stringify(probe.tinyfish.result, null, 2)}</code>
        </div> : null}

        <label className={styles.authority}>
          <input type="checkbox" checked={productionAuthority} onChange={(event) => setProductionAuthority(event.target.checked)}/>
          <span>
            <strong>Tôi cấp Production release authority cho đúng SHA ở trên.</strong>
            <em>Backend sẽ probe lại toàn bộ gate ngay trước khi promote. Không dùng trạng thái cũ trên giao diện.</em>
          </span>
        </label>
        <button className={styles.publish} disabled={Boolean(busy) || !shaValid || !productionAuthority} onClick={() => void safePublish()}>
          {busy === "publish" ? "Đang promote…" : "Safe Publish → Vercel Production"}
        </button>
        {message ? <div className={styles.message} aria-live="polite">{message}</div> : null}
      </section>

      <section className={styles.panel}>
        <div className={styles.panelTitle}><div><small>03 · AUDIT</small><h2>TinyFish / release runs</h2></div><button onClick={() => void loadRuns()}>↻</button></div>
        <div className={styles.runTable}>
          <div className={styles.runHead}><span>SHA</span><span>TinyFish</span><span>Trạng thái</span><span>Thời gian</span></div>
          {runs.map((run) => <div className={styles.runRow} key={run.id}>
            <code>{shortSha(run.sourceSha)}</code>
            <span>{run.tinyfishStatus ?? "—"}</span>
            <b data-status={run.status}>{run.status}</b>
            <span>{new Date(run.updatedAt || run.createdAt).toLocaleString("vi-VN")}</span>
          </div>)}
          {!runs.length ? <div className={styles.empty}>Chưa có run cho ứng dụng này.</div> : null}
        </div>
      </section>
    </div>
  </main>;
}

function ProviderCard({
  title,
  enabled,
  configured,
  onToggle,
  children,
}: {
  title: string;
  enabled: boolean;
  configured: boolean;
  onToggle: (enabled: boolean) => void;
  children: React.ReactNode;
}) {
  return <section className={styles.provider} data-enabled={enabled}>
    <header>
      <div><small>{configured ? "API secret sẵn sàng" : "Thiếu Worker secret"}</small><h3>{title}</h3></div>
      <label className={styles.switch}><input type="checkbox" checked={enabled} onChange={(event) => onToggle(event.target.checked)}/><span>{enabled ? "Dùng" : "Tắt"}</span></label>
    </header>
    <div className={styles.providerBody}>{children}</div>
  </section>;
}

function Gate({ label, passed, detail }: { label: string; passed: boolean; detail: string }) {
  return <article data-pass={passed}>
    <i>{passed ? "✓" : "!"}</i>
    <div><strong>{label}</strong><span>{detail}</span></div>
  </article>;
}
