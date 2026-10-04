import { getChatGPTUser } from "../../../chatgpt-auth";
import { ControlAccessError, controlErrorResponse, getControlDatabase, isOwnerEmail } from "../../../control-device.server";

export const dynamic = "force-dynamic";

type AdminRole = "reviewer" | "publisher" | "owner";

const REVIEWABLE_FIELDS = new Set([
  "surname", "givenNames", "birthDate", "birthPlace", "sex", "passportNo", "passportIssue", "passportExpiry",
  "phone", "email", "routeCity", "workStudyPlace", "position", "workAddress", "workPhone", "workEmail",
  "preferredEmbassy", "hadFormerRussianCitizenship", "formerCitizenshipLostDate", "formerCitizenshipLossReason",
  "visitedRussia", "visitsCount", "lastVisitFrom", "lastVisitTo", "hasInsurance", "insurancePolicy",
  "childrenUnder16", "relativesInRussia", "specialNotes",
]);

function json(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      "cache-control": "no-store, private",
      "x-content-type-options": "nosniff",
    },
  });
}

function base64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/g, "");
}

async function sha256(value: string) {
  return base64Url(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))));
}

function text(value: unknown, max = 500) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

async function adminIdentity() {
  const user = await getChatGPTUser();
  if (!user) throw new ControlAccessError("Cần đăng nhập quản trị.", 401, "SIGN_IN_REQUIRED");
  const email = user.email.trim().toLowerCase();
  if (await isOwnerEmail(email)) return { email, role: "owner" as AdminRole, displayName: user.displayName };

  const database = await getControlDatabase();
  const member = await database.prepare(
    "SELECT role,status,display_name FROM control_members WHERE email=? LIMIT 1",
  ).bind(email).first<{ role: string; status: string; display_name: string | null }>();
  if (!member || member.status !== "active" || !["reviewer", "publisher", "owner"].includes(member.role)) {
    throw new ControlAccessError("Bạn không có quyền duyệt hồ sơ visa.", 403, "REVIEWER_REQUIRED");
  }
  return { email, role: member.role as AdminRole, displayName: member.display_name ?? user.displayName };
}

async function audit(actor: string, action: string, target: string, detail: Record<string, unknown> = {}) {
  const database = await getControlDatabase();
  await database.prepare(
    "INSERT INTO control_audit_log (actor,action,target,detail_json) VALUES (?,?,?,?)",
  ).bind(actor, action, target, JSON.stringify(detail)).run();
}

async function snapshot() {
  const database = await getControlDatabase();
  const [links, submissions] = await Promise.all([
    database.prepare(
      `SELECT id,label,status,created_by,created_at,expires_at
         FROM visa_intake_links ORDER BY created_at DESC LIMIT 50`,
    ).all<{
      id: string; label: string; status: string; created_by: string; created_at: string; expires_at: string | null;
    }>(),
    database.prepare(
      `SELECT queue_no,id,link_id,status,applicant_name,passport_no,email,phone,payload_json,
              validation_json,submitted_at,reviewed_by,reviewed_at,review_note,imported_applicant_id
         FROM visa_intake_submissions
        ORDER BY CASE status WHEN 'pending' THEN 0 WHEN 'approved' THEN 1 WHEN 'imported' THEN 2 ELSE 3 END,
                 queue_no ASC LIMIT 300`,
    ).all<{
      queue_no: number;
      id: string;
      link_id: string;
      status: string;
      applicant_name: string;
      passport_no: string;
      email: string;
      phone: string;
      payload_json: string;
      validation_json: string;
      submitted_at: string;
      reviewed_by: string | null;
      reviewed_at: string | null;
      review_note: string | null;
      imported_applicant_id: string | null;
    }>(),
  ]);

  return {
    links: links.results.map((row) => ({
      id: row.id,
      label: row.label,
      status: row.status,
      createdBy: row.created_by,
      createdAt: row.created_at,
      expiresAt: row.expires_at,
    })),
    submissions: submissions.results.map((row) => {
      let applicant: Record<string, unknown> = {};
      let validation: Record<string, unknown> = {};
      try { applicant = JSON.parse(row.payload_json) as Record<string, unknown>; } catch {}
      try { validation = JSON.parse(row.validation_json) as Record<string, unknown>; } catch {}
      return {
        queueNo: row.queue_no,
        id: row.id,
        linkId: row.link_id,
        status: row.status,
        applicantName: row.applicant_name,
        passportNo: row.passport_no,
        email: row.email,
        phone: row.phone,
        applicant,
        validation,
        submittedAt: row.submitted_at,
        reviewedBy: row.reviewed_by,
        reviewedAt: row.reviewed_at,
        reviewNote: row.review_note,
        correctionFields: Array.isArray(validation.correctionFields)
          ? validation.correctionFields.filter((value): value is string => typeof value === "string" && REVIEWABLE_FIELDS.has(value))
          : [],
        resubmittedFields: Array.isArray(validation.resubmittedFields)
          ? validation.resubmittedFields.filter((value): value is string => typeof value === "string" && REVIEWABLE_FIELDS.has(value))
          : [],
        revision: typeof validation.revision === "number" ? validation.revision : 0,
        importedApplicantId: row.imported_applicant_id,
      };
    }),
  };
}

