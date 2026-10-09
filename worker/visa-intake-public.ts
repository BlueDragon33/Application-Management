type VisaIntakePageEnv = { DB: D1Database };

const STUDENT_SERVER_DEFAULTS: Record<string, string> = {
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
};

function htmlAttr(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function base64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/g, "");
}

async function hashToken(value: string) {
  return base64Url(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))));
}

function mergeStudentServerDefaults(raw: Record<string, unknown>) {
  const formType = raw.formType === "general" ? "general" : "student";
  if (formType === "general") return { ...raw, formType };
  const merged: Record<string, unknown> = { ...raw, formType: "student" };
  for (const [key, value] of Object.entries(STUDENT_SERVER_DEFAULTS)) {
    if (!String(merged[key] ?? "").trim() && value) merged[key] = value;
  }
  return merged;
}

async function resolveServerDefaults(request: Request, env: VisaIntakePageEnv) {
  const url = new URL(request.url);
  const batch = url.searchParams.get("batch") ?? "";
  const token = url.searchParams.get("token") ?? "";
  let row: { defaults_json: string } | null = null;
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(batch)) {
    row = await env.DB.prepare("SELECT defaults_json FROM visa_intake_links WHERE id=? LIMIT 1").bind(batch).first<{ defaults_json: string }>();
  } else if (/^[A-Za-z0-9_-]{30,120}$/.test(token)) {
    row = await env.DB.prepare("SELECT defaults_json FROM visa_intake_links WHERE token_hash=? LIMIT 1").bind(await hashToken(token)).first<{ defaults_json: string }>();
  }
  let defaults: Record<string, unknown> = {};
  try { defaults = row?.defaults_json ? JSON.parse(row.defaults_json) as Record<string, unknown> : {}; } catch {}
  return mergeStudentServerDefaults(defaults);
}

function dateParts(value: unknown) {
  const [day = "", month = "", year = ""] = String(value ?? "").split("/");
  return { day: htmlAttr(day), month: htmlAttr(month), year: htmlAttr(year), full: htmlAttr(value) };
}

function selectOptions(current: unknown, options: Array<[string, string]>) {
  const selected = String(current ?? "");
  const known = options.some(([value]) => value === selected);
  const rows = ['<option value="">-- Chọn như trên KD-MID --</option>'];
  if (selected && !known) rows.push(`<option value="${htmlAttr(selected)}" selected>${htmlAttr(selected)} · Giá trị đã lưu</option>`);
  for (const [value, label] of options) rows.push(`<option value="${htmlAttr(value)}" ${value === selected ? "selected" : ""}>${htmlAttr(value)} · ${htmlAttr(label)}</option>`);
  return rows.join("");
}

function headers() {
  return {
    "content-type": "text/html; charset=utf-8",
    "cache-control": "no-store",
    "referrer-policy": "no-referrer",
    "x-content-type-options": "nosniff",
    "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
  };
}

export async function publicVisaIntakePage(request: Request, env: VisaIntakePageEnv) {
  let serverDefaults: Record<string, unknown> = {};
  try { serverDefaults = await resolveServerDefaults(request, env); } catch {}
  const serverStudent = serverDefaults.formType !== "general";
  const entryDate = dateParts(serverDefaults.entryDate);
  const exitDate = dateParts(serverDefaults.exitDate);
  const selectedEmbassy = String(serverDefaults.preferredEmbassy ?? "");
  const html = `<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Form hồ sơ Visa Nga</title>
<style>
:root{color-scheme:dark;font-family:Inter,system-ui,sans-serif;background:#07120f;color:#effaf6}*{box-sizing:border-box}body{margin:0;background:#07120f;color:#effaf6}.page{width:min(1080px,calc(100% - 24px));margin:24px auto 64px}.hero,.section,.confirm,.success{border:1px solid #214f42;border-radius:18px;background:#0b211b}.hero{padding:26px;background:linear-gradient(135deg,#0b211b,#0a1714)}.hero span,.section header b{color:#e1d252;font-weight:900;letter-spacing:.1em;font-size:12px}.hero h1{font-size:clamp(28px,5vw,44px);margin:8px 0}.hero p,.section p,.hint{color:#95b7ab}.batch,.error,.return-alert{margin:16px 0;padding:12px 14px;border-radius:10px}.batch{border:1px solid #2b6955;background:#0d2b22}.error{border:1px solid #8f4747;background:#3a1b1b;color:#ffdada;display:none}.return-alert{display:none;border:2px solid #e66d6d;background:#411b1b;color:#ffe0e0;box-shadow:0 0 0 4px rgba(230,109,109,.08)}.return-alert strong{font-size:16px}.return-alert p{margin:6px 0}.return-alert button,.success button{margin-top:12px;border:1px solid #4c7668;border-radius:10px;background:#10261f;color:#effaf6;padding:10px 14px;font:inherit;font-weight:850;cursor:pointer}.return-alert button:disabled,.success button:disabled{opacity:.55;cursor:wait}.field[data-correction="true"],.checks label[data-correction="true"]{border:2px solid #e66d6d!important;background:rgba(230,109,109,.12)!important;border-radius:10px;padding:8px}.field[data-correction="true"] input,.field[data-correction="true"] select,.field[data-correction="true"] textarea{border-color:#e66d6d}.section{margin-top:16px;padding:20px}.section header{display:flex;gap:12px;align-items:flex-start}.section header b{display:grid;place-items:center;width:38px;height:38px;border:1px solid #756c27;border-radius:10px}.section h2{margin:0 0 4px}.section header p{margin:0}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;margin-top:16px}.field{display:grid;gap:5px;font-weight:800;font-size:14px}.field small{font-weight:500;color:#89aa9f}.required-mark{color:#ffcf66;font-size:15px;font-weight:950}.field small[title],.checks small[title]{cursor:help;text-decoration:underline dotted rgba(137,170,159,.65);text-underline-offset:3px}.field[data-personal-required="true"]:not([data-correction="true"]):has(input:required:invalid),.field[data-personal-required="true"]:not([data-correction="true"]):has(select:required:invalid),.field[data-personal-required="true"]:not([data-correction="true"]):has(textarea:required:invalid){padding:8px;border:1px solid #b9832f;border-radius:10px;background:rgba(185,131,47,.12)}.field[data-personal-required="true"]:not([data-correction="true"]):has(input:required:invalid) input,.field[data-personal-required="true"]:not([data-correction="true"]):has(select:required:invalid) select,.field[data-personal-required="true"]:not([data-correction="true"]):has(textarea:required:invalid) textarea{border-color:#d9a13f;background:#171407}.field:has(input:user-invalid),.field:has(select:user-invalid),.field:has(textarea:user-invalid){outline:2px solid rgba(230,109,109,.45);outline-offset:2px}.field input,.field select,.field textarea{width:100%;padding:11px 12px;border:1px solid #2b6354;border-radius:9px;background:#071510;color:#fff;font:inherit}.field input[data-normalize="upper-plain"]{text-transform:uppercase}.draft-status{display:block;margin-top:8px;color:#8fb0a5;font-size:11px}.draft-status[data-state="error"]{color:#ffb3a9}.date-fields{display:grid;grid-template-columns:minmax(72px,.9fr) minmax(82px,1fr) minmax(108px,1.25fr);gap:8px}.date-fields input{text-align:center;min-width:0;padding-left:8px;padding-right:8px}.date-fields input::placeholder{font-size:12px;color:#6f9186}.field input[readonly]{color:#b8d0c7;background:#10251f}.checks{display:grid;gap:10px;margin-top:16px}.checks label,.confirm label{display:flex;gap:10px;padding:12px;border:1px solid #2a5648;border-radius:10px;background:#0a1c17}.checks input,.confirm input{width:18px;height:18px;margin-top:2px}.checks span,.confirm span{display:grid;gap:3px}.checks small,.confirm small{color:#89aa9f}.conditional{display:none}.confirm{margin-top:16px;padding:18px}.confirm button{width:100%;min-height:52px;margin-top:14px;border:0;border-radius:11px;background:#e1d252;color:#15130a;font-weight:950;font-size:16px}.confirm button:disabled{opacity:.5}.success{margin-top:28px;padding:32px;text-align:center;display:none}.success>strong{display:block;color:#e1d252;font-size:36px;margin-top:10px}.result-box{margin:18px auto 0;max-width:560px;padding:16px;border:1px solid #2d6b57;border-radius:14px;background:#071510}.result-box strong{display:block;font-size:17px}.result-box p{color:#9fc0b5;margin:7px 0 12px}.result-box a{display:none;text-decoration:none;border-radius:10px;background:#e1d252;color:#15130a;padding:10px 14px;font-weight:950}@media(max-width:720px){.grid{grid-template-columns:1fr}.page{width:min(100% - 16px,1080px);margin-top:8px}.hero,.section{padding:16px}.date-fields{grid-template-columns:minmax(64px,.85fr) minmax(74px,1fr) minmax(92px,1.2fr);gap:6px}}
.guide{margin:16px 0;border:1px solid #315f50;border-radius:14px;background:#0b211b;overflow:hidden}.guide summary{cursor:pointer;padding:14px 16px;font-weight:900;color:#e1d252}.guide-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;padding:0 16px 16px}.guide-grid article{padding:12px;border:1px solid #244d40;border-radius:10px;background:#081713}.guide-grid strong{font-size:13px}.guide-grid p{margin:5px 0 0;color:#91b3a7;font-size:12px;line-height:1.55}.prefill-notice{display:none;margin:16px 0;padding:14px 16px;border:1px solid #756c27;border-radius:12px;background:#25220c;color:#d8d3a0}.prefill-notice strong{color:#f2e87f}.prefill-notice p{margin:5px 0 0;font-size:12px;line-height:1.55}@media(max-width:720px){.guide-grid{grid-template-columns:1fr}}
</style>
</head>
<body>
<main class="page">
<section class="hero"><span id="formTypeBadge">${serverStudent ? "LINK 1 · MẪU NHẬP HỌC" : "LINK 2 · MẪU VISA NGƯỜI THƯỜNG"}</span><h1 id="heroTitle">${serverStudent ? "Điền hồ sơ nhập học để chuẩn bị KD-MID" : "Điền hồ sơ visa cá nhân để chuẩn bị KD-MID"}</h1><p id="heroIntro">${serverStudent ? "Các dữ liệu dùng chung đã được điền sẵn trực tiếp trong ô. Chỉ sửa nếu giấy tờ của bạn khác." : "Hãy nhập thông tin theo đúng mục đích chuyến đi của bạn."}</p></section>
<div id="batch" class="batch">Đang kiểm tra link thu hồ sơ…</div>
<div id="error" class="error"></div>
<div id="returnAlert" class="return-alert"><strong>⚠ HỒ SƠ BỊ TRẢ VỀ · CẦN SỬA</strong><p id="returnNote"></p><small id="returnMeta"></small><button id="refreshReturned" type="button">↻ Cập nhật trạng thái</button></div>
<details class="guide" open><summary>Hướng dẫn điền hồ sơ</summary><div class="guide-grid">
<article><strong>Thông tin theo hộ chiếu</strong><p>Họ, tên, nơi sinh và số hộ chiếu nhập đúng giấy tờ. Chữ tiếng Việt tự chuyển IN HOA không dấu; email giữ chữ thường. <b>Dấu * là trường cá nhân bắt buộc; ô còn thiếu sẽ nổi bật cho tới khi điền đủ.</b></p></article>
<article><strong>Ngày tháng</strong><p>Nhập riêng Ngày · Tháng · Năm. Ngày hết hạn hộ chiếu tự động giữ ngày/tháng ngày cấp và cộng 10 năm.</p></article>
<article><strong>Các mục Có / Không</strong><p>Chỉ chọn Có khi đúng thực tế. Các ô chi tiết sẽ tự hiện và cần điền đầy đủ.</p></article>
<article><strong>Khi hồ sơ bị trả về</strong><p>Ô sai màu đỏ; sửa và gửi lại để admin thấy ô đã sửa màu xanh và xác minh lại.</p></article>
<article><strong>Đóng tab và mở lại</strong><p>Sau khi đã gửi, mở lại đúng link trên cùng trình duyệt sẽ tự khôi phục hồ sơ và trạng thái bằng mã thiết bị cho đến khi admin đóng link.</p></article>
<article><strong id="guideTypeTitle">Loại mẫu</strong><p id="guideTypeText"></p></article>
</div></details>
<div id="prefillNotice" class="prefill-notice"><strong>Thông tin chung Link 1 đã nạp sẵn</strong><p>Quốc tịch · nhóm/mục đích học tập · loại visa · số lần nhập cảnh · ngày vào/ra · loại nơi đến · tổ chức tiếp nhận · địa chỉ tổ chức · INN · Mã Telex · số giấy mời nếu có · Moscow · địa chỉ thường trú · nơi học · STUDENT · địa chỉ/điện thoại/email đơn vị · nơi nộp · mật khẩu KD-MID. Nếu khác giấy tờ của bạn, sửa trực tiếp trong ô tương ứng.</p></div>
<form id="form" novalidate>
<datalist id="day-options"><option value="01"></option><option value="02"></option><option value="03"></option><option value="04"></option><option value="05"></option><option value="06"></option><option value="07"></option><option value="08"></option><option value="09"></option><option value="10"></option><option value="11"></option><option value="12"></option><option value="13"></option><option value="14"></option><option value="15"></option><option value="16"></option><option value="17"></option><option value="18"></option><option value="19"></option><option value="20"></option><option value="21"></option><option value="22"></option><option value="23"></option><option value="24"></option><option value="25"></option><option value="26"></option><option value="27"></option><option value="28"></option><option value="29"></option><option value="30"></option><option value="31"></option></datalist>
<datalist id="month-options"><option value="01"></option><option value="02"></option><option value="03"></option><option value="04"></option><option value="05"></option><option value="06"></option><option value="07"></option><option value="08"></option><option value="09"></option><option value="10"></option><option value="11"></option><option value="12"></option></datalist>
<section class="section"><header><b>01</b><div><h2>Thông tin visa & thư mời</h2><p>Các trường có thể mặc định theo đợt đã được điền sẵn. Chỉ sửa khi giấy tờ của bạn khác.</p></div></header><div class="grid">
<label class="field" data-field="citizenship">Quốc tịch <small>Гражданство</small><select name="citizenship" required>${selectOptions(serverDefaults.citizenship, [["ВЬЕТНАМ","Việt Nam"]])}</select></label>
<label class="field" data-field="purposeSection">Nhóm mục đích <small>Цель поездки (раздел)</small><select name="purposeSection" required>${selectOptions(serverDefaults.purposeSection, [["УЧЕБА","Học tập"],["РАБОТА","Lao động"],["ДЕЛОВАЯ","Công vụ / thương mại"],["ГУМАНИТАРНАЯ","Nhân đạo"],["ЧАСТНАЯ","Cá nhân / thăm thân"],["ТУРИЗМ","Du lịch"],["ТРАНЗИТ","Quá cảnh"]])}</select></label>
<label class="field" data-field="purpose">Mục đích chuyến đi <small>Цель поездки</small><select name="purpose" required>${selectOptions(serverDefaults.purpose, [["УЧЕБА","Học tập"],["РАБОТА","Lao động"],["ДЕЛОВАЯ","Công vụ / thương mại"],["ГУМАНИТАРНАЯ","Nhân đạo"],["ЧАСТНАЯ","Cá nhân / thăm thân"],["ТУРИЗМ","Du lịch"],["ТРАНЗИТ","Quá cảnh"]])}</select></label>
<label class="field" data-field="visaType">Loại visa <small>Категория и вид визы</small><select name="visaType" required>${selectOptions(serverDefaults.visaType, [["ОБЫКНОВЕННАЯ УЧЕБНАЯ","Visa học tập thông thường"],["ОБЫКНОВЕННАЯ РАБОЧАЯ","Visa lao động thông thường"],["ОБЫКНОВЕННАЯ ДЕЛОВАЯ","Visa công vụ / thương mại"],["ОБЫКНОВЕННАЯ ГУМАНИТАРНАЯ","Visa nhân đạo"],["ОБЫКНОВЕННАЯ ЧАСТНАЯ","Visa cá nhân"],["ОБЫКНОВЕННАЯ ТУРИСТИЧЕСКАЯ","Visa du lịch"],["ТРАНЗИТНАЯ","Visa quá cảnh"]])}</select></label>
<label class="field" data-field="entries">Số lần nhập cảnh <small>Кратность визы</small><select name="entries" required>${selectOptions(serverDefaults.entries, [["ОДНОКРАТНАЯ","Một lần"],["ДВУКРАТНАЯ","Hai lần"],["МНОГОКРАТНАЯ","Nhiều lần"]])}</select></label>
<label class="field" data-field="entryDate">Ngày vào Nga <small>Дата въезда в Россию</small><div class="date-fields" data-date="entryDate"><input data-part="day" aria-label="Ngày" placeholder="NGÀY" value="${entryDate.day}" inputmode="numeric" maxlength="2" list="day-options" required><input data-part="month" aria-label="Tháng" placeholder="THÁNG" value="${entryDate.month}" inputmode="numeric" maxlength="2" list="month-options" required><input data-part="year" aria-label="Năm" placeholder="NĂM" value="${entryDate.year}" inputmode="numeric" maxlength="4" required><input type="hidden" name="entryDate" value="${entryDate.full}"></div></label>
<label class="field" data-field="exitDate">Ngày ra Nga <small>Дата выезда из России</small><div class="date-fields" data-date="exitDate"><input data-part="day" aria-label="Ngày" placeholder="NGÀY" value="${exitDate.day}" inputmode="numeric" maxlength="2" list="day-options" required><input data-part="month" aria-label="Tháng" placeholder="THÁNG" value="${exitDate.month}" inputmode="numeric" maxlength="2" list="month-options" required><input data-part="year" aria-label="Năm" placeholder="NĂM" value="${exitDate.year}" inputmode="numeric" maxlength="4" required><input type="hidden" name="exitDate" value="${exitDate.full}"></div></label>
<label class="field" data-field="destinationType">Loại nơi đến <small>В какое учреждение направляетесь?</small><select name="destinationType" required>${selectOptions(serverDefaults.destinationType, [["ОРГАНИЗАЦИЯ","Tổ chức"],["ФИЗИЧЕСКОЕ ЛИЦО","Cá nhân"]])}</select></label>
<label class="field" data-field="organization">Tên tổ chức tiếp nhận <small>Наименование организации</small><input name="organization" value="${htmlAttr(serverDefaults.organization)}" required></label>
<label class="field" data-field="organizationAddress">Địa chỉ tổ chức <small>Адрес</small><input name="organizationAddress" value="${htmlAttr(serverDefaults.organizationAddress)}" required></label>
<label class="field" data-field="tin">INN tổ chức <small>ИНН организации</small><input name="tin" value="${htmlAttr(serverDefaults.tin)}" required></label>
<label class="field" data-field="telex" id="telexField">Mã Telex / Số chỉ thị <small>Номер указания (телекса)</small><input name="telex" value="${htmlAttr(serverDefaults.telex)}" required></label>
<label class="field" data-field="invitation">Số giấy mời <small>Номер приглашения · không có thì để trống</small><input name="invitation" value="${htmlAttr(serverDefaults.invitation)}"></label>
</div></section>
<section class="section"><header><b>02</b><div><h2>Thông tin cá nhân</h2><p>Họ và tên nhập chữ Latin không dấu, đúng thứ tự trên hộ chiếu.</p></div></header><div class="grid">
<label class="field" data-field="surname" data-personal-required="true">Họ <b class="required-mark">*</b> <small>Фамилия</small><input name="surname" data-normalize="upper-plain" required></label>
<label class="field" data-field="givenNames" data-personal-required="true">Tên và tên đệm <b class="required-mark">*</b> <small>Имя, другие имена, отчество</small><input name="givenNames" data-normalize="upper-plain" required></label>
<label class="field" data-field="birthDate" data-personal-required="true">Ngày sinh <b class="required-mark">*</b> <small>Дата рождения · Ngày / Tháng / Năm</small><div class="date-fields" data-date="birthDate"><input data-part="day" aria-label="Ngày" title="Ngày" placeholder="NGÀY" inputmode="numeric" maxlength="2" list="day-options" required><input data-part="month" aria-label="Tháng" title="Tháng" placeholder="THÁNG" inputmode="numeric" maxlength="2" list="month-options" required><input data-part="year" aria-label="Năm" title="Năm" placeholder="NĂM" inputmode="numeric" maxlength="4" required><input type="hidden" name="birthDate"></div></label>
<label class="field" data-field="birthPlace" data-personal-required="true">Nơi sinh <b class="required-mark">*</b> <small>Место рождения</small><input name="birthPlace" data-normalize="upper-plain" required></label>
<label class="field" data-field="sex" data-personal-required="true">Giới tính <b class="required-mark">*</b> <small>Пол</small><select name="sex"><option value="МУЖСКОЙ">Nam</option><option value="ЖЕНСКИЙ">Nữ</option></select></label>
<label class="field" data-field="hasOtherNames">Đã từng dùng tên khác? <small>Есть ли у Вас другие когда-либо использовавшиеся имена</small><select name="hasOtherNames"><option value="НЕТ">Không</option><option value="ДА">Có</option></select></label>
<label class="field" data-field="otherNames" data-personal-required="true">Tên khác đã từng dùng <b class="required-mark">*</b> <small>Không có thì để trống</small><input name="otherNames" data-normalize="upper-plain"></label>
<label class="field" data-field="bornInRussia">Sinh tại Nga? <small>Вы родились в России?</small><select name="bornInRussia"><option value="НЕТ">Không</option><option value="ДА">Có</option></select></label>
<label class="field" data-field="routeCity">Nơi đến tại Nga <small>Маршрут</small><input name="routeCity" data-normalize="upper-plain" value="${htmlAttr(serverDefaults.routeCity)}" required></label>
</div></section>
<section class="section"><header><b>03</b><div><h2>Hộ chiếu</h2><p>Mỗi ngày dùng 3 ô Ngày · Tháng · Năm để tránh nhập sai. Ngày cấp không được ở tương lai; ngày hết hạn phải sau ngày cấp và hộ chiếu phải còn hạn.</p></div></header><div class="grid">
<label class="field" data-field="passportNo" data-personal-required="true">Số hộ chiếu <b class="required-mark">*</b> <small>Номер паспорта</small><input name="passportNo" required></label>
<label class="field" data-field="passportIssue" data-personal-required="true">Ngày cấp hộ chiếu <b class="required-mark">*</b> <small>Дата выдачи</small><div class="date-fields" data-date="passportIssue"><input data-part="day" aria-label="Ngày" title="Ngày" placeholder="NGÀY" inputmode="numeric" maxlength="2" list="day-options" required><input data-part="month" aria-label="Tháng" title="Tháng" placeholder="THÁNG" inputmode="numeric" maxlength="2" list="month-options" required><input data-part="year" aria-label="Năm" title="Năm" placeholder="NĂM" inputmode="numeric" maxlength="4" required><input type="hidden" name="passportIssue"></div></label>
<label class="field" data-field="passportExpiry" data-personal-required="true">Ngày hết hạn hộ chiếu <b class="required-mark">*</b><div class="date-fields" data-date="passportExpiry"><input data-part="day" aria-label="Ngày" placeholder="NGÀY" inputmode="numeric" maxlength="2" list="day-options" required><input data-part="month" aria-label="Tháng" placeholder="THÁNG" inputmode="numeric" maxlength="2" list="month-options" required><input data-part="year" aria-label="Năm" placeholder="NĂM" inputmode="numeric" maxlength="4" required><input type="hidden" name="passportExpiry"></div></label>
</div></section>
<section class="section"><header><b>04</b><div><h2>Liên hệ & địa chỉ</h2><p>Địa chỉ thường trú được nạp mặc định; Fax không có thì để trống.</p></div></header><div class="grid">
<label class="field" data-field="hasPermanentAddress">Có địa chỉ thường trú? <small>Имеете ли Вы адрес постоянного проживания?</small><select name="hasPermanentAddress"><option value="ДА">Có</option><option value="НЕТ">Không</option></select></label>
<label class="field" data-field="personalAddress" id="personalAddressField">Địa chỉ thường trú <small>Адрес вашего постоянного проживания</small><input name="personalAddress" value="${htmlAttr(serverDefaults.permanentAddress)}"></label>
<label class="field" data-field="phone" data-personal-required="true">Điện thoại cá nhân <b class="required-mark">*</b> <small>Ваш личный телефон</small><input name="phone" required></label>
<label class="field" data-field="personalFax">Fax cá nhân <small>Ваш личный факс · không có thì để trống</small><input name="personalFax"></label>
<label class="field" data-field="email" data-personal-required="true">Email cá nhân <b class="required-mark">*</b> <small>Ваш личный E-mail</small><input name="email" type="email" required></label>
</div></section>
<section class="section"><header><b>05</b><div><h2>Nơi làm việc / học tập</h2><p>Form tự nạp dữ liệu mặc định của đợt hồ sơ. Chỉ sửa nếu thông tin của bạn khác.</p></div></header><div class="grid">
<label class="field" data-field="worksOrStudies">Đang làm việc / học tập? <small>Вы работаете (работали ранее), учитесь (учились ранее)?</small><select name="worksOrStudies"><option value="ДА">Có</option><option value="НЕТ">Không</option></select></label>
</div><div id="workFields" class="grid">
<label class="field" data-field="workStudyPlace">Nơi làm việc / học tập <small>Место работы (учебы)</small><input name="workStudyPlace" value="${htmlAttr(serverDefaults.employer)}" required></label>
<label class="field" data-field="position">Chức vụ / tư cách <small>Должность</small><input name="position" value="${htmlAttr(serverDefaults.position)}" required></label>
<label class="field" data-field="workAddress">Địa chỉ cơ quan <small>Рабочий адрес</small><input name="workAddress" value="${htmlAttr(serverDefaults.workAddress)}" required></label>
<label class="field" data-field="workPhone">Điện thoại cơ quan <small>Рабочий телефон</small><input name="workPhone" value="${htmlAttr(serverDefaults.workPhone)}" required></label>
<label class="field" data-field="workFax">Fax cơ quan <small>Рабочий факс · không có thì để trống</small><input name="workFax"></label>
<label class="field" data-field="workEmail">Email cơ quan <small>Рабочий E-mail</small><input name="workEmail" type="email" value="${htmlAttr(serverDefaults.workEmail)}" required></label>
</div></section>
<section class="section"><header><b>06</b><div><h2>Lịch sử liên quan đến Nga</h2><p>Chọn Có chỉ khi đúng với bạn.</p></div></header>
<div class="checks">
<label data-field="hadFormerRussianCitizenship"><input id="former" type="checkbox"><span><strong>Đã từng có quốc tịch Liên Xô hoặc Nga</strong><small>Если Вы имели гражданство СССР или России</small></span></label>
<label data-field="visitedRussia"><input id="visited" type="checkbox"><span><strong>Đã từng đến Nga</strong><small>Были ли Вы когда-нибудь в России?</small></span></label>
<label data-field="hasInsurance"><input id="insurance" type="checkbox"><span><strong>Có bảo hiểm có hiệu lực tại Nga</strong><small>Документ о медицинском страховании</small></span></label>
</div>
<div id="formerFields" class="grid conditional"><label class="field" data-field="formerCitizenshipLostDate">Ngày mất quốc tịch <small>Ngày / Tháng / Năm</small><div class="date-fields" data-date="formerCitizenshipLostDate"><input data-part="day" aria-label="Ngày" title="Ngày" placeholder="NGÀY" inputmode="numeric" maxlength="2" list="day-options"><input data-part="month" aria-label="Tháng" title="Tháng" placeholder="THÁNG" inputmode="numeric" maxlength="2" list="month-options"><input data-part="year" aria-label="Năm" title="Năm" placeholder="NĂM" inputmode="numeric" maxlength="4"><input type="hidden" name="formerCitizenshipLostDate"></div></label><label class="field" data-field="formerCitizenshipLossReason">Lý do mất quốc tịch<input name="formerCitizenshipLossReason"></label></div>
<div id="visitFields" class="grid conditional"><label class="field" data-field="visitsCount">Số lần đã đến Nga<input name="visitsCount"></label><label class="field" data-field="lastVisitFrom">Chuyến gần nhất - từ ngày <small>Ngày / Tháng / Năm</small><div class="date-fields" data-date="lastVisitFrom"><input data-part="day" aria-label="Ngày" title="Ngày" placeholder="NGÀY" inputmode="numeric" maxlength="2" list="day-options"><input data-part="month" aria-label="Tháng" title="Tháng" placeholder="THÁNG" inputmode="numeric" maxlength="2" list="month-options"><input data-part="year" aria-label="Năm" title="Năm" placeholder="NĂM" inputmode="numeric" maxlength="4"><input type="hidden" name="lastVisitFrom"></div></label><label class="field" data-field="lastVisitTo">Chuyến gần nhất - đến ngày <small>Ngày / Tháng / Năm</small><div class="date-fields" data-date="lastVisitTo"><input data-part="day" aria-label="Ngày" title="Ngày" placeholder="NGÀY" inputmode="numeric" maxlength="2" list="day-options"><input data-part="month" aria-label="Tháng" title="Tháng" placeholder="THÁNG" inputmode="numeric" maxlength="2" list="month-options"><input data-part="year" aria-label="Năm" title="Năm" placeholder="NĂM" inputmode="numeric" maxlength="4"><input type="hidden" name="lastVisitTo"></div></label></div>
<div id="insuranceFields" class="grid conditional"><label class="field" data-field="insurancePolicy">Tên công ty / số hợp đồng bảo hiểm<input name="insurancePolicy"></label></div>
</section>
<section class="section"><header><b>07</b><div><h2>Gia đình & nơi nộp hồ sơ</h2><p>Không đánh dấu hai mục đầu nghĩa là Không.</p></div></header>
<div class="checks"><label data-field="childrenUnder16"><input id="children" type="checkbox"><span><strong>Có trẻ em dưới 16 tuổi đi cùng / ghi trong hộ chiếu</strong><small>Дети до 16 лет...</small></span></label><label data-field="relativesInRussia"><input id="relatives" type="checkbox"><span><strong>Có người thân hiện đang ở Nga</strong><small>Родственники на территории России</small></span></label></div>
<div class="grid"><label class="field" data-field="preferredEmbassy">Nơi dự kiến nộp hồ sơ <small>Место подачи заявления</small><select name="preferredEmbassy" required><option value="">-- Chọn nơi nộp hồ sơ --</option><option value="ПОСОЛЬСТВО РФ ВО ВЬЕТНАМЕ" ${selectedEmbassy === "ПОСОЛЬСТВО РФ ВО ВЬЕТНАМЕ" ? "selected" : ""}>Đại sứ quán Nga tại Hà Nội</option><option value="ГЕНКОНСУЛЬСТВО РФ В ДАНАНГЕ" ${selectedEmbassy === "ГЕНКОНСУЛЬСТВО РФ В ДАНАНГЕ" ? "selected" : ""}>Tổng Lãnh sự quán Nga tại Đà Nẵng</option><option value="ГЕНКОНСУЛЬСТВО РФ В ХОШИМИНЕ" ${selectedEmbassy === "ГЕНКОНСУЛЬСТВО РФ В ХОШИМИНЕ" ? "selected" : ""}>Tổng Lãnh sự quán Nga tại TP.HCM</option></select></label><label class="field" data-field="specialNotes">Ghi chú đặc biệt <small>Nếu có trẻ em/người thân tại Nga, ghi rõ thông tin cần người phụ trách biết.</small><textarea name="specialNotes" rows="4"></textarea></label></div>
</section>
<section class="section"><header><b>08</b><div><h2>Thông tin KD-MID</h2><p>Mật khẩu được nạp mặc định theo đợt. Application ID chưa có thì để trống.</p></div></header><div class="grid">
<label class="field" data-field="passwordOverride">Mật khẩu KD-MID<input name="passwordOverride" value="${htmlAttr(serverDefaults.password)}"></label>
<label class="field" data-field="applicationId">Application ID <small>Chưa có thì để trống</small><input name="applicationId" inputmode="numeric"></label>
</div></section>
<section class="confirm"><label><input id="confirmed" type="checkbox"><span><strong>Tôi xác nhận thông tin trên là đúng theo giấy tờ của mình.</strong><small>Người phụ trách sẽ xác minh trước khi dùng dữ liệu này để làm hồ sơ Visa.</small></span></label><small id="draftStatus" class="draft-status" role="status" aria-live="polite">Bản nháp sẽ tự lưu trên thiết bị này.</small><button id="submit" type="submit" disabled>Hoàn thành & gửi hồ sơ</button></section>
</form>
<section id="success" class="success"><span id="successState">ĐÃ GỬI HỒ SƠ</span><h2 id="successName"></h2><p id="successMessage">Hồ sơ đã vào hàng chờ xác minh.</p><strong id="queue"></strong><div class="result-box"><strong>Nhận kết quả</strong><p id="resultMessage">Sau khi hồ sơ được tiếp nhận, PDF kết quả sẽ xuất hiện tại đây.</p><a id="resultDownload" href="#">Tải PDF kết quả</a></div><button id="refreshWaiting" type="button">↻ Cập nhật trạng thái</button></section>
</main>
<script>
(() => {
  const params = new URLSearchParams(location.search);
  const token = params.get("token") || "";
  const batchId = params.get("batch") || "";
  const accessKey = batchId ? "batch:"+batchId : "token:"+token;
  const apiAccess = () => batchId ? "batch="+encodeURIComponent(batchId) : "token="+encodeURIComponent(token);
  const form = document.getElementById("form");
  const error = document.getElementById("error");
  const batch = document.getElementById("batch");
  const confirmed = document.getElementById("confirmed");
  const submit = document.getElementById("submit");
  const byName = name => form.elements.namedItem(name);
  const russianTranslations = {
    "Гражданство":"Quốc tịch","Цель поездки (раздел)":"Nhóm mục đích chuyến đi","Цель поездки":"Mục đích chuyến đi",
    "Категория и вид визы":"Loại / hạng visa","Кратность визы":"Số lần nhập cảnh","Дата въезда в Россию":"Ngày nhập cảnh vào Nga",
    "Дата выезда из России":"Ngày rời Nga","В какое учреждение направляетесь?":"Bạn đến cơ quan / đơn vị nào?","Наименование организации":"Tên tổ chức",
    "Адрес":"Địa chỉ","ИНН организации":"Mã số thuế INN của tổ chức","Номер указания (телекса)":"Số chỉ thị / mã Telex",
    "Номер приглашения":"Số giấy mời","Фамилия":"Họ","Имя, другие имена, отчество":"Tên, tên khác và tên đệm",
    "Дата рождения":"Ngày sinh","Место рождения":"Nơi sinh","Пол":"Giới tính","Вы родились в России?":"Bạn có sinh tại Nga không?",
    "Маршрут":"Nơi / thành phố đến tại Nga","Номер паспорта":"Số hộ chiếu","Дата выдачи":"Ngày cấp hộ chiếu","Действителен до":"Hộ chiếu có giá trị đến",
    "Имеете ли Вы адрес постоянного проживания?":"Bạn có địa chỉ thường trú không?","Адрес вашего постоянного проживания":"Địa chỉ thường trú",
    "Ваш личный телефон":"Điện thoại cá nhân","Ваш личный факс":"Fax cá nhân","Ваш личный E-mail":"Email cá nhân",
    "Вы работаете (работали ранее), учитесь (учились ранее)?":"Bạn đang / đã làm việc hoặc học tập?","Место работы (учебы)":"Nơi làm việc / học tập",
    "Должность":"Chức vụ / tư cách","Рабочий адрес":"Địa chỉ cơ quan","Рабочий телефон":"Điện thoại cơ quan","Рабочий факс":"Fax cơ quan",
    "Рабочий E-mail":"Email cơ quan","Место подачи заявления":"Nơi nộp hồ sơ","Были ли Вы когда-нибудь в России?":"Bạn đã từng đến Nga chưa?",
    "Документ о медицинском страховании":"Giấy tờ / hợp đồng bảo hiểm y tế","Родственники на территории России":"Người thân đang ở trên lãnh thổ Nga"
  };
  document.querySelectorAll(".field small,.checks small").forEach(el => {
    const raw=String(el.textContent || "").split("·")[0].trim();
    const translated=russianTranslations[raw] || (/[А-Яа-яЁё]/.test(raw) ? "Nội dung tiếng Nga trên mẫu KD-MID" : "");
    if(translated) el.setAttribute("title", translated);
  });
  const storageKey = "visa-intake:draft:"+accessKey;
  const deviceStorageKey = "visa-intake:device-id:v1";
  let deviceId = "";
  try {
    deviceId = localStorage.getItem(deviceStorageKey) || "";
    if(!/^[A-Za-z0-9_-]{20,120}$/.test(deviceId)){ deviceId=crypto.randomUUID(); localStorage.setItem(deviceStorageKey,deviceId); }
  } catch { deviceId=crypto.randomUUID(); }
  let linkClosed = false;
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(storageKey) || "null"); } catch {}
  let receipt = saved?.receipt || null;
  let currentApplicant = saved?.applicant || null;
  let formType = "student";
  const STUDENT_FORM_DEFAULTS = {
    password:"qllhs2025",
    citizenship:"ВЬЕТНАМ",
    purposeSection:"УЧЕБА",
    purpose:"УЧЕБА",
    visaType:"ОБЫКНОВЕННАЯ УЧЕБНАЯ",
    entries:"ОДНОКРАТНАЯ",
    entryDate:"05/10/2026",
    exitDate:"31/12/2026",
    destinationType:"ОРГАНИЗАЦИЯ",
    organization:"МИН-ВО НАУКИ И ВЫСШЕГО ОБРАЗОВАНИЯ РФ (МИНОБРНАУКИ РОССИИ)",
    organizationAddress:"125993, МОСКВА, УЛ. ТВЕРСКАЯ, Д.11, СТР.1, 4",
    tin:"7707740714",
    telex:"321422",
    invitation:"",
    routeCity:"МОСКВА",
    employer:"ГОСУДАРСТВЕННЫЙ ТЕХНИЧЕСКИЙ УНИВЕРСИТЕТ ИМЕНИ ЛЕ КУИ ДОНА",
    position:"СТУДЕНТ",
    workAddress:"ВЬЕТНАМ, Г. ХАНОЙ, УЛИЦА НГИА ДО, ДОРОГА ХОАНГ КУОК ВЬЕТ",
    workPhone:"+842437555706",
    workEmail:"lequydonqllhs@gmail.com",
    permanentAddress:"ВЬЕТНАМ, Г. ХАНОЙ, УЛИЦА НГИА ДО, ДОРОГА ХОАНГ КУОК ВЬЕТ, ДОМ Ш9",
    preferredEmbassy:"ПОСОЛЬСТВО РФ ВО ВЬЕТНАМЕ"
  };
  const withStudentFallbacks = raw => {
    const merged={...(raw || {})};
    for(const [key,value] of Object.entries(STUDENT_FORM_DEFAULTS)){
      if(!String(merged[key] ?? "").trim() && String(value ?? "").trim()) merged[key]=value;
    }
    return merged;
  };

  let lastStatus = receipt?.status || "";
  const draftStatus=document.getElementById("draftStatus");
  const writeDraft = (storage,key,payload) => {
    try { storage.setItem(key,JSON.stringify(payload)); return {ok:true,error:""}; }
    catch (cause) { return {ok:false,error:cause instanceof Error ? cause.message : String(cause || "storage-error")}; }
  };
  const setDraftStatus = (message,state="ok") => {
    if(!draftStatus) return;
    draftStatus.textContent=message;
    draftStatus.dataset.state=state;
  };
  const saveLocal = (applicant=currentApplicant) => {
    currentApplicant = applicant || currentApplicant;
    const result=writeDraft(localStorage,storageKey,{ applicant: currentApplicant, receipt });
    if(result.ok) setDraftStatus("✓ Bản nháp đã lưu trên thiết bị này.","ok");
    else setDraftStatus("⚠ Không lưu được bản nháp trên thiết bị. Bạn vẫn có thể gửi hồ sơ; không đóng trang trước khi gửi.","error");
    return result.ok;
  };
  const upperPlain = value => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[đĐ]/g, letter => letter === "đ" ? "d" : "D").toUpperCase();
  const personalUpperPlainNames = ["surname","givenNames","birthPlace","otherNames","routeCity"];
  const normalizePersonalApplicant = applicant => {
    const normalized={...(applicant || {})};
    personalUpperPlainNames.forEach(name=>{normalized[name]=upperPlain(normalized[name] || "");});
    return normalized;
  };
  const normalizeTwoDigits = (value,max) => {
    if (!value) return "";
    const number=Number(value);
    return Number.isInteger(number) && number >= 1 && number <= max ? String(number).padStart(2,"0") : value;
  };
  document.querySelectorAll("[data-date]").forEach(widget => {
    const key=widget.dataset.date, day=widget.querySelector('[data-part="day"]'), month=widget.querySelector('[data-part="month"]'), year=widget.querySelector('[data-part="year"]'), hidden=byName(key);
    const clean=(input,length)=>String(input || "").replace(/\D/g,"").slice(0,length);
    const sync=()=>{ hidden.value=(day.value || month.value || year.value) ? day.value+"/"+month.value+"/"+year.value : ""; };
    day.addEventListener("input",()=>{ day.value=clean(day.value,2); sync(); });
    month.addEventListener("input",()=>{ month.value=clean(month.value,2); sync(); });
    year.addEventListener("input",()=>{ year.value=clean(year.value,4); sync(); });
    day.addEventListener("blur",()=>{ day.value=normalizeTwoDigits(day.value,31); sync(); });
    month.addEventListener("blur",()=>{ month.value=normalizeTwoDigits(month.value,12); sync(); });
    sync();
  });
  const emailNames = ["email","workEmail"];
  const plainNames = ["citizenship","purposeSection","purpose","visaType","entries","destinationType","organization","organizationAddress","passportNo","personalAddress","workStudyPlace","position","workAddress","formerCitizenshipLossReason","insurancePolicy","specialNotes"];
  const normalizePlainElement = el => {
    if(!el || typeof el.value !== "string") return;
    const normalized=upperPlain(el.value);
    if(el.value!==normalized) el.value=normalized;
  };
  emailNames.forEach(name => { const el=byName(name); if(el) ["input","change","blur"].forEach(type=>el.addEventListener(type,()=>{el.value=el.value.toLowerCase();})); });
  plainNames.forEach(name => { const el=byName(name); if(el) ["input","change","blur","compositionend"].forEach(type=>el.addEventListener(type,()=>normalizePlainElement(el))); });
  const normalizeMarkedElement = element => {
    if(!element || element.dataset?.normalize!=="upper-plain") return false;
    normalizePlainElement(element);
    return true;
  };
  const normalizeMarkedEvent = event => {
    if(event.type==="input" && event.isComposing) return;
    normalizeMarkedElement(event.target);
  };
  ["input","change","blur","compositionend"].forEach(type=>form.addEventListener(type,normalizeMarkedEvent,true));
  const normalizeMarkedInputs = () => {
    form.querySelectorAll('[data-normalize="upper-plain"]').forEach(normalizeMarkedElement);
  };
  const fillDate = (key,value) => {
    const widget=document.querySelector('[data-date="'+key+'"]');
    if(!widget) return;
    const parts=String(value || "").split("/");
    const day=widget.querySelector('[data-part="day"]'), month=widget.querySelector('[data-part="month"]'), year=widget.querySelector('[data-part="year"]');
    day.value=parts[0] || ""; month.value=parts[1] || ""; year.value=parts[2] || "";
    const hidden=byName(key); if(hidden) hidden.value=value || "";
  };
  const passportExpiryFromIssue = value => {
    const match=String(value || "").match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    return match ? match[1]+"/"+match[2]+"/"+(Number(match[3])+10) : "";
  };
  let passportExpiryManuallyEdited = false;
  let lastAutoPassportExpiry = "";
  const syncPassportExpiry = () => {
    if (passportExpiryManuallyEdited) return;
    const next=passportExpiryFromIssue(String(byName("passportIssue")?.value || ""));
    lastAutoPassportExpiry=next;
    fillDate("passportExpiry",next);
  };
  const issueWidget=document.querySelector('[data-date="passportIssue"]');
  const expiryWidget=document.querySelector('[data-date="passportExpiry"]');
  issueWidget?.querySelectorAll("input[data-part]").forEach(input=>{input.addEventListener("input",syncPassportExpiry);input.addEventListener("blur",syncPassportExpiry);});
  expiryWidget?.querySelectorAll("input[data-part]").forEach(input=>input.addEventListener("input",()=>{passportExpiryManuallyEdited=true;}));

  const fillApplicant = applicant => {
    if(!applicant) return;
    applicant=normalizePersonalApplicant(applicant);
    Object.entries(applicant).forEach(([key,value]) => {
      if(["birthDate","entryDate","exitDate","passportIssue","passportExpiry","formerCitizenshipLostDate","lastVisitFrom","lastVisitTo"].includes(key)){ fillDate(key,String(value || "")); return; }
      const el=byName(key);
      if(el && typeof value !== "boolean") el.value=String(value ?? "");
    });
    if(byName("hasOtherNames")) byName("hasOtherNames").value=applicant.hasOtherNames === true ? "ДА" : "НЕТ";
    if(byName("bornInRussia")) byName("bornInRussia").value=applicant.bornInRussia === true ? "ДА" : "НЕТ";
    if(byName("hasPermanentAddress")) byName("hasPermanentAddress").value=applicant.hasPermanentAddress === false ? "НЕТ" : "ДА";
    if(byName("worksOrStudies")) byName("worksOrStudies").value=applicant.worksOrStudies === false ? "НЕТ" : "ДА";
    document.getElementById("former").checked=applicant.hadFormerRussianCitizenship === true;
    document.getElementById("visited").checked=applicant.visitedRussia === true;
    document.getElementById("insurance").checked=applicant.hasInsurance === true;
    document.getElementById("children").checked=applicant.childrenUnder16 === true;
    document.getElementById("relatives").checked=applicant.relativesInRussia === true;
    const providedExpiry=String(applicant.passportExpiry || "");
    const automaticExpiry=passportExpiryFromIssue(String(applicant.passportIssue || ""));
    passportExpiryManuallyEdited=Boolean(providedExpiry && providedExpiry !== automaticExpiry);
    lastAutoPassportExpiry=automaticExpiry;
    if (passportExpiryManuallyEdited) fillDate("passportExpiry",providedExpiry);
    else syncPassportExpiry();
    normalizeMarkedInputs();
  };
  const applyCorrections = fields => {
    const selected=new Set(Array.isArray(fields)?fields:[]);
    document.querySelectorAll("[data-field]").forEach(el => el.dataset.correction=selected.has(el.dataset.field) ? "true" : "false");
  };
  const showReturned = submission => {
    receipt={...receipt,...submission};
    lastStatus=submission.status;
    saveLocal();
    document.getElementById("success").style.display="none";
    form.style.display="block";
    batch.style.display="block";
    returnAlert.style.display="block";
    document.getElementById("returnNote").textContent=submission.reviewNote || "Hãy sửa các ô được đánh dấu đỏ rồi gửi lại.";
    document.getElementById("returnMeta").textContent="Giữ nguyên số tiếp nhận #"+(submission.queueNo ?? "—")+" · "+(submission.correctionFields?.length || 0)+" ô cần sửa.";
    applyCorrections(submission.correctionFields || []);
    document.title="⚠ HỒ SƠ CẦN SỬA · Visa Nga";
    try { navigator.vibrate?.(200); } catch {}
  };
  const showWaiting = submission => {
    receipt={...receipt,...submission}; saveLocal(); applyCorrections([]); returnAlert.style.display="none";
    form.style.display="none"; batch.style.display="none"; error.style.display="none";
    document.getElementById("success").style.display="block";
    document.getElementById("successName").textContent=submission.applicantName || "";
    document.getElementById("queue").textContent="#"+(submission.queueNo ?? "—")+(submission.deviceCode ? " · "+submission.deviceCode : "");
    const accepted=["approved","imported"].includes(submission.status);
    document.getElementById("successState").textContent=accepted ? "ĐÃ TIẾP NHẬN HỒ SƠ" : "ĐÃ GỬI HỒ SƠ";
    document.getElementById("successMessage").textContent=accepted ? "Hồ sơ của bạn đã được người phụ trách xác minh và tiếp nhận." : (submission.revision || 0) > 0 ? "Nội dung đã sửa đã được gửi lại. Hãy chờ người phụ trách xác minh." : "Hồ sơ đã vào hàng chờ xác minh.";
    const resultMessage=document.getElementById("resultMessage"),resultDownload=document.getElementById("resultDownload");
    if(submission.result?.available){resultMessage.textContent="Đã có PDF kết quả: "+submission.result.fileName;resultDownload.href=submission.result.downloadUrl;resultDownload.style.display="inline-flex";document.title="📄 ĐÃ CÓ KẾT QUẢ · Visa Nga";}
    else{resultMessage.textContent=accepted ? "Hồ sơ đã được tiếp nhận. PDF kết quả sẽ xuất hiện tại đây khi người phụ trách gửi." : "Sau khi hồ sơ được tiếp nhận, PDF kết quả sẽ xuất hiện tại đây.";resultDownload.style.display="none";document.title=accepted ? "✓ ĐÃ TIẾP NHẬN HỒ SƠ · Visa Nga" : "Form hồ sơ Visa Nga";}
  };
  const setError = (message, missing=[]) => { error.style.display = message ? "block" : "none"; error.innerHTML = message ? "<strong>"+message+"</strong>"+(missing.length?"<ul>"+missing.map(x=>"<li>"+String(x).replace(/[<>&]/g,"")+"</li>").join("")+"</ul>":"") : ""; };
  const toggle = (checkboxId, fieldsId) => {
    const c = document.getElementById(checkboxId), box = document.getElementById(fieldsId);
    const run = () => { box.style.display = c.checked ? "grid" : "none"; box.querySelectorAll("input").forEach(i => i.required = c.checked); };
    c.addEventListener("change", run); run();
  };
  toggle("former","formerFields"); toggle("visited","visitFields"); toggle("insurance","insuranceFields");
  const syncSelectSection = (name, fieldId, yes="ДА") => {
    const select=byName(name), box=document.getElementById(fieldId);
    const run=()=>{const active=select?.value===yes; if(box) box.style.display=active?"grid":"none"; if(box) box.querySelectorAll("input,select,textarea").forEach(el=>{if(el.name!=="personalFax"&&el.name!=="workFax") el.required=active;});};
    select?.addEventListener("change",run); run();
  };
  syncSelectSection("hasPermanentAddress","personalAddressField");
  syncSelectSection("worksOrStudies","workFields");
  const otherNamesSelect=byName("hasOtherNames"), otherNamesInput=byName("otherNames");
  const syncOtherNamesRequired=()=>{if(otherNamesInput) otherNamesInput.required=otherNamesSelect?.value==="ДА";};
  otherNamesSelect?.addEventListener("change",syncOtherNamesRequired); syncOtherNamesRequired();
  confirmed.addEventListener("change", () => submit.disabled = !confirmed.checked);
  const children = document.getElementById("children"), relatives = document.getElementById("relatives"), notes = byName("specialNotes");
  const syncSpecialNotes = () => { if (notes) notes.required = children.checked || relatives.checked; };
  children.addEventListener("change", syncSpecialNotes); relatives.addEventListener("change", syncSpecialNotes); syncSpecialNotes();
  if(currentApplicant) { fillApplicant(currentApplicant); document.getElementById("former").dispatchEvent(new Event("change")); document.getElementById("visited").dispatchEvent(new Event("change")); document.getElementById("insurance").dispatchEvent(new Event("change")); syncSpecialNotes(); }

  const statusUrl = () => "/api/kd-mid-visa-intake/public?"+apiAccess()+(receipt?.id ? "&submissionId="+encodeURIComponent(receipt.id) : "")+"&deviceId="+encodeURIComponent(deviceId);
  const refreshButtons=[document.getElementById("refreshWaiting"),document.getElementById("refreshReturned")].filter(Boolean);
  const checkStatus = async (manual=false) => {
    if(!receipt?.id || linkClosed) return;
    if(manual) refreshButtons.forEach(button=>{button.disabled=true;button.textContent="↻ Đang cập nhật…";});
    try {
      const r=await fetch(statusUrl(),{cache:"no-store"}); const data=await r.json();
      if(r.status===410){linkClosed=true;try{localStorage.removeItem(storageKey)}catch{}receipt=null;form.style.display="none";document.getElementById("success").style.display="none";batch.style.display="none";setError(data.error||"Đợt thu hồ sơ đã đóng.");return;}
      if(!r.ok || !data.ok || !data.submission) return;
      if(data.submission.status==="rejected") {
        const becameRejected=lastStatus!=="rejected";
        showReturned(data.submission);
        if(becameRejected) scrollTo({top:0,behavior:"smooth"});
      } else {
        lastStatus=data.submission.status;
        showWaiting(data.submission);
      }
    } catch {}
    finally {
      if(manual) refreshButtons.forEach(button=>{button.disabled=false;button.textContent="↻ Cập nhật trạng thái";});
    }
  };
  refreshButtons.forEach(button=>button.addEventListener("click",()=>void checkStatus(true)));

  fetch("/api/kd-mid-visa-intake/public?"+apiAccess()+(receipt?.id ? "&submissionId="+encodeURIComponent(receipt.id) : "")+"&deviceId="+encodeURIComponent(deviceId), {cache:"no-store"}).then(async r => {
    const data = await r.json();
    if (!r.ok || !data.ok) { if(r.status===410){linkClosed=true;try{localStorage.removeItem(storageKey)}catch{}} throw new Error(data.error || "Link không hợp lệ."); }
    const rawDefaults = data.defaults || {};
    formType = data.link?.formType === "general" || rawDefaults.formType === "general" ? "general" : "student";
    const student = formType === "student";
    const d = student ? withStudentFallbacks(rawDefaults) : rawDefaults;
    batch.innerHTML = "Đợt thu hồ sơ: <strong>"+String(data.link?.label || "").replace(/[<>&]/g,"")+"</strong> · <b>"+(student ? "MẪU NHẬP HỌC" : "NGƯỜI THƯỜNG")+"</b>";
    document.getElementById("formTypeBadge").textContent = student ? "LINK 1 · MẪU NHẬP HỌC" : "LINK 2 · MẪU VISA NGƯỜI THƯỜNG";
    document.getElementById("heroTitle").textContent = student ? "Điền hồ sơ nhập học để chuẩn bị KD-MID" : "Điền hồ sơ visa cá nhân để chuẩn bị KD-MID";
    document.getElementById("heroIntro").textContent = student ? "Các dữ liệu học tập dùng chung đã được điền sẵn trực tiếp trong từng ô. Chỉ sửa ô nào khác với giấy tờ của bạn; hãy kiểm tra Mã Telex trước khi gửi." : "Mẫu tổng quát không tự áp các giá trị visa học tập. Hãy nhập đúng thông tin theo mục đích chuyến đi của bạn.";
    document.getElementById("guideTypeTitle").textContent=student ? "Mẫu nhập học" : "Mẫu người thường";
    document.getElementById("guideTypeText").textContent=student ? "Các trường chung đã nằm sẵn trong ô nhập theo đợt. Bạn chỉ cần kiểm tra; nếu khác giấy tờ thì sửa trực tiếp. Mã Telex bắt buộc." : "Không dùng mặc định học tập. Điền mục đích, loại visa, lịch trình và thông tin thư mời đúng hồ sơ thực tế; Telex có thể để trống nếu không dùng.";
    document.getElementById("prefillNotice").style.display=student ? "block" : "none";
    const telexField=document.getElementById("telexField");
    if(telexField) telexField.childNodes[0].textContent=student ? "Mã Telex " : "Mã Telex / Số chỉ thị ";
    ["organization","organizationAddress","tin","telex"].forEach(name=>{const el=byName(name);if(el) el.required=student;});
    const values = {
      citizenship:upperPlain(d.citizenship || "ВЬЕТНАМ"),
      purposeSection:upperPlain(d.purposeSection || (student ? "УЧЕБА" : "")),
      purpose:upperPlain(d.purpose || (student ? "УЧЕБА" : "")),
      visaType:upperPlain(d.visaType || (student ? "ОБЫКНОВЕННАЯ УЧЕБНАЯ" : "")),
      entries:upperPlain(d.entries || (student ? "ОДНОКРАТНАЯ" : "")),
      destinationType:upperPlain(d.destinationType || (student ? "ОРГАНИЗАЦИЯ" : "")),
      organization:upperPlain(d.organization || ""), organizationAddress:upperPlain(d.organizationAddress || ""),
      tin:String(d.tin || ""), telex:String(d.telex || ""), invitation:String(d.invitation || ""), passwordOverride:String(d.password || ""),
      personalAddress:upperPlain(d.permanentAddress || ""), routeCity:upperPlain(d.routeCity || (student ? "МОСКВА" : "")),
      workStudyPlace:upperPlain(d.employer || ""), position:upperPlain(d.position || ""), workAddress:upperPlain(d.workAddress || ""),
      workPhone:d.workPhone || "", workEmail:String(d.workEmail || "").toLowerCase(), preferredEmbassy:d.preferredEmbassy || ""
    };
    Object.entries(values).forEach(([k,v]) => { const el=byName(k); if(el && !String(el.value || "").trim()) el.value=String(v); });
    if(d.entryDate && !byName("entryDate").value) fillDate("entryDate",String(d.entryDate));
    if(d.exitDate && !byName("exitDate").value) fillDate("exitDate",String(d.exitDate));

    const mergeCommonDefaultsIntoDraft = draft => {
      const merged={...(draft || {})};
      Object.entries(values).forEach(([key,value]) => {
        if(!String(merged[key] ?? "").trim() && String(value ?? "").trim()) merged[key]=String(value);
      });
      if(!String(merged.entryDate || "").trim() && d.entryDate) merged.entryDate=String(d.entryDate);
      if(!String(merged.exitDate || "").trim() && d.exitDate) merged.exitDate=String(d.exitDate);
      return merged;
    };

    if(data.submission?.applicant){
      currentApplicant=normalizePersonalApplicant(student ? mergeCommonDefaultsIntoDraft(data.submission.applicant) : data.submission.applicant);
      fillApplicant(currentApplicant);
      saveLocal(currentApplicant);
    } else if(currentApplicant) {
      currentApplicant=normalizePersonalApplicant(mergeCommonDefaultsIntoDraft(currentApplicant));
      fillApplicant(currentApplicant);
      saveLocal(currentApplicant);
    } else {
      currentApplicant=normalizePersonalApplicant(mergeCommonDefaultsIntoDraft({}));
      fillApplicant(currentApplicant);
      saveLocal(currentApplicant);
    }
    syncPassportExpiry();
    if(data.submission) {
      receipt={...receipt,...data.submission};
      saveLocal(currentApplicant);
      if(data.submission.status==="rejected") showReturned(data.submission); else showWaiting(data.submission);
    }
  }).catch(e => { setError(e.message || "Không thể mở form."); form.style.display="none"; batch.style.display="none"; });

  const value = name => String(byName(name)?.value || "").trim();
  const readApplicant = () => ({
      surname:upperPlain(value("surname")), givenNames:upperPlain(value("givenNames")), birthDate:value("birthDate"),
      birthPlace:upperPlain(value("birthPlace")), sex:value("sex"), hasOtherNames:value("hasOtherNames")==="ДА", otherNames:upperPlain(value("otherNames")),
      bornInRussia:value("bornInRussia")==="ДА", citizenship:upperPlain(value("citizenship")), purposeSection:upperPlain(value("purposeSection")),
      purpose:upperPlain(value("purpose")), visaType:upperPlain(value("visaType")), entries:upperPlain(value("entries")), entryDate:value("entryDate"), exitDate:value("exitDate"),
      destinationType:upperPlain(value("destinationType")), organization:upperPlain(value("organization")), organizationAddress:upperPlain(value("organizationAddress")),
      tin:value("tin"), telex:value("telex"), invitation:value("invitation"), passportNo:upperPlain(value("passportNo")),
      passportIssue:value("passportIssue"), passportExpiry:value("passportExpiry") || passportExpiryFromIssue(value("passportIssue")),
      hasPermanentAddress:value("hasPermanentAddress")!=="НЕТ", personalAddress:upperPlain(value("personalAddress")), phone:value("phone"), personalFax:value("personalFax"), email:value("email").toLowerCase(),
      routeCity:upperPlain(value("routeCity")), worksOrStudies:value("worksOrStudies")!=="НЕТ", workStudyPlace:upperPlain(value("workStudyPlace")), position:upperPlain(value("position")),
      workAddress:upperPlain(value("workAddress")), workPhone:value("workPhone"), workFax:value("workFax"), workEmail:value("workEmail").toLowerCase(),
      preferredEmbassy:value("preferredEmbassy"), passwordOverride:value("passwordOverride"), applicationId:value("applicationId").replace(/\D/g,""),
      hadFormerRussianCitizenship:document.getElementById("former").checked, formerCitizenshipLostDate:value("formerCitizenshipLostDate"),
      formerCitizenshipLossReason:upperPlain(value("formerCitizenshipLossReason")), visitedRussia:document.getElementById("visited").checked,
      visitsCount:value("visitsCount"), lastVisitFrom:value("lastVisitFrom"), lastVisitTo:value("lastVisitTo"),
      hasInsurance:document.getElementById("insurance").checked, insurancePolicy:upperPlain(value("insurancePolicy")),
      childrenUnder16:document.getElementById("children").checked, relativesInRussia:document.getElementById("relatives").checked,
      specialNotes:upperPlain(value("specialNotes"))
    });

  const snapshotCurrentApplicant = () => {
    normalizeMarkedInputs();
    return normalizePersonalApplicant(readApplicant());
  };
  const persistFormDraft = () => saveLocal(snapshotCurrentApplicant());
  form.addEventListener("input",persistFormDraft);
  form.addEventListener("change",persistFormDraft);
  form.addEventListener("blur",persistFormDraft,true);
  form.addEventListener("compositionend",persistFormDraft,true);
  if(receipt?.id) { void checkStatus(); setInterval(()=>void checkStatus(),15000); }

  const fieldLabel = element => {
    const field=element?.closest?.("[data-field]");
    if(!field) return "Trường bắt buộc";
    const clone=field.cloneNode(true);
    clone.querySelectorAll("input,select,textarea,small,.date-fields").forEach(node=>node.remove());
    return String(clone.textContent || "Trường bắt buộc").replace("*","").trim() || "Trường bắt buộc";
  };
  const collectClientInvalid = () => {
    const invalid=Array.from(form.querySelectorAll("input,select,textarea")).filter(el=>el.willValidate && !el.checkValidity());
    return { invalid, labels:[...new Set(invalid.map(fieldLabel))] };
  };

  form.addEventListener("invalid", event => {
    event.preventDefault();
    const target=event.target;
    setError("Trường có dấu * hoặc trường điều kiện này chưa hợp lệ.", [fieldLabel(target)]);
  }, true);

  form.addEventListener("submit", async event => {
    event.preventDefault(); setError("");
    normalizeMarkedInputs();
    const clientValidation=collectClientInvalid();
    if(clientValidation.invalid.length){
      setError("Còn trường bắt buộc chưa điền hoặc chưa hợp lệ.", clientValidation.labels);
      const first=clientValidation.invalid[0];
      first?.focus?.();
      first?.closest?.("[data-field]")?.scrollIntoView?.({behavior:"smooth",block:"center"});
      submit.disabled=!confirmed.checked;
      submit.textContent="Hoàn thành & gửi hồ sơ";
      return;
    }
    submit.disabled=true; submit.textContent="Đang gửi…";
    const applicant = snapshotCurrentApplicant();
    saveLocal(applicant);
    try {
      const r = await fetch("/api/kd-mid-visa-intake/public", {method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({token,batch:batchId,deviceId,applicant,confirmedAccurate:confirmed.checked,submissionId:receipt?.status==="rejected" ? receipt.id : undefined})});
      const data = await r.json();
      if (!r.ok || !data.ok) { setError(data.error || "Chưa thể gửi hồ sơ.", data.missing || []); throw new Error("validation"); }
      receipt={...data.submission,status:data.submission?.status || "pending",correctionFields:data.submission?.correctionFields || []};
      lastStatus=receipt.status;
      saveLocal(applicant);
      showWaiting(receipt);
      scrollTo({top:0,behavior:"smooth"});
    } catch(e) {
      if (e?.message !== "validation") setError("Không thể gửi hồ sơ lúc này. Vui lòng thử lại.");
      submit.disabled=!confirmed.checked; submit.textContent="Hoàn thành & gửi hồ sơ";
    }
  });
})();
</script>
</body></html>`;
  return new Response(html, { status: 200, headers: headers() });
}
