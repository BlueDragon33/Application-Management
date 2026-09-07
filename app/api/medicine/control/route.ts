import { ControlAccessError, controlErrorResponse, verifyControlProof } from "../../../control-device.server";
import { getMedicineDatabase, medicineAudit, medicineJson, medicineMeta, readMedicineRules, textValue } from "../../../medicine.server";

export const dynamic = "force-dynamic";

type MedicineActor = { email: string; displayName: string; role: string; deviceId?: string; deviceCode?: string; status?: string; owner?: boolean };

async function medicineServiceConfiguration() {
  const workers = await import("cloudflare:workers");
  const values = workers.env as unknown as Record<string, unknown>;
  const baseUrl = typeof values.MEDICINE_APP_BASE_URL === "string" ? values.MEDICINE_APP_BASE_URL.replace(/\/$/, "") : "";
  const secret = typeof values.MEDICINE_SERVICE_SECRET === "string" ? values.MEDICINE_SERVICE_SECRET : "";
  return { baseUrl: /^https:\/\/[a-z0-9.-]+$/i.test(baseUrl) ? baseUrl : "", secret };
}

async function actorForRequest(request: Request, body: Record<string, unknown>) {
  const { secret } = await medicineServiceConfiguration();
  if (secret && request.headers.get("x-medicine-service-secret") === secret) {
    const candidate = body.__controlActor;
    if (!candidate || typeof candidate !== "object") throw new ControlAccessError("Bằng chứng dịch vụ không hợp lệ.", 401, "INVALID_MEDICINE_SERVICE_ACTOR");
    const source = candidate as Record<string, unknown>;
    const email = typeof source.email === "string" ? source.email.trim().toLowerCase() : "";
    const displayName = typeof source.displayName === "string" ? source.displayName.trim().slice(0, 160) : email;
    const role = typeof source.role === "string" ? source.role : "";
    if (!/^\S+@\S+\.\S+$/.test(email) || !["viewer", "reviewer", "publisher", "owner"].includes(role)) {
      throw new ControlAccessError("Bằng chứng dịch vụ không hợp lệ.", 401, "INVALID_MEDICINE_SERVICE_ACTOR");
    }
    return { email, displayName: displayName || email, role } satisfies MedicineActor;
  }
  const previewRequest = ["terminal.local", "localhost"].includes(new URL(request.url).hostname);
  return verifyControlProof(body, undefined, previewRequest);
}

async function forwardToMedicineSite(body: Record<string, unknown>, actor: MedicineActor, baseUrl: string, secret: string) {
  const forwarded = { ...body, __controlActor: { email: actor.email, displayName: actor.displayName, role: actor.role } };
  delete forwarded.deviceId;
  delete forwarded.challenge;
  delete forwarded.signature;
  let response: Response;
  try {
    response = await fetch(`${baseUrl}/api/medicine/control`, {
      method: "POST",
      headers: { "content-type": "application/json", "cache-control": "no-store", "x-medicine-service-secret": secret },
      body: JSON.stringify(forwarded),
    });
  } catch {
    return Response.json({ error: "Không thể kết nối Site Hòa nhập Nga.", code: "MEDICINE_UPSTREAM_UNAVAILABLE" }, {
      status: 503,
      headers: { "cache-control": "no-store, private", "x-content-type-options": "nosniff" },
    });
  }
  const responseText = await response.text();
  try {
    JSON.parse(responseText);
  } catch {
    return Response.json({ error: "Site Hòa nhập Nga trả về phản hồi không phải JSON.", code: "MEDICINE_UPSTREAM_INVALID_RESPONSE" }, {
      status: 502,
      headers: { "cache-control": "no-store, private", "x-content-type-options": "nosniff" },
    });
  }
  return new Response(responseText, {
    status: response.status,
    headers: { "content-type": "application/json", "cache-control": "no-store, private", "x-content-type-options": "nosniff" },
  });
}

