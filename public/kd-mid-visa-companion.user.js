// ==UserScript==
// @name         KD-MID Visa VN Companion
// @namespace    application-management
// @version      0.2.0
// @description  Tự điền visa.kdmid.ru từ KD-MID Visa VN Tool, thêm tooltip Anh/Việt và tùy chọn tự chuyển trang.
// @match        https://visa.kdmid.ru/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(() => {
  "use strict";

  const DATA_KEY = "kd-mid-visa-vn:payload:v2";
  const CLICK_KEY = "kd-mid-visa-vn:auto-click:v2";
  const HASH_PREFIX = "#kdmid=";

  const hints = [
    ["Гражданство", "Citizenship", "Quốc tịch"],
    ["Если Вы имели гражданство СССР или России", "If you previously had USSR or Russian citizenship", "Nếu trước đây từng có quốc tịch Liên Xô hoặc Nga"],
    ["Цель поездки (раздел)", "Purpose of visit (section)", "Mục đích chuyến đi (nhóm)"],
    ["Цель поездки", "Purpose of visit", "Mục đích chuyến đi"],
    ["Категория и вид визы", "Visa category and type", "Loại và diện visa"],
    ["Кратность визы", "Number of entries", "Số lần nhập cảnh"],
    ["Дата въезда в Россию", "Date of entry into Russia", "Ngày nhập cảnh Nga"],
    ["Дата выезда из России", "Date of exit from Russia", "Ngày rời Nga"],
    ["Фамилия", "Surname", "Họ"],
    ["Имя, другие имена, отчество", "First name, middle names, patronymic", "Tên, tên đệm, tên cha"],
    ["Есть ли у Вас другие когда-либо использовавшиеся имена", "Have you ever used other names?", "Bạn đã từng dùng tên khác chưa?"],
    ["Пол", "Sex", "Giới tính"],
    ["Дата рождения", "Date of birth", "Ngày sinh"],
    ["Место рождения", "Place of birth", "Nơi sinh"],
    ["Вы родились в России", "Were you born in Russia?", "Bạn có sinh tại Nga không?"],
    ["Номер паспорта", "Passport number", "Số hộ chiếu"],
    ["Дата выдачи", "Date of issue", "Ngày cấp"],
    ["Действителен до", "Valid until", "Có giá trị đến"],
    ["Наименование организации", "Name of organization", "Tên cơ quan/tổ chức"],
    ["Адрес", "Address", "Địa chỉ"],
    ["ИНН организации", "Organization TIN", "Mã số thuế tổ chức"],
    ["Номер указания (телекса)", "Directive (telex) number", "Số chỉ thị/telex"],
    ["Номер приглашения", "Invitation number", "Số giấy mời"],
    ["Маршрут", "Itinerary / route", "Lộ trình"],
    ["Населенный пункт", "City / locality", "Thành phố / địa điểm"],
    ["Имеете ли Вы документ о медицинском страховании", "Do you have medical insurance valid in Russia?", "Bạn có bảo hiểm có hiệu lực tại Nga không?"],
    ["Название страховой компании и номер полиса", "Insurance company and policy number", "Tên công ty bảo hiểm và số hợp đồng"],
    ["Были ли Вы когда-нибудь в России", "Have you ever visited Russia?", "Bạn đã từng đến Nga chưa?"],
    ["Сколько раз Вы были в России", "How many times have you been to Russia?", "Bạn đã đến Nga bao nhiêu lần?"],
    ["Имеете ли Вы адрес постоянного проживания", "Do you have a permanent residential address?", "Bạn có địa chỉ thường trú không?"],
    ["Адрес вашего постоянного проживания", "Your permanent residential address", "Địa chỉ thường trú"],
    ["Ваш личный телефон", "Your personal phone", "Điện thoại cá nhân"],
    ["Ваш личный E-mail", "Your personal email", "Email cá nhân"],
    ["Вы работаете", "Do you work/study?", "Hiện tại bạn có làm việc/học tập không?"],
    ["Место работы (учебы)", "Place of work/study", "Nơi làm việc/học tập"],
    ["Должность", "Position", "Chức danh/vị trí"],
    ["Рабочий адрес", "Work address", "Địa chỉ cơ quan"],
    ["Рабочий телефон", "Work phone", "Điện thoại cơ quan"],
    ["Рабочий E-mail", "Work email", "Email cơ quan"],
    ["Дети до 16 лет", "Children under 16 travelling with you", "Trẻ dưới 16 tuổi đi cùng"],
    ["Имеете ли Вы в настоящее время родственников", "Do you currently have relatives in Russia?", "Hiện tại bạn có người thân ở Nga không?"],
    ["Наименование учреждения", "Institution where you will submit the application", "Cơ quan nơi nộp hồ sơ"],
    ["Сохранить черновик", "Save draft", "Lưu bản nháp"],
    ["Далее", "Next", "Tiếp theo"],
    ["Назад", "Back", "Quay lại"],
    ["Печать формата A4", "Print A4", "In khổ A4"],
    ["Просмотр анкеты", "View application", "Xem hồ sơ"],
    ["НЕТ", "No", "Không"],
    ["ДА", "Yes", "Có"],
    ["УЧЕБА", "Study", "Học tập"],
    ["ОДНОКРАТНАЯ", "Single-entry", "Nhập cảnh một lần"],
    ["ОБЫКНОВЕННАЯ УЧЕБНАЯ", "Common educational visa", "Visa học tập thông thường"],
    ["МУЖСКОЙ", "Male", "Nam"],
    ["ЖЕНСКИЙ", "Female", "Nữ"],
    ["МОСКВА", "Moscow", "Moscow"],
    ["ВЬЕТНАМ", "Vietnam", "Việt Nam"],
  ];

  const norm = (value) => String(value || "").replace(/\s+/g, " ").trim().toUpperCase();
  const fire = (element) => {
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
  };
  const allControls = (root = document) => [...root.querySelectorAll("input,select,textarea")];

  function takePayloadFromHash() {
    if (!location.hash.startsWith(HASH_PREFIX)) return;
    try {
      const raw = decodeURIComponent(location.hash.slice(HASH_PREFIX.length));
      JSON.parse(raw);
      localStorage.setItem(DATA_KEY, raw);
      history.replaceState(null, document.title, location.pathname + location.search);
    } catch (error) {
      console.warn("[KD-MID Visa VN] Payload không hợp lệ.", error);
    }
  }

  function readPayload() {
    try {
      const raw = localStorage.getItem(DATA_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function labelBlock(text) {
    const needle = norm(text);
    if (!needle) return null;
    const candidates = [...document.querySelectorAll("label,td,th,div,span,p,b,strong")].filter((node) => norm(node.textContent).includes(needle));
    for (const candidate of candidates) {
      let current = candidate;
      for (let depth = 0; depth < 5 && current; depth += 1, current = current.parentElement) {
        if (allControls(current).length) return current;
      }
    }
    return null;
  }

  function blockControls(text) {
    const block = labelBlock(text);
    return block ? allControls(block) : [];
  }

  function setText(label, value) {
    if (value == null || value === "") return false;
    const element = blockControls(label).find((item) =>
      item.tagName !== "SELECT" &&
      item.type !== "hidden" &&
      item.type !== "button" &&
      item.type !== "submit"
    );
    if (!element) return false;
    element.value = value;
    fire(element);
    return true;
  }

  function setSelect(label, value) {
    const element = blockControls(label).find((item) => item.tagName === "SELECT");
    if (!element || value == null || value === "") return false;
    const wanted = norm(value);
    const option = [...element.options].find((item) => norm(item.textContent) === wanted) ||
      [...element.options].find((item) => norm(item.textContent).includes(wanted));
    if (!option) return false;
    element.value = option.value;
    fire(element);
    return true;
  }

  function setYesNo(label, value) {
    return setSelect(label, value ? "ДА" : "НЕТ");
  }

  function setDate(label, value) {
    if (!value) return false;
    const parts = value.split("/");
    if (parts.length !== 3) return false;
    const controls = blockControls(label).filter((item) => item.type !== "hidden");
    if (controls.length < 3) return false;
    parts.forEach((part, index) => {
      const element = controls[index];
      if (!element) return;
      if (element.tagName === "SELECT") {
        const option = [...element.options].find((item) => norm(item.textContent) === norm(part) || String(item.value) === String(part));
        if (option) element.value = option.value;
      } else {
        element.value = part;
      }
      fire(element);
    });
    return true;
  }

  function fillPage(payload) {
    const A = payload.applicant || {};
    let changed = 0;
    const text = (labels, value) => { if (labels.some((label) => setText(label, value))) changed += 1; };
    const select = (labels, value) => { if (labels.some((label) => setSelect(label, value))) changed += 1; };
    const yesNo = (label, value) => { if (setYesNo(label, value)) changed += 1; };
    const date = (label, value) => { if (setDate(label, value)) changed += 1; };

    select(["Гражданство"], payload.citizenship);
    yesNo("Если Вы имели гражданство СССР или России", false);
    select(["Цель поездки (раздел)"], payload.purposeSection);
    select(["Цель поездки"], payload.purpose);
    select(["Категория и вид визы"], payload.visaType);
    select(["Кратность визы"], payload.entries);
    date("Дата въезда в Россию", payload.entryDate);
    date("Дата выезда из России", payload.exitDate);

    text(["Фамилия (согласно паспорту)"], A.surname);
    text(["Имя, другие имена, отчество"], A.givenNames);
    yesNo("Есть ли у Вас другие когда-либо использовавшиеся имена", false);
    select(["Пол"], A.sex);
    date("Дата рождения", A.birthDate);
    text(["Место рождения"], A.birthPlace);
    yesNo("Вы родились в России", false);

    text(["Номер паспорта"], A.passportNo);
    date("Дата выдачи", A.passportIssue);
    date("Действителен до", A.passportExpiry);

    text(["Наименование организации"], payload.organization);
    text(["Адрес"], payload.organizationAddress);
    text(["ИНН организации"], payload.tin);
    text(["Номер указания (телекса)"], payload.telex);
    text(["Номер приглашения"], payload.invitation);
    text(["Населенный пункт"], payload.city);

    yesNo("Имеете ли Вы документ о медицинском страховании", Boolean(A.hasInsurance));
    if (A.hasInsurance) text(["Название страховой компании и номер полиса", "номер страхового документа"], A.insurancePolicy);

    yesNo("Были ли Вы когда-нибудь в России", Boolean(A.visitedRussia));
    if (A.visitedRussia) {
      text(["Сколько раз Вы были в России"], A.visitsCount);
      date("Дата въезда", A.lastVisitFrom);
      date("Дата выезда", A.lastVisitTo);
    }

    yesNo("Имеете ли Вы адрес постоянного проживания", true);
    text(["Адрес вашего постоянного проживания"], payload.fixedPermanentAddress || A.personalAddress);
    text(["Ваш личный телефон"], A.phone);
    text(["Ваш личный E-mail"], A.email);

    yesNo("Вы работаете", true);
    text(["Место работы (учебы)"], payload.employer);
    text(["Должность"], A.position || payload.defaultPosition);
    text(["Рабочий адрес"], payload.employerAddress);
    text(["Рабочий телефон"], payload.fixedWorkPhone || A.workPhone);
    text(["Рабочий E-mail"], payload.employerEmail);

    yesNo("Дети до 16 лет", false);
    yesNo("Имеете ли Вы в настоящее время родственников", false);
    select(["Наименование учреждения"], payload.embassy);

    return changed;
  }

  function addVietnameseNotes() {
    document.querySelectorAll("[data-kdmid-vn-note]").forEach((node) => node.remove());
    [
      ["Цель поездки", "Mục đích chuyến đi"],
      ["Номер указания", "Số telex/chỉ thị"],
      ["Место рождения", "Nơi sinh theo hộ chiếu"],
      ["Были ли Вы когда-нибудь в России", "Bạn đã từng đến Nga chưa?"],
      ["Имеете ли Вы документ о медицинском страховании", "Bảo hiểm có hiệu lực tại Nga"],
    ].forEach(([ru, vi]) => {
      const block = labelBlock(ru);
      if (!block) return;
      const note = document.createElement("div");
      note.dataset.kdmidVnNote = "1";
      note.textContent = "🇻🇳 " + vi;
      note.style.cssText = "margin:6px 0;padding:6px 9px;border-left:3px solid #16a34a;background:#ecfdf5;color:#14532d;font:600 12px/1.4 Arial";
      block.appendChild(note);
    });
  }

  function addHoverHints() {
    const candidates = [...document.querySelectorAll("label,td,th,div,span,p,b,strong,option,button,a")];
    const sorted = [...hints].sort((a, b) => b[0].length - a[0].length);
    for (const node of candidates) {
      const text = norm(node.textContent);
      if (!/[А-ЯЁ]/i.test(text)) continue;
      const match = sorted.find(([ru]) => text.includes(norm(ru)));
      if (!match) continue;
      const [, en, vi] = match;
      node.title = "English: " + en + "\nTiếng Việt: " + vi;
      node.dataset.kdmidVnTooltip = "1";
      node.style.cursor = node.style.cursor || "help";
    }
  }

  function postResumeRecord(payload) {
    const text = document.body.innerText || "";
    const match = text.match(/(?:Номер анкеты|№ заявления \(сайт\))[^0-9]{0,40}(\d{6,12})/i);
    if (!match) return;
    const A = payload.applicant || {};
    if (window.opener) {
      window.opener.postMessage({
        type: "KD_MID_RECORD",
        applicationId: match[1],
        surname5: A.surname5 || "",
        birthYear: A.birthYear || "",
        password: A.password || payload.password || "",
        applicantName: [A.surname, A.givenNames].filter(Boolean).join(" "),
        complete: /Печать формата A4|Печать формата Letter/i.test(text),
      }, "*");
    }
  }

  function pageSignature() {
    const labels = [...document.querySelectorAll("label,td,th,h1,h2,h3")].map((node) => norm(node.textContent)).join("|").slice(0, 6000);
    let hash = 2166136261;
    for (let index = 0; index < labels.length; index += 1) {
      hash ^= labels.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return location.pathname + location.search + ":" + String(hash >>> 0);
  }

  function maybeAutoAdvance(payload, changed) {
    if (!payload?._automation?.autoAdvance || changed < 1) return;
    const bodyText = document.body.innerText || "";
    if (/Печать формата A4|Печать формата Letter|ПЕЧАТНАЯ ФОРМА ЭЛЕКТРОННОЙ ВИЗОВОЙ АНКЕТЫ/i.test(bodyText)) return;
    if (document.querySelector('input[type="captcha"], img[src*="captcha" i], [class*="captcha" i]')) return;

    const signature = pageSignature();
    if (sessionStorage.getItem(CLICK_KEY) === signature) return;

    const controls = [...document.querySelectorAll("button,input[type=button],input[type=submit],a")];
    const next = controls.find((element) => norm(element.textContent || element.value) === "ДАЛЕЕ");
    if (!next || next.disabled) return;

    sessionStorage.setItem(CLICK_KEY, signature);
    setTimeout(() => next.click(), 900);
  }

  function showStatus(changed, payload) {
    document.getElementById("kd-mid-vn-status")?.remove();
    const box = document.createElement("div");
    box.id = "kd-mid-vn-status";
    box.style.cssText = "position:fixed;right:14px;bottom:14px;z-index:2147483647;max-width:360px;padding:10px 12px;border:1px solid #2f855a;border-radius:10px;background:#ecfdf5;color:#14532d;box-shadow:0 8px 30px rgba(0,0,0,.22);font:600 12px/1.45 Arial";
    box.textContent = changed
      ? "KD-MID Visa VN: đã tự điền " + changed + " nhóm trường trên trang này." + (payload?._automation?.autoAdvance ? " Auto-next đang bật." : " Hãy kiểm tra rồi bấm Далее.")
      : "KD-MID Visa VN: chưa có trường phù hợp trên trang này; không tự chuyển trang.";
    document.body.appendChild(box);
    setTimeout(() => box.remove(), 6500);
  }

  takePayloadFromHash();
  const payload = readPayload();
  addHoverHints();

  if (!payload) return;

  const run = () => {
    const changed = fillPage(payload);
    addVietnameseNotes();
    addHoverHints();
    postResumeRecord(payload);
    showStatus(changed, payload);
    maybeAutoAdvance(payload, changed);
  };

  run();
  const observer = new MutationObserver(() => {
    clearTimeout(observer._timer);
    observer._timer = setTimeout(() => {
      addHoverHints();
      postResumeRecord(payload);
    }, 250);
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
})();