import { getControlDatabase, type ControlDeviceState } from "./control-device.server";
import { projectRepositories } from "./project-registry";
import { getApplicationConfig } from "./application-registry";
import { deployOpsCredentialStatus, loadDeployOpsCredential } from "./deploy-ops-credentials.server";

const PROVIDER_TIMEOUT_MS = 12_000;
const VERCEL_API_ORIGIN = "https://api.vercel.com";
const NEON_API_ORIGIN = "https://console.neon.tech/api/v2";

export type DeployOpsTargetRow = {
  app_id: string;
  repository: string;
  vercel_enabled: number;
  vercel_project_id: string | null;
  vercel_team_id: string | null;
  neon_enabled: number;
  neon_project_id: string | null;
  neon_branch: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type DeployOpsRunRow = {
  id: string;
  app_id: string;
  source_sha: string;
  status: string;
  detail_json: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  published_at: string | null;
};

type UnknownRecord = Record<string, unknown>;

type ProviderConfiguration = {
  vercel: boolean;
  neon: boolean;
  encryptionReady: boolean;
  sources: {
    vercel: { configured: boolean; source: "worker" | "vault" | "missing"; fingerprint: string };
    neon: { configured: boolean; source: "worker" | "vault" | "missing"; fingerprint: string };
  };
};

type VercelProbe = {
  enabled: boolean;
  configured: boolean;
  ready: boolean;
  deploymentId: string | null;
  deploymentUrl: string | null;
  state: string | null;
  target: string | null;
  message: string;
};

type NeonProbe = {
  enabled: boolean;
  configured: boolean;
  ready: boolean;
  projectId: string | null;
  branchId: string | null;
  branchName: string | null;
  message: string;
};

export type DeployOpsProbe = {
  appId: string;
  sourceSha: string;
  providers: ProviderConfiguration;
  vercel: VercelProbe;
  neon: NeonProbe;
  ready: boolean;
  gates: Array<{ id: string; passed: boolean; detail: string }>;
};

function record(value: unknown): UnknownRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as UnknownRecord : {};
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function bool(value: unknown) {
  return value === true;
}

function validSha(value: string) {
  return /^[0-9a-f]{40}$/i.test(value);
}

function validAppId(value: string) {
  return /^[a-z0-9][a-z0-9-]{1,62}$/.test(value)
    && projectRepositories.some((project) => project.id === value);
}

function validRepository(value: string) {
  return /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(value) && value.length <= 180;
}

export async function deployOpsProviderConfiguration(): Promise<ProviderConfiguration> {
  const status = await deployOpsCredentialStatus();
  return {
    vercel: status.providers.vercel.configured,
    neon: status.providers.neon.configured,
    encryptionReady: status.encryptionReady,
    sources: status.providers,
  };
}

function safeErrorMessage(value: unknown, fallback: string) {
  const data = record(value);
  const error = record(data.error);
  return text(error.message) || text(data.message) || text(data.error) || fallback;
}

async function providerJson(
  label: string,
  url: string,
  init: RequestInit,
  acceptedStatuses: number[] = [200],
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
      cache: "no-store",
      headers: {
        accept: "application/json",
        ...(init.headers ?? {}),
      },
    });
    const payload = await response.json().catch(() => ({})) as unknown;
    if (!acceptedStatuses.includes(response.status)) {
      throw new Error(`${label}: HTTP ${response.status} · ${safeErrorMessage(payload, "provider request failed")}`);
    }
    return record(payload);
  } catch (error) {
    if (controller.signal.aborted) throw new Error(`${label}: phản hồi quá ${PROVIDER_TIMEOUT_MS / 1000} giây`);
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function audit(actor: string, action: string, target: string, detail: UnknownRecord) {
  const database = await getControlDatabase();
  await database.prepare(
    "INSERT INTO control_audit_log (actor, action, target, detail_json) VALUES (?, ?, ?, ?)",
  ).bind(actor, action, target, JSON.stringify(detail)).run();
}

function targetPublic(row: DeployOpsTargetRow) {
  return {
    appId: row.app_id,
    repository: row.repository,
    vercelEnabled: row.vercel_enabled === 1,
    vercelProjectId: row.vercel_project_id ?? "",
    vercelTeamId: row.vercel_team_id ?? "",
    neonEnabled: row.neon_enabled === 1,
    neonProjectId: row.neon_project_id ?? "",
    neonBranch: row.neon_branch ?? "",
    updatedAt: row.updated_at,
  };
}

export async function listDeployOpsTargets() {
  const database = await getControlDatabase();
  const rows = await database.prepare(
    "SELECT * FROM deploy_ops_targets ORDER BY app_id ASC",
  ).all<DeployOpsTargetRow>();
  return rows.results.map(targetPublic);
}

export async function readDeployOpsTarget(appId: string) {
  const database = await getControlDatabase();
  return await database.prepare(
    "SELECT * FROM deploy_ops_targets WHERE app_id = ? LIMIT 1",
  ).bind(appId).first<DeployOpsTargetRow>();
}


type DiscoveryCandidate = {
  id: string;
  name: string;
  score: number;
  reasons: string[];
};

function normalizedName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function repositoryName(repository: string) {
  return repository.split("/").pop() ?? repository;
}

function vercelRegistrySuggestion(appId: string) {
  const app = getApplicationConfig(appId);
  if (!app?.publicUrl) return null;
  try {
    const url = new URL(app.publicUrl);
    if (!url.hostname.endsWith(".vercel.app")) return null;
    const slug = url.hostname.slice(0, -".vercel.app".length);
    if (!slug) return null;
    return {
      projectIdOrSlug: slug,
      productionUrl: url.origin,
      reason: "Suy ra từ publicUrl canonical trong Application Registry; vẫn phải probe API trước khi publish.",
    };
  } catch {
    return null;
  }
}

function vercelCandidate(project: UnknownRecord, appId: string, repository: string) {
  const id = text(project.id);
  const name = text(project.name);
  if (!id || !name) return null;
  const reasons: string[] = [];
  let score = 0;
  const repoBase = repositoryName(repository);
  const normalizedRepo = normalizedName(repoBase);
  const normalizedApp = normalizedName(appId);
  const normalizedProject = normalizedName(name);
  const link = record(project.link);
  const gitRepo = text(link.repo) || text(link.repoName) || text(project.repo);
  if (gitRepo && normalizedName(gitRepo) === normalizedRepo) {
    score += 120;
    reasons.push("Git repository khớp");
  }
  if (normalizedProject === normalizedRepo) {
    score += 90;
    reasons.push("Tên project khớp repository");
  }
  if (normalizedProject === normalizedApp) {
    score += 80;
    reasons.push("Tên project khớp app ID");
  }
  const suggestion = vercelRegistrySuggestion(appId);
  if (suggestion && normalizedName(suggestion.projectIdOrSlug) === normalizedProject) {
    score += 110;
    reasons.push("Khớp publicUrl canonical");
  }
  return {
    id,
    name,
    teamId: text(project.accountId) || text(project.teamId),
    gitRepository: gitRepo,
    score,
    reasons,
  };
}

function neonCandidate(project: UnknownRecord, appId: string, repository: string) {
  const id = text(project.id);
  const name = text(project.name);
  if (!id || !name) return null;
  const reasons: string[] = [];
  let score = 0;
  const normalizedRepo = normalizedName(repositoryName(repository));
  const normalizedApp = normalizedName(appId);
  const normalizedProject = normalizedName(name);
  if (normalizedProject === normalizedRepo) {
    score += 90;
    reasons.push("Tên project khớp repository");
  }
  if (normalizedProject === normalizedApp) {
    score += 80;
    reasons.push("Tên project khớp app ID");
  }
  if (normalizedProject.includes(normalizedApp) || normalizedApp.includes(normalizedProject)) {
    score += 25;
    reasons.push("Tên project gần app ID");
  }
  return {
    id,
    name,
    regionId: text(project.region_id) || text(project.regionId),
    score,
    reasons,
  };
}

export async function discoverDeployOpsResources(appId: string) {
  if (!validAppId(appId)) throw new Error("INVALID_APP_ID");
  const project = projectRepositories.find((item) => item.id === appId);
  if (!project) throw new Error("INVALID_APP_ID");
  const repository = project.repository;
  const [vercelCredential, neonCredential] = await Promise.all([
    loadDeployOpsCredential("vercel"),
    loadDeployOpsCredential("neon"),
  ]);

  const result: {
    appId: string;
    repository: string;
    registrySuggestion: ReturnType<typeof vercelRegistrySuggestion>;
    vercel: { configured: boolean; candidates: Array<DiscoveryCandidate & { teamId: string; gitRepository: string }>; error: string | null };
    neon: { configured: boolean; candidates: Array<DiscoveryCandidate & { regionId: string }>; error: string | null };
  } = {
    appId,
    repository,
    registrySuggestion: vercelRegistrySuggestion(appId),
    vercel: { configured: Boolean(vercelCredential.value), candidates: [], error: null },
    neon: { configured: Boolean(neonCredential.value), candidates: [], error: null },
  };

  if (vercelCredential.value) {
    try {
      const data = await providerJson(
        "Vercel discovery",
        `${VERCEL_API_ORIGIN}/v10/projects?limit=100`,
        { headers: { authorization: `Bearer ${vercelCredential.value}` } },
      );
      const projects = Array.isArray(data.projects) ? data.projects.map(record) : [];
      result.vercel.candidates = projects
        .map((item) => vercelCandidate(item, appId, repository))
        .filter((item): item is NonNullable<ReturnType<typeof vercelCandidate>> => Boolean(item))
        .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
        .slice(0, 25);
    } catch (error) {
      result.vercel.error = error instanceof Error ? error.message : "Vercel discovery failed.";
    }
  }

  if (neonCredential.value) {
    try {
      const data = await providerJson(
        "Neon discovery",
        `${NEON_API_ORIGIN}/projects?limit=100`,
        { headers: { authorization: `Bearer ${neonCredential.value}` } },
      );
      const projects = Array.isArray(data.projects) ? data.projects.map(record) : [];
      result.neon.candidates = projects
        .map((item) => neonCandidate(item, appId, repository))
        .filter((item): item is NonNullable<ReturnType<typeof neonCandidate>> => Boolean(item))
        .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
        .slice(0, 25);
    } catch (error) {
      result.neon.error = error instanceof Error ? error.message : "Neon discovery failed.";
    }
  }

  return result;
}

export async function discoverNeonBranches(projectIdValue: unknown) {
  const projectId = text(projectIdValue);
  if (!/^[a-z0-9-]{1,60}$/i.test(projectId)) throw new Error("INVALID_NEON_PROJECT_ID");
  const credential = await loadDeployOpsCredential("neon");
  if (!credential.value) throw new Error("NEON_CREDENTIAL_MISSING");

  const data = await providerJson(
    "Neon branch discovery",
    `${NEON_API_ORIGIN}/projects/${encodeURIComponent(projectId)}/branches`,
    { headers: { authorization: `Bearer ${credential.value}` } },
  );
  const branches = Array.isArray(data.branches) ? data.branches.map(record) : [];
  return branches
    .map((branch) => ({
      id: text(branch.id),
      name: text(branch.name),
      primary: branch.primary === true,
      currentState: text(branch.current_state) || text(branch.currentState),
      createdAt: text(branch.created_at) || text(branch.createdAt),
    }))
    .filter((branch) => branch.id && branch.name)
    .sort((a, b) => Number(b.primary) - Number(a.primary) || Number(b.name === "main") - Number(a.name === "main") || a.name.localeCompare(b.name));
}

export async function saveDeployOpsTarget(payload: UnknownRecord, actor: ControlDeviceState) {
  if (actor.role !== "owner") throw new Error("OWNER_REQUIRED");
  const appId = text(payload.appId).toLowerCase();
  const repository = text(payload.repository);
  if (!validAppId(appId)) throw new Error("INVALID_APP_ID");
  if (!validRepository(repository)) throw new Error("INVALID_REPOSITORY");

  const vercelEnabled = bool(payload.vercelEnabled);
  const vercelProjectId = text(payload.vercelProjectId);
  const vercelTeamId = text(payload.vercelTeamId);
  const neonEnabled = bool(payload.neonEnabled);
  const neonProjectId = text(payload.neonProjectId);
  const neonBranch = text(payload.neonBranch);

  if (vercelEnabled && (!vercelProjectId || vercelProjectId.length > 160)) throw new Error("VERCEL_PROJECT_REQUIRED");
  if (vercelTeamId.length > 160) throw new Error("INVALID_VERCEL_TEAM");
  if (neonEnabled && (!/^[a-z0-9-]{1,60}$/i.test(neonProjectId) || !neonBranch || neonBranch.length > 160)) throw new Error("NEON_MAPPING_REQUIRED");

  const database = await getControlDatabase();
  await database.prepare(
    `INSERT INTO deploy_ops_targets (
      app_id, repository, vercel_enabled, vercel_project_id, vercel_team_id,
      neon_enabled, neon_project_id, neon_branch, created_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(app_id) DO UPDATE SET
      repository=excluded.repository,
      vercel_enabled=excluded.vercel_enabled,
      vercel_project_id=excluded.vercel_project_id,
      vercel_team_id=excluded.vercel_team_id,
      neon_enabled=excluded.neon_enabled,
      neon_project_id=excluded.neon_project_id,
      neon_branch=excluded.neon_branch,
      updated_at=CURRENT_TIMESTAMP`,
  ).bind(
    appId,
    repository,
    vercelEnabled ? 1 : 0,
    vercelProjectId || null,
    vercelTeamId || null,
    neonEnabled ? 1 : 0,
    neonProjectId || null,
    neonBranch || null,
    actor.email,
  ).run();

  await audit(actor.email, "deploy_ops_target_saved", appId, {
    repository,
    vercelEnabled,
    neonEnabled,
  });
  const row = await readDeployOpsTarget(appId);
  if (!row) throw new Error("DEPLOY_OPS_TARGET_SAVE_FAILED");
  return targetPublic(row);
}

async function probeVercel(row: DeployOpsTargetRow, sourceSha: string): Promise<VercelProbe> {
  if (row.vercel_enabled !== 1) {
    return { enabled: false, configured: true, ready: true, deploymentId: null, deploymentUrl: null, state: null, target: null, message: "Không dùng Vercel cho app này." };
  }
  const credential = await loadDeployOpsCredential("vercel");
  const token = credential.value;
  if (!token) {
    return { enabled: true, configured: false, ready: false, deploymentId: null, deploymentUrl: null, state: null, target: null, message: "Chưa cấu hình credential Vercel." };
  }
  const projectId = row.vercel_project_id ?? "";
  const params = new URLSearchParams({ projectId, sha: sourceSha, state: "READY", limit: "10" });
  if (row.vercel_team_id) params.set("teamId", row.vercel_team_id);
  try {
    const data = await providerJson(
      "Vercel",
      `${VERCEL_API_ORIGIN}/v7/deployments?${params.toString()}`,
      { headers: { authorization: `Bearer ${token}` } },
    );
    const deployments = Array.isArray(data.deployments) ? data.deployments.map(record) : [];
    const deployment = deployments.find((item) => text(item.state) === "READY") ?? deployments[0];
    if (!deployment) {
      return { enabled: true, configured: true, ready: false, deploymentId: null, deploymentUrl: null, state: null, target: null, message: "Không tìm thấy deployment READY đúng commit SHA." };
    }
    const deploymentId = text(deployment.uid) || text(deployment.id);
    const url = text(deployment.url);
    return {
      enabled: true,
      configured: true,
      ready: Boolean(deploymentId && url),
      deploymentId: deploymentId || null,
      deploymentUrl: url ? `https://${url.replace(/^https?:\/\//, "")}` : null,
      state: text(deployment.state) || null,
      target: text(deployment.target) || null,
      message: deploymentId && url ? "Đã xác minh deployment READY đúng SHA." : "Deployment thiếu ID hoặc URL.",
    };
  } catch (error) {
    return { enabled: true, configured: true, ready: false, deploymentId: null, deploymentUrl: null, state: null, target: null, message: error instanceof Error ? error.message : "Vercel probe failed." };
  }
}

async function probeNeon(row: DeployOpsTargetRow): Promise<NeonProbe> {
  if (row.neon_enabled !== 1) {
    return { enabled: false, configured: true, ready: true, projectId: null, branchId: null, branchName: null, message: "Không dùng Neon cho app này." };
  }
  const credential = await loadDeployOpsCredential("neon");
  const token = credential.value;
  if (!token) {
    return { enabled: true, configured: false, ready: false, projectId: row.neon_project_id, branchId: null, branchName: null, message: "Chưa cấu hình credential Neon." };
  }
  const projectId = row.neon_project_id ?? "";
  const wantedBranch = row.neon_branch ?? "";
  try {
    await providerJson(
      "Neon project",
      `${NEON_API_ORIGIN}/projects/${encodeURIComponent(projectId)}`,
      { headers: { authorization: `Bearer ${token}` } },
    );
    const branchData = await providerJson(
      "Neon branches",
      `${NEON_API_ORIGIN}/projects/${encodeURIComponent(projectId)}/branches`,
      { headers: { authorization: `Bearer ${token}` } },
    );
    const branches = Array.isArray(branchData.branches) ? branchData.branches.map(record) : [];
    const branch = branches.find((item) => text(item.id) === wantedBranch || text(item.name) === wantedBranch);
    if (!branch) {
      return { enabled: true, configured: true, ready: false, projectId, branchId: null, branchName: null, message: "Không tìm thấy Neon branch đã cấu hình." };
    }
    return {
      enabled: true,
      configured: true,
      ready: true,
      projectId,
      branchId: text(branch.id) || null,
      branchName: text(branch.name) || null,
      message: "Đã xác minh Neon project và branch tồn tại.",
    };
  } catch (error) {
    return { enabled: true, configured: true, ready: false, projectId, branchId: null, branchName: null, message: error instanceof Error ? error.message : "Neon probe failed." };
  }
}

export async function probeDeployOps(appId: string, sourceSha: string): Promise<DeployOpsProbe> {
  if (!validAppId(appId) || !validSha(sourceSha)) throw new Error("INVALID_DEPLOY_OPS_PROBE");
  const row = await readDeployOpsTarget(appId);
  if (!row) throw new Error("DEPLOY_OPS_TARGET_NOT_FOUND");
  const providers = await deployOpsProviderConfiguration();
  const [vercel, neon] = await Promise.all([
    probeVercel(row, sourceSha),
    probeNeon(row),
  ]);
  const gates = [
    { id: "source", passed: validSha(sourceSha), detail: validSha(sourceSha) ? "Commit SHA đầy đủ 40 ký tự." : "SHA không hợp lệ." },
    { id: "vercel", passed: vercel.ready, detail: vercel.message },
    { id: "neon", passed: neon.ready, detail: neon.message },
  ];
  return {
    appId,
    sourceSha,
    providers,
    vercel,
    neon,
    ready: gates.every((gate) => gate.passed),
    gates,
  };
}

async function promoteVercel(row: DeployOpsTargetRow, deploymentId: string) {
  const credential = await loadDeployOpsCredential("vercel");
  const token = credential.value;
  if (!token) throw new Error("VERCEL_TOKEN_MISSING");
  const projectId = row.vercel_project_id ?? "";
  const params = new URLSearchParams();
  if (row.vercel_team_id) params.set("teamId", row.vercel_team_id);
  const suffix = params.size ? `?${params.toString()}` : "";
  await providerJson(
    "Vercel promote",
    `${VERCEL_API_ORIGIN}/v10/projects/${encodeURIComponent(projectId)}/promote/${encodeURIComponent(deploymentId)}${suffix}`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: "{}",
    },
    [200, 201, 202, 204],
  );
}

