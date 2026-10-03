"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { deployOpsAction } from "../../admin-device-client";
import { projectRepositories } from "../../project-registry";
import styles from "./deploy-ops.module.css";

type ProviderKey = "vercel" | "neon";
type ProviderSource = "worker" | "vault" | "missing";
type ProviderState = { configured: boolean; source: ProviderSource; fingerprint: string };
type Providers = {
  vercel: boolean;
  neon: boolean;
  encryptionReady: boolean;
  sources: Record<ProviderKey, ProviderState>;
};

type Target = {
  appId: string;
  repository: string;
  vercelEnabled: boolean;
  vercelProjectId: string;
  vercelTeamId: string;
  neonEnabled: boolean;
  neonProjectId: string;
  neonBranch: string;
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
  gates: Array<{ id: string; passed: boolean; detail: string }>;
};

type Run = {
  id: string;
  appId: string;
  sourceSha: string;
  status: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
};

type Discovery = {
  appId: string;
  repository: string;
  registrySuggestion: { projectIdOrSlug: string; productionUrl: string; reason: string } | null;
  vercel: {
    configured: boolean;
    error: string | null;
    candidates: Array<{ id: string; name: string; teamId: string; gitRepository: string; score: number; reasons: string[] }>;
  };
  neon: {
    configured: boolean;
    error: string | null;
    candidates: Array<{ id: string; name: string; regionId: string; score: number; reasons: string[] }>;
  };
};

type NeonBranch = {
  id: string;
  name: string;
  primary: boolean;
  currentState: string;
  createdAt: string;
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
  promoted?: boolean;
  deploymentId?: string;
  deploymentUrl?: string;
  discovery?: Discovery;
  branches?: NeonBranch[];
};

const emptySources: Record<ProviderKey, ProviderState> = {
  vercel: { configured: false, source: "missing", fingerprint: "" },
  neon: { configured: false, source: "missing", fingerprint: "" },
};

const emptyProviders: Providers = {
  vercel: false,
  neon: false,
  encryptionReady: false,
  sources: emptySources,
};

const providerMeta: Array<{ id: ProviderKey; label: string; role: string; placeholder: string }> = [
  { id: "vercel", label: "Vercel", role: "Deploy / Promote", placeholder: "Vercel access token" },
  { id: "neon", label: "Neon", role: "PostgreSQL / Branch", placeholder: "Neon API key" },
];

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
  };
}

function shortSha(value: string) {
  return value ? value.slice(0, 12) : "—";
}

function sourceLabel(state: ProviderState) {
  if (state.source === "worker") return "Worker secret";
  if (state.source === "vault") return state.fingerprint ? `Vault · ${state.fingerprint}` : "Vault mã hóa";
  return "Chưa cấu hình";
}

