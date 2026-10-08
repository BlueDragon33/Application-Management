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

const STUDENT_INTAKE_DEFAULTS = {
  formType: "student",
  password: "qllhs2025",
  citizenship: "ВЬЕТНАМ",
  purposeSection: "УЧЕБА",
  purpose: "УЧЕБА",
  visaType: "ОБЫКНОВЕННАЯ УЧЕБНАЯ",
  entries: "ОДНОКРАТНАЯ",
  entryDate: "05/10/2026",
  exitDate: "31/12/2026",
  destinationType: "ОРГАНИЗАЦИЯ",
  organization: "МИН-ВО НАУКИ И ВЫСШЕГО ОБРАЗОВАНИЯ РФ (МИНОБРНАУКИ РОССИИ)",
  organizationAddress: "125993, МОСКВА, УЛ. ТВЕРСКАЯ, Д.11, СТР.1, 4",
  tin: "7707740714",
  telex: "321422",
  invitation: "",
  routeCity: "МОСКВА",
  employer: "ГОСУДАРСТВЕННЫЙ ТЕХНИЧЕСКИЙ УНИВЕРСИТЕТ ИМЕНИ ЛЕ КУИ ДОНА",
  position: "СТУДЕНТ",
  workAddress: "ВЬЕТНАМ, Г. ХАНОЙ, УЛИЦА НГИА ДО, ДОРОГА ХОАНГ КУОК ВЬЕТ",
  workPhone: "+842437555706",
  workEmail: "lequydonqllhs@gmail.com",
  permanentAddress: "ВЬЕТНАМ, Г. ХАНОЙ, УЛИЦА НГИА ДО, ДОРОГА ХОАНГ КУОК ВЬЕТ, ДОМ Ш9",
  preferredEmbassy: "ПОСОЛЬСТВО РФ ВО ВЬЕТНАМЕ",
} as const;

