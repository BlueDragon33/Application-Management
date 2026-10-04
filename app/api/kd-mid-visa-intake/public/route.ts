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

function validDmy(value: string) {
  const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return false;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

async function activeLink(token: string) {
  if (!/^[A-Za-z0-9_-]{30,120}$/.test(token)) return null;
  const database = await getControlDatabase();
  const row = await database.prepare(
    `SELECT id,label,status,defaults_json,expires_at
       FROM visa_intake_links
      WHERE token_hash=? AND status='active' LIMIT 1`,
  ).bind(await sha256(token)).first<{
    id: string;
    label: string;
    status: string;
    defaults_json: string;
    expires_at: string | null;
  }>();
  if (!row) return null;
  if (row.expires_at && Date.parse(row.expires_at) <= Date.now()) return null;
  let defaults: Record<string, unknown> = {};
  try { defaults = JSON.parse(row.defaults_json) as Record<string, unknown>; } catch {}
  return { ...row, defaults };
}

export async function GET(request: Request) {
  try {
    const token = new URL(request.url).searchParams.get("token") ?? "";
    const link = await activeLink(token);
    if (!link) return json({ ok: false, error: "Link thu thập hồ sơ không hợp lệ hoặc đã đóng." }, 404);
    return json({
      ok: true,
      link: { id: link.id, label: link.label },
      defaults: link.defaults,
    });
  } catch {
    return json({ ok: false, error: "Không thể mở form thu thập lúc này." }, 503);
  }
}

export async function POST(request: Request) {
  try {
    const length = Number(request.headers.get("content-length") || "0");
    if (length > 80_000) return json({ ok: false, error: "Dữ liệu gửi lên quá lớn." }, 413);
    const body = await request.json() as Record<string, unknown>;
    const token = text(body.token, 120);
    const link = await activeLink(token);
    if (!link) return json({ ok: false, error: "Link thu thập hồ sơ không hợp lệ hoặc đã đóng." }, 404);

    const source = (body.applicant && typeof body.applicant === "object" ? body.applicant : {}) as Record<string, unknown>;
    const applicant = {
      surname: text(source.surname, 80).toUpperCase(),
      givenNames: text(source.givenNames, 120).toUpperCase(),
      birthDate: text(source.birthDate, 10),
      birthPlace: text(source.birthPlace, 160).toUpperCase(),
      sex: text(source.sex, 20),
      passportNo: text(source.passportNo, 40).toUpperCase(),
      passportIssue: text(source.passportIssue, 10),
      passportExpiry: text(source.passportExpiry, 10),
      phone: text(source.phone, 40),
      email: text(source.email, 160).toLowerCase(),
      routeCity: text(source.routeCity, 80).toUpperCase() || "МОСКВА",
      workStudyPlace: text(source.workStudyPlace, 240),
      position: text(source.position, 120),
      workAddress: text(source.workAddress, 300),
      workPhone: text(source.workPhone, 40),
      workEmail: text(source.workEmail, 160).toLowerCase(),
      preferredEmbassy: text(source.preferredEmbassy, 120),
      hadFormerRussianCitizenship: bool(source.hadFormerRussianCitizenship),
      formerCitizenshipLostDate: text(source.formerCitizenshipLostDate, 10),
      formerCitizenshipLossReason: text(source.formerCitizenshipLossReason, 300),
      visitedRussia: bool(source.visitedRussia),
      visitsCount: text(source.visitsCount, 10),
      lastVisitFrom: text(source.lastVisitFrom, 10),
      lastVisitTo: text(source.lastVisitTo, 10),
      hasInsurance: bool(source.hasInsurance),
      insurancePolicy: text(source.insurancePolicy, 300),
      childrenUnder16: bool(source.childrenUnder16),
      relativesInRussia: bool(source.relativesInRussia),
      specialNotes: text(source.specialNotes, 1200),
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

    if (!bool(body.confirmedAccurate)) missing.push("Xác nhận thông tin là đúng sự thật");
    if (missing.length) return json({ ok: false, error: "Form còn thiếu hoặc sai dữ liệu.", missing }, 400);

    const id = crypto.randomUUID();
    const applicantName = [applicant.surname, applicant.givenNames].filter(Boolean).join(" ");
    const database = await getControlDatabase();
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
      JSON.stringify({ complete: true, checkedAt: new Date().toISOString() }),
    ).first<{ queue_no: number }>();

    return json({
      ok: true,
      submission: {
        id,
        queueNo: result?.queue_no ?? null,
        applicantName,
      },
    }, 201);
  } catch {
    return json({ ok: false, error: "Không thể gửi hồ sơ lúc này. Vui lòng thử lại." }, 500);
  }
}
