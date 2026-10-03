// ==UserScript==
// @name         KD-MID Visa VN Companion
// @namespace    application-management
// @version      0.5.0
// @description  Tự điền hồ sơ chính thức trên visa.kdmid.ru từ KD-MID Visa VN Tool.
// @match        https://visa.kdmid.ru/*
// @run-at       document-idle
// @updateURL    https://application-management.boiech-ai.workers.dev/kd-mid-visa-companion.user.js
// @downloadURL  https://application-management.boiech-ai.workers.dev/kd-mid-visa-companion.user.js
// @grant        none
// ==/UserScript==

(() => {
  "use strict";

  const DATA_KEY = "kd-mid-visa-vn:payload:v3";
  const CLICK_KEY = "kd-mid-visa-vn:auto-click:v3";
  const HASH_PREFIX = "#kdmid-bridge=";

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
    const needles = (Array.isArray(labels) ? labels : [labels]).map(norm);
    const nodes = [...document.querySelectorAll("label,td,th,div,span,p,b,strong")];
    for (const node of nodes) {
      const text = norm(node.textContent);
      if (!needles.some((needle) => needle && text.includes(needle))) continue;
      let current = node;
      for (let depth = 0; depth < 6 && current; depth += 1, current = current.parentElement) {
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
      item.type !== "radio"
    );
    if (!el) return false;
    el.value = value;
    fire(el);
    return true;
  }

  function setSelect(labels, values) {
    const el = blockControls(labels).find((item) => item.tagName === "SELECT");
    if (!el) return false;
    const wants = (Array.isArray(values) ? values : [values]).map(norm);
    const option = [...el.options].find((o) => wants.includes(norm(o.textContent))) ||
      [...el.options].find((o) => wants.some((want) => norm(o.textContent).includes(want)));
    if (!option) return false;
    el.value = option.value;
    fire(el);
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
        if (option) el.value = option.value;
      } else {
        el.value = part;
      }
      fire(el);
    });
    return true;
  }

  function fillPassword(payload) {
    const password = payload?.applicant?.password || payload?.password;
    if (!password) return 0;
    const passwordInputs = [...document.querySelectorAll('input[type="password"]')];
    let changed = 0;
    passwordInputs.forEach((el) => {
      if (el.value !== password) {
        el.value = password;
        fire(el);
        changed += 1;
      }
    });
    return changed;
  }

  function fillPage(payload) {
    const A = payload.applicant || {};
    let changed = 0;
    const mark = (ok) => { if (ok) changed += 1; };

    // Trang mở đầu chính thức.
    mark(setSelect(["Страна","Country"], ["ВЬЕТНАМ","VIETNAM"]));
    mark(setSelect(["Язык подсказок","Hints and help language"], ["РУССКИЙ","RUSSIAN"]));
    mark(setCheckbox(["Я прочитал эту информацию","I have read this information"], true));

    // Mật khẩu ở bước tạo hồ sơ (nếu trang hiện các ô password).
    changed += fillPassword(payload);

    // Trang mục đích / quốc tịch.
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

    // Thông tin cá nhân.
    mark(setText("Фамилия (согласно паспорту)", A.surname));
    mark(setText("Имя, другие имена, отчество", A.givenNames));
    mark(setYesNo("Есть ли у Вас другие когда-либо использовавшиеся имена", false));
    mark(setSelect("Пол", A.sex));
    mark(setDate("Дата рождения", A.birthDate));
    mark(setText("Место рождения", A.birthPlace));
    mark(setYesNo("Вы родились в России", false));

    // Hộ chiếu.
    mark(setText("Номер паспорта", A.passportNo));
    mark(setDate("Дата выдачи", A.passportIssue));
    mark(setDate("Действителен до", A.passportExpiry));

    // Cơ quan mời + route.
    mark(setText("Наименование организации", payload.organization));
    mark(setText("Адрес", payload.organizationAddress));
    mark(setText("ИНН организации", payload.tin));
    mark(setText("Номер указания (телекса)", payload.telex));
    if (payload.invitation) mark(setText("Номер приглашения", payload.invitation));
    mark(setText("Населенный пункт", A.routeCity || payload.city));

    // Bảo hiểm + lịch sử Nga.
    mark(setYesNo("Имеете ли Вы документ о медицинском страховании", Boolean(A.hasInsurance)));
    if (A.hasInsurance) mark(setText(["Название страховой компании и номер полиса","номер страхового документа"], A.insurancePolicy));
    mark(setYesNo("Были ли Вы когда-нибудь в России", Boolean(A.visitedRussia)));
    if (A.visitedRussia) {
      mark(setText("Сколько раз Вы были в России", A.visitsCount));
      mark(setDate(["Даты Вашей последней поездки","Дата въезда"], A.lastVisitFrom));
      mark(setDate("Дата выезда", A.lastVisitTo));
    }

    // Địa chỉ / cơ quan.
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

    // Nơi nộp.
    mark(setSelect("Наименование учреждения", payload.embassy));

    return changed;
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

  function captureApplicationId(payload) {
    const text = document.body.innerText || "";
    const match = text.match(/(?:Номер анкеты|№ заявления \(сайт\)|Application number)[^0-9]{0,50}(\d{6,12})/i);
    if (!match || !window.opener) return;
    const A = payload.applicant || {};
    window.opener.postMessage({
      type: "KD_MID_RECORD",
      applicationId: match[1],
      surname5: A.surname5 || "",
      birthYear: A.birthYear || "",
      password: A.password || payload.password || "",
      applicantName: [A.surname, A.givenNames].filter(Boolean).join(" "),
      complete: /Печать формата A4|Печать формата Letter|Print A4/i.test(text),
    }, "*");
  }

  function signature() {
    const text = [...document.querySelectorAll("label,td,th,h1,h2,h3,button,input[type=submit]")]
      .map((node) => norm(node.textContent || node.value))
      .join("|")
      .slice(0, 8000);
    let hash = 2166136261;
    for (let i = 0; i < text.length; i += 1) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return location.pathname + location.search + ":" + String(hash >>> 0);
  }

  function maybeAdvance(payload, changed) {
    if (!payload?._automation?.autoAdvance || changed < 1) return;
    const body = document.body.innerText || "";
    if (/Печать формата A4|Печать формата Letter|ПЕЧАТНАЯ ФОРМА ЭЛЕКТРОННОЙ ВИЗОВОЙ АНКЕТЫ|Print A4/i.test(body)) return;
    if (document.querySelector('input[type="captcha"], img[src*="captcha" i], [class*="captcha" i]')) return;

    const sig = signature();
    if (sessionStorage.getItem(CLICK_KEY) === sig) return;

    const buttons = [...document.querySelectorAll("button,input[type=button],input[type=submit],a")];
    const wanted = ["ДАЛЕЕ","NEXT","ЗАПОЛНИТЬ НОВУЮ АНКЕТУ","COMPLETE NEW APPLICATION"];
    const next = buttons.find((el) => wanted.includes(norm(el.textContent || el.value)));
    if (!next || next.disabled) return;

    sessionStorage.setItem(CLICK_KEY, sig);
    setTimeout(() => next.click(), 900);
  }

  function status(message, tone = "ok") {
    document.getElementById("kd-mid-vn-status")?.remove();
    const box = document.createElement("div");
    box.id = "kd-mid-vn-status";
    const colors = tone === "wait"
      ? ["#b7791f","#fffbeb","#744210"]
      : ["#2f855a","#ecfdf5","#14532d"];
    box.style.cssText = `position:fixed;right:14px;bottom:14px;z-index:2147483647;max-width:390px;padding:10px 12px;border:1px solid ${colors[0]};border-radius:10px;background:${colors[1]};color:${colors[2]};box-shadow:0 8px 30px rgba(0,0,0,.22);font:600 12px/1.45 Arial`;
    box.textContent = message;
    document.body.appendChild(box);
  }

  function run(payload) {
    const changed = fillPage(payload);
    addHints();
    captureApplicationId(payload);
    status(changed
      ? `KD-MID Visa VN: đã tự điền ${changed} nhóm trường. ${payload?._automation?.autoAdvance ? "Auto-next đang bật." : "Hãy kiểm tra rồi bấm Далее."}`
      : "KD-MID Visa VN: trang này chưa có trường nhận diện để tự điền.");
    maybeAdvance(payload, changed);
  }

  function acceptBridge(nonce) {
    if (!nonce) return;
    status("KD-MID Visa VN Companion: đang chờ hồ sơ từ App-Manager…", "wait");
    if (window.opener) window.opener.postMessage({ type: "KD_MID_READY", nonce }, "*");
    window.addEventListener("message", (event) => {
      const data = event.data;
      if (!data || data.type !== "KD_MID_PAYLOAD" || data.nonce !== nonce || !data.payload) return;
      savePayload(data.payload);
      history.replaceState(null, document.title, location.pathname + location.search);
      if (window.opener) window.opener.postMessage({ type: "KD_MID_ACK", nonce }, "*");
      run(data.payload);
    });
  }

  addHints();
  const nonce = nonceFromHash();
  if (nonce) {
    localStorage.removeItem(DATA_KEY);
    acceptBridge(nonce);
  } else {
    const payload = readPayload();
    if (payload) run(payload);
  }

  const observer = new MutationObserver(() => {
    clearTimeout(observer._kdmidTimer);
    observer._kdmidTimer = setTimeout(() => {
      addHints();
      const payload = readPayload();
      if (payload) captureApplicationId(payload);
    }, 250);
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
})();
