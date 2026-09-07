import { getMedicineDatabase, medicineJson, sha256Hex } from "../../../../medicine.server";
import { getMedicineAccess } from "../../../../medicine-access.server";

export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!(await getMedicineAccess())) return medicineJson({ error: "Cần phiên truy cập do Trung tâm quản trị cấp." }, 401, true);
  if (!/^[0-9a-f-]{36}$/i.test(id)) return medicineJson({ error: "Không tìm thấy ca kiểm duyệt." }, 404);
  const token = new URL(request.url).searchParams.get("token")?.trim() || "";
  if (!/^[A-Za-z0-9_-]{40,80}$/.test(token)) return medicineJson({ error: "Không tìm thấy ca kiểm duyệt." }, 404);
  try {
    const database = await getMedicineDatabase();
    const row = await database.prepare(
      `SELECT id, status, proposed_level, admin_note, decision, updated_at, reviewed_at, public_token_hash
         FROM medicine_reviews WHERE id = ?`,
    ).bind(id).first<Record<string, unknown>>();
    if (!row || !row.public_token_hash || String(row.public_token_hash) !== await sha256Hex(token)) {
      return medicineJson({ error: "Không tìm thấy ca kiểm duyệt." }, 404);
    }
    return medicineJson({
      id: row.id,
      status: row.status,
      proposedLevel: row.proposed_level,
      adminNote: row.admin_note,
      decision: row.decision,
      updatedAt: row.updated_at,
      reviewedAt: row.reviewed_at,
    });
  } catch {
    return medicineJson({ error: "Không thể đọc trạng thái kiểm duyệt." }, 500);
  }
}