export async function safePublishDeployOps(
  appId: string,
  sourceSha: string,
  productionAuthority: boolean,
  actor: ControlDeviceState,
) {
  if (actor.role !== "owner" || !productionAuthority) throw new Error("PRODUCTION_AUTHORITY_REQUIRED");
  if (!validAppId(appId) || !validSha(sourceSha)) throw new Error("INVALID_SAFE_PUBLISH_TARGET");
  const row = await readDeployOpsTarget(appId);
  if (!row) throw new Error("DEPLOY_OPS_TARGET_NOT_FOUND");
  if (row.vercel_enabled !== 1) throw new Error("NO_VERCEL_PUBLISH_PROVIDER");

  const probe = await probeDeployOps(appId, sourceSha);
  if (!probe.ready || !probe.vercel.deploymentId) {
    const error = new Error("SAFE_PUBLISH_BLOCKED");
    (error as Error & { probe?: DeployOpsProbe }).probe = probe;
    throw error;
  }

  await promoteVercel(row, probe.vercel.deploymentId);
  const database = await getControlDatabase();
  const runId = crypto.randomUUID();
  await database.prepare(
    `INSERT INTO deploy_ops_runs
      (id, app_id, source_sha, status, detail_json, created_by, published_at, updated_at)
     VALUES (?, ?, ?, 'published', ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
  ).bind(
    runId,
    appId,
    sourceSha,
    JSON.stringify({
      vercelDeploymentId: probe.vercel.deploymentId,
      vercelDeploymentUrl: probe.vercel.deploymentUrl,
      neonProjectId: probe.neon.projectId,
      neonBranchId: probe.neon.branchId,
    }),
    actor.email,
  ).run();

  await audit(actor.email, "deploy_ops_safe_publish", appId, {
    sourceSha,
    vercelDeploymentId: probe.vercel.deploymentId,
    neonProjectId: probe.neon.projectId,
  });
  return {
    ok: true,
    promoted: true,
    appId,
    sourceSha,
    deploymentId: probe.vercel.deploymentId,
    deploymentUrl: probe.vercel.deploymentUrl,
    probe,
  };
}

export async function deployOpsRecentRuns(appId: string, limit = 12) {
  const database = await getControlDatabase();
  const safeLimit = Math.max(1, Math.min(50, Math.floor(limit)));
  const rows = await database.prepare(
    `SELECT id, app_id, source_sha, status, detail_json, created_by, created_at, updated_at, published_at
       FROM deploy_ops_runs WHERE app_id=? ORDER BY created_at DESC LIMIT ?`,
  ).bind(appId, safeLimit).all<DeployOpsRunRow>();
  return rows.results.map((row) => ({
    id: row.id,
    appId: row.app_id,
    sourceSha: row.source_sha,
    status: row.status,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    publishedAt: row.published_at,
  }));
}
