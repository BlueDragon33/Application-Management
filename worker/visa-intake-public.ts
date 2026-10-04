function headers() {
  return {
    "content-type": "text/html; charset=utf-8",
    "cache-control": "no-store",
    "referrer-policy": "no-referrer",
    "x-content-type-options": "nosniff",
    "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
  };
}

export function publicVisaIntakePage() {
  const html = `<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Form hồ sơ Visa Nga</title>
<style>
:root{color-scheme:dark;font-family:Inter,system-ui,sans-serif;background:#07120f;color:#effaf6}*{box-sizing:border-box}body{margin:0;background:#07120f;color:#effaf6}.page{width:min(1080px,calc(100% - 24px));margin:24px auto 64px}.hero,.section,.confirm,.success{border:1px solid #214f42;border-radius:18px;background:#0b211b}.hero{padding:26px;background:linear-gradient(135deg,#0b211b,#0a1714)}.hero span,.section header b{color:#e1d252;font-weight:900;letter-spacing:.1em;font-size:12px}.hero h1{font-size:clamp(28px,5vw,44px);margin:8px 0}.hero p,.section p,.hint{color:#95b7ab}.batch,.error,.return-alert{margin:16px 0;padding:12px 14px;border-radius:10px}.batch{border:1px solid #2b6955;background:#0d2b22}.error{border:1px solid #8f4747;background:#3a1b1b;color:#ffdada;display:none}.return-alert{display:none;border:2px solid #e66d6d;background:#411b1b;color:#ffe0e0;box-shadow:0 0 0 4px rgba(230,109,109,.08)}.return-alert strong{font-size:16px}.return-alert p{margin:6px 0}.return-alert button,.success button{margin-top:12px;border:1px solid #4c7668;border-radius:10px;background:#10261f;color:#effaf6;padding:10px 14px;font:inherit;font-weight:850;cursor:pointer}.return-alert button:disabled,.success button:disabled{opacity:.55;cursor:wait}.field[data-correction="true"],.checks label[data-correction="true"]{border:2px solid #e66d6d!important;background:rgba(230,109,109,.12)!important;border-radius:10px;padding:8px}.field[data-correction="true"] input,.field[data-correction="true"] select,.field[data-correction="true"] textarea{border-color:#e66d6d}.section{margin-top:16px;padding:20px}.section header{display:flex;gap:12px;align-items:flex-start}.section header b{display:grid;place-items:center;width:38px;height:38px;border:1px solid #756c27;border-radius:10px}.section h2{margin:0 0 4px}.section header p{margin:0}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;margin-top:16px}.field{display:grid;gap:5px;font-weight:800;font-size:14px}.field small{font-weight:500;color:#89aa9f}.field input,.field select,.field textarea{width:100%;padding:11px 12px;border:1px solid #2b6354;border-radius:9px;background:#071510;color:#fff;font:inherit}.date-fields{display:grid;grid-template-columns:minmax(72px,.9fr) minmax(82px,1fr) minmax(108px,1.25fr);gap:8px}.date-fields input{text-align:center;min-width:0;padding-left:8px;padding-right:8px}.date-fields input::placeholder{font-size:12px;color:#6f9186}.field input[readonly]{color:#b8d0c7;background:#10251f}.checks{display:grid;gap:10px;margin-top:16px}.checks label,.confirm label{display:flex;gap:10px;padding:12px;border:1px solid #2a5648;border-radius:10px;background:#0a1c17}.checks input,.confirm input{width:18px;height:18px;margin-top:2px}.checks span,.confirm span{display:grid;gap:3px}.checks small,.confirm small{color:#89aa9f}.conditional{display:none}.confirm{margin-top:16px;padding:18px}.confirm button{width:100%;min-height:52px;margin-top:14px;border:0;border-radius:11px;background:#e1d252;color:#15130a;font-weight:950;font-size:16px}.confirm button:disabled{opacity:.5}.success{margin-top:28px;padding:32px;text-align:center;display:none}.success>strong{display:block;color:#e1d252;font-size:36px;margin-top:10px}.result-box{margin:18px auto 0;max-width:560px;padding:16px;border:1px solid #2d6b57;border-radius:14px;background:#071510}.result-box strong{display:block;font-size:17px}.result-box p{color:#9fc0b5;margin:7px 0 12px}.result-box a{display:none;text-decoration:none;border-radius:10px;background:#e1d252;color:#15130a;padding:10px 14px;font-weight:950}@media(max-width:720px){.grid{grid-template-columns:1fr}.page{width:min(100% - 16px,1080px);margin-top:8px}.hero,.section{padding:16px}.date-fields{grid-template-columns:minmax(64px,.85fr) minmax(74px,1fr) minmax(92px,1.2fr);gap:6px}}
</style>
</head>
<body>
<main class="page">
<section class="hero"><span>FORM THU THẬP HỒ SƠ VISA NGA</span><h1>Điền thông tin để chuẩn bị hồ sơ KD-MID</h1><p>Hướng dẫn bằng tiếng Việt. Hãy nhập đúng theo hộ chiếu và kiểm tra kỹ trước khi gửi.</p></section>
<div id="batch" class="batch">Đang kiểm tra link thu hồ sơ…</div>
<div id="error" class="error"></div>
<div id="returnAlert" class="return-alert"><strong>⚠ HỒ SƠ BỊ TRẢ VỀ · CẦN SỬA</strong><p id="returnNote"></p><small id="returnMeta"></small><button id="refreshReturned" type="button">↻ Cập nhật trạng thái</button></div>
<form id="form">
<datalist id="day-options"><option value="01"></option><option value="02"></option><option value="03"></option><option value="04"></option><option value="05"></option><option value="06"></option><option value="07"></option><option value="08"></option><option value="09"></option><option value="10"></option><option value="11"></option><option value="12"></option><option value="13"></option><option value="14"></option><option value="15"></option><option value="16"></option><option value="17"></option><option value="18"></option><option value="19"></option><option value="20"></option><option value="21"></option><option value="22"></option><option value="23"></option><option value="24"></option><option value="25"></option><option value="26"></option><option value="27"></option><option value="28"></option><option value="29"></option><option value="30"></option><option value="31"></option></datalist>
<datalist id="month-options"><option value="01"></option><option value="02"></option><option value="03"></option><option value="04"></option><option value="05"></option><option value="06"></option><option value="07"></option><option value="08"></option><option value="09"></option><option value="10"></option><option value="11"></option><option value="12"></option></datalist>
<section class="section"><header><b>01</b><div><h2>Thông tin cá nhân</h2><p>Họ và tên nhập chữ Latin không dấu, đúng thứ tự trên hộ chiếu.</p></div></header><div class="grid">
<label class="field" data-field="surname">Họ <small>Фамилия</small><input name="surname" required></label>
<label class="field" data-field="givenNames">Tên và tên đệm <small>Имя, другие имена, отчество</small><input name="givenNames" required></label>
<label class="field" data-field="birthDate">Ngày sinh <small>Дата рождения · Ngày / Tháng / Năm</small><div class="date-fields" data-date="birthDate"><input data-part="day" aria-label="Ngày" title="Ngày" placeholder="NGÀY" inputmode="numeric" maxlength="2" list="day-options" required><input data-part="month" aria-label="Tháng" title="Tháng" placeholder="THÁNG" inputmode="numeric" maxlength="2" list="month-options" required><input data-part="year" aria-label="Năm" title="Năm" placeholder="NĂM" inputmode="numeric" maxlength="4" required><input type="hidden" name="birthDate"></div></label>
<label class="field" data-field="birthPlace">Nơi sinh <small>Место рождения</small><input name="birthPlace" required></label>
<label class="field" data-field="sex">Giới tính <small>Пол</small><select name="sex"><option value="МУЖСКОЙ">Nam</option><option value="ЖЕНСКИЙ">Nữ</option></select></label>
<label class="field" data-field="routeCity">Nơi đến tại Nga <small>Маршрут</small><input name="routeCity" value="МОСКВА" required></label>
</div></section>
<section class="section"><header><b>02</b><div><h2>Hộ chiếu</h2><p>Mỗi ngày dùng 3 ô Ngày · Tháng · Năm để tránh nhập sai. Ngày cấp không được ở tương lai; ngày hết hạn phải sau ngày cấp và hộ chiếu phải còn hạn.</p></div></header><div class="grid">
<label class="field" data-field="passportNo">Số hộ chiếu <small>Номер паспорта</small><input name="passportNo" required></label>
<label class="field" data-field="passportIssue">Ngày cấp hộ chiếu <small>Дата выдачи</small><div class="date-fields" data-date="passportIssue"><input data-part="day" aria-label="Ngày" title="Ngày" placeholder="NGÀY" inputmode="numeric" maxlength="2" list="day-options" required><input data-part="month" aria-label="Tháng" title="Tháng" placeholder="THÁNG" inputmode="numeric" maxlength="2" list="month-options" required><input data-part="year" aria-label="Năm" title="Năm" placeholder="NĂM" inputmode="numeric" maxlength="4" required><input type="hidden" name="passportIssue"></div></label>
<label class="field" data-field="passportExpiry">Ngày hết hạn hộ chiếu <small>Действителен до</small><div class="date-fields" data-date="passportExpiry"><input data-part="day" aria-label="Ngày" title="Ngày" placeholder="NGÀY" inputmode="numeric" maxlength="2" list="day-options" required><input data-part="month" aria-label="Tháng" title="Tháng" placeholder="THÁNG" inputmode="numeric" maxlength="2" list="month-options" required><input data-part="year" aria-label="Năm" title="Năm" placeholder="NĂM" inputmode="numeric" maxlength="4" required><input type="hidden" name="passportExpiry"></div></label>
</div></section>
<section class="section"><header><b>03</b><div><h2>Liên hệ & địa chỉ</h2><p>Không cần nhập Fax.</p></div></header><div class="grid">
<label class="field">Địa chỉ thường trú dùng cho đợt hồ sơ <small>Адрес вашего постоянного проживания</small><input id="permanentAddress" readonly></label>
<label class="field" data-field="phone">Điện thoại cá nhân <small>Ваш личный телефон</small><input name="phone" required></label>
<label class="field" data-field="email">Email cá nhân <small>Ваш личный E-mail</small><input name="email" type="email" required></label>
</div></section>
<section class="section"><header><b>04</b><div><h2>Nơi làm việc / học tập</h2><p>Form tự nạp dữ liệu mặc định của đợt hồ sơ. Chỉ sửa nếu thông tin của bạn khác.</p></div></header><div class="grid">
<label class="field" data-field="workStudyPlace">Nơi làm việc / học tập <small>Место работы (учебы)</small><input name="workStudyPlace" required></label>
<label class="field" data-field="position">Chức vụ / tư cách <small>Должность</small><input name="position" required></label>
<label class="field" data-field="workAddress">Địa chỉ cơ quan <small>Рабочий адрес</small><input name="workAddress" required></label>
<label class="field" data-field="workPhone">Điện thoại cơ quan <small>Рабочий телефон</small><input name="workPhone" required></label>
<label class="field" data-field="workEmail">Email cơ quan <small>Рабочий E-mail</small><input name="workEmail" type="email" required></label>
</div></section>
<section class="section"><header><b>05</b><div><h2>Lịch sử liên quan đến Nga</h2><p>Chọn Có chỉ khi đúng với bạn.</p></div></header>
<div class="checks">
<label data-field="hadFormerRussianCitizenship"><input id="former" type="checkbox"><span><strong>Đã từng có quốc tịch Liên Xô hoặc Nga</strong><small>Если Вы имели гражданство СССР или России</small></span></label>
<label data-field="visitedRussia"><input id="visited" type="checkbox"><span><strong>Đã từng đến Nga</strong><small>Были ли Вы когда-нибудь в России?</small></span></label>
<label data-field="hasInsurance"><input id="insurance" type="checkbox"><span><strong>Có bảo hiểm có hiệu lực tại Nga</strong><small>Документ о медицинском страховании</small></span></label>
</div>
<div id="formerFields" class="grid conditional"><label class="field" data-field="formerCitizenshipLostDate">Ngày mất quốc tịch <small>Ngày / Tháng / Năm</small><div class="date-fields" data-date="formerCitizenshipLostDate"><input data-part="day" aria-label="Ngày" title="Ngày" placeholder="NGÀY" inputmode="numeric" maxlength="2" list="day-options"><input data-part="month" aria-label="Tháng" title="Tháng" placeholder="THÁNG" inputmode="numeric" maxlength="2" list="month-options"><input data-part="year" aria-label="Năm" title="Năm" placeholder="NĂM" inputmode="numeric" maxlength="4"><input type="hidden" name="formerCitizenshipLostDate"></div></label><label class="field" data-field="formerCitizenshipLossReason">Lý do mất quốc tịch<input name="formerCitizenshipLossReason"></label></div>
<div id="visitFields" class="grid conditional"><label class="field" data-field="visitsCount">Số lần đã đến Nga<input name="visitsCount"></label><label class="field" data-field="lastVisitFrom">Chuyến gần nhất - từ ngày <small>Ngày / Tháng / Năm</small><div class="date-fields" data-date="lastVisitFrom"><input data-part="day" aria-label="Ngày" title="Ngày" placeholder="NGÀY" inputmode="numeric" maxlength="2" list="day-options"><input data-part="month" aria-label="Tháng" title="Tháng" placeholder="THÁNG" inputmode="numeric" maxlength="2" list="month-options"><input data-part="year" aria-label="Năm" title="Năm" placeholder="NĂM" inputmode="numeric" maxlength="4"><input type="hidden" name="lastVisitFrom"></div></label><label class="field" data-field="lastVisitTo">Chuyến gần nhất - đến ngày <small>Ngày / Tháng / Năm</small><div class="date-fields" data-date="lastVisitTo"><input data-part="day" aria-label="Ngày" title="Ngày" placeholder="NGÀY" inputmode="numeric" maxlength="2" list="day-options"><input data-part="month" aria-label="Tháng" title="Tháng" placeholder="THÁNG" inputmode="numeric" maxlength="2" list="month-options"><input data-part="year" aria-label="Năm" title="Năm" placeholder="NĂM" inputmode="numeric" maxlength="4"><input type="hidden" name="lastVisitTo"></div></label></div>
<div id="insuranceFields" class="grid conditional"><label class="field" data-field="insurancePolicy">Tên công ty / số hợp đồng bảo hiểm<input name="insurancePolicy"></label></div>
</section>
<section class="section"><header><b>06</b><div><h2>Gia đình & nơi nộp hồ sơ</h2><p>Không đánh dấu hai mục đầu nghĩa là Không.</p></div></header>
<div class="checks"><label data-field="childrenUnder16"><input id="children" type="checkbox"><span><strong>Có trẻ em dưới 16 tuổi đi cùng / ghi trong hộ chiếu</strong><small>Дети до 16 лет...</small></span></label><label data-field="relativesInRussia"><input id="relatives" type="checkbox"><span><strong>Có người thân hiện đang ở Nga</strong><small>Родственники на территории России</small></span></label></div>
<div class="grid"><label class="field" data-field="preferredEmbassy">Nơi dự kiến nộp hồ sơ <small>Место подачи заявления</small><select name="preferredEmbassy"><option value="ПОСОЛЬСТВО РФ ВО ВЬЕТНАМЕ">Đại sứ quán Nga tại Hà Nội</option><option value="ГЕНКОНСУЛЬСТВО РФ В ДАНАНГЕ">Tổng Lãnh sự quán Nga tại Đà Nẵng</option><option value="ГЕНКОНСУЛЬСТВО РФ В ХОШИМИНЕ">Tổng Lãnh sự quán Nga tại TP.HCM</option></select></label><label class="field" data-field="specialNotes">Ghi chú đặc biệt <small>Nếu có trẻ em/người thân tại Nga, ghi rõ thông tin cần người phụ trách biết.</small><textarea name="specialNotes" rows="4"></textarea></label></div>
</section>
<section class="confirm"><label><input id="confirmed" type="checkbox"><span><strong>Tôi xác nhận thông tin trên là đúng theo giấy tờ của mình.</strong><small>Người phụ trách sẽ xác minh trước khi dùng dữ liệu này để làm hồ sơ Visa.</small></span></label><button id="submit" type="submit" disabled>Hoàn thành & gửi hồ sơ</button></section>
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
  const storageKey = "visa-intake:draft:"+accessKey;
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(storageKey) || "null"); } catch {}
  let receipt = saved?.receipt || null;
  let currentApplicant = saved?.applicant || null;
  let lastStatus = receipt?.status || "";
  const saveLocal = (applicant=currentApplicant) => {
    currentApplicant = applicant || currentApplicant;
    try { localStorage.setItem(storageKey, JSON.stringify({ applicant: currentApplicant, receipt })); } catch {}
  };
  const upperPlain = value => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[đĐ]/g, letter => letter === "đ" ? "d" : "D").toUpperCase();
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
  const plainNames = ["surname","givenNames","birthPlace","routeCity","passportNo","workStudyPlace","position","workAddress","formerCitizenshipLossReason","insurancePolicy","specialNotes"];
  emailNames.forEach(name => { const el=byName(name); if(el) el.addEventListener("input",()=>{el.value=el.value.toLowerCase();}); });
  plainNames.forEach(name => { const el=byName(name); if(el) el.addEventListener("input",()=>{el.value=upperPlain(el.value);}); });
  const fillDate = (key,value) => {
    const widget=document.querySelector('[data-date="'+key+'"]');
    if(!widget) return;
    const parts=String(value || "").split("/");
    const day=widget.querySelector('[data-part="day"]'), month=widget.querySelector('[data-part="month"]'), year=widget.querySelector('[data-part="year"]');
    day.value=parts[0] || ""; month.value=parts[1] || ""; year.value=parts[2] || "";
    const hidden=byName(key); if(hidden) hidden.value=value || "";
  };
  const fillApplicant = applicant => {
    if(!applicant) return;
    Object.entries(applicant).forEach(([key,value]) => {
      if(["birthDate","passportIssue","passportExpiry","formerCitizenshipLostDate","lastVisitFrom","lastVisitTo"].includes(key)){ fillDate(key,String(value || "")); return; }
      const el=byName(key);
      if(el && typeof value !== "boolean") el.value=String(value ?? "");
    });
    document.getElementById("former").checked=applicant.hadFormerRussianCitizenship === true;
    document.getElementById("visited").checked=applicant.visitedRussia === true;
    document.getElementById("insurance").checked=applicant.hasInsurance === true;
    document.getElementById("children").checked=applicant.childrenUnder16 === true;
    document.getElementById("relatives").checked=applicant.relativesInRussia === true;
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
    document.getElementById("queue").textContent="#"+(submission.queueNo ?? "—");
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
  confirmed.addEventListener("change", () => submit.disabled = !confirmed.checked);
  const children = document.getElementById("children"), relatives = document.getElementById("relatives"), notes = byName("specialNotes");
  const syncSpecialNotes = () => { if (notes) notes.required = children.checked || relatives.checked; };
  children.addEventListener("change", syncSpecialNotes); relatives.addEventListener("change", syncSpecialNotes); syncSpecialNotes();
  if(currentApplicant) { fillApplicant(currentApplicant); document.getElementById("former").dispatchEvent(new Event("change")); document.getElementById("visited").dispatchEvent(new Event("change")); document.getElementById("insurance").dispatchEvent(new Event("change")); syncSpecialNotes(); }

  const statusUrl = () => "/api/kd-mid-visa-intake/public?"+apiAccess()+(receipt?.id ? "&submissionId="+encodeURIComponent(receipt.id) : "");
  const refreshButtons=[document.getElementById("refreshWaiting"),document.getElementById("refreshReturned")].filter(Boolean);
  const checkStatus = async (manual=false) => {
    if(!receipt?.id) return;
    if(manual) refreshButtons.forEach(button=>{button.disabled=true;button.textContent="↻ Đang cập nhật…";});
    try {
      const r=await fetch(statusUrl(),{cache:"no-store"}); const data=await r.json();
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

  fetch("/api/kd-mid-visa-intake/public?"+apiAccess()+(receipt?.id ? "&submissionId="+encodeURIComponent(receipt.id) : ""), {cache:"no-store"}).then(async r => {
    const data = await r.json();
    if (!r.ok || !data.ok) throw new Error(data.error || "Link không hợp lệ.");
    batch.innerHTML = "Đợt thu hồ sơ: <strong>"+String(data.link?.label || "").replace(/[<>&]/g,"")+"</strong>";
    const d = data.defaults || {};
    const values = {
      routeCity:upperPlain(d.routeCity || "МОСКВА"), workStudyPlace:upperPlain(d.employer || ""), position:upperPlain(d.position || ""),
      workAddress:upperPlain(d.workAddress || ""), workPhone:d.workPhone || "", workEmail:String(d.workEmail || "").toLowerCase(),
      preferredEmbassy:d.preferredEmbassy || "ПОСОЛЬСТВО РФ ВО ВЬЕТНАМЕ"
    };
    Object.entries(values).forEach(([k,v]) => { const el=byName(k); if(el && !String(el.value || "").trim()) el.value=String(v); });
    document.getElementById("permanentAddress").value = upperPlain(d.permanentAddress || "");
    if(currentApplicant) fillApplicant(currentApplicant);
    if(data.submission) {
      receipt={...receipt,...data.submission};
      if(data.submission.status==="rejected") showReturned(data.submission); else showWaiting(data.submission);
    }
  }).catch(e => { setError(e.message || "Không thể mở form."); form.style.display="none"; batch.style.display="none"; });

  const value = name => String(byName(name)?.value || "").trim();
  const readApplicant = () => ({
      surname:upperPlain(value("surname")), givenNames:upperPlain(value("givenNames")), birthDate:value("birthDate"),
      birthPlace:upperPlain(value("birthPlace")), sex:value("sex"), passportNo:upperPlain(value("passportNo")),
      passportIssue:value("passportIssue"), passportExpiry:value("passportExpiry"), phone:value("phone"), email:value("email").toLowerCase(),
      routeCity:upperPlain(value("routeCity")), workStudyPlace:upperPlain(value("workStudyPlace")), position:upperPlain(value("position")),
      workAddress:upperPlain(value("workAddress")), workPhone:value("workPhone"), workEmail:value("workEmail").toLowerCase(),
      preferredEmbassy:value("preferredEmbassy"), hadFormerRussianCitizenship:document.getElementById("former").checked,
      formerCitizenshipLostDate:value("formerCitizenshipLostDate"), formerCitizenshipLossReason:upperPlain(value("formerCitizenshipLossReason")),
      visitedRussia:document.getElementById("visited").checked, visitsCount:value("visitsCount"), lastVisitFrom:value("lastVisitFrom"),
      lastVisitTo:value("lastVisitTo"), hasInsurance:document.getElementById("insurance").checked,
      insurancePolicy:upperPlain(value("insurancePolicy")), childrenUnder16:document.getElementById("children").checked,
      relativesInRussia:document.getElementById("relatives").checked, specialNotes:upperPlain(value("specialNotes"))
    });

  form.addEventListener("input",()=>saveLocal(readApplicant()));
  form.addEventListener("change",()=>saveLocal(readApplicant()));
  if(receipt?.id) { void checkStatus(); setInterval(()=>void checkStatus(),15000); }

  form.addEventListener("submit", async event => {
    event.preventDefault(); setError(""); submit.disabled=true; submit.textContent="Đang gửi…";
    const applicant = readApplicant();
    saveLocal(applicant);
    try {
      const r = await fetch("/api/kd-mid-visa-intake/public", {method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({token,batch:batchId,applicant,confirmedAccurate:confirmed.checked,submissionId:receipt?.status==="rejected" ? receipt.id : undefined})});
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
