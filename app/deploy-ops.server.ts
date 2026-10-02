import { getControlDatabase, type ControlDeviceState } from "./control-device.server";
import { projectRepositories } from "./project-registry";
import { deployOpsCredentialStatus, loadDeployOpsCredential } from "./deploy-ops-credentials.server";

const PROVIDER_TIMEOUT_MS = 12_000;
const TINYFISH_AGENT_ORIGIN = "https://agent.tinyfish.ai";
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
  tinyfish_enabled: number;
  tinyfish_target_url: string | null;
  tinyfish_goal: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type DeployOpsRunRow = {
  id: string;
  app_id: string;
  source_sha: string;
  tinyfish_run_id: string | null;
  tinyfish_status: string | null;
  tinyfish_result_json: string | null;
  callback_nonce_hash: string | null;
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
  tinyfish: boolean;
  encryptionReady: boolean;
  sources: {
    vercel: { configured: boolean; source: "worker" | "vault" | "missing"; fingerprint: string };
    neon: { configured: boolean; source: "worker" | "vault" | "missing"; fingerprint: string };
    tinyfish: { configured: boolean; source: "worker" | "vault" | "missing"; fingerprint: string };
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

type TinyFishProbe = {
  enabled: boolean;
  configured: boolean;
  ready: boolean;
  runId: string | null;
  status: string | null;
  result: UnknownRecord | null;
  message: string;
};

export type DeployOpsProbe = {
  appId: string;
  sourceSha: string;
  providers: ProviderConfiguration;
  vercel: VercelProbe;
  neon: NeonProbe;
  tinyfish: TinyFishProbe;
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

function privateHost(hostname: string) {
  const normalized = hostname.toLowerCase();
  if (normalized === "localhost" || normalized === "127.0.0.1" || normalized === "::1") return true;
  if (/^10\./.test(normalized) || /^192\.168\./.test(normalized) || /^169\.254\./.test(normalized)) return true;
  const match = normalized.match(/^172\.(\d+)\./);
  return Boolean(match && Number(match[1]) >= 16 && Number(match[1]) <= 31);
}

function publicHttpsUrl(value: unknown) {
  const raw = text(value);
  if (!raw) return "";
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" || url.username || url.password || privateHost(url.hostname)) return "";
    return url.toString();
  } catch {
    return "";
  }
}

export async function deployOpsProviderConfiguration(): Promise<ProviderConfiguration> {
  const status = await deployOpsCredentialStatus();
  return {
    vercel: status.providers.vercel.configured,
    neon: status.providers.neon.configured,
    tinyfish: status.providers.tinyfish.configured,
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

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((item) => item.toString(16).padStart(2, "0")).join("");
}

function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
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
    tinyfishEnabled: row.tinyfish_enabled === 1,
    tinyfishTargetUrl: row.tinyfish_target_url ?? "",
    tinyfishGoal: row.tinyfish_goal ?? "",
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
  const tinyfishEnabled = bool(payload.tinyfishEnabled);
  const tinyfishTargetUrl = publicHttpsUrl(payload.tinyfishTargetUrl);
  const tinyfishGoal = text(payload.tinyfishGoal);

  if (vercelEnabled && (!vercelProjectId || vercelProjectId.length > 160)) throw new Error("VERCEL_PROJECT_REQUIRED");
  if (vercelTeamId.length > 160) throw new Error("INVALID_VERCEL_TEAM");
  if (neonEnabled && (!/^[a-z0-9-]{1,60}$/i.test(neonProjectId) || !neonBranch || neonBranch.length > 160)) throw new Error("NEON_MAPPING_REQUIRED");
  if (tinyfishEnabled && (!tinyfishTargetUrl || tinyfishGoal.length < 10 || tinyfishGoal.length > 2000)) throw new Error("TINYFISH_MAPPING_REQUIRED");

  const database = await getControlDatabase();
  await database.prepare(
    `INSERT INTO deploy_ops_targets (
      app_id, repository, vercel_enabled, vercel_project_id, vercel_team_id,
      neon_enabled, neon_project_id, neon_branch,
      tinyfish_enabled, tinyfish_target_url, tinyfish_goal, created_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(app_id) DO UPDATE SET
      repository=excluded.repository,
      vercel_enabled=excluded.vercel_enabled,
      vercel_project_id=excluded.vercel_project_id,
      vercel_team_id=excluded.vercel_team_id,
      neon_enabled=excluded.neon_enabled,
      neon_project_id=excluded.neon_project_id,
      neon_branch=excluded.neon_branch,
      tinyfish_enabled=excluded.tinyfish_enabled,
      tinyfish_target_url=excluded.tinyfish_target_url,
      tinyfish_goal=excluded.tinyfish_goal,
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
    tinyfishEnabled ? 1 : 0,
    tinyfishTargetUrl || null,
    tinyfishGoal || null,
    actor.email,
  ).run();

  await audit(actor.email, "deploy_ops_target_saved", appId, {
    repository,
    vercelEnabled,
    neonEnabled,
    tinyfishEnabled,
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

function parseTinyFishResult(value: unknown): UnknownRecord | null {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as UnknownRecord;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as UnknownRecord : null;
    } catch {
      return null;
    }
  }
  return null;
}

async function verifyTinyFishRun(runId: string): Promise<TinyFishProbe> {
  const credential = await loadDeployOpsCredential("tinyfish");
  const token = credential.value;
  if (!token) {
    return { enabled: true, configured: false, ready: false, runId, status: null, result: null, message: "Chưa cấu hình credential TinyFish." };
  }
  try {
    const data = await providerJson(
      "TinyFish",
      `${TINYFISH_AGENT_ORIGIN}/v1/runs/${encodeURIComponent(runId)}`,
      { headers: { "x-api-key": token } },
    );
    const status = text(data.status).toUpperCase();
    const result = parseTinyFishResult(data.result);
    const ready = status === "COMPLETED" && result?.ok === true;
    return {
      enabled: true,
      configured: true,
      ready,
      runId,
      status: status || null,
      result,
      message: ready
        ? "TinyFish đã xác minh browser test PASS."
        : status === "COMPLETED"
          ? "TinyFish đã hoàn tất nhưng kết quả kiểm thử không PASS."
          : status ? `TinyFish: ${status}.` : "Không đọc được trạng thái TinyFish.",
    };
  } catch (error) {
    return { enabled: true, configured: true, ready: false, runId, status: null, result: null, message: error instanceof Error ? error.message : "TinyFish probe failed." };
  }
}

async function latestRun(appId: string, sourceSha: string) {
  const database = await getControlDatabase();
  return await database.prepare(
    "SELECT * FROM deploy_ops_runs WHERE app_id=? AND source_sha=? ORDER BY created_at DESC LIMIT 1",
  ).bind(appId, sourceSha).first<DeployOpsRunRow>();
}

async function tinyFishGate(row: DeployOpsTargetRow, sourceSha: string): Promise<TinyFishProbe> {
  if (row.tinyfish_enabled !== 1) {
    return { enabled: false, configured: true, ready: true, runId: null, status: null, result: null, message: "Không dùng TinyFish cho app này." };
  }
  const credential = await loadDeployOpsCredential("tinyfish");
  if (!credential.value) {
    return { enabled: true, configured: false, ready: false, runId: null, status: null, result: null, message: "Chưa cấu hình credential TinyFish." };
  }
  const run = await latestRun(row.app_id, sourceSha);
  if (!run?.tinyfish_run_id) {
    return { enabled: true, configured: true, ready: false, runId: null, status: null, result: null, message: "Chưa có browser test TinyFish cho SHA này." };
  }
  const verified = await verifyTinyFishRun(run.tinyfish_run_id);
  await updateTinyFishRunFromProbe(run.id, verified);
  return verified;
}

async function updateTinyFishRunFromProbe(localRunId: string, probe: TinyFishProbe) {
  const database = await getControlDatabase();
  const status = probe.ready ? "passed"
    : probe.status === "FAILED" || probe.status === "CANCELLED" ? "failed"
      : "testing";
  await database.prepare(
    `UPDATE deploy_ops_runs
       SET tinyfish_status=?, tinyfish_result_json=?, status=?, updated_at=CURRENT_TIMESTAMP
       WHERE id=?`,
  ).bind(
    probe.status,
    probe.result ? JSON.stringify(probe.result) : null,
    status,
    localRunId,
  ).run();
}

export async function probeDeployOps(appId: string, sourceSha: string): Promise<DeployOpsProbe> {
  if (!validAppId(appId) || !validSha(sourceSha)) throw new Error("INVALID_DEPLOY_OPS_PROBE");
  const row = await readDeployOpsTarget(appId);
  if (!row) throw new Error("DEPLOY_OPS_TARGET_NOT_FOUND");
  const providers = await deployOpsProviderConfiguration();
  const [vercel, neon, tinyfish] = await Promise.all([
    probeVercel(row, sourceSha),
    probeNeon(row),
    tinyFishGate(row, sourceSha),
  ]);
  const gates = [
    { id: "source", passed: validSha(sourceSha), detail: validSha(sourceSha) ? "Commit SHA đầy đủ 40 ký tự." : "SHA không hợp lệ." },
    { id: "vercel", passed: vercel.ready, detail: vercel.message },
    { id: "neon", passed: neon.ready, detail: neon.message },
    { id: "tinyfish", passed: tinyfish.ready, detail: tinyfish.message },
  ];
  return {
    appId,
    sourceSha,
    providers,
    vercel,
    neon,
    tinyfish,
    ready: gates.every((gate) => gate.passed),
    gates,
  };
}

export async function startTinyFishBrowserTest(
  appId: string,
  sourceSha: string,
  callbackOrigin: string,
  actor: ControlDeviceState,
) {
  if (actor.role !== "owner") throw new Error("OWNER_REQUIRED");
  if (!validAppId(appId) || !validSha(sourceSha)) throw new Error("INVALID_TEST_TARGET");
  const row = await readDeployOpsTarget(appId);
  if (!row || row.tinyfish_enabled !== 1) throw new Error("TINYFISH_NOT_ENABLED");
  const credential = await loadDeployOpsCredential("tinyfish");
  const token = credential.value;
  if (!token) throw new Error("TINYFISH_API_KEY_MISSING");
  const targetUrl = publicHttpsUrl(row.tinyfish_target_url);
  if (!targetUrl) throw new Error("INVALID_TINYFISH_TARGET");

  const origin = publicHttpsUrl(callbackOrigin);
  if (!origin) throw new Error("INVALID_CALLBACK_ORIGIN");

  const localRunId = crypto.randomUUID();
  const nonce = randomToken();
  const nonceHash = await sha256(nonce);
  const database = await getControlDatabase();
  await database.prepare(
    `INSERT INTO deploy_ops_runs
      (id, app_id, source_sha, callback_nonce_hash, status, detail_json, created_by)
      VALUES (?, ?, ?, ?, 'testing', '{}', ?)`,
  ).bind(localRunId, appId, sourceSha, nonceHash, actor.email).run();

  const webhook = new URL("/api/deploy-ops/tinyfish-webhook", origin);
  webhook.searchParams.set("localRunId", localRunId);
  webhook.searchParams.set("nonce", nonce);

  const outputSchema = {
    type: "object",
    properties: {
      ok: { type: "boolean" },
      summary: { type: "string" },
      final_url: { type: "string" },
      checks: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            passed: { type: "boolean" },
            detail: { type: "string" },
          },
          required: ["name", "passed", "detail"],
        },
      },
    },
    required: ["ok", "summary", "final_url", "checks"],
  };

  const goal = `${row.tinyfish_goal ?? "Kiểm tra website hoạt động ổn định."}
Bạn đang kiểm thử release commit ${sourceSha}.
Hãy chạy theo chế độ fail-fast: xác minh trang tải được, không có lỗi nghiêm trọng hiển thị, điều hướng/chức năng chính có thể sử dụng theo giao diện hiện tại. Không thay đổi dữ liệu phá hủy và không thực hiện thanh toán. Chỉ trả kết quả theo schema.`;

  try {
    const response = await providerJson(
      "TinyFish start",
      `${TINYFISH_AGENT_ORIGIN}/v1/automation/run-async`,
      {
        method: "POST",
        headers: {
          "x-api-key": token,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          url: targetUrl,
          goal,
          browser_profile: "lite",
          webhook_url: webhook.toString(),
          agent_config: { mode: "strict", max_steps: 80, max_duration_seconds: 240 },
          capture_config: { screenshots: true, snapshots: true, elements: true, html: false, recording: false },
          output_schema: outputSchema,
        }),
      },
      [200, 201, 202],
    );
    const runId = text(response.run_id) || text(response.id);
    if (!runId) throw new Error("TinyFish không trả run_id.");
    await database.prepare(
      "UPDATE deploy_ops_runs SET tinyfish_run_id=?, tinyfish_status=?, updated_at=CURRENT_TIMESTAMP WHERE id=?",
    ).bind(runId, text(response.status) || "PENDING", localRunId).run();
    await audit(actor.email, "deploy_ops_tinyfish_started", appId, { sourceSha, localRunId, runId, targetUrl });
    return { ok: true, localRunId, runId, status: text(response.status) || "PENDING" };
  } catch (error) {
    await database.prepare(
      "UPDATE deploy_ops_runs SET status='failed', detail_json=?, updated_at=CURRENT_TIMESTAMP WHERE id=?",
    ).bind(JSON.stringify({ error: error instanceof Error ? error.message : "TinyFish start failed" }), localRunId).run();
    throw error;
  }
}

export async function refreshTinyFishBrowserTest(appId: string, sourceSha: string) {
  const run = await latestRun(appId, sourceSha);
  if (!run?.tinyfish_run_id) throw new Error("TINYFISH_RUN_NOT_FOUND");
  const probe = await verifyTinyFishRun(run.tinyfish_run_id);
  await updateTinyFishRunFromProbe(run.id, probe);
  return probe;
}

export async function acceptTinyFishWebhook(localRunId: string, nonce: string, payload: UnknownRecord) {
  if (!/^[0-9a-f-]{36}$/i.test(localRunId) || nonce.length < 32 || nonce.length > 128) throw new Error("INVALID_WEBHOOK_REFERENCE");
  const database = await getControlDatabase();
  const run = await database.prepare(
    "SELECT * FROM deploy_ops_runs WHERE id=? LIMIT 1",
  ).bind(localRunId).first<DeployOpsRunRow>();
  if (!run?.tinyfish_run_id || !run.callback_nonce_hash) throw new Error("WEBHOOK_RUN_NOT_FOUND");
  const providedHash = await sha256(nonce);
  if (providedHash !== run.callback_nonce_hash) throw new Error("WEBHOOK_NONCE_MISMATCH");

  const payloadRunId = text(payload.run_id) || text(record(payload.data).run_id);
  if (payloadRunId && payloadRunId !== run.tinyfish_run_id) throw new Error("WEBHOOK_RUN_MISMATCH");

  // Never trust the webhook body as release evidence. Re-read the run through
  // TinyFish's authenticated API and only persist that verified result.
  const probe = await verifyTinyFishRun(run.tinyfish_run_id);
  await updateTinyFishRunFromProbe(run.id, probe);
  return probe;
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
  const run = await latestRun(appId, sourceSha);
  if (run) {
    await database.prepare(
      "UPDATE deploy_ops_runs SET status='published', published_at=CURRENT_TIMESTAMP, updated_at=CURRENT_TIMESTAMP WHERE id=?",
    ).bind(run.id).run();
  }
  await audit(actor.email, "deploy_ops_safe_publish", appId, {
    sourceSha,
    vercelDeploymentId: probe.vercel.deploymentId,
    neonProjectId: probe.neon.projectId,
    tinyfishRunId: probe.tinyfish.runId,
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
    `SELECT id, app_id, source_sha, tinyfish_run_id, tinyfish_status, tinyfish_result_json,
            status, detail_json, created_by, created_at, updated_at, published_at
       FROM deploy_ops_runs WHERE app_id=? ORDER BY created_at DESC LIMIT ?`,
  ).bind(appId, safeLimit).all<Omit<DeployOpsRunRow, "callback_nonce_hash">>();
  return rows.results.map((row) => ({
    id: row.id,
    appId: row.app_id,
    sourceSha: row.source_sha,
    tinyfishRunId: row.tinyfish_run_id,
    tinyfishStatus: row.tinyfish_status,
    tinyfishResult: row.tinyfish_result_json ? (() => { try { return JSON.parse(row.tinyfish_result_json); } catch { return null; } })() : null,
    status: row.status,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    publishedAt: row.published_at,
  }));
}