function fillStudentDefaults(raw: Record<string, unknown>) {
  const formType = raw.formType === "general" ? "general" : "student";
  if (formType === "general") return { ...raw, formType };
  const merged: Record<string, unknown> = { ...raw, formType: "student" };
  for (const [key, value] of Object.entries(STUDENT_INTAKE_DEFAULTS)) {
    if (!String(merged[key] ?? "").trim() && String(value ?? "").trim()) merged[key] = value;
  }
  return merged;
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

function passportExpiryFromIssue(value: string) {
  const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return "";
  return `${match[1]}/${match[2]}/${Number(match[3]) + 10}`;
}

function validBatchId(value:string){return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);}
function validDeviceId(value:string){return /^[A-Za-z0-9_-]{20,120}$/.test(value);}
async function deviceIdentity(value:string){
  if(!validDeviceId(value)) return null;
  const hash=await sha256(value);
  const compact=hash.replace(/[^A-Za-z0-9]/g,"").slice(0,8).toUpperCase();
  return {hash,code:`TB-${compact}`};
}
type IntakeAccessLink={id:string;label:string;status:string;defaults_json:string;expires_at:string|null};
async function linkByAccess(token:string,batch:string){
 const database=await getControlDatabase();let row:IntakeAccessLink|null=null;
 if(validBatchId(batch)) row=await database.prepare("SELECT id,label,status,defaults_json,expires_at FROM visa_intake_links WHERE id=? LIMIT 1").bind(batch).first<IntakeAccessLink>();
 else if(/^[A-Za-z0-9_-]{30,120}$/.test(token)) row=await database.prepare("SELECT id,label,status,defaults_json,expires_at FROM visa_intake_links WHERE token_hash=? LIMIT 1").bind(await sha256(token)).first<IntakeAccessLink>();
 if(!row)return null;
 let defaults:Record<string,unknown>={};
 try{defaults=JSON.parse(row.defaults_json)}catch{}
 defaults=fillStudentDefaults(defaults);
 return {...row,defaults,expired:Boolean(row.expires_at&&Date.parse(row.expires_at)<=Date.now())};
}
function publicAccessQuery(token:string,batch:string){return validBatchId(batch)?`batch=${encodeURIComponent(batch)}`:`token=${encodeURIComponent(token)}`;}
export async function GET(request:Request){
 try{
  const url=new URL(request.url);
  const token=url.searchParams.get("token")??"";
  const batch=url.searchParams.get("batch")??"";
  const submissionId=text(url.searchParams.get("submissionId"),80);
  const deviceId=text(url.searchParams.get("deviceId"),120);
  const wantsResult=url.searchParams.get("result")==="1";
  const link=await linkByAccess(token,batch);
  if(!link)return json({ok:false,error:"Link thu thập hồ sơ không hợp lệ."},404);
  if(link.status!=="active"||link.expired){
    return json({ok:false,error:"Đợt thu hồ sơ đã đóng. Link này không còn cho phép người nhận mở lại hồ sơ hoặc nhận kết quả."},410);
  }

  const database=await getControlDatabase();
  const device=await deviceIdentity(deviceId);
  type PublicRow={id:string;queue_no:number;link_id:string;status:string;applicant_name:string;payload_json:string;validation_json:string;review_note:string|null;reviewed_at:string|null;device_hash:string|null;device_code:string|null};
  let row:PublicRow|null=null;

  if(submissionId){
    row=await database.prepare(
      "SELECT id,queue_no,link_id,status,applicant_name,payload_json,validation_json,review_note,reviewed_at,device_hash,device_code FROM visa_intake_submissions WHERE id=? AND link_id=? LIMIT 1"
    ).bind(submissionId,link.id).first<PublicRow>();
    if(!row)return json({ok:false,error:"Không tìm thấy hồ sơ đã gửi."},404);
    if(row.device_hash && (!device||row.device_hash!==device.hash)){
      return json({ok:false,error:"Thiết bị này không khớp với hồ sơ đã gửi."},403);
    }
  } else if(device){
    row=await database.prepare(
      "SELECT id,queue_no,link_id,status,applicant_name,payload_json,validation_json,review_note,reviewed_at,device_hash,device_code FROM visa_intake_submissions WHERE link_id=? AND device_hash=? ORDER BY queue_no DESC LIMIT 1"
    ).bind(link.id,device.hash).first<PublicRow>();
  }

  if(row){
    const result=await database.prepare(
      "SELECT file_name,file_size,pdf_blob,uploaded_at FROM visa_intake_results WHERE submission_id=? AND link_id=? LIMIT 1"
    ).bind(row.id,link.id).first<{file_name:string;file_size:number;pdf_blob:ArrayBuffer;uploaded_at:string}>();
    if(wantsResult){
      if(!result)return json({ok:false,error:"Chưa có PDF kết quả."},404);
      const safeName=result.file_name.replace(/[\r\n"]/g,"_");
      return new Response(result.pdf_blob,{status:200,headers:{
        "content-type":"application/pdf",
        "content-length":String(result.file_size),
        "content-disposition":`attachment; filename*=UTF-8''${encodeURIComponent(safeName)}`,
        "cache-control":"no-store, private",
        "x-content-type-options":"nosniff"
      }});
    }
    let validation:Record<string,unknown>={};
    let applicant:Record<string,unknown>={};
    try{validation=JSON.parse(row.validation_json||"{}")}catch{}
    try{applicant=JSON.parse(row.payload_json||"{}")}catch{}
    const recoveredDefaults = fillStudentDefaults(link.defaults);
    for (const [key, value] of Object.entries(recoveredDefaults)) {
      if (key === "formType") continue;
      if (!String(applicant[key] ?? "").trim() && String(value ?? "").trim()) applicant[key] = value;
    }
    const correctionFields=Array.isArray(validation.correctionFields)?validation.correctionFields.filter((value):value is string=>typeof value==="string"):[];
    const resubmittedFields=Array.isArray(validation.resubmittedFields)?validation.resubmittedFields.filter((value):value is string=>typeof value==="string"):[];
    const accessQuery=publicAccessQuery(token,batch);
    const deviceQuery=deviceId?`&deviceId=${encodeURIComponent(deviceId)}`:"";
    const formType=link.defaults.formType==="general"?"general":"student";
    return json({ok:true,link:{id:link.id,label:link.label,status:link.status,formType},defaults:link.defaults,submission:{
      id:row.id,queueNo:row.queue_no,status:row.status,applicantName:row.applicant_name,reviewNote:row.review_note,reviewedAt:row.reviewed_at,
      correctionFields,resubmittedFields,revision:typeof validation.revision==="number"?validation.revision:0,deviceCode:row.device_code,
      applicant,
      result:result?{available:true,fileName:result.file_name,fileSize:result.file_size,uploadedAt:result.uploaded_at,downloadUrl:`/api/kd-mid-visa-intake/public?${accessQuery}&submissionId=${encodeURIComponent(row.id)}${deviceQuery}&result=1`}:null
    }});
  }

  if(wantsResult)return json({ok:false,error:"Không tìm thấy hồ sơ nhận kết quả."},404);
  const formType=link.defaults.formType==="general"?"general":"student";
  return json({ok:true,link:{id:link.id,label:link.label,status:link.status,formType},defaults:link.defaults,deviceCode:device?.code??null});
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
    const rawDeviceId = text(body.deviceId, 120);
    const device = await deviceIdentity(rawDeviceId);
    if (!device) return json({ ok: false, error: "Không tạo được mã thiết bị hợp lệ. Hãy tải lại trang rồi thử lại." }, 400);
    const link = await linkByAccess(token, batch);
    if (!link) return json({ ok: false, error: "Link thu thập hồ sơ không hợp lệ." }, 404);
    if (link.status !== "active" || link.expired) return json({ ok: false, error: "Đợt thu hồ sơ đã đóng. Link không còn nhận hoặc mở lại hồ sơ." }, 410);

    const source = (body.applicant && typeof body.applicant === "object" ? body.applicant : {}) as Record<string, unknown>;
    const defaults = link.defaults ?? {};
    const formType = defaults.formType === "general" ? "general" : "student";
    const student = formType === "student";
    const passportIssue = text(source.passportIssue, 10);
    const applicant = {
      surname: upperPlain(source.surname, 80),
      givenNames: upperPlain(source.givenNames, 120),
      birthDate: text(source.birthDate, 10),
      birthPlace: upperPlain(source.birthPlace, 160),
      sex: text(source.sex, 20),
      hasOtherNames: bool(source.hasOtherNames),
      otherNames: upperPlain(source.otherNames, 240),
      bornInRussia: bool(source.bornInRussia),
      citizenship: upperPlain(source.citizenship, 80) || upperPlain(defaults.citizenship, 80) || "ВЬЕТНАМ",
      purposeSection: upperPlain(source.purposeSection, 120) || upperPlain(defaults.purposeSection, 120) || (student ? "УЧЕБА" : ""),
      purpose: upperPlain(source.purpose, 120) || upperPlain(defaults.purpose, 120) || (student ? "УЧЕБА" : ""),
      visaType: upperPlain(source.visaType, 160) || upperPlain(defaults.visaType, 160) || (student ? "ОБЫКНОВЕННАЯ УЧЕБНАЯ" : ""),
      entries: upperPlain(source.entries, 80) || upperPlain(defaults.entries, 80) || (student ? "ОДНОКРАТНАЯ" : ""),
      entryDate: text(source.entryDate, 10) || text(defaults.entryDate, 10),
      exitDate: text(source.exitDate, 10) || text(defaults.exitDate, 10),
      destinationType: upperPlain(source.destinationType, 80) || upperPlain(defaults.destinationType, 80) || (student ? "ОРГАНИЗАЦИЯ" : ""),
      organization: upperPlain(source.organization, 300) || upperPlain(defaults.organization, 300),
      organizationAddress: upperPlain(source.organizationAddress, 400) || upperPlain(defaults.organizationAddress, 400),
      tin: text(source.tin, 40) || text(defaults.tin, 40),
      telex: text(source.telex, 80) || text(defaults.telex, 80),
      invitation: text(source.invitation, 120) || text(defaults.invitation, 120),
      passportNo: upperPlain(source.passportNo, 40),
      passportIssue,
      passportExpiry: text(source.passportExpiry, 10) || passportExpiryFromIssue(passportIssue),
      hasPermanentAddress: source.hasPermanentAddress !== false,
      personalAddress: upperPlain(source.personalAddress, 300) || upperPlain(defaults.permanentAddress, 300),
      phone: text(source.phone, 40),
      personalFax: text(source.personalFax, 40),
      email: text(source.email, 160).toLowerCase(),
      routeCity: upperPlain(source.routeCity, 80) || upperPlain(defaults.routeCity, 80) || (student ? "МОСКВА" : ""),
      worksOrStudies: source.worksOrStudies !== false,
      workStudyPlace: upperPlain(source.workStudyPlace, 240) || upperPlain(defaults.employer, 240),
      position: upperPlain(source.position, 120) || upperPlain(defaults.position, 120),
      workAddress: upperPlain(source.workAddress, 300) || upperPlain(defaults.workAddress, 300),
      workPhone: text(source.workPhone, 40) || text(defaults.workPhone, 40),
      workFax: text(source.workFax, 40),
      workEmail: (text(source.workEmail, 160) || text(defaults.workEmail, 160)).toLowerCase(),
      preferredEmbassy: text(source.preferredEmbassy, 120) || text(defaults.preferredEmbassy, 120),
      passwordOverride: text(source.passwordOverride, 120) || text(defaults.password, 120),
      applicationId: text(source.applicationId, 30).replace(/\D/g, ""),
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
      ["citizenship", "Quốc tịch"],
      ["purposeSection", "Nhóm mục đích chuyến đi"],
      ["purpose", "Mục đích chuyến đi"],
      ["visaType", "Loại visa"],
      ["entries", "Số lần nhập cảnh"],
      ["entryDate", "Ngày vào Nga"],
      ["exitDate", "Ngày ra Nga"],
      ["destinationType", "Loại nơi đến tại Nga"],
      ["routeCity", "Nơi đến tại Nga"],
      ["passportNo", "Số hộ chiếu"],
      ["passportIssue", "Ngày cấp hộ chiếu"],
      ["passportExpiry", "Ngày hết hạn hộ chiếu"],
      ["phone", "Điện thoại cá nhân"],
      ["email", "Email cá nhân"],
      ["preferredEmbassy", "Nơi nộp hồ sơ"],
    ];
    if (student) {
      required.push(
        ["organization", "Tên tổ chức mời/tiếp nhận"],
        ["organizationAddress", "Địa chỉ tổ chức"],
        ["tin", "INN tổ chức"],
        ["telex", "Mã Telex"],
      );
    }
    for (const [key, label] of required) if (!String(applicant[key] ?? "").trim()) missing.push(label);

    for (const [key, label] of [
      ["birthDate", "Ngày sinh"],
      ["passportIssue", "Ngày cấp hộ chiếu"],
      ["passportExpiry", "Ngày hết hạn hộ chiếu"],
      ["entryDate", "Ngày vào Nga"],
      ["exitDate", "Ngày ra Nga"],
    ] as const) {
      if (applicant[key] && !validDmy(applicant[key])) missing.push(`${label} phải theo dd/mm/yyyy`);
    }
    const today = utcToday();
    const birthDate = parseDmy(applicant.birthDate);
    const passportIssueDate = parseDmy(applicant.passportIssue);
    const passportExpiry = parseDmy(applicant.passportExpiry);
    const entryDate = parseDmy(applicant.entryDate);
    const exitDate = parseDmy(applicant.exitDate);
    if (birthDate && birthDate > today) missing.push("Ngày sinh không được ở tương lai");
    if (passportIssueDate && passportIssueDate > today) missing.push("Ngày cấp hộ chiếu không được ở tương lai");
    if (birthDate && passportIssueDate && passportIssueDate <= birthDate) missing.push("Ngày cấp hộ chiếu phải sau ngày sinh");
    if (passportIssueDate && passportExpiry && passportExpiry <= passportIssueDate) missing.push("Ngày hết hạn hộ chiếu phải sau ngày cấp");
    if (passportExpiry && passportExpiry <= today) missing.push("Hộ chiếu đã hết hạn");
    if (entryDate && exitDate && exitDate < entryDate) missing.push("Ngày ra Nga phải bằng hoặc sau ngày vào Nga");
    if (applicant.hasOtherNames && !applicant.otherNames) missing.push("Tên khác đã từng sử dụng");
    if (applicant.hasPermanentAddress && !applicant.personalAddress) missing.push("Địa chỉ thường trú");
    if (applicant.worksOrStudies) {
      if (!applicant.workStudyPlace) missing.push("Nơi làm việc/học tập");
      if (!applicant.position) missing.push("Chức vụ/tư cách");
      if (!applicant.workAddress) missing.push("Địa chỉ cơ quan");
      if (!applicant.workPhone) missing.push("Điện thoại cơ quan");
      if (!applicant.workEmail) missing.push("Email cơ quan");
    }

    if (!["МУЖСКОЙ", "ЖЕНСКИЙ"].includes(applicant.sex)) missing.push("Giới tính không hợp lệ");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(applicant.email)) missing.push("Email cá nhân không hợp lệ");
    if (applicant.workEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(applicant.workEmail)) missing.push("Email cơ quan không hợp lệ");
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
        "SELECT id,queue_no,status,validation_json,device_hash FROM visa_intake_submissions WHERE id=? AND link_id=? LIMIT 1",
      ).bind(submissionId, link.id).first<{ id: string; queue_no: number; status: string; validation_json: string; device_hash: string | null }>();
      if (!existing) return json({ ok: false, error: "Không tìm thấy hồ sơ cần sửa." }, 404);
      if (existing.device_hash && existing.device_hash !== device.hash) return json({ ok: false, error: "Thiết bị này không khớp với hồ sơ cần sửa." }, 403);
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
            SET status='pending', applicant_name=?, passport_no=?, email=?, phone=?, device_hash=?, device_code=?, payload_json=?, validation_json=?,
                submitted_at=CURRENT_TIMESTAMP, reviewed_by=NULL, reviewed_at=NULL, review_note=NULL
          WHERE id=? AND link_id=?`,
      ).bind(
        applicantName, applicant.passportNo, applicant.email, applicant.phone, device.hash, device.code,
        JSON.stringify(applicant), JSON.stringify(validation), submissionId, link.id,
      ).run();
      return json({
        ok: true,
        submission: { id: existing.id, queueNo: existing.queue_no, applicantName, status: "pending", revision, correctionFields: [], resubmittedFields, deviceCode: device.code, applicant },
      });
    }

    const existingForDevice = await database.prepare(
      "SELECT id,queue_no,status,applicant_name,payload_json,validation_json,device_code FROM visa_intake_submissions WHERE link_id=? AND device_hash=? ORDER BY queue_no DESC LIMIT 1"
    ).bind(link.id, device.hash).first<{ id:string; queue_no:number; status:string; applicant_name:string; payload_json:string; validation_json:string; device_code:string|null }>();
    if (existingForDevice) {
      let existingApplicant:Record<string,unknown>={};
      let existingValidation:Record<string,unknown>={};
      try{existingApplicant=JSON.parse(existingForDevice.payload_json||"{}")}catch{}
      try{existingValidation=JSON.parse(existingForDevice.validation_json||"{}")}catch{}
      return json({ok:true,recovered:true,submission:{
        id:existingForDevice.id,queueNo:existingForDevice.queue_no,applicantName:existingForDevice.applicant_name,status:existingForDevice.status,
        revision:typeof existingValidation.revision==="number"?existingValidation.revision:0,
        correctionFields:Array.isArray(existingValidation.correctionFields)?existingValidation.correctionFields:[],
        resubmittedFields:Array.isArray(existingValidation.resubmittedFields)?existingValidation.resubmittedFields:[],
        deviceCode:existingForDevice.device_code,applicant:existingApplicant
      }});
    }

    const id = crypto.randomUUID();
    const validation = { complete: true, checkedAt: new Date().toISOString(), revision: 0, correctionFields: [], resubmittedFields: [], deviceCode: device.code };
    const result = await database.prepare(
      `INSERT INTO visa_intake_submissions
        (id,link_id,status,applicant_name,passport_no,email,phone,device_hash,device_code,payload_json,validation_json)
       VALUES (?,?, 'pending', ?,?,?,?,?,?,?,?,?) RETURNING queue_no`,
    ).bind(
      id,
      link.id,
      applicantName,
      applicant.passportNo,
      applicant.email,
      applicant.phone,
      device.hash,
      device.code,
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
        deviceCode: device.code,
        applicant,
      },
    }, 201);
  } catch {
    return json({ ok: false, error: "Không thể gửi hồ sơ lúc này. Vui lòng thử lại." }, 500);
  }
}