export async function GET() {
  try {
    await adminIdentity();
    return json({ ok: true, ...(await snapshot()) });
  } catch (error) {
    return controlErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const actor = await adminIdentity();
    const body = await request.json() as Record<string, unknown>;
    const action = text(body.action, 40);
    const database = await getControlDatabase();

    if (action === "create-link") {
      const token = base64Url(crypto.getRandomValues(new Uint8Array(32)));
      const id = crypto.randomUUID();
      const label = text(body.label, 120) || `Đợt thu hồ sơ ${new Date().toLocaleDateString("vi-VN")}`;
      const defaults = body.defaults && typeof body.defaults === "object" ? body.defaults as Record<string, unknown> : {};
      const safeDefaults = {
        routeCity: text(defaults.routeCity, 80) || "МОСКВА",
        employer: text(defaults.employer, 240),
        position: text(defaults.position, 120),
        workAddress: text(defaults.workAddress, 300),
        workPhone: text(defaults.workPhone, 40),
        workEmail: text(defaults.workEmail, 160),
        permanentAddress: text(defaults.permanentAddress, 300),
        preferredEmbassy: text(defaults.preferredEmbassy, 120),
      };
      await database.prepare(
        `INSERT INTO visa_intake_links
          (id,token_hash,label,status,defaults_json,created_by)
         VALUES (?,?,?,'active',?,?)`,
      ).bind(id, await sha256(token), label, JSON.stringify(safeDefaults), actor.email).run();
      await audit(actor.email, "visa_intake_link_created", id, { label });
      return json({
        ok: true,
        token,
        link: { id, label, status: "active" },
        ...(await snapshot()),
      }, 201);
    }

    if (action === "close-link") {
      const linkId = text(body.linkId, 80);
      await database.prepare(
        "UPDATE visa_intake_links SET status='closed' WHERE id=?",
      ).bind(linkId).run();
      await audit(actor.email, "visa_intake_link_closed", linkId);
      return json({ ok: true, ...(await snapshot()) });
    }

    if (action === "review") {
      const submissionId = text(body.submissionId, 80);
      const decision = text(body.decision, 20);
      if (!["approved", "rejected"].includes(decision)) {
        throw new ControlAccessError("Quyết định duyệt không hợp lệ.", 400, "INVALID_REVIEW_DECISION");
      }
      const note = text(body.note, 1000);
      const correctionFields = Array.isArray(body.correctionFields)
        ? [...new Set(body.correctionFields.map((value) => text(value, 80)).filter((value) => REVIEWABLE_FIELDS.has(value)))]
        : [];
      if (decision === "rejected" && correctionFields.length === 0) {
        throw new ControlAccessError("Phải chọn ít nhất một ô sai trước khi trả hồ sơ.", 400, "CORRECTION_FIELD_REQUIRED");
      }
      const existing = await database.prepare(
        "SELECT status,validation_json FROM visa_intake_submissions WHERE id=? LIMIT 1",
      ).bind(submissionId).first<{ status: string; validation_json: string }>();
      if (!existing) throw new ControlAccessError("Không tìm thấy hồ sơ gửi lên.", 404, "SUBMISSION_NOT_FOUND");
      if (existing.status === "imported") {
        throw new ControlAccessError("Hồ sơ đã được lưu vào danh sách xử lý.", 409, "SUBMISSION_ALREADY_IMPORTED");
      }
      let validation: Record<string, unknown> = {};
      try { validation = JSON.parse(existing.validation_json || "{}") as Record<string, unknown>; } catch {}
      validation = {
        ...validation,
        correctionFields: decision === "rejected" ? correctionFields : [],
        resubmittedFields: decision === "rejected" ? [] : [],
        reviewedAt: new Date().toISOString(),
      };
      await database.prepare(
        `UPDATE visa_intake_submissions
            SET status=?, reviewed_by=?, reviewed_at=CURRENT_TIMESTAMP, review_note=?, validation_json=?
          WHERE id=?`,
      ).bind(decision, actor.email, note || null, JSON.stringify(validation), submissionId).run();
      await audit(actor.email, `visa_intake_${decision}`, submissionId, { note, correctionFields });
      return json({ ok: true, ...(await snapshot()) });
    }

    if (action === "mark-imported") {
      const submissionId = text(body.submissionId, 80);
      const applicantId = text(body.applicantId, 100);
      if (!applicantId) throw new ControlAccessError("Thiếu mã hồ sơ nội bộ.", 400, "APPLICANT_ID_REQUIRED");
      const existing = await database.prepare(
        "SELECT status FROM visa_intake_submissions WHERE id=? LIMIT 1",
      ).bind(submissionId).first<{ status: string }>();
      if (!existing) throw new ControlAccessError("Không tìm thấy hồ sơ gửi lên.", 404, "SUBMISSION_NOT_FOUND");
      if (existing.status !== "approved") {
        throw new ControlAccessError("Cần xác minh hồ sơ trước khi lưu.", 409, "SUBMISSION_NOT_APPROVED");
      }
      await database.prepare(
        `UPDATE visa_intake_submissions
            SET status='imported', imported_applicant_id=?
          WHERE id=?`,
      ).bind(applicantId, submissionId).run();
      await audit(actor.email, "visa_intake_imported", submissionId, { applicantId });
      return json({ ok: true, ...(await snapshot()) });
    }

    if (action === "delete-submission") {
      if (!["publisher", "owner"].includes(actor.role)) {
        throw new ControlAccessError("Chỉ Publisher/Owner được xóa hồ sơ đã gửi.", 403, "PUBLISHER_REQUIRED");
      }
      const submissionId = text(body.submissionId, 80);
      await database.prepare("DELETE FROM visa_intake_submissions WHERE id=?").bind(submissionId).run();
      await audit(actor.email, "visa_intake_deleted", submissionId);
      return json({ ok: true, ...(await snapshot()) });
    }

    throw new ControlAccessError("Thao tác hộp thư hồ sơ không hợp lệ.", 400, "INVALID_INTAKE_ACTION");
  } catch (error) {
    return controlErrorResponse(error);
  }
}
