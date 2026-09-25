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
        })),
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
          id: probe.config.id,
          name: probe.config.name,
          connection: probe.connection,
          credentialConfigured: probe.credentialConfigured,
          remoteAdminReady: probe.remoteAdminReady,
          note: probe.note,
          capabilities: probe.config.capabilities,
          manifest: probe.manifest,
          deviceCount: probe.devices.length,
        },
      });
    }

    return json({ error: "Thao tác catalog không hợp lệ.", code: "INVALID_ACTION" }, 400);
  } catch (error) {
    if (error instanceof ControlAccessError) return json({ error: error.message, code: error.code }, error.status);
    return json({ error: error instanceof Error ? error.message : "Không thể xử lý catalog ứng dụng.", code: "CATALOG_ERROR" }, 500);
  }
}