export default function DeployOpsTool({ user }: { user: { displayName: string; email: string } }) {
  const [providers, setProviders] = useState<Providers>(emptyProviders);
  const [credentialDrafts, setCredentialDrafts] = useState<Record<ProviderKey, string>>({ vercel: "", neon: "" });
  const [targets, setTargets] = useState<Target[]>([]);
  const [target, setTarget] = useState<Target>(() => defaultTarget());
  const [discovery, setDiscovery] = useState<Discovery | null>(null);
  const [neonBranches, setNeonBranches] = useState<NeonBranch[]>([]);
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
      setProviders(data.providers ?? emptyProviders);
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
    setDiscovery(null);
    setNeonBranches([]);
    setSourceSha("");
    setProductionAuthority(false);
    setMessage("");
  }

  function patch(value: Partial<Target>) {
    setTarget((current) => ({ ...current, ...value }));
    setProbe(null);
    setProductionAuthority(false);
  }

  async function saveCredential(provider: ProviderKey) {
    const credential = credentialDrafts[provider].trim();
    if (!credential) {
      setMessage(`Hãy nhập credential ${providerMeta.find((item) => item.id === provider)?.label ?? provider}.`);
      return;
    }
    setBusy(`credential-${provider}`);
    setMessage("");
    try {
      const data = await deployOpsAction({
        action: "save-provider-credential",
        provider,
        credential,
      }) as ApiResult;
      if (!data.ok || !data.providers) throw new Error(data.error ?? "Không lưu được credential.");
      setProviders(data.providers);
      setCredentialDrafts((current) => ({ ...current, [provider]: "" }));
      setProbe(null);
      setMessage(`Đã mã hóa và lưu credential ${providerMeta.find((item) => item.id === provider)?.label ?? provider} vào Vault D1.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không lưu được credential.");
    } finally {
      setBusy("");
    }
  }

  async function removeCredential(provider: ProviderKey) {
    if (providers.sources[provider].source !== "vault") return;
    if (!window.confirm(`Xóa credential ${providerMeta.find((item) => item.id === provider)?.label ?? provider} khỏi Vault D1?`)) return;
    setBusy(`credential-remove-${provider}`);
    setMessage("");
    try {
      const data = await deployOpsAction({
        action: "remove-provider-credential",
        provider,
      }) as ApiResult;
      if (!data.ok || !data.providers) throw new Error(data.error ?? "Không xóa được credential.");
      setProviders(data.providers);
      setProbe(null);
      setMessage("Đã xóa credential khỏi Vault D1.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không xóa được credential.");
    } finally {
      setBusy("");
    }
  }

  async function discoverResources() {
    setBusy("discover");
    setMessage("");
    try {
      const data = await deployOpsAction({ action: "discover-resources", appId: target.appId }) as ApiResult;
      if (!data.discovery) throw new Error(data.error ?? "Không dò được provider resource.");
      setDiscovery(data.discovery);
      if (data.providers) setProviders(data.providers);
      const vercelCount = data.discovery.vercel.candidates.length;
      const neonCount = data.discovery.neon.candidates.length;
      setMessage(`Đã dò: ${vercelCount} Vercel project · ${neonCount} Neon project. Chọn đúng resource rồi lưu mapping.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không dò được provider resource.");
    } finally {
      setBusy("");
    }
  }

  async function discoverBranches(projectId: string) {
    setBusy("discover-branches");
    setMessage("");
    try {
      const data = await deployOpsAction({ action: "discover-neon-branches", projectId }) as ApiResult;
      const branches = data.branches ?? [];
      setNeonBranches(branches);
      setMessage(branches.length ? `Đã tìm thấy ${branches.length} Neon branch.` : "Neon project này chưa trả branch nào.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không đọc được Neon branch.");
    } finally {
      setBusy("");
    }
  }

  function useVercelCandidate(candidate: Discovery["vercel"]["candidates"][number]) {
    patch({
      vercelEnabled: true,
      vercelProjectId: candidate.id || candidate.name,
      vercelTeamId: candidate.teamId,
    });
    setMessage(`Đã chọn Vercel project ${candidate.name}. Hãy lưu mapping sau khi kiểm tra.`);
  }

  function useVercelSuggestion() {
    const suggestion = discovery?.registrySuggestion;
    if (!suggestion) return;
    patch({ vercelEnabled: true, vercelProjectId: suggestion.projectIdOrSlug });
    setMessage(`Đã điền Vercel slug ${suggestion.projectIdOrSlug} từ Application Registry. Cần probe API trước Safe Publish.`);
  }

  async function useNeonCandidate(candidate: Discovery["neon"]["candidates"][number]) {
    patch({ neonEnabled: true, neonProjectId: candidate.id, neonBranch: "" });
    setNeonBranches([]);
    await discoverBranches(candidate.id);
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
      setMessage("Đã lưu mapping vào D1. Credential được quản lý riêng trong Provider Vault.");
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
      setProviders(data.probe.providers);
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
      if (data.probe) {
        setProbe(data.probe);
        setProviders(data.probe.providers);
      }
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

  return <main className={styles.shell}>
    <div className={styles.wrap}>
      <header className={styles.header}>
        <div>
          <small>DEPLOY & OPS · LIVE CONTROL</small>
          <h1>Vercel · Neon</h1>
          <p>Đọc Vercel và Neon bằng API server-side, kiểm tra đúng SHA/branch và chỉ promote Vercel khi toàn bộ gate bắt buộc PASS.</p>
        </div>
        <Link className={styles.back} href="/">← Trung tâm</Link>
      </header>

      <section className={styles.providerStrip}>
        {providerMeta.map((item) => {
          const state = providers.sources[item.id];
          return <article key={item.id} data-ready={providers[item.id]}>
            <i>{providers[item.id] ? "✓" : "!"}</i>
            <div><strong>{item.label}</strong><span>{item.role}</span></div>
            <b>{sourceLabel(state)}</b>
          </article>;
        })}
      </section>

      <section className={styles.panel}>
        <div className={styles.panelTitle}>
          <div><small>00 · PROVIDER VAULT</small><h2>Credential mã hóa</h2></div>
          <b data-ready={providers.encryptionReady}>{providers.encryptionReady ? "AES-GCM READY" : "ENCRYPTION BLOCKED"}</b>
        </div>
        <p className={styles.projectNote}>
          Worker secret luôn được ưu tiên. Nếu chưa có Worker secret, Owner có thể nhập token tại đây; backend mã hóa AES-GCM trước khi ghi D1 và không trả plaintext về trình duyệt.
        </p>
        <div className={styles.vaultGrid}>
          {providerMeta.map((item) => {
            const state = providers.sources[item.id];
            const workerOwned = state.source === "worker";
            return <article className={styles.vaultCard} key={item.id} data-ready={state.configured}>
              <header>
                <div>
                  <small>{item.role}</small>
                  <h3>{item.label}</h3>
                </div>
                <b>{sourceLabel(state)}</b>
              </header>
              <label>
                <span>{workerOwned ? "Worker secret đang có hiệu lực" : state.source === "vault" ? "Thay credential Vault" : "Nhập credential"}</span>
                <input
                  type="password"
                  autoComplete="new-password"
                  spellCheck={false}
                  disabled={workerOwned || !providers.encryptionReady || Boolean(busy)}
                  value={credentialDrafts[item.id]}
                  onChange={(event) => setCredentialDrafts((current) => ({ ...current, [item.id]: event.target.value }))}
                  placeholder={workerOwned ? "Được quản lý ngoài ứng dụng" : item.placeholder}
                />
              </label>
              <div className={styles.vaultActions}>
                <button
                  disabled={workerOwned || !providers.encryptionReady || Boolean(busy) || !credentialDrafts[item.id].trim()}
                  onClick={() => void saveCredential(item.id)}
                >
                  {busy === `credential-${item.id}` ? "Đang mã hóa…" : state.source === "vault" ? "Thay token" : "Lưu vào Vault"}
                </button>
                <button
                  className={styles.dangerGhost}
                  disabled={state.source !== "vault" || Boolean(busy)}
                  onClick={() => void removeCredential(item.id)}
                >
                  {busy === `credential-remove-${item.id}` ? "Đang xóa…" : "Xóa Vault"}
                </button>
              </div>
            </article>;
          })}
        </div>
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


        </div>

        <div className={styles.actions}>
          <button className={styles.primary} disabled={Boolean(busy)} onClick={() => void saveTarget()}>{busy === "save" ? "Đang lưu…" : "Lưu mapping vào D1"}</button>
          <button disabled={Boolean(busy)} onClick={() => void discoverResources()}>{busy === "discover" ? "Đang dò…" : "Auto Discover Vercel + Neon"}</button>
          <button disabled={Boolean(busy)} onClick={() => void bootstrap()}>{busy === "bootstrap" ? "Đang đọc…" : "Đọc lại cấu hình"}</button>
        </div>

        {discovery ? <section className={styles.discovery}>
          <header>
            <div><small>AUTO DISCOVERY</small><h3>Resource tìm thấy</h3></div>
            <span>Không tự ghi mapping · Owner chọn rồi lưu</span>
          </header>

          {discovery.registrySuggestion ? <article className={styles.suggestion}>
            <div>
              <strong>Vercel gợi ý từ Application Registry</strong>
              <span>{discovery.registrySuggestion.projectIdOrSlug} · {discovery.registrySuggestion.productionUrl}</span>
              <em>{discovery.registrySuggestion.reason}</em>
            </div>
            <button onClick={useVercelSuggestion}>Dùng gợi ý</button>
          </article> : null}

          <div className={styles.discoveryGrid}>
            <div>
              <h4>Vercel projects</h4>
              {!discovery.vercel.configured ? <p className={styles.discoveryEmpty}>Chưa có Vercel credential trong Worker/Vault.</p> : null}
              {discovery.vercel.error ? <p className={styles.discoveryError}>{discovery.vercel.error}</p> : null}
              {discovery.vercel.candidates.map((candidate) => <article className={styles.resourceRow} key={candidate.id}>
                <div>
                  <strong>{candidate.name}</strong>
                  <span>{candidate.id}{candidate.teamId ? ` · ${candidate.teamId}` : ""}</span>
                  <em>{candidate.reasons.length ? candidate.reasons.join(" · ") : "Không có match mạnh; cần kiểm tra thủ công."}</em>
                </div>
                <button onClick={() => useVercelCandidate(candidate)}>Chọn</button>
              </article>)}
              {discovery.vercel.configured && !discovery.vercel.error && !discovery.vercel.candidates.length ? <p className={styles.discoveryEmpty}>API Vercel không trả project nào.</p> : null}
            </div>

            <div>
              <h4>Neon projects</h4>
              {!discovery.neon.configured ? <p className={styles.discoveryEmpty}>Chưa có Neon credential trong Worker/Vault.</p> : null}
              {discovery.neon.error ? <p className={styles.discoveryError}>{discovery.neon.error}</p> : null}
              {discovery.neon.candidates.map((candidate) => <article className={styles.resourceRow} key={candidate.id}>
                <div>
                  <strong>{candidate.name}</strong>
                  <span>{candidate.id}{candidate.regionId ? ` · ${candidate.regionId}` : ""}</span>
                  <em>{candidate.reasons.length ? candidate.reasons.join(" · ") : "Không có match mạnh; cần kiểm tra thủ công."}</em>
                </div>
                <button disabled={Boolean(busy)} onClick={() => void useNeonCandidate(candidate)}>Chọn + dò branch</button>
              </article>)}
              {discovery.neon.configured && !discovery.neon.error && !discovery.neon.candidates.length ? <p className={styles.discoveryEmpty}>API Neon không trả project nào.</p> : null}
            </div>
          </div>

          {target.neonProjectId && neonBranches.length ? <div className={styles.branchPicker}>
            <strong>Branch của {target.neonProjectId}</strong>
            <div>
              {neonBranches.map((branch) => <button
                key={branch.id}
                data-selected={target.neonBranch === branch.id || target.neonBranch === branch.name}
                onClick={() => patch({ neonEnabled: true, neonBranch: branch.id })}
              >
                {branch.name}{branch.primary ? " · PRIMARY" : ""} <small>{branch.id}</small>
              </button>)}
            </div>
          </div> : null}
        </section> : null}
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
          <button disabled={Boolean(busy) || !shaValid} onClick={() => void liveProbe()}>{busy === "probe" ? "Đang probe…" : "Kiểm tra Vercel + Neon"}</button>
        </div>

        {probe ? <div className={styles.gates}>
          <Gate label="Source SHA" passed={shaValid} detail={shaValid ? shortSha(sourceSha) : "Không hợp lệ"}/>
          <Gate label="Vercel" passed={probe.vercel.ready} detail={probe.vercel.message}/>
          <Gate label="Neon" passed={probe.neon.ready} detail={probe.neon.message}/>
        </div> : null}

        {probe?.vercel.deploymentUrl ? <div className={styles.evidence}>
          <strong>Vercel deployment</strong>
          <a href={probe.vercel.deploymentUrl} target="_blank" rel="noopener noreferrer">{probe.vercel.deploymentUrl}</a>
          <span>ID: {probe.vercel.deploymentId} · {probe.vercel.state} · {probe.vercel.target ?? "preview"}</span>
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
        <div className={styles.panelTitle}><div><small>03 · AUDIT</small><h2>Lịch sử publish</h2></div><button onClick={() => void loadRuns()}>↻</button></div>
        <div className={styles.runTable}>
          <div className={styles.runHead}><span>SHA</span><span>Trạng thái</span><span>Thời gian</span></div>
          {runs.map((run) => <div className={styles.runRow} key={run.id}>
            <code>{shortSha(run.sourceSha)}</code>
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
      <div><small>{configured ? "Credential sẵn sàng" : "Thiếu credential"}</small><h3>{title}</h3></div>
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
