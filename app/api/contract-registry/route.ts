import { verifyControlProof } from "../../control-device.server";
import {
  deleteManagedContract,
  discoverManagedContract,
  listManagedContracts,
  pairManagedContract,
  probeAllManagedContracts,
  probeManagedContract,
  saveDiscoveredManagedContract,
  saveLegacyManagedContract,
  setManagedContractEnabled,
} from "../../managed-contract-registry.server";

export const dynamic = "force-dynamic";

function json(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      "cache-control": "no-store, private",
      "x-content-type-options": "nosniff",
    },
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
    const action = text(payload.action) || "bootstrap";

    if (action === "bootstrap") {
      return json({ applications: await listManagedContracts(), actor: { role: actor.role, deviceCode: actor.deviceCode } });
    }

    if (action === "probe") {
      const applicationId = text(payload.applicationId);
      if (!applicationId) return json({ error: "Thiếu applicationId.", code: "APPLICATION_ID_REQUIRED" }, 400);
      return json({ application: await probeManagedContract(applicationId) });
    }

    if (action === "probe-all") {
      return json({ applications: await probeAllManagedContracts() });
    }

    if (actor.role !== "owner") {
      return json({ error: "Chỉ Chủ hệ thống được thay đổi Contract Registry.", code: "OWNER_REQUIRED" }, 403);
    }

    if (action === "discover") {
      const controlOrigin = text(payload.controlOrigin);
      const manifestPath = text(payload.manifestPath);
      const result = await discoverManagedContract(controlOrigin, manifestPath || undefined);
      return json({ discovery: result });
    }

    if (action === "save-discovered") {
      const controlOrigin = text(payload.controlOrigin);
      const manifestPath = text(payload.manifestPath);
      const application = await saveDiscoveredManagedContract({
        controlOrigin,
        manifestPath: manifestPath || undefined,
      });
      return json({ ok: true, application });
    }

    if (action === "save-legacy") {
      const applicationId = text(payload.applicationId);
      const application = await saveLegacyManagedContract({
        applicationId,
        controlOrigin: text(payload.controlOrigin) || undefined,
        runtimeOrigin: text(payload.runtimeOrigin) || undefined,
        classification: text(payload.classification) || undefined,
        categoryLabel: text(payload.categoryLabel) || undefined,
      });
      return json({ ok: true, application });
    }

    if (action === "pair") {
      const applicationId = text(payload.applicationId);
      const pairingCode = text(payload.pairingCode);
      const application = await pairManagedContract(applicationId, pairingCode);
      return json({ ok: true, application });
    }

    if (action === "set-enabled") {
      const applicationId = text(payload.applicationId);
      if (typeof payload.enabled !== "boolean") {
        return json({ error: "Trạng thái enabled không hợp lệ.", code: "INVALID_ENABLED_STATE" }, 400);
      }
      const application = await setManagedContractEnabled(applicationId, payload.enabled);
      return json({ ok: true, application });
    }

    if (action === "delete") {
      const applicationId = text(payload.applicationId);
      await deleteManagedContract(applicationId);
      return json({ ok: true, applicationId });
    }

    return json({ error: "Thao tác Contract Registry không hợp lệ.", code: "INVALID_CONTRACT_REGISTRY_ACTION" }, 400);
  } catch (error) {
    return json({
      error: error instanceof Error ? error.message : "Không thể xử lý Contract Registry.",
      code: "CONTRACT_REGISTRY_UNAVAILABLE",
    }, 500);
  }
}
