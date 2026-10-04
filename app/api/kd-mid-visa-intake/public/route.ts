import { getControlDatabase } from "../../../control-device.server";

export const dynamic = "force-dynamic";

const ALLOWED_EMBASSIES = new Set([
  "ПОСОЛЬСТВО РФ ВО ВЬЕТНАМЕ",
  "ГЕНКОНСУЛЬСТВО РФ В ДАНАНГЕ",
  "ГЕНКОНСУЛЬСТВО РФ В ХОШИМИНЕ",
]);

function json(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      "referrer-policy": "no-referrer",
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

function text(value: unknown, max = 300) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function bool(value: unknown) {
  return value === true;
}

function upperPlain(value: unknown, max = 300) {
  return text(value, max)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, (letter) => letter === "đ" ? "d" : "D")
    .toUpperCase();
}

function parseDmy(value: string) {
  const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return date;
}

function validDmy(value: string) {
  return parseDmy(value) !== null;
}

function utcToday() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function validBatchId(value:string){return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);}
type IntakeAccessLink={id:string;label:string;status:string;defaults_json:string;expires_at:string|null};
async function linkByAccess(token:string,batch:string){
 const database=await getControlDatabase();let row:IntakeAccessLink|null=null;
 if(validBatchId(batch)) row=await database.prepare("SELECT id,label,status,defaults_json,expires_at FROM visa_intake_links WHERE id=? LIMIT 1").bind(batch).first<IntakeAccessLink>();
 else if(/^[A-Za-z0-9_-]{30,120}$/.test(token)) row=await database.prepare("SELECT id,label,status,defaults_json,expires_at FROM visa_intake_links WHERE token_hash=? LIMIT 1").bind(await sha256(token)).first<IntakeAccessLink>();
 if(!row)return null;let defaults:Record<string,unknown>={};try{defaults=JSON.parse(row.defaults_json)}catch{}return {...row,defaults,expired:Boolean(row.expires_at&&Date.parse(row.expires_at)<=Date.now())};
}
function publicAccessQuery(token:string,batch:string){return validBatchId(batch)?`batch=${encodeURIComponent(batch)}`:`token=${encodeURIComponent(token)}`;}
export async function GET(request:Request){
 try{
  const url=new URL(request.url),token=url.searchParams.get("token")??"",batch=url.searchParams.get("batch")??"",submissionId=text(url.searchParams.get("submissionId"),80),wantsResult=url.searchParams.get("result")==="1";
  const link=await linkByAccess(token,batch);if(!link)return json({ok:false,error:"Link thu thập hồ sơ không hợp lệ."},404);
  if(submissionId){
   const database=await getControlDatabase();
   const row=await database.prepare("SELECT id,queue_no,link_id,status,applicant_name,validation_json,review_note,reviewed_at FROM visa_intake_submissions WHERE id=? AND link_id=? LIMIT 1").bind(submissionId,link.id).first<{id:string;queue_no:number;link_id:string;status:string;applicant_name:string;validation_json:string;review_note:string|null;reviewed_at:string|null}>();
   if(!row)return json({ok:false,error:"Không tìm thấy hồ sơ đã gửi."},404);
   const result=await database.prepare("SELECT file_name,file_size,pdf_blob,uploaded_at FROM visa_intake_results WHERE submission_id=? AND link_id=? LIMIT 1").bind(submissionId,link.id).first<{file_name:string;file_size:number;pdf_blob:ArrayBuffer;uploaded_at:string}>();
   if(wantsResult){if(!result)return json({ok:false,error:"Chưa có PDF kết quả."},404);const safeName=result.file_name.replace(/[\r\n"]/g,"_");return new Response(result.pdf_blob,{status:200,headers:{"content-type":"application/pdf","content-length":String(result.file_size),"content-disposition":`attachment; filename*=UTF-8''${encodeURIComponent(safeName)}`,"cache-control":"no-store, private","x-content-type-options":"nosniff"}});}
   let validation:Record<string,unknown>={};try{validation=JSON.parse(row.validation_json||"{}")}catch{}
   const correctionFields=Array.isArray(validation.correctionFields)?validation.correctionFields.filter((value):value is string=>typeof value==="string"):[],resubmittedFields=Array.isArray(validation.resubmittedFields)?validation.resubmittedFields.filter((value):value is string=>typeof value==="string"):[];
   const accessQuery=publicAccessQuery(token,batch);
   return json({ok:true,link:{id:link.id,label:link.label,status:link.status},defaults:link.defaults,submission:{id:row.id,queueNo:row.queue_no,status:row.status,applicantName:row.applicant_name,reviewNote:row.review_note,reviewedAt:row.reviewed_at,correctionFields,resubmittedFields,revision:typeof validation.revision==="number"?validation.revision:0,result:result?{available:true,fileName:result.file_name,fileSize:result.file_size,uploadedAt:result.uploaded_at,downloadUrl:`/api/kd-mid-visa-intake/public?${accessQuery}&submissionId=${encodeURIComponent(row.id)}&result=1`}:null}});
  }
  if(link.status!=="active"||link.expired)return json({ok:false,error:"Đợt thu hồ sơ đã đóng. Người đã gửi hồ sơ vẫn có thể mở lại link trên đúng trình duyệt để xem trạng thái và nhận kết quả."},410);
  return json({ok:true,link:{id:link.id,label:link.label,status:link.status},defaults:link.defaults});
 }catch{return json({ok:false,error:"Không thể mở form thu thập lúc này."},503);}
}
export async function POST(request: Request) {
  try {
    const length = Number(request.headers.get("content-length") || "0");
    if (length > 80_000) return json({ ok: false, error: "Dữ liệu gửi lên quá lớn." }, 413);
    const body = await request.json() as Record<string, unknown>;
    const token = text(body.token, 120);
    const batch = text(body.batch, 80);
    const submissionId = text(body.submissionId, 80);
    const link = await linkByAccess(token, batch);
    if (!link) return json({ ok: false, error: "Link thu thập hồ sơ không hợp lệ." }, 404);
    if (!submissionId && (link.status !== "active" || link.expired)) return json({ ok: false, error: "Đợt thu hồ sơ đã đóng." }, 410);

    const source = (body.applicant && typeof body.applicant === "object" ? body.applicant : {}) as Record<string, unknown>;
    const applicant = {
      surname: upperPlain(source.surname, 80),
      givenNames: upperPlain(source.givenNames, 120),
      birthDate: text(source.birthDate, 10),
      birthPlace: upperPlain(source.birthPlace, 160),
      sex: text(source.sex, 20),
      passportNo: upperPlain(source.passportNo, 40),
      passportIssue: text(source.passportIssue, 10),
      passportExpiry: text(source.passportExpiry, 10),
      phone: text(source.phone, 40),
      email: text(source.email, 160).toLowerCase(),
      routeCity: upperPlain(source.routeCity, 80) || "МОСКВА",
      workStudyPlace: upperPlain(source.workStudyPlace, 240),
      position: upperPlain(source.position, 120),
      workAddress: upperPlain(source.workAddress, 300),
      workPhone: text(source.workPhone, 40),
      workEmail: text(source.workEmail, 160).toLowerCase(),
      preferredEmbassy: text(source.preferredEmbassy, 120),
      hadFormerRussianCitizenship: bool(source.hadFormerRussianCitizenship),
      formerCitizenshipLostDate: text(source.formerCitizenshipLostDate, 10),
      formerCitizenshipLossReason: upperPlain(source.formerCitizenshipLossReason, 300),
      visitedRussia: bool(source.visitedRussia),
      visitsCount: text(source.visitsCount, 10),
      lastVisitFrom: text(source.lastVisitFrom, 10),
      lastVisitTo: text(source.lastVisitTo, 10),
      hasInsurance: bool(source.hasInsurance),
      insurancePolicy: upperPlain(source.insurancePolicy, 300),
      childrenUnder16: bool(source.childrenUnder16),
      relativesInRussia: bool(source.relativesInRussia),
      specialNotes: upperPlain(source.specialNotes, 1200),
    };

    const missing: string[] = [];
    const required: Array<[keyof typeof applicant, string]> = [
      ["surname", "Họ theo hộ chiếu"],
      ["givenNames", "Tên và tên đệm theo hộ chiếu"],
      ["birthDate", "Ngày sinh"],
      ["birthPlace", "Nơi sinh"],
      ["sex", "Giới tính"],
      ["passportNo", "Số hộ chiếu"],
      ["passportIssue", "Ngày cấp hộ chiếu"],
      ["passportExpiry", "Ngày hết hạn hộ chiếu"],
      ["phone", "Điện thoại cá nhân"],
      ["email", "Email cá nhân"],
      ["workStudyPlace", "Nơi làm việc/học tập"],
      ["position", "Chức vụ"],
      ["workAddress", "Địa chỉ cơ quan"],
      ["workPhone", "Điện thoại cơ quan"],
      ["workEmail", "Email cơ quan"],
      ["preferredEmbassy", "Nơi nộp hồ sơ"],
    ];
    for (const [key, label] of required) if (!String(applicant[key] ?? "").trim()) missing.push(label);

    for (const [key, label] of [
      ["birthDate", "Ngày sinh"],
      ["passportIssue", "Ngày cấp hộ chiếu"],
      ["passportExpiry", "Ngày hết hạn hộ chiếu"],
    ] as const) {
      if (applicant[key] && !validDmy(applicant[key])) missing.push(`${label} phải theo dd/mm/yyyy`);
    }
    const today = utcToday();
    const birthDate = parseDmy(applicant.birthDate);
    const passportIssue = parseDmy(applicant.passportIssue);
    const passportExpiry = parseDmy(applicant.passportExpiry);
    if (birthDate && birthDate > today) missing.push("Ngày sinh không được ở tương lai");
    if (passportIssue && passportIssue > today) missing.push("Ngày cấp hộ chiếu không được ở tương lai");
    if (birthDate && passportIssue && passportIssue <= birthDate) missing.push("Ngày cấp hộ chiếu phải sau ngày sinh");
    if (passportIssue && passportExpiry && passportExpiry <= passportIssue) missing.push("Ngày hết hạn hộ chiếu phải sau ngày cấp");
    if (passportExpiry && passportExpiry <= today) missing.push("Hộ chiếu đã hết hạn");

    if (!["МУЖСКОЙ", "ЖЕНСКИЙ"].includes(applicant.sex)) missing.push("Giới tính không hợp lệ");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(applicant.email)) missing.push("Email cá nhân không hợp lệ");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(applicant.workEmail)) missing.push("Email cơ quan không hợp lệ");
    if (!ALLOWED_EMBASSIES.has(applicant.preferredEmbassy)) missing.push("Nơi nộp hồ sơ không hợp lệ");

    if (applicant.hadFormerRussianCitizenship) {
      if (!validDmy(applicant.formerCitizenshipLostDate)) missing.push("Ngày mất quốc tịch Liên Xô/Nga");
      if (!applicant.formerCitizenshipLossReason) missing.push("Lý do mất quốc tịch Liên Xô/Nga");
    }
    if (applicant.visitedRussia) {
      if (!applicant.visitsCount) missing.push("Số lần đã đến Nga");
      if (!validDmy(applicant.lastVisitFrom)) missing.push("Ngày bắt đầu chuyến Nga gần nhất");
      if (!validDmy(applicant.lastVisitTo)) missing.push("Ngày kết thúc chuyến Nga gần nhất");
    }
    if (applicant.hasInsurance && !applicant.insurancePolicy) missing.push("Tên công ty/số hợp đồng bảo hiểm");
    if ((applicant.childrenUnder16 || applicant.relativesInRussia) && !applicant.specialNotes) {
      missing.push("Thông tin chi tiết về trẻ em/người thân tại Nga");
    }

    if (!bool(body.confirmedAccurate)) missing.push("Xác nhận thông tin là đúng sự thật");
    if (missing.length) return json({ ok: false, error: "Form còn thiếu hoặc sai dữ liệu.", missing }, 400);

    const applicantName = [applicant.surname, applicant.givenNames].filter(Boolean).join(" ");
    const database = await getControlDatabase();

    if (submissionId) {
      const existing = await database.prepare(
        "SELECT id,queue_no,status,validation_json FROM visa_intake_submissions WHERE id=? AND link_id=? LIMIT 1",
      ).bind(submissionId, link.id).first<{ id: string; queue_no: number; status: string; validation_json: string }>();
      if (!existing) return json({ ok: false, error: "Không tìm thấy hồ sơ cần sửa." }, 404);
      if (existing.status !== "rejected") {
        return json({ ok: false, error: "Hồ sơ này hiện không ở trạng thái cần sửa." }, 409);
      }
      let previousValidation: Record<string, unknown> = {};
      try { previousValidation = JSON.parse(existing.validation_json || "{}") as Record<string, unknown>; } catch {}
      const revision = (typeof previousValidation.revision === "number" ? previousValidation.revision : 0) + 1;
      const resubmittedFields = Array.isArray(previousValidation.correctionFields)
        ? previousValidation.correctionFields.filter((value): value is string => typeof value === "string")
        : [];
      const validation = { complete: true, checkedAt: new Date().toISOString(), revision, correctionFields: [], resubmittedFields };
      await database.prepare(
        `UPDATE visa_intake_submissions
            SET status='pending', applicant_name=?, passport_no=?, email=?, phone=?, payload_json=?, validation_json=?,
                submitted_at=CURRENT_TIMESTAMP, reviewed_by=NULL, reviewed_at=NULL, review_note=NULL
          WHERE id=? AND link_id=?`,
      ).bind(
        applicantName, applicant.passportNo, applicant.email, applicant.phone,
        JSON.stringify(applicant), JSON.stringify(validation), submissionId, link.id,
      ).run();
      return json({
        ok: true,
        submission: { id: existing.id, queueNo: existing.queue_no, applicantName, status: "pending", revision, correctionFields: [], resubmittedFields },
      });
    }

    const id = crypto.randomUUID();
    const validation = { complete: true, checkedAt: new Date().toISOString(), revision: 0, correctionFields: [], resubmittedFields: [] };
    const result = await database.prepare(
      `INSERT INTO visa_intake_submissions
        (id,link_id,status,applicant_name,passport_no,email,phone,payload_json,validation_json)
       VALUES (?,?, 'pending', ?,?,?,?,?,?) RETURNING queue_no`,
    ).bind(
      id,
      link.id,
      applicantName,
      applicant.passportNo,
      applicant.email,
      applicant.phone,
      JSON.stringify(applicant),
      JSON.stringify(validation),
    ).first<{ queue_no: number }>();

    return json({
      ok: true,
      submission: {
        id,
        queueNo: result?.queue_no ?? null,
        applicantName,
        status: "pending",
        revision: 0,
        correctionFields: [],
        resubmittedFields: [],
      },
    }, 201);
  } catch {
    return json({ ok: false, error: "Không thể gửi hồ sơ lúc này. Vui lòng thử lại." }, 500);
  }
}
