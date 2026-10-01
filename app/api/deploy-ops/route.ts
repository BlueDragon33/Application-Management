import { ControlAccessError, verifyControlProof } from "../../control-device.server";
import {
  deployOpsProviderConfiguration,
  deployOpsRecentRuns,
  listDeployOpsTargets,
  probeDeployOps,
  readDeployOpsTarget,
  refreshTinyFishBrowserTest,
  safePublishDeployOps,
  saveDeployOpsTarget,
  startTinyFishBrowserTest,
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

    const appId = text(payload.appId);
    const sourceSha = text(payload.sourceSha).toLowerCase();

    if (action === "probe") {
      const probe = await probeDeployOps(appId, sourceSha);
      return json({ ok: true, probe });
    }

    if (action === "start-tinyfish") {
      const origin = new URL(request.url).origin;
      const run = await startTinyFishBrowserTest(appId, sourceSha, origin, actor);
      return json({ ok: true, run });
    }

    if (action === "refresh-tinyfish") {
      const tinyfish = await refreshTinyFishBrowserTest(appId, sourceSha);
      const probe = await probeDeployOps(appId, sourceSha);
      return json({ ok: true, tinyfish, probe });
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
      "TINYFISH_MAPPING_REQUIRED",
      "INVALID_DEPLOY_OPS_PROBE",
      "DEPLOY_OPS_TARGET_NOT_FOUND",
      "INVALID_TEST_TARGET",
      "TINYFISH_NOT_ENABLED",
      "TINYFISH_API_KEY_MISSING",
      "INVALID_TINYFISH_TARGET",
      "INVALID_CALLBACK_ORIGIN",
      "TINYFISH_RUN_NOT_FOUND",
      "PRODUCTION_AUTHORITY_REQUIRED",
      "INVALID_SAFE_PUBLISH_TARGET",
      "NO_VERCEL_PUBLISH_PROVIDER",
    ]);
    return json({
      error: known.has(message) ? message : "Không thể hoàn tất thao tác Deploy & Ops.",
      code: known.has(message) ? message : "DEPLOY_OPS_ERROR",
    }, known.has(message) ? 400 : 500);
  }
}