function requireRole(role: string, allowed: string[]) {
  if (!allowed.includes(role)) throw new ControlAccessError("Bạn không có quyền thực hiện thao tác này.", 403, "ROLE_REQUIRED");
}

async function reviewRows() {
  const database = await getMedicineDatabase();
  const result = await database.prepare(
    `SELECT id, created_at, updated_at, status, medicine_name, ocr_text, matched_rule_ids_json,
            proposed_level, confidence, note, admin_note, decision, reviewed_by, reviewed_at
       FROM medicine_reviews ORDER BY CASE status WHEN 'pending' THEN 0 WHEN 'needs_documents' THEN 1 ELSE 2 END, created_at DESC LIMIT 300`,
  ).all<Record<string, unknown>>();
  return result.results.map((row) => ({
    id: row.id, createdAt: row.created_at, updatedAt: row.updated_at, status: row.status,
    medicineName: row.medicine_name, ocrText: row.ocr_text,
    matchedRuleIds: JSON.parse(String(row.matched_rule_ids_json || "[]")), proposedLevel: row.proposed_level,
    confidence: row.confidence, note: row.note, adminNote: row.admin_note, decision: row.decision,
    reviewedBy: row.reviewed_by, reviewedAt: row.reviewed_at,
  }));
}

async function auditRows() {
  const database = await getMedicineDatabase();
  const result = await database.prepare(
    "SELECT id, actor, action, target, detail_json, created_at FROM medicine_audit_log ORDER BY id DESC LIMIT 150",
  ).all<Record<string, unknown>>();
  return result.results.map((row) => {
    let detail: Record<string, unknown> = {};
    try { detail = JSON.parse(String(row.detail_json || "{}")) as Record<string, unknown>; } catch { detail = {}; }
    return { id: row.id, actor: row.actor, action: row.action, target: row.target, detail, createdAt: row.created_at };
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as Record<string, unknown>;
    const actor = await actorForRequest(request, body);
    const service = await medicineServiceConfiguration();
    if (service.baseUrl && service.secret.length >= 32) return await forwardToMedicineSite(body, actor, service.baseUrl, service.secret);
    const action = textValue(body.action, 80) || "bootstrap";
    const database = await getMedicineDatabase();

    if (action === "bootstrap") {
      const reviews = await reviewRows();
      return medicineJson({
        actor, meta: medicineMeta, reviews, rules: await readMedicineRules(true),
        auditLog: ["publisher", "owner"].includes(actor.role) ? await auditRows() : [],
        stats: {
          total: reviews.length,
          pending: reviews.filter((item) => item.status === "pending").length,
          needsDocuments: reviews.filter((item) => item.status === "needs_documents").length,
          resolved: reviews.filter((item) => ["approved", "rejected"].includes(String(item.status))).length,
        },
      }, 200, true);
    }

    if (action === "update-review") {
      requireRole(actor.role, ["reviewer", "publisher", "owner"]);
      const id = textValue(body.id, 80);
      const status = textValue(body.status, 40);
      const decision = textValue(body.decision, 2000);
      const adminNote = textValue(body.adminNote, 2000);
      if (!/^[0-9a-f-]{36}$/i.test(id) || !["pending", "approved", "needs_documents", "rejected"].includes(status)) {
        throw new ControlAccessError("Dữ liệu duyệt không hợp lệ.", 400, "INVALID_REVIEW_UPDATE");
      }
      if (["approved", "rejected"].includes(status) && decision.length < 5) {
        throw new ControlAccessError("Cần nhập kết luận rõ ràng trước khi đóng ca kiểm duyệt.", 400, "REVIEW_DECISION_REQUIRED");
      }
      if (status === "needs_documents" && !adminNote && !decision) {
        throw new ControlAccessError("Cần ghi rõ hồ sơ hoặc thông tin phải bổ sung.", 400, "REVIEW_NOTE_REQUIRED");
      }
      const result = await database.prepare(
        `UPDATE medicine_reviews SET status = ?, decision = ?, admin_note = ?, reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?`,
      ).bind(status, decision || null, adminNote || null, actor.email, id).run();
      if (!result.meta.changes) throw new ControlAccessError("Không tìm thấy ca kiểm duyệt.", 404, "REVIEW_NOT_FOUND");
      await medicineAudit(actor.email, "review.updated", id, { status, hasDecision: !!decision, hasAdminNote: !!adminNote });
      return medicineJson({ ok: true, reviews: await reviewRows() }, 200, true);
    }

    if (action === "update-rule") {
      requireRole(actor.role, ["publisher", "owner"]);
      const id = textValue(body.id, 100);
      const name = textValue(body.name, 200);
      const basis = textValue(body.basis, 3000);
      const level = Math.max(1, Math.min(5, Math.round(Number(body.level) || 1)));
      const synonyms = Array.isArray(body.synonyms)
        ? [...new Set(body.synonyms.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean))].slice(0, 40)
        : [];
      const sourceIds = Array.isArray(body.sourceIds)
        ? [...new Set(body.sourceIds.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean))].slice(0, 20)
        : [];
      const validSourceIds = new Set<string>(medicineMeta.sources.map((source) => source.id));
      if (!/^[a-z0-9][a-z0-9_-]{1,99}$/i.test(id) || !name || !basis) {
        throw new ControlAccessError("Quy tắc phải có ID, tên hoạt chất và căn cứ.", 400, "INVALID_RULE");
      }
      if (sourceIds.some((sourceId) => !validSourceIds.has(sourceId))) {
        throw new ControlAccessError("Quy tắc chứa mã nguồn Nga không được hệ thống công nhận.", 400, "INVALID_RULE_SOURCE");
      }
      await database.prepare(
        `INSERT INTO medicine_rules
          (id, name, synonyms_json, level, category, basis, source_ids_json, review_required, condition, enabled, updated_by, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT(id) DO UPDATE SET name = excluded.name, synonyms_json = excluded.synonyms_json, level = excluded.level,
           category = excluded.category, basis = excluded.basis, source_ids_json = excluded.source_ids_json,
           review_required = excluded.review_required, condition = excluded.condition, enabled = excluded.enabled,
           updated_by = excluded.updated_by, updated_at = CURRENT_TIMESTAMP`,
      ).bind(id, name, JSON.stringify(synonyms), level, textValue(body.category, 100) || "other", basis, JSON.stringify(sourceIds), body.reviewRequired ? 1 : 0, textValue(body.condition, 100) || null, body.enabled === false ? 0 : 1, actor.email).run();
      await medicineAudit(actor.email, "rule.updated", id, { level, enabled: body.enabled !== false, sourceIds });
      return medicineJson({ ok: true, rules: await readMedicineRules(true) }, 200, true);
    }

    if (action === "toggle-rule") {
      requireRole(actor.role, ["publisher", "owner"]);
      const id = textValue(body.id, 100);
      if (!/^[a-z0-9][a-z0-9_-]{1,99}$/i.test(id)) throw new ControlAccessError("Mã quy tắc không hợp lệ.", 400, "INVALID_RULE");
      const result = await database.prepare("UPDATE medicine_rules SET enabled = ?, updated_by = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
        .bind(body.enabled ? 1 : 0, actor.email, id).run();
      if (!result.meta.changes) throw new ControlAccessError("Không tìm thấy quy tắc.", 404, "RULE_NOT_FOUND");
      await medicineAudit(actor.email, "rule.toggled", id, { enabled: !!body.enabled });
      return medicineJson({ ok: true, rules: await readMedicineRules(true) }, 200, true);
    }

    throw new ControlAccessError("Thao tác RU MedCheck không hợp lệ.", 400, "INVALID_MEDICINE_ACTION");
  } catch (error) {
    return controlErrorResponse(error);
  }
}
