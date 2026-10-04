// ==UserScript==
// @name         KD-MID Visa VN Companion
// @namespace    application-management
// @version      0.9.2
// @description  Tự động điền hồ sơ chính thức trên visa.kdmid.ru; tự điền password, chờ người dùng nhập CAPTCHA, lưu ID xác nhận rồi tiếp tục đến PDF A4.
// @match        https://application-management.boiech-ai.workers.dev/*
// @match        https://visa.kdmid.ru/*
// @run-at       document-idle
// @updateURL    https://application-management.boiech-ai.workers.dev/kd-mid-visa-companion.user.js
// @downloadURL  https://application-management.boiech-ai.workers.dev/kd-mid-visa-companion.user.js
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @grant        GM_addValueChangeListener
// ==/UserScript==

(() => {
  "use strict";

  const VERSION = "0.9.2";
  const SHARED_PAYLOAD_KEY = "kd-mid-visa-vn:shared-payload:v9";
  const SHARED_RECORD_KEY = "kd-mid-visa-vn:shared-record:v9";
  const CLICK_KEY = "kd-mid-visa-vn:auto-click:v9";
  const PRINT_KEY = "kd-mid-visa-vn:auto-print:v9";
  const RETRY_MS = 450;
  const RETRY_LIMIT = 160;
  const APP_HOST = "application-management.boiech-ai.workers.dev";
  const KD_HOST = "visa.kdmid.ru";
  const HASH_PREFIX = "#kdmidv8=";

  const norm = (v) => String(v || "").replace(/\s+/g, " ").trim().toUpperCase();
  const controls = (root = document) => [...root.querySelectorAll("input,select,textarea")];
  const visible = (el) => {
    const style = window.getComputedStyle(el);
    return style.display !== "none" && style.visibility !== "hidden" && !el.disabled;
  };
  const fire = (el) => {
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  };

  function gmSet(key, value) {
    try { GM_setValue(key, value); return true; }
    catch (error) { console.error("[KD-MID Visa VN] GM_setValue failed", error); return false; }
  }

  function gmGet(key, fallback = "") {
    try { return GM_getValue(key, fallback); }
    catch (error) { console.error("[KD-MID Visa VN] GM_getValue failed", error); return fallback; }
  }

  function relayRecordToApp(record) {
    if (!record || !record.applicationId) return;
    window.postMessage({ type: "KD_MID_RECORD", ...record }, location.origin);
  }

  function runAppManagerBridge() {
    window.addEventListener("message", (event) => {
      if (event.origin !== location.origin) return;
      const data = event.data;
      if (!data) return;
      if (data.type === "KD_MID_PING") {
        window.postMessage({ type: "KD_MID_COMPANION_READY", version: VERSION }, location.origin);
      }
    });

    const existingRaw = gmGet(SHARED_RECORD_KEY, "");
    if (existingRaw) {
      try { relayRecordToApp(JSON.parse(existingRaw)); } catch {}
    }

    try {
      GM_addValueChangeListener(SHARED_RECORD_KEY, (_name, _oldValue, newValue) => {
        if (!newValue) return;
        try { relayRecordToApp(JSON.parse(newValue)); } catch {}
      });
    } catch (error) {
      console.warn("[KD-MID Visa VN] GM_addValueChangeListener unavailable", error);
    }

    window.postMessage({ type: "KD_MID_COMPANION_READY", version: VERSION }, location.origin);
  }

  if (location.hostname === APP_HOST) {
    runAppManagerBridge();
    return;
  }
  if (location.hostname !== KD_HOST) return;

  function readSharedPayload() {
    const raw = gmGet(SHARED_PAYLOAD_KEY, "");
    if (!raw) return null;
    try { return JSON.parse(raw); } catch { return null; }
  }

  function readPayloadFromHash() {
    if (!location.hash.startsWith(HASH_PREFIX)) return null;
    try {
      let encoded = location.hash.slice(HASH_PREFIX.length).replace(/-/g, "+").replace(/_/g, "/");
      while (encoded.length % 4) encoded += "=";
      const binary = atob(encoded);
      const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
      const payload = JSON.parse(new TextDecoder().decode(bytes));
      gmSet(SHARED_PAYLOAD_KEY, JSON.stringify(payload));
      history.replaceState(null, document.title, location.pathname + location.search);
      return payload;
    } catch (error) {
      console.error("[KD-MID Visa VN] Không đọc được payload từ URL hash", error);
      return null;
    }
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

  function matchingTextNodes(labels) {
    const needles = (Array.isArray(labels) ? labels : [labels]).map(norm).filter(Boolean);
    return [...document.querySelectorAll("label,td,th,div,span,p,b,strong")]
      .map((node) => ({ node, text: norm(node.textContent) }))
      .filter(({ text }) => needles.some((needle) => text.includes(needle)))
      .sort((a, b) => a.text.length - b.text.length)
      .map(({ node }) => node);
  }

  function findControlNearLabel(labels, selector) {
    for (const node of matchingTextNodes(labels)) {
      let current = node;
      for (let depth = 0; depth < 6 && current; depth += 1, current = current.parentElement) {
        const found = [...current.querySelectorAll(selector)].filter(visible);
        if (current.matches?.(selector) && visible(current)) found.unshift(current);
        const unique = [...new Set(found)];
        if (unique.length === 1) return unique[0];
      }
    }
    return null;
  }

  function findSelectNearLabel(labels) {
    return findControlNearLabel(labels, "select");
  }

  function findInputNearLabel(labels) {
    return findControlNearLabel(labels, 'input:not([type="hidden"]),textarea');
  }

  function setSelectNearLabel(labels, values) {
    const el = findSelectNearLabel(labels);
    if (!el) return false;
    const wants = (Array.isArray(values) ? values : [values]).map(norm);
    const option = [...el.options].find((o) => wants.includes(norm(o.textContent))) ||
      [...el.options].find((o) => wants.some((want) => want && norm(o.textContent).includes(want)));
    if (!option) return false;
    if (el.value !== option.value || el.selectedIndex !== option.index) {
      el.selectedIndex = option.index;
      el.value = option.value;
      fire(el);
    }
    return true;
  }

  function selectNearLabelHas(labels, values) {
    const el = findSelectNearLabel(labels);
    if (!el) return false;
    const selected = norm(el.options[el.selectedIndex]?.textContent || "");
    const wants = (Array.isArray(values) ? values : [values]).map(norm);
    return wants.some((want) => selected === want || selected.includes(want));
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

  function findSelectWithExactOption(values) {
    const wants = (Array.isArray(values) ? values : [values]).map(norm);
    return [...document.querySelectorAll("select")].find((select) =>
      [...select.options].some((option) => wants.includes(norm(option.textContent)))
    ) || null;
  }

  function selectHasExactValue(select, values) {
    if (!select) return false;
    const selected = norm(select.options[select.selectedIndex]?.textContent || "");
    const wants = (Array.isArray(values) ? values : [values]).map(norm);
    return wants.includes(selected);
  }

  function setExactSelectOption(select, values) {
    if (!select) return false;
    const wants = (Array.isArray(values) ? values : [values]).map(norm);
    const option = [...select.options].find((item) => wants.includes(norm(item.textContent)));
    if (!option) return false;
    if (select.value !== option.value || select.selectedIndex !== option.index) {
      select.selectedIndex = option.index;
      select.value = option.value;
      fire(select);
    }
    return true;
  }

  function landingControls() {
    return {
      country: findSelectWithExactOption(["ВЬЕТНАМ","VIETNAM"]),
      language: findSelectWithExactOption(["РУССКИЙ (RUSSIAN)","RUSSIAN"]),
      checkbox: blockControls(["Я прочитал эту информацию","I have read this information"])
        .find((item) => item.type === "checkbox") || null,
    };
  }

  function isLandingPage() {
    const { country, language } = landingControls();
    return Boolean(country && language) &&
      norm(document.body.innerText || "").includes("Я ПРОЧИТАЛ ЭТУ ИНФОРМАЦИЮ");
  }

  function landingPageReady() {
    const { country, language, checkbox } = landingControls();
    return selectHasExactValue(country, ["ВЬЕТНАМ","VIETNAM"]) &&
      selectHasExactValue(language, ["РУССКИЙ (RUSSIAN)","RUSSIAN"]) &&
      Boolean(checkbox?.checked);
  }

  function fillLandingPage() {
    const { country, language, checkbox } = landingControls();
    if (!country || !language) return { handled: false, ready: false };

    if (!selectHasExactValue(country, ["ВЬЕТНАМ","VIETNAM"])) {
      setExactSelectOption(country, ["ВЬЕТНАМ","VIETNAM"]);
      status("KD-MID Visa VN: đã chọn Việt Nam. Đang chờ trang ổn định trước khi chọn ngôn ngữ…", "wait");
      return { handled: true, ready: false };
    }

    if (!selectHasExactValue(language, ["РУССКИЙ (RUSSIAN)","RUSSIAN"])) {
      setExactSelectOption(language, ["РУССКИЙ (RUSSIAN)","RUSSIAN"]);
      status("KD-MID Visa VN: đã chọn РУССКИЙ (RUSSIAN). Đang chờ trang ổn định…", "wait");
      return { handled: true, ready: false };
    }

    if (checkbox && !checkbox.checked) {
      checkbox.click();
      if (!checkbox.checked) {
        checkbox.checked = true;
        fire(checkbox);
      }
      status("KD-MID Visa VN: đã tích xác nhận đọc thông tin. Đang chuẩn bị mở hồ sơ mới…", "wait");
      return { handled: true, ready: false };
    }

    return { handled: true, ready: landingPageReady() };
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
    const inputs = [...document.querySelectorAll('input[type="password"]')].filter(visible);
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

  function isVisaRequestPage() {
    const body = norm(document.body.innerText || "");
    return body.includes("ИНФОРМАЦИЯ О ЗАПРАШИВАЕМОЙ ВИЗЕ") &&
      body.includes("ЦЕЛЬ ПОЕЗДКИ (РАЗДЕЛ)") &&
      body.includes("КАТЕГОРИЯ И ВИД ВИЗЫ");
  }

  function setDateNearLabel(labels, value) {
    if (!value) return false;
    const node = matchingTextNodes(labels)[0];
    if (!node) return false;
    let current = node;
    let list = [];
    for (let depth = 0; depth < 6 && current; depth += 1, current = current.parentElement) {
      list = [...current.querySelectorAll("input,select")].filter((item) => visible(item) && item.type !== "hidden");
      if (list.length >= 3 && list.length <= 5) break;
    }
    if (list.length < 3) return false;
    const parts = value.split("/");
    if (parts.length !== 3) return false;
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

  function fillVisaRequestPage(payload) {
    if (!isVisaRequestPage()) return { handled: false, ready: false };
    const A = payload.applicant || {};

    setSelectNearLabel("Гражданство", [payload.citizenship, "ВЬЕТНАМ"]);
    if (!selectNearLabelHas("Гражданство", [payload.citizenship, "ВЬЕТНАМ"])) {
      status("KD-MID Visa VN: đang chọn quốc tịch Việt Nam…", "wait");
      return { handled: true, ready: false };
    }

    setSelectNearLabel("Если Вы имели гражданство СССР или России", A.hadFormerRussianCitizenship ? ["ДА"] : ["НЕТ"]);
    if (!selectNearLabelHas("Если Вы имели гражданство СССР или России", A.hadFormerRussianCitizenship ? ["ДА"] : ["НЕТ"])) {
      status("KD-MID Visa VN: đang chọn trạng thái quốc tịch Liên Xô/Nga…", "wait");
      return { handled: true, ready: false };
    }

    if (A.hadFormerRussianCitizenship) {
      setDateNearLabel(["Когда?","Когда"], A.formerCitizenshipLostDate);
      setText(["В связи с чем?","В связи с чем"], A.formerCitizenshipLossReason);
    }

    setSelectNearLabel("Цель поездки (раздел)", [payload.purposeSection, "УЧЕБА"]);
    if (!selectNearLabelHas("Цель поездки (раздел)", [payload.purposeSection, "УЧЕБА"])) {
      status("KD-MID Visa VN: đang chọn раздел = УЧЕБА…", "wait");
      return { handled: true, ready: false };
    }

    const purposeSelect = findSelectNearLabel("Цель поездки");
    if (!purposeSelect || purposeSelect.disabled || purposeSelect.options.length <= 1) {
      status("KD-MID Visa VN: đang chờ KD-MID nạp danh sách Цель поездки…", "wait");
      return { handled: true, ready: false };
    }
    setSelectNearLabel("Цель поездки", [payload.purpose, "УЧЕБА"]);
    if (!selectNearLabelHas("Цель поездки", [payload.purpose, "УЧЕБА"])) {
      status("KD-MID Visa VN: đang chọn Цель поездки = УЧЕБА…", "wait");
      return { handled: true, ready: false };
    }

    const visaKind = findSelectNearLabel("Категория и вид визы");
    if (!visaKind || visaKind.disabled || visaKind.options.length <= 1) {
      status("KD-MID Visa VN: đang chờ KD-MID nạp Категория и вид визы…", "wait");
      return { handled: true, ready: false };
    }
    setSelectNearLabel("Категория и вид визы", [payload.visaType, "ОБЫКНОВЕННАЯ УЧЕБНАЯ"]);
    if (!selectNearLabelHas("Категория и вид визы", [payload.visaType, "ОБЫКНОВЕННАЯ УЧЕБНАЯ"])) {
      status("KD-MID Visa VN: đang chọn ОБЫКНОВЕННАЯ УЧЕБНАЯ…", "wait");
      return { handled: true, ready: false };
    }

    setSelectNearLabel("Кратность визы", [payload.entries, "ОДНОКРАТНАЯ"]);
    if (!selectNearLabelHas("Кратность визы", [payload.entries, "ОДНОКРАТНАЯ"])) {
      status("KD-MID Visa VN: đang chọn ОДНОКРАТНАЯ…", "wait");
      return { handled: true, ready: false };
    }

    setDateNearLabel("Дата въезда в Россию", payload.entryDate);
    setDateNearLabel("Дата выезда из России", payload.exitDate);

    status("KD-MID Visa VN: trang visa đã điền đủ các trường phụ thuộc. Đang chuyển bước…");
    return { handled: true, ready: true };
  }

  function fillPage(payload) {
    const visaPage = fillVisaRequestPage(payload);
    if (visaPage.handled) return visaPage.ready ? 1 : 0;

    const A = payload.applicant || {};
    let recognized = 0;
    const mark = (ok) => { if (ok) recognized += 1; };

    recognized += fillPassword(payload);

    mark(setText("Фамилия (согласно паспорту)", A.surname));
    mark(setText("Имя, другие имена, отчество", A.givenNames));
    mark(setYesNo("Есть ли у Вас другие когда-либо использовавшиеся имена", false));
    mark(setSelect("Пол", A.sex));
    mark(setDate("Дата рождения", A.birthDate));
    mark(setText("Место рождения", A.birthPlace));
    mark(setYesNo("Вы родились в России", false));

    mark(setText("Номер паспорта", A.passportNo));
    mark(setDate("Дата выдачи", A.passportIssue));
    mark(setDate("Действителен до", A.passportExpiry));

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

    mark(setSelect("Наименование учреждения", payload.embassy));
    return recognized;
  }

  function addHints() {
    const hints = [
      ["Страна","Country","Nước nộp hồ sơ"],
      ["Язык подсказок","Hints and help language","Ngôn ngữ hướng dẫn"],
      ["Пароль","Password","Mật khẩu"],
      ["Подтверждение пароля","Confirm password","Xác nhận mật khẩu"],
      ["Введите надпись с картинки","Enter text from image","Nhập CAPTCHA trong ảnh"],
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

  function isPasswordCaptchaPage() {
    const body = norm(document.body.innerText || "");
    return Boolean(document.querySelector('input[type="password"]')) &&
      (body.includes("ПОДТВЕРЖДЕНИЕ ПАРОЛЯ") || body.includes("ВВЕДИТЕ НАДПИСЬ С КАРТИНКИ"));
  }

  function findCaptchaInput() {
    const direct = document.querySelector('input[name*="captcha" i],input[id*="captcha" i],input[name*="code" i],input[id*="code" i]');
    if (direct && direct.type !== "hidden" && visible(direct)) return direct;

    const labeled = blockControls(["Введите надпись с картинки","Enter text from image"])
      .filter((el) => visible(el) && (el.type === "text" || el.type === "" || !el.type));
    if (labeled.length) return labeled[labeled.length - 1];

    if (isPasswordCaptchaPage()) {
      const textInputs = [...document.querySelectorAll('input[type="text"],input:not([type])')]
        .filter((el) => visible(el));
      if (textInputs.length) return textInputs[textInputs.length - 1];
    }
    return null;
  }

  function captchaValue() {
    return String(findCaptchaInput()?.value || "").trim();
  }

  function captchaReady() {
    return captchaValue().length >= 5;
  }

  function isIdConfirmationPage() {
    const body = norm(document.body.innerText || "");
    return body.includes("ИДЕНТИФИКАЦИОННЫЙ НОМЕР ВАШЕЙ АНКЕТЫ") ||
      body.includes("ПЕЧАТЬ НОМЕРА АНКЕТЫ");
  }

  function extractConfirmedApplicationId() {
    if (!isIdConfirmationPage()) return "";
    const body = document.body.innerText || "";
    const match = body.match(/Идентификационный номер Вашей анкеты\s*:?\s*(\d{6,12})/i) ||
      body.match(/Номер анкеты\s*:?\s*(\d{6,12})/i);
    return match?.[1] || "";
  }

  function saveConfirmedApplicationRecord(payload, complete = false) {
    const previousRaw = gmGet(SHARED_RECORD_KEY, "");
    let previous = null;
    try { previous = previousRaw ? JSON.parse(previousRaw) : null; } catch {}

    const id = extractConfirmedApplicationId() || previous?.applicationId || "";
    if (!id) return "";

    const A = payload.applicant || {};
    const record = {
      id,
      applicationId: id,
      surname5: A.surname5 || "",
      birthYear: A.birthYear || "",
      password: A.password || payload.password || "",
      applicantName: [A.surname, A.givenNames].filter(Boolean).join(" "),
      complete,
      updatedAt: new Date().toISOString(),
    };
    gmSet(SHARED_RECORD_KEY, JSON.stringify(record));
    return id;
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
    const previousAt = Number(sessionStorage.getItem(CLICK_KEY + ":" + sig) || "0");
    if (Date.now() - previousAt < 1800) return true;

    sessionStorage.setItem(CLICK_KEY + ":" + sig, String(Date.now()));
    setTimeout(() => button.click(), delay);
    return true;
  }

  function maybeAutoPrint(payload) {
    if (!payload?._automation?.autoPrint) return false;
    const body = document.body.innerText || "";
    if (!/Печать формата A4|Print A4/i.test(body)) return false;

    const key = pageSignature();
    const previousAt = Number(sessionStorage.getItem(PRINT_KEY + ":" + key) || "0");
    if (Date.now() - previousAt < 5000) return true;

    sessionStorage.setItem(PRINT_KEY + ":" + key, String(Date.now()));
    saveConfirmedApplicationRecord(payload, true);
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

    if (isLandingPage()) {
      if (!landingPageReady()) {
        status("KD-MID Visa VN: đang hoàn tất trang đầu — Việt Nam + Russian + xác nhận đã đọc…", "wait");
        return false;
      }
      status("KD-MID Visa VN: trang đầu đã đúng Việt Nam + Russian. Đang mở hồ sơ mới…");
      return clickNamed(["ЗАПОЛНИТЬ НОВУЮ АНКЕТУ","COMPLETE NEW APPLICATION"], 700);
    }

    // Trang password/CAPTCHA phải được xử lý TRƯỚC việc đọc số анкеты ở header.
    if (isPasswordCaptchaPage()) {
      fillPassword(payload);
      if (!captchaReady()) {
        status("KD-MID Visa VN: đã điền Password + Confirm Password. Hãy tự nhập CAPTCHA trong ảnh; Tool sẽ tự bấm «Отправить» khi bạn nhập xong.", "wait");
        return false;
      }
      status("KD-MID Visa VN: CAPTCHA đã được nhập. Đang gửi để tạo hồ sơ…");
      return clickNamed(["ОТПРАВИТЬ","SUBMIT"], 550);
    }

    if (isIdConfirmationPage()) {
      const id = saveConfirmedApplicationRecord(payload, false);
      if (id) {
        status(`KD-MID Visa VN: đã lưu Application ID ${id} vào hồ sơ. Đang bấm «Далее»…`);
        return clickNamed(["ДАЛЕЕ","NEXT"], 700);
      }
      status("KD-MID Visa VN: đang chờ Application ID xác nhận từ KD-MID…", "wait");
      return false;
    }

    const body = document.body.innerText || "";
    if (/ПЕЧАТНАЯ ФОРМА ЭЛЕКТРОННОЙ ВИЗОВОЙ АНКЕТЫ/i.test(body)) return false;

    if (isVisaRequestPage() && recognized < 1) return false;

    if (recognized > 0) {
      return clickNamed(["ЗАПОЛНИТЬ НОВУЮ АНКЕТУ","COMPLETE NEW APPLICATION","ДАЛЕЕ","NEXT"], 800);
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
    box.style.cssText = `position:fixed;right:14px;bottom:14px;z-index:2147483647;max-width:450px;padding:10px 12px;border:1px solid ${colors[0]};border-radius:10px;background:${colors[1]};color:${colors[2]};box-shadow:0 8px 30px rgba(0,0,0,.22);font:600 12px/1.45 Arial`;
    box.textContent = message;
    document.body.appendChild(box);
  }

  let retryCount = 0;
  let retryTimer = 0;
  function run(payload) {
    addHints();

    if (isLandingPage()) {
      const landing = fillLandingPage();
      if (!landing.ready) return;
      maybeAdvance(payload, 1);
      return;
    }

    const recognized = fillPage(payload);
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

  addHints();
  const payload = readPayloadFromHash() || readSharedPayload();
  if (!payload) {
    status(`KD-MID Visa VN Companion v${VERSION} đang chạy nhưng chưa nhận được hồ sơ. Quay lại App-Manager và bấm “Bắt đầu tự động đến PDF”.`, "wait");
  } else {
    status(`KD-MID Visa VN Companion v${VERSION} đã nhận hồ sơ. Đang bắt đầu tự động…`);
    startProgressiveRun(payload);
  }

  let captchaIdleTimer = 0;
  document.addEventListener("input", (event) => {
    const current = readSharedPayload();
    if (!current || !isPasswordCaptchaPage()) return;
    if (event.target !== findCaptchaInput()) return;
    window.clearTimeout(captchaIdleTimer);
    if (captchaValue().length >= 5) {
      captchaIdleTimer = window.setTimeout(() => run(current), 700);
    }
  }, true);

  document.addEventListener("change", (event) => {
    const current = readSharedPayload();
    if (!current || !isPasswordCaptchaPage()) return;
    if (event.target !== findCaptchaInput() || captchaValue().length < 3) return;
    window.setTimeout(() => run(current), 120);
  }, true);

  document.addEventListener("keydown", (event) => {
    const current = readSharedPayload();
    if (!current || !isPasswordCaptchaPage()) return;
    if (event.key !== "Enter" || event.target !== findCaptchaInput() || captchaValue().length < 3) return;
    event.preventDefault();
    window.setTimeout(() => run(current), 50);
  }, true);

  const observer = new MutationObserver(() => {
    const current = readSharedPayload();
    addHints();
    if (!current) return;
    window.clearTimeout(observer._kdmidTimer);
    observer._kdmidTimer = window.setTimeout(() => run(current), 180);
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
})();
