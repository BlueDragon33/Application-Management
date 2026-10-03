import { ControlAccessError, verifyControlProof } from "../../control-device.server";
import { removeDeployOpsCredential, saveDeployOpsCredential } from "../../deploy-ops-credentials.server";
import {
  deployOpsProviderConfiguration,
  deployOpsRecentRuns,
  discoverDeployOpsResources,
  discoverNeonBranches,
  listDeployOpsTargets,
  probeDeployOps,
  readDeployOpsTarget,
  safePublishDeployOps,
  saveDeployOpsTarget,
} from "../../deploy-ops.server";

export const dynamic = "force-dynamic";

function json(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: { "cache-control": "no-store, private", "x-content-type-options": "nosniff" },
  });
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: Request) {
  try {
    const payload = await request.json() as Record<string, unknown>;
    const previewRequest = ["terminal.local", "localhost"].includes(new URL(request.url).hostname);
    const actor = await verifyControlProof(payload, undefined, previewRequest);
    if (actor.role !== "owner") return json({ error: "Chỉ Chủ hệ thống được vận hành Deploy & Ops.", code: "OWNER_REQUIRED" }, 403);
    const action = text(payload.action) || "bootstrap";

    if (action === "bootstrap") {
      const targets = await listDeployOpsTargets();
      return json({
        ok: true,
        providers: await deployOpsProviderConfiguration(),
        targets,
      });
    }

    if (action === "save-target") {
      const target = await saveDeployOpsTarget(payload, actor);
      return json({ ok: true, target, providers: await deployOpsProviderConfiguration() });
    }
    if (action === "save-provider-credential") {
      const credential = await saveDeployOpsCredential(payload.provider, payload.credential, actor);
      return json({ ok: true, credential, providers: await deployOpsProviderConfiguration() });
    }

    if (action === "remove-provider-credential") {
      const credential = await removeDeployOpsCredential(payload.provider, actor);
      return json({ ok: true, credential, providers: await deployOpsProviderConfiguration() });
    }

    if (action === "discover-resources") {
      const discovery = await discoverDeployOpsResources(text(payload.appId));
      return json({ ok: true, discovery, providers: await deployOpsProviderConfiguration() });
    }

    if (action === "discover-neon-branches") {
      const branches = await discoverNeonBranches(payload.projectId);
      return json({ ok: true, branches });
    }

    const appId = text(payload.appId);
    const sourceSha = text(payload.sourceSha).toLowerCase();

    if (action === "probe") {
      const probe = await probeDeployOps(appId, sourceSha);
      return json({ ok: true, probe });
    }

    if (action === "safe-publish") {
      try {
        const result = await safePublishDeployOps(appId, sourceSha, payload.productionAuthority === true, actor);
        return json(result);
      } catch (error) {
        const withProbe = error as Error & { probe?: unknown };
        if (withProbe.message === "SAFE_PUBLISH_BLOCKED") {
          return json({ error: "Safe Publish bị khóa vì còn gate chưa PASS.", code: "SAFE_PUBLISH_BLOCKED", probe: withProbe.probe }, 409);
        }
        throw error;
      }
    }

    if (action === "runs") {
      const target = await readDeployOpsTarget(appId);
      if (!target) return json({ error: "App chưa có cấu hình Deploy & Ops.", code: "TARGET_NOT_FOUND" }, 404);
      return json({ ok: true, runs: await deployOpsRecentRuns(appId) });
    }

    return json({ error: "Thao tác Deploy & Ops không hợp lệ.", code: "INVALID_ACTION" }, 400);
  } catch (error) {
    if (error instanceof ControlAccessError) return json({ error: error.message, code: error.code }, error.status);
    const message = error instanceof Error ? error.message : "Deploy & Ops failed.";
    const known = new Set([
      "OWNER_REQUIRED",
      "INVALID_APP_ID",
      "INVALID_REPOSITORY",
      "VERCEL_PROJECT_REQUIRED",
      "INVALID_VERCEL_TEAM",
      "NEON_MAPPING_REQUIRED",
      "INVALID_DEPLOY_OPS_PROBE",
      "DEPLOY_OPS_TARGET_NOT_FOUND",
      "INVALID_TEST_TARGET",
      "PRODUCTION_AUTHORITY_REQUIRED",
      "INVALID_SAFE_PUBLISH_TARGET",
      "NO_VERCEL_PUBLISH_PROVIDER",
      "INVALID_PROVIDER",
      "INVALID_PROVIDER_CREDENTIAL",
      "CREDENTIAL_ENCRYPTION_KEY_MISSING",
      "INVALID_CREDENTIAL_ENCRYPTION_KEY",
      "INVALID_NEON_PROJECT_ID",
      "NEON_CREDENTIAL_MISSING",
    ]);
    return json({
      error: known.has(message) ? message : "Không thể hoàn tất thao tác Deploy & Ops.",
      code: known.has(message) ? message : "DEPLOY_OPS_ERROR",
    }, known.has(message) ? 400 : 500);
  }
}
