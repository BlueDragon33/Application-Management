import {
  analyzeMedicineText,
  consumeMedicineReviewQuota,
  createMedicineReviewToken,
  getMedicineDatabase,
  medicineAudit,
  medicineJson,
  sha256Hex,
  textValue,
} from "../../../medicine.server";
import { getMedicineAccess } from "../../../medicine-access.server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    if (!(await getMedicineAccess())) return medicineJson({ error: "Cần phiên truy cập do Trung tâm quản trị cấp." }, 401, true);
    const declaredLength = Number(request.headers.get("content-length") || 0);
    if (declaredLength > 100_000) return medicineJson({ error: "Yêu cầu quá lớn." }, 413);
    await consumeMedicineReviewQuota(request);
    const body = await request.json() as Record<string, unknown>;
    const ocrText = textValue(body.ocrText, 20000);
    if (!ocrText) return medicineJson({ error: "Thiếu nội dung thành phần/OCR." }, 400);
    const confidence = Math.max(0, Math.min(100, Math.round(Number(body.confidence) || 0)));
    const analysis = await analyzeMedicineText(ocrText);
    const id = crypto.randomUUID();
    const token = createMedicineReviewToken();
    const tokenHash = await sha256Hex(token);
    const database = await getMedicineDatabase();
    await database.prepare(
      `INSERT INTO medicine_reviews
        (id, medicine_name, ocr_text, matched_rule_ids_json, proposed_level, confidence, note, public_token_hash)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(
      id,
      textValue(body.medicineName, 200) || null,
      ocrText,
      JSON.stringify(analysis.matchedRuleIds),
      analysis.level,
      confidence,
      textValue(body.note, 1000) || null,
      tokenHash,
    ).run();
    await medicineAudit("public-user", "review.submitted", id, {
      proposedLevel: analysis.level,
      confidence,
      matchedRuleCount: analysis.matchedRuleIds.length,
      serverAnalyzed: true,
    });
    return medicineJson({
      ok: true,
      id,
      token,
      status: "pending",
      proposedLevel: analysis.level,
      matchedRuleIds: analysis.matchedRuleIds,
      reviewRequired: analysis.reviewRequired || confidence < 70,
    }, 201);
  } catch (error) {
    if (error instanceof Error && error.message === "RATE_LIMITED") {
      return medicineJson({ error: "Đã gửi quá nhiều yêu cầu trong một giờ. Vui lòng thử lại sau." }, 429);
    }
    return medicineJson({ error: "Không thể gửi ca kiểm duyệt." }, 500);
  }
}
