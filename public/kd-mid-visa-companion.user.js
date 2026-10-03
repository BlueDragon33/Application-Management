// ==UserScript==
// @name         KD-MID Visa VN Companion
// @namespace    application-management
// @version      0.6.0
// @description  Tự động điền hồ sơ chính thức trên visa.kdmid.ru, dừng CAPTCHA để người dùng nhập, sau đó tự tiếp tục đến PDF A4.
// @match        https://visa.kdmid.ru/*
// @run-at       document-idle
// @updateURL    https://application-management.boiech-ai.workers.dev/kd-mid-visa-companion.user.js
// @downloadURL  https://application-management.boiech-ai.workers.dev/kd-mid-visa-companion.user.js
// @grant        none
// ==/UserScript==

(() => {
  "use strict";

  const DATA_KEY = "kd-mid-visa-vn:payload:v4";
  const CLICK_KEY = "kd-mid-visa-vn:auto-click:v4";
  const PRINT_KEY = "kd-mid-visa-vn:auto-print:v4";
  const ID_KEY = "kd-mid-visa-vn:application-id:v4";
  const HASH_PREFIX = "#kdmid-bridge=";
  const RETRY_MS = 450;
  const RETRY_LIMIT = 80;

  const norm = (v) => String(v || "").replace(/\s+/g, " ").trim().toUpperCase();
  const controls = (root = document) => [...root.querySelectorAll("input,select,textarea")];
  const fire = (el) => {
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  };

  function nonceFromHash() {
    if (!location.hash.startsWith(HASH_PREFIX)) return "";
    try { return decodeURIComponent(location.hash.slice(HASH_PREFIX.length)).trim(); }
    catch { return ""; }
  }

  function readPayload() {
    try {
      const raw = localStorage.getItem(DATA_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }

  function savePayload(payload) {
    localStorage.setItem(DATA_KEY, JSON.stringify(payload));
  }

  function labelBlock(labels) {
    const needles = (Array.isArray(labels) ? labels : [labels]).map(norm).filter(Boolean);
    const nodes = [...document.querySelectorAll("label,td,th,div,span,p,b,strong")];
    for (const node of nodes) {
      const text = norm(node.textContent);
      if (!needles.some((needle) => text.includes(needle))) continue;
      let current = node;
      for (let depth = 0; depth < 7 && current; depth += 1, current = current.parentElement) {
        if (controls(current).length) return current;
      }
    }
    return null;
  }

  function blockControls(labels) {
    const block = labelBlock(labels);
    return block ? controls(block) : [];
  }

  function setText(labels, value) {
    if (value == null || value === "") return false;
    const el = blockControls(labels).find((item) =>
      item.tagName !== "SELECT" &&
      item.type !== "hidden" &&
      item.type !== "button" &&
      item.type !== "submit" &&
      item.type !== "checkbox" &&
      item.type !== "radio" &&
      item.type !== "password"
    );
    if (!el) return false;
    if (String(el.value) !== String(value)) {
      el.value = value;
      fire(el);
    }
    return true;
  }

  function setSelect(labels, values) {
    const el = blockControls(labels).find((item) => item.tagName === "SELECT");
    if (!el) return false;
    const wants = (Array.isArray(values) ? values : [values]).map(norm);
    const option = [...el.options].find((o) => wants.includes(norm(o.textContent))) ||
      [...el.options].find((o) => wants.some((want) => want && norm(o.textContent).includes(want)));
    if (!option) return false;
    if (el.value !== option.value) {
      el.value = option.value;
      fire(el);
    }
    return true;
  }

  function setYesNo(labels, value) {
    return setSelect(labels, value ? ["ДА","YES"] : ["НЕТ","NO"]);
  }

  function setCheckbox(labels, value = true) {
    const el = blockControls(labels).find((item) => item.type === "checkbox");
    if (!el) return false;
    if (Boolean(el.checked) !== Boolean(value)) el.click();
    if (Boolean(el.checked) !== Boolean(value)) {
      el.checked = Boolean(value);
      fire(el);
    }
    return Boolean(el.checked) === Boolean(value);
  }

  function setDate(labels, value) {
    if (!value) return false;
    const parts = value.split("/");
    if (parts.length !== 3) return false;
    const list = blockControls(labels).filter((item) => item.type !== "hidden");
    if (list.length < 3) return false;
    parts.forEach((part, index) => {
      const el = list[index];
      if (!el) return;
      if (el.tagName === "SELECT") {
        const option = [...el.options].find((o) => norm(o.textContent) === norm(part) || String(o.value) === String(part));
        if (option && el.value !== option.value) {
          el.value = option.value;
          fire(el);
        }
      } else if (String(el.value) !== String(part)) {
        el.value = part;
        fire(el);
      }
    });
    return true;
  }

  function fillPassword(payload) {
    const password = payload?.applicant?.password || payload?.password;
    if (!password) return 0;
    const inputs = [...document.querySelectorAll('input[type="password"]')];
    let recognized = 0;
    inputs.forEach((el) => {
      recognized += 1;
      if (el.value !== password) {
        el.value = password;
        fire(el);
      }
    });
    return recognized;
  }

  function fillPage(payload) {
    const A = payload.applicant || {};
    let recognized = 0;
    const mark = (ok) => { if (ok) recognized += 1; };

    // Trang 1: Việt Nam + Russian + đã đọc.
    mark(setSelect(["Страна","Country"], ["ВЬЕТНАМ","VIETNAM"]));
    mark(setSelect(["Язык подсказок","Hints and help language"], ["РУССКИЙ","RUSSIAN"]));
    mark(setCheckbox(["Я прочитал эту информацию","I have read this information"], true));

    // Trang 2: password. CAPTCHA tuyệt đối không tự giải.
    recognized += fillPassword(payload);

    // Trang thông tin visa.
    mark(setSelect("Гражданство", payload.citizenship));
    mark(setYesNo("Если Вы имели гражданство СССР или России", Boolean(A.hadFormerRussianCitizenship)));
    if (A.hadFormerRussianCitizenship) {
      mark(setDate(["Когда?","Когда"], A.formerCitizenshipLostDate));
      mark(setText(["В связи с чем?","В связи с чем"], A.formerCitizenshipLossReason));
    }
    mark(setSelect("Цель поездки (раздел)", payload.purposeSection));
    mark(setSelect("Цель поездки", payload.purpose));
    mark(setSelect("Категория и вид визы", payload.visaType));
    mark(setSelect("Кратность визы", payload.entries));
    mark(setDate("Дата въезда в Россию", payload.entryDate));
    mark(setDate("Дата выезда из России", payload.exitDate));

    // Trang thông tin cá nhân.
    mark(setText("Фамилия (согласно паспорту)", A.surname));
    mark(setText("Имя, другие имена, отчество", A.givenNames));
    mark(setYesNo("Есть ли у Вас другие когда-либо использовавшиеся имена", false));
    mark(setSelect("Пол", A.sex));
    mark(setDate("Дата рождения", A.birthDate));
    mark(setText("Место рождения", A.birthPlace));
    mark(setYesNo("Вы родились в России", false));

    // Trang hộ chiếu.
    mark(setText("Номер паспорта", A.passportNo));
    mark(setDate("Дата выдачи", A.passportIssue));
    mark(setDate("Действителен до", A.passportExpiry));

    // Trang thông tin chuyến đi.
    mark(setText("Наименование организации", payload.organization));
    mark(setText("Адрес", payload.organizationAddress));
    mark(setText("ИНН организации", payload.tin));
    mark(setText("Номер указания (телекса)", payload.telex));
    if (payload.invitation) mark(setText("Номер приглашения", payload.invitation));
    mark(setText("Населенный пункт", A.routeCity || payload.city));
    mark(setYesNo("Имеете ли Вы документ о медицинском страховании", Boolean(A.hasInsurance)));
    if (A.hasInsurance) mark(setText(["Название страховой компании и номер полиса","номер страхового документа"], A.insurancePolicy));
    mark(setYesNo("Были ли Вы когда-нибудь в России", Boolean(A.visitedRussia)));
    if (A.visitedRussia) {
      mark(setText("Сколько раз Вы были в России", A.visitsCount));
      mark(setDate(["Даты Вашей последней поездки","Дата въезда"], A.lastVisitFrom));
      mark(setDate("Дата выезда", A.lastVisitTo));
    }

    // Trang liên hệ.
    mark(setYesNo("Имеете ли Вы адрес постоянного проживания", true));
    mark(setText("Адрес вашего постоянного проживания", payload.fixedPermanentAddress || A.personalAddress));
    mark(setText("Ваш личный телефон", A.phone));
    mark(setText("Ваш личный E-mail", A.email));
    mark(setYesNo(["Вы работаете","Вы работаете (работали ранее), учитесь"], true));
    mark(setText("Место работы (учебы)", payload.employer));
    mark(setText("Должность", A.position || payload.defaultPosition));
    mark(setText("Рабочий адрес", payload.employerAddress));
    mark(setText("Рабочий телефон", payload.fixedWorkPhone || A.workPhone));
    mark(setText("Рабочий E-mail", payload.employerEmail));
    mark(setYesNo("Дети до 16 лет", false));
    mark(setYesNo("Имеете ли Вы в настоящее время родственников", false));

    // Trang nơi nộp.
    mark(setSelect("Наименование учреждения", payload.embassy));

    return recognized;
  }

  function addHints() {
    const hints = [
      ["Страна","Country","Nước nộp hồ sơ"],
      ["Язык подсказок","Hints and help language","Ngôn ngữ hướng dẫn"],
      ["Гражданство","Citizenship","Quốc tịch"],
      ["Цель поездки","Purpose of visit","Mục đích chuyến đi"],
      ["Категория и вид визы","Visa category/type","Loại visa"],
      ["Кратность визы","Number of entries","Số lần nhập cảnh"],
      ["Фамилия","Surname","Họ"],
      ["Имя, другие имена, отчество","First/Middle names","Tên + tên đệm"],
      ["Место рождения","Place of birth","Nơi sinh"],
      ["Номер паспорта","Passport number","Số hộ chiếu"],
      ["Маршрут","Itinerary","Lộ trình/nơi đến"],
      ["Населенный пункт","City/locality","Thành phố/nơi đến"],
      ["Наименование учреждения","Submission institution","Cơ quan tiếp nhận"],
      ["Если Вы имели гражданство СССР или России","Former USSR/Russian citizenship","Đã từng có quốc tịch Liên Xô/Nga"],
      ["Когда?","When?","Khi nào?"],
      ["В связи с чем?","Reason","Lý do"],
    ];
    const nodes = [...document.querySelectorAll("label,td,th,div,span,p,b,strong,option,button,a")];
    for (const node of nodes) {
      const text = norm(node.textContent);
      if (!/[А-ЯЁ]/i.test(text)) continue;
      const match = hints.find(([ru]) => text.includes(norm(ru)));
      if (!match) continue;
      node.title = `English: ${match[1]}\nTiếng Việt: ${match[2]}`;
      node.style.cursor = node.style.cursor || "help";
    }
  }

  function extractApplicationId() {
    const body = document.body.innerText || "";
    const patterns = [
      /Идентификационный номер Вашей анкеты\s*:?\s*(\d{6,12})/i,
      /Номер анкеты\s*:?\s*(\d{6,12})/i,
      /№ заявления \(сайт\)[^0-9]{0,50}(\d{6,12})/i,
      /Application (?:ID|number)[^0-9]{0,50}(\d{6,12})/i,
    ];
    for (const pattern of patterns) {
      const match = body.match(pattern);
      if (match) return match[1];
    }
    return "";
  }

  function postApplicationId(payload, complete = false) {
    const id = extractApplicationId() || localStorage.getItem(ID_KEY) || "";
    if (!id) return "";
    localStorage.setItem(ID_KEY, id);
    const A = payload.applicant || {};
    if (window.opener) {
      window.opener.postMessage({
        type: "KD_MID_RECORD",
        applicationId: id,
        surname5: A.surname5 || "",
        birthYear: A.birthYear || "",
        password: A.password || payload.password || "",
        applicantName: [A.surname, A.givenNames].filter(Boolean).join(" "),
        complete,
      }, "*");
    }
    return id;
  }

  function findCaptchaInput() {
    const direct = document.querySelector('input[name*="captcha" i],input[id*="captcha" i],input[name*="code" i],input[id*="code" i]');
    if (direct && direct.type !== "hidden") return direct;
    const image = document.querySelector('img[src*="captcha" i],img[id*="captcha" i],img[class*="captcha" i]');
    if (!image) return null;
    const container = image.closest("form,table,div,td") || document;
    return [...container.querySelectorAll('input[type="text"],input:not([type])')].find((el) => !el.disabled) || null;
  }

  function isCaptchaPage() {
    return Boolean(document.querySelector('input[type="password"]') && (findCaptchaInput() || document.querySelector('img[src*="captcha" i],img[id*="captcha" i],img[class*="captcha" i]')));
  }

  function captchaReady() {
    const input = findCaptchaInput();
    return Boolean(input && String(input.value || "").trim().length >= 3);
  }

  function pageSignature() {
    const text = [...document.querySelectorAll("label,td,th,h1,h2,h3,button,input[type=submit],input[type=button]")]
      .map((node) => norm(node.textContent || node.value))
      .join("|")
      .slice(0, 10000);
    let hash = 2166136261;
    for (let i = 0; i < text.length; i += 1) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return location.pathname + location.search + ":" + String(hash >>> 0);
  }

  function clickNamed(labels, delay = 700) {
    const wants = labels.map(norm);
    const candidates = [...document.querySelectorAll("button,input[type=button],input[type=submit],a")];
    const button = candidates.find((el) => wants.includes(norm(el.textContent || el.value)));
    if (!button || button.disabled) return false;
    const sig = pageSignature() + ":" + wants.join(",");
    if (sessionStorage.getItem(CLICK_KEY) === sig) return true;
    sessionStorage.setItem(CLICK_KEY, sig);
    setTimeout(() => button.click(), delay);
    return true;
  }

  function maybeAutoPrint(payload) {
    if (!payload?._automation?.autoPrint) return false;
    const body = document.body.innerText || "";
    if (!/Печать формата A4|Print A4/i.test(body)) return false;
    const key = pageSignature();
    if (sessionStorage.getItem(PRINT_KEY) === key) return true;
    sessionStorage.setItem(PRINT_KEY, key);
    postApplicationId(payload, true);
    status("KD-MID Visa VN: hồ sơ hoàn tất. Đang yêu cầu KD-MID xuất PDF A4 chính thức…");
    const candidates = [...document.querySelectorAll("button,input[type=button],input[type=submit],a")];
    const printButton = candidates.find((el) => ["ПЕЧАТЬ ФОРМАТА A4","PRINT A4"].includes(norm(el.textContent || el.value)));
    if (!printButton || printButton.disabled) return false;
    setTimeout(() => printButton.click(), 900);
    return true;
  }

  function maybeAdvance(payload, recognized) {
    if (!payload?._automation?.autoAdvance) return false;

    if (maybeAutoPrint(payload)) return true;

    const body = document.body.innerText || "";
    const id = extractApplicationId();
    if (id) {
      postApplicationId(payload, false);
      status(`KD-MID Visa VN: đã ghi nhớ Application ID ${id}. Đang tiếp tục…`);
      return clickNamed(["ДАЛЕЕ","NEXT"], 650);
    }

    if (isCaptchaPage()) {
      fillPassword(payload);
      if (!captchaReady()) {
        status("KD-MID Visa VN: đã điền mật khẩu. Hãy nhập ký tự CAPTCHA trong ảnh; sau khi nhập xong Tool sẽ tự tiếp tục.", "wait");
        return false;
      }
      status("KD-MID Visa VN: CAPTCHA đã được bạn nhập. Đang tiếp tục…");
      return clickNamed(["ДАЛЕЕ","NEXT","ПРОДОЛЖИТЬ","CONTINUE","ОТПРАВИТЬ","SUBMIT"], 450);
    }

    if (/ПЕЧАТНАЯ ФОРМА ЭЛЕКТРОННОЙ ВИЗОВОЙ АНКЕТЫ/i.test(body)) return false;

    // Trang đầu và các trang dữ liệu.
    if (recognized > 0) {
      return clickNamed(["ЗАПОЛНИТЬ НОВУЮ АНКЕТУ","COMPLETE NEW APPLICATION","ДАЛЕЕ","NEXT"], 750);
    }
    return false;
  }

  function status(message, tone = "ok") {
    document.getElementById("kd-mid-vn-status")?.remove();
    const box = document.createElement("div");
    box.id = "kd-mid-vn-status";
    const colors = tone === "wait"
      ? ["#b7791f","#fffbeb","#744210"]
      : ["#2f855a","#ecfdf5","#14532d"];
    box.style.cssText = `position:fixed;right:14px;bottom:14px;z-index:2147483647;max-width:430px;padding:10px 12px;border:1px solid ${colors[0]};border-radius:10px;background:${colors[1]};color:${colors[2]};box-shadow:0 8px 30px rgba(0,0,0,.22);font:600 12px/1.45 Arial`;
    box.textContent = message;
    document.body.appendChild(box);
  }

  let retryCount = 0;
  let retryTimer = 0;
  function run(payload) {
    const recognized = fillPage(payload);
    addHints();
    postApplicationId(payload, false);
    maybeAdvance(payload, recognized);
  }

  function startProgressiveRun(payload) {
    window.clearInterval(retryTimer);
    retryCount = 0;
    const tick = () => {
      retryCount += 1;
      run(payload);
      if (retryCount >= RETRY_LIMIT) window.clearInterval(retryTimer);
    };
    tick();
    retryTimer = window.setInterval(tick, RETRY_MS);
  }

  function acceptBridge(nonce) {
    if (!nonce) return;
    status("KD-MID Visa VN Companion: đang chờ hồ sơ từ App-Manager…", "wait");
    if (window.opener) window.opener.postMessage({ type: "KD_MID_READY", nonce }, "*");
    window.addEventListener("message", (event) => {
      const data = event.data;
      if (!data || data.type !== "KD_MID_PAYLOAD" || data.nonce !== nonce || !data.payload) return;
      savePayload(data.payload);
      localStorage.removeItem(ID_KEY);
      history.replaceState(null, document.title, location.pathname + location.search);
      if (window.opener) window.opener.postMessage({ type: "KD_MID_ACK", nonce }, "*");
      startProgressiveRun(data.payload);
    });
  }

  addHints();
  const nonce = nonceFromHash();
  if (nonce) {
    localStorage.removeItem(DATA_KEY);
    acceptBridge(nonce);
  } else {
    const payload = readPayload();
    if (payload) startProgressiveRun(payload);
  }

  // CAPTCHA: người dùng nhập thủ công; sau đó Companion tiếp tục ngay.
  document.addEventListener("input", () => {
    const payload = readPayload();
    if (!payload || !isCaptchaPage()) return;
    window.setTimeout(() => run(payload), 120);
  }, true);

  const observer = new MutationObserver(() => {
    const payload = readPayload();
    addHints();
    if (!payload) return;
    window.clearTimeout(observer._kdmidTimer);
    observer._kdmidTimer = window.setTimeout(() => run(payload), 180);
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
})();
