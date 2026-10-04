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
  const [links, submissions, results] = await Promise.all([
    database.prepare(`SELECT id,label,status,created_by,created_at,expires_at FROM visa_intake_links ORDER BY created_at DESC LIMIT 100`).all<{ id:string; label:string; status:string; created_by:string; created_at:string; expires_at:string|null }>(),
    database.prepare(`SELECT queue_no,id,link_id,status,applicant_name,passport_no,email,phone,payload_json,validation_json,submitted_at,reviewed_by,reviewed_at,review_note,imported_applicant_id FROM visa_intake_submissions ORDER BY CASE status WHEN 'pending' THEN 0 WHEN 'approved' THEN 1 WHEN 'imported' THEN 2 ELSE 3 END, queue_no ASC LIMIT 500`).all<{ queue_no:number; id:string; link_id:string; status:string; applicant_name:string; passport_no:string; email:string; phone:string; payload_json:string; validation_json:string; submitted_at:string; reviewed_by:string|null; reviewed_at:string|null; review_note:string|null; imported_applicant_id:string|null }>(),
    database.prepare(`SELECT submission_id,link_id,file_name,file_size,uploaded_at FROM visa_intake_results ORDER BY uploaded_at DESC`).all<{ submission_id:string; link_id:string; file_name:string; file_size:number; uploaded_at:string }>(),
  ]);
  const resultBySubmission=new Map(results.results.map((row)=>[row.submission_id,row]));
  const submissionCount=new Map<string,number>(), resultCount=new Map<string,number>();
  for(const row of submissions.results) submissionCount.set(row.link_id,(submissionCount.get(row.link_id)??0)+1);
  for(const row of results.results) resultCount.set(row.link_id,(resultCount.get(row.link_id)??0)+1);
  return {
    links: links.results.map((row)=>({id:row.id,label:row.label,status:row.status,createdBy:row.created_by,createdAt:row.created_at,expiresAt:row.expires_at,publicPath:`/visa-intake?batch=${encodeURIComponent(row.id)}`,submissionCount:submissionCount.get(row.id)??0,resultCount:resultCount.get(row.id)??0})),
    submissions: submissions.results.map((row)=>{
      let applicant:Record<string,unknown>={},validation:Record<string,unknown>={};try{applicant=JSON.parse(row.payload_json)}catch{}try{validation=JSON.parse(row.validation_json)}catch{}
      const result=resultBySubmission.get(row.id);
      return {queueNo:row.queue_no,id:row.id,linkId:row.link_id,status:row.status,applicantName:row.applicant_name,passportNo:row.passport_no,email:row.email,phone:row.phone,applicant,validation,submittedAt:row.submitted_at,reviewedBy:row.reviewed_by,reviewedAt:row.reviewed_at,reviewNote:row.review_note,correctionFields:Array.isArray(validation.correctionFields)?validation.correctionFields.filter((value):value is string=>typeof value==="string"&&REVIEWABLE_FIELDS.has(value)):[],resubmittedFields:Array.isArray(validation.resubmittedFields)?validation.resubmittedFields.filter((value):value is string=>typeof value==="string"&&REVIEWABLE_FIELDS.has(value)):[],revision:typeof validation.revision==="number"?validation.revision:0,importedApplicantId:row.imported_applicant_id,result:result?{available:true,fileName:result.file_name,fileSize:result.file_size,uploadedAt:result.uploaded_at}:null};
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
    const contentType = request.headers.get("content-type") ?? "";
    let body: Record<string, unknown>;
    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      body = Object.fromEntries(form.entries()) as Record<string, unknown>;
    } else {
      body = await request.json() as Record<string, unknown>;
    }
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
        link: { id, label, status: "active", publicPath: `/visa-intake?batch=${encodeURIComponent(id)}` },
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

    if (action === "send-result") {
      const submissionId=text(body.submissionId,80), candidate=body.file;
      if(!candidate||typeof candidate!=="object"||!("arrayBuffer" in candidate)||!("size" in candidate)) throw new ControlAccessError("Chưa chọn file PDF kết quả.",400,"RESULT_PDF_REQUIRED");
      const pdf=candidate as File, fileName=text(pdf.name,180)||"ket-qua-visa.pdf", fileSize=Number(pdf.size||0);
      if(fileSize<=0||fileSize>2_000_000) throw new ControlAccessError("PDF kết quả phải lớn hơn 0 và không vượt quá 2 MB.",400,"RESULT_PDF_TOO_LARGE");
      if(pdf.type&&pdf.type!=="application/pdf"&&!fileName.toLowerCase().endsWith(".pdf")) throw new ControlAccessError("Chỉ chấp nhận file PDF.",400,"RESULT_PDF_TYPE");
      const existing=await database.prepare("SELECT id,link_id,status FROM visa_intake_submissions WHERE id=? LIMIT 1").bind(submissionId).first<{id:string;link_id:string;status:string}>();
      if(!existing) throw new ControlAccessError("Không tìm thấy hồ sơ nhận kết quả.",404,"SUBMISSION_NOT_FOUND");
      if(!["approved","imported"].includes(existing.status)) throw new ControlAccessError("Chỉ gửi kết quả sau khi hồ sơ đã được tiếp nhận.",409,"SUBMISSION_NOT_ACCEPTED");
      const buffer=await pdf.arrayBuffer();
      if(new TextDecoder().decode(buffer.slice(0,5))!=="%PDF-") throw new ControlAccessError("File không có chữ ký PDF hợp lệ.",400,"RESULT_PDF_INVALID");
      await database.prepare(`INSERT INTO visa_intake_results (id,submission_id,link_id,file_name,mime_type,file_size,pdf_blob,uploaded_by,uploaded_at) VALUES (?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP) ON CONFLICT(submission_id) DO UPDATE SET link_id=excluded.link_id,file_name=excluded.file_name,mime_type=excluded.mime_type,file_size=excluded.file_size,pdf_blob=excluded.pdf_blob,uploaded_by=excluded.uploaded_by,uploaded_at=CURRENT_TIMESTAMP`).bind(crypto.randomUUID(),submissionId,existing.link_id,fileName,"application/pdf",fileSize,buffer,actor.email).run();
      await audit(actor.email,"visa_intake_result_sent",submissionId,{fileName,fileSize});
      return json({ok:true,...(await snapshot())});
    }

    if (action === "delete-submission") {
      if (!["publisher", "owner"].includes(actor.role)) {
        throw new ControlAccessError("Chỉ Publisher/Owner được xóa hồ sơ đã gửi.", 403, "PUBLISHER_REQUIRED");
      }
      const submissionId = text(body.submissionId, 80);
      await database.prepare("DELETE FROM visa_intake_results WHERE submission_id=?").bind(submissionId).run();
      await database.prepare("DELETE FROM visa_intake_submissions WHERE id=?").bind(submissionId).run();
      await audit(actor.email, "visa_intake_deleted", submissionId);
      return json({ ok: true, ...(await snapshot()) });
    }

    throw new ControlAccessError("Thao tác hộp thư hồ sơ không hợp lệ.", 400, "INVALID_INTAKE_ACTION");
  } catch (error) {
    return controlErrorResponse(error);
  }
}
