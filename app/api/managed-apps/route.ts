import { contractCategoryProfiles, contractStarterForCategory } from "../../contract-category-profiles";
import { discoverManagedContractOrigin } from "../../managed-contract-discovery.server";
import { applicationRegistry, type ApplicationCategory } from "../../application-registry";
import { listClientNetworkSpecs } from "../../client-network-registry";
import { resolveClientBridge } from "../../client-origin.server";
import { ControlAccessError, verifyControlProof } from "../../control-device.server";
import {
  listManagedCatalog,
  managedCredentialEncryptionReady,
  probeManagedCatalogEntry,
  removeManagedCatalog,
  upsertManagedCatalog,
} from "../../open-contract.server";

export const dynamic = "force-dynamic";

function json(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: { "cache-control": "no-store, private", "x-content-type-options": "nosniff" },
  });
}

function publicOrigin(value?: string) {
  if (!value) return "";
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.origin : "";
  } catch {
    return "";
  }
}

async function legacyCatalogCandidate(application: (typeof applicationRegistry)[number]) {
  const spec = listClientNetworkSpecs().find((item) =>
    item.endpointKind === "control" && item.applicationId === application.id,
  );
  if (spec) {
    try {
      const bridge = await resolveClientBridge(spec.id);
      return {
        origin: bridge.baseUrl,
        credential: bridge.secret,
        source: bridge.source === "production" ? "legacy-production-bridge" : "legacy-local-bridge",
      };
    } catch {
      // Missing legacy env is not fatal. Dynamic Catalog may still use a
      // public manifest origin, or report that the owner must supply one.
    }
  }
  const fallback = publicOrigin(application.publicUrl);
  return fallback
    ? { origin: fallback, credential: "", source: "public-url" }
    : { origin: "", credential: "", source: "missing-origin" };
}

function probeSummary(probe: Awaited<ReturnType<typeof probeManagedCatalogEntry>>) {
  return {
    id: probe.config.id,
    name: probe.config.name,
    connection: probe.connection,
    credentialConfigured: probe.credentialConfigured,
    contractConnected: probe.contractConnected,
    remoteAdminReady: probe.remoteAdminReady,
    note: probe.note,
    issueCode: probe.issueCode ?? null,
    protocol: probe.manifest?.protocol ?? null,
    discoveredVia: probe.manifest?.discoveredVia ?? null,
    capabilities: probe.config.capabilities,
    deviceCount: probe.devices.length,
  };
}

export async function POST(request: Request) {
  try {
    const payload = await request.json() as Record<string, unknown>;
    const previewRequest = ["terminal.local", "localhost"].includes(new URL(request.url).hostname);
    const actor = await verifyControlProof(payload, undefined, previewRequest);
    if (actor.role !== "owner") return json({ error: "Chỉ Chủ hệ thống được quản lý catalog ứng dụng.", code: "OWNER_REQUIRED" }, 403);
    const action = typeof payload.action === "string" ? payload.action : "list";

    if (action === "list") {
      const rows = await listManagedCatalog();
      const encryptionReady = await managedCredentialEncryptionReady();
      return json({
        ok: true,
        encryptionReady,
        apps: rows.map((row) => ({
          id: row.id,
          name: row.name,
          shortName: row.short_name,
          category: row.category,
          origin: row.origin,
          publicUrl: row.public_url,
          repository: row.repository,
          contractPath: row.contract_path,
          enabled: row.enabled === 1,
          credentialConfigured: Boolean(row.credential_ciphertext && row.credential_iv),
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          lastConnectedAt: row.last_contract_connected_at,
          lastProbeAt: row.last_probe_at,
          lastProbeError: row.last_probe_error,
        })),
      });
    }

    if (action === "sync-existing") {
      const rowsBefore = await listManagedCatalog();
      const byId = new Map(rowsBefore.map((row) => [row.id, row]));
      const migrated: Array<Record<string, unknown>> = [];
      const needsOrigin: Array<Record<string, unknown>> = [];
      const existing: Array<Record<string, unknown>> = [];

      for (const application of applicationRegistry) {
        const current = byId.get(application.id);
        const candidate = await legacyCatalogCandidate(application);

        if (!current && !candidate.origin) {
          needsOrigin.push({
            id: application.id,
            name: application.name,
            category: application.category,
            repository: application.repository,
            reason: "Cần khai báo Control Origin trong Dynamic Catalog.",
          });
          continue;
        }

        if (!current) {
          try {
            const id = await upsertManagedCatalog({
              id: application.id,
              name: application.name,
              shortName: application.shortName,
              category: application.category,
              origin: candidate.origin,
              publicUrl: application.publicUrl ?? "",
              repository: application.repository,
              contractPath: "/api/application-management/contract",
              credential: candidate.credential,
            }, actor);
            const row = (await listManagedCatalog()).find((item) => item.id === id);
            const probe = row ? await probeManagedCatalogEntry(row) : null;
            migrated.push({
              id,
              source: candidate.source,
              probe: probe ? probeSummary(probe) : null,
            });
          } catch (error) {
            needsOrigin.push({
              id: application.id,
              name: application.name,
              category: application.category,
              repository: application.repository,
              reason: error instanceof Error ? error.message : "Không thể migrate vào Dynamic Catalog.",
            });
          }
          continue;
        }

        // Existing Dynamic Catalog entries are authoritative. Never overwrite
        // an owner-selected origin/credential during compatibility sync.
        const probe = await probeManagedCatalogEntry(current);
        existing.push({ id: current.id, probe: probeSummary(probe) });
      }

      return json({
        ok: true,
        migrated,
        existing,
        needsOrigin,
        totals: {
          migrated: migrated.length,
          existing: existing.length,
          needsOrigin: needsOrigin.length,
        },
      });
    }

    if (action === "probe-all") {
      const rows = (await listManagedCatalog()).filter((row) => row.enabled === 1);
      const probes = [];
      for (const row of rows) {
        probes.push(probeSummary(await probeManagedCatalogEntry(row)));
      }
      return json({
        ok: true,
        probes,
        totals: {
          connected: probes.filter((item) => item.connection === "connected").length,
          warning: probes.filter((item) => item.connection === "warning").length,
          pending: probes.filter((item) => item.connection === "pending").length,
          unavailable: probes.filter((item) => item.connection === "unavailable").length,
        },
      });
    }

    if (action === "discover") {
      const discovery = await discoverManagedContractOrigin({
        target: payload.target,
        credential: payload.credential,
      });
      return json({ ok: true, discovery });
    }

    if (action === "template") {
      const id = typeof payload.id === "string" ? payload.id.trim().toLowerCase() : "";
      const name = typeof payload.name === "string" ? payload.name.trim() : "";
      const category = typeof payload.category === "string" ? payload.category.trim() as ApplicationCategory : "Học tập";
      if (!/^[a-z0-9][a-z0-9-]{1,62}$/.test(id) || !name) {
        return json({ error: "Cần ID và tên ứng dụng hợp lệ để tạo contract starter.", code: "INVALID_TEMPLATE_INPUT" }, 400);
      }
      if (!(category in contractCategoryProfiles)) {
        return json({ error: "Phân loại ứng dụng không được hỗ trợ.", code: "INVALID_CATEGORY" }, 400);
      }
      return json({
        ok: true,
        template: contractStarterForCategory({ id, name, category }),
        profile: contractCategoryProfiles[category],
      });
    }

    if (action === "upsert") {
      const id = await upsertManagedCatalog(payload, actor);
      const row = (await listManagedCatalog()).find((item) => item.id === id);
      const probe = row ? await probeManagedCatalogEntry(row) : null;
      return json({
        ok: true,
        id,
        probe: probe ? {
          connection: probe.connection,
          credentialConfigured: probe.credentialConfigured,
          remoteAdminReady: probe.remoteAdminReady,
          note: probe.note,
          protocol: probe.manifest?.protocol ?? null,
          discoveredVia: probe.manifest?.discoveredVia ?? null,
          capabilities: probe.config.capabilities,
        } : null,
      });
    }

    if (action === "remove") {
      await removeManagedCatalog(payload.id, actor);
      return json({ ok: true });
    }

    if (action === "probe") {
      const id = typeof payload.id === "string" ? payload.id : "";
      const row = (await listManagedCatalog()).find((item) => item.id === id);
      if (!row) return json({ error: "Ứng dụng không tồn tại trong catalog.", code: "APP_NOT_FOUND" }, 404);
      const probe = await probeManagedCatalogEntry(row);
      return json({
        ok: true,
        probe: {
          ...probeSummary(probe),
          manifest: probe.manifest,
        },
      });
    }

    return json({ error: "Thao tác catalog không hợp lệ.", code: "INVALID_ACTION" }, 400);
  } catch (error) {
    if (error instanceof ControlAccessError) return json({ error: error.message, code: error.code }, error.status);
    return json({ error: error instanceof Error ? error.message : "Không thể xử lý catalog ứng dụng.", code: "CATALOG_ERROR" }, 500);
  }
}
