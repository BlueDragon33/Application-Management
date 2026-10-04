// ==UserScript==
// @name         KD-MID Visa VN Companion
// @namespace    application-management
// @version      0.9.27
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

  const VERSION = "0.9.27";
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
    try { el.focus({ preventScroll: true }); } catch { try { el.focus(); } catch {} }
    el.dispatchEvent(new FocusEvent("focus", { bubbles: false }));
    el.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    el.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true, key: "Unidentified" }));
    el.dispatchEvent(new FocusEvent("blur", { bubbles: false }));
    el.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
    try { el.blur(); } catch {}
  };

  function setNativeControlValue(el, value) {
    const proto = el instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : el instanceof HTMLSelectElement
        ? HTMLSelectElement.prototype
        : HTMLInputElement.prototype;
    const descriptor = Object.getOwnPropertyDescriptor(proto, "value");
    if (descriptor?.set) descriptor.set.call(el, value);
    else el.value = value;
  }

  function activateControl(el) {
    if (!el) return;
    try { el.scrollIntoView({ block: "center", inline: "nearest" }); } catch {}
    try {
      el.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, view: window }));
      el.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true, view: window }));
      el.click();
    } catch {}
    try { el.focus({ preventScroll: true }); } catch { try { el.focus(); } catch {} }
  }

  function writeTextControl(el, value) {
    if (!el) return "missing";
    if (value == null || value === "") return "ready";
    if (String(el.value) === String(value)) return "ready";
    activateControl(el);
    setNativeControlValue(el, value);
    fire(el);
    if (String(el.value) !== String(value)) {
      try { el.value = value; } catch {}
      fire(el);
    }
    return String(el.value) === String(value) ? "changed" : "waiting";
  }

  function writeSelectControl(el, values) {
    if (!el) return "missing";
    if (el.disabled || el.options.length <= 1) return "waiting";
    if (selectAlreadyHas(el, values)) return "ready";
    const option = exactOption(el, values);
    if (!option) return "waiting";
    activateControl(el);
    el.selectedIndex = option.index;
    setNativeControlValue(el, option.value);
    fire(el);
    return selectAlreadyHas(el, values) ? "changed" : "waiting";
  }

  function writeDateTextAtomic(el, value) {
    if (!el) return false;
    const text = String(value ?? "");
    setNativeControlValue(el, text);
    if (String(el.value) !== text) {
      try { el.value = text; } catch {}
    }
    try { el.setAttribute("value", text); } catch {}
    // Do NOT blur/change here. KD-MID validates date parts as a group, and
    // committing the day while the year is still empty can clear the day again.
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true, key: "Unidentified" }));
    return normalizedNumeric(el.value) === normalizedNumeric(text);
  }

  function writeDateControls(list, value) {
    if (!value) return "ready";
    const parts = parseDmyStrict(value);
    if (!parts || list.length < 3) return "missing";

    const dayEl = list[0];
    const monthEl = list[1];
    const yearEl = list[2];
    if (!dayEl || !monthEl || !yearEl) return "missing";

    // Step 1: month only. Its change can trigger an ASP.NET postback.
    if (monthEl.tagName === "SELECT" && !dateControlMatches(monthEl, parts[1], 1)) {
      const option = findDateOption(monthEl, parts[1], 1);
      if (!option) return "waiting";
      activateControl(monthEl);
      monthEl.selectedIndex = option.index;
      setNativeControlValue(monthEl, option.value);
      fire(monthEl);
      return dateControlMatches(monthEl, parts[1], 1) ? "changed" : "waiting";
    }

    // Step 2: once the month is stable, write DAY + YEAR atomically.
    // Never blur/change the day before the year exists: KD-MID can clear it.
    const dayReadyBefore = dateControlMatches(dayEl, parts[0], 0);
    const yearReadyBefore = dateControlMatches(yearEl, parts[2], 2);

    let changed = false;
    if (!dayReadyBefore || !yearReadyBefore) {
      const dayOk = dayReadyBefore || writeDateTextAtomic(dayEl, parts[0]);
      const yearOk = yearReadyBefore || writeDateTextAtomic(yearEl, parts[2]);
      changed = dayOk || yearOk;

      if (dayOk && yearOk) {
        // Both values now exist. A single grouped validation pass is safe.
        refreshAspNetValidators();
      }
    }

    const ready =
      dateControlMatches(dayEl, parts[0], 0) &&
      dateControlMatches(monthEl, parts[1], 1) &&
      dateControlMatches(yearEl, parts[2], 2);

    return ready ? (changed ? "changed" : "ready") : "waiting";
  }

  function refreshAspNetValidators() {
    try {
      const validators = window.Page_Validators;
      const validate = window.ValidatorValidate;
      if (Array.isArray(validators) && typeof validate === "function") {
        validators.forEach((validator) => {
          try { validate(validator); } catch {}
        });
      }
    } catch {}
  }

  function gmSet(key, value) {
    try { GM_setValue(key, value); return true; }
    catch (error) { console.error("[KD-MID Visa VN] GM_setValue failed", error); return false; }
  }

  function gmGet(key, fallback = "") {
    try { return GM_getValue(key, fallback); }
    catch (error) { console.error("[KD-MID Visa VN] GM_getValue failed", error); return fallback; }
  }

  function payloadRevision(payload) {
    return Number(payload?._payloadRevision || payload?._launchToken || 0);
  }

  function payloadIdentity(payload) {
    return [
      payload?.applicant?.surname || "",
      payload?.applicant?.givenNames || "",
      payload?.applicant?.birthDate || "",
      payload?.applicant?.passportNo || "",
    ].join("|");
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
      if (data.type === "KD_MID_SET_PAYLOAD" && data.payload) {
        const fresh = {
          ...data.payload,
          _payloadRevision: data.payload._payloadRevision || Date.now(),
        };
        gmSet(SHARED_PAYLOAD_KEY, JSON.stringify(fresh));
        window.postMessage({
          type: "KD_MID_PAYLOAD_SAVED",
          applicantId: fresh?.applicant?.id || "",
          surname: fresh?.applicant?.surname || "",
          givenNames: fresh?.applicant?.givenNames || "",
          birthDate: fresh?.applicant?.birthDate || "",
          revision: fresh?._payloadRevision || 0,
        }, location.origin);
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
      // The payload in THIS launch URL is the only source allowed to initialize this KD-MID run.
      try { GM_deleteValue(SHARED_PAYLOAD_KEY); } catch {}
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

  function labelCandidates(labels) {
    const needles = (Array.isArray(labels) ? labels : [labels]).map(norm).filter(Boolean);
    return [...document.querySelectorAll("label,td,th,div,span,p,b,strong")]
      .map((node) => {
        const text = norm(node.textContent);
        const exact = needles.some((needle) => text === needle);
        const contains = needles.some((needle) => text.includes(needle));
        return { node, text, exact, contains };
      })
      .filter((item) => item.contains)
      .sort((a, b) => Number(b.exact) - Number(a.exact) || a.text.length - b.text.length)
      .map((item) => item.node);
  }

  function findSelectNearExactLabel(labels) {
    for (const node of labelCandidates(labels)) {
      let current = node;
      for (let depth = 0; depth < 6 && current; depth += 1, current = current.parentElement) {
        const selects = [...current.querySelectorAll("select")].filter(visible);
        if (current.matches?.("select") && visible(current)) selects.unshift(current);
        const unique = [...new Set(selects)];
        if (unique.length === 1) return unique[0];
      }
    }
    return null;
  }

  function selectedText(select) {
    return norm(select?.options?.[select.selectedIndex]?.textContent || "");
  }

  function exactOption(select, values) {
    if (!select) return null;
    const wants = (Array.isArray(values) ? values : [values]).map(norm);
    return [...select.options].find((option) => wants.includes(norm(option.textContent))) ||
      [...select.options].find((option) => wants.includes(norm(option.value)));
  }

  function selectAlreadyHas(select, values) {
    if (!select) return false;
    const wants = (Array.isArray(values) ? values : [values]).map(norm);
    return wants.includes(selectedText(select)) || wants.includes(norm(select.value));
  }

  function ensureSelectNearLabel(labels, values) {
    const select = findSelectNearExactLabel(labels);
    if (!select) return "missing";
    if (select.disabled || select.options.length <= 1) return "waiting";
    if (selectAlreadyHas(select, values)) return "ready";
    const option = exactOption(select, values);
    if (!option) return "waiting";
    select.selectedIndex = option.index;
    select.value = option.value;
    fire(select);
    return "changed";
  }

  function findYesNoSelect() {
    return [...document.querySelectorAll("select")].find((select) => {
      if (!visible(select)) return false;
      const values = [...select.options].map((option) => norm(option.textContent || option.value));
      const hasYes = values.some((value) => value === "ДА" || value === "YES");
      const hasNo = values.some((value) => value === "НЕТ" || value === "NO");
      return hasYes && hasNo;
    }) || null;
  }

  function ensureVisaFormerCitizenship(value) {
    const select = findYesNoSelect();
    if (!select) return "missing";
    if (select.disabled || select.options.length <= 1) return "waiting";
    const wants = value ? ["ДА","YES"] : ["НЕТ","NO"];
    if (selectAlreadyHas(select, wants)) return "ready";
    const option = exactOption(select, wants);
    if (!option) return "waiting";
    select.selectedIndex = option.index;
    select.value = option.value;
    fire(select);
    return "changed";
  }

  const RU_MONTHS = ["","ЯНВАРЬ","ФЕВРАЛЬ","МАРТ","АПРЕЛЬ","МАЙ","ИЮНЬ","ИЮЛЬ","АВГУСТ","СЕНТЯБРЬ","ОКТЯБРЬ","НОЯБРЬ","ДЕКАБРЬ"];

  function normalizedNumeric(value) {
    const raw = String(value ?? "").trim();
    if (!/^\d+$/.test(raw)) return raw;
    return String(Number(raw));
  }

  function parseDmyStrict(value) {
    const match = String(value ?? "").trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!match) return null;
    const day = Number(match[1]);
    const month = Number(match[2]);
    const year = Number(match[3]);
    const check = new Date(Date.UTC(year, month - 1, day));
    if (
      check.getUTCFullYear() !== year ||
      check.getUTCMonth() !== month - 1 ||
      check.getUTCDate() !== day
    ) return null;
    return [match[1], match[2], match[3]];
  }

  function findDateOption(select, part, index) {
    const raw = String(part ?? "").trim();
    const numeric = normalizedNumeric(raw);
    const options = [...select.options];

    const byValue = options.find((o) => normalizedNumeric(o.value) === numeric);
    if (byValue) return byValue;

    const byTextNumeric = options.find((o) => normalizedNumeric(o.textContent) === numeric);
    if (byTextNumeric) return byTextNumeric;

    if (index === 1) {
      const monthNumber = Number(numeric);
      if (monthNumber >= 1 && monthNumber <= 12) {
        const monthName = RU_MONTHS[monthNumber];
        const byMonthName = options.find((o) => norm(o.textContent) === monthName);
        if (byMonthName) return byMonthName;
        // KD-MID normally has one placeholder followed by January..December.
        const indexed = options[monthNumber];
        if (indexed) return indexed;
      }
    }
    return null;
  }

  function dateControlMatches(el, part, index) {
    if (!el) return false;
    if (el.tagName === "SELECT") {
      const option = findDateOption(el, part, index);
      return Boolean(option && el.selectedIndex === option.index);
    }
    return normalizedNumeric(el.value) === normalizedNumeric(part);
  }

  function dateControlsNearLabel(labels) {
    for (const node of labelCandidates(labels)) {
      let current = node;
      for (let depth = 0; depth < 6 && current; depth += 1, current = current.parentElement) {
        const list = [...current.querySelectorAll("input,select")]
          .filter((item) => visible(item) && item.type !== "hidden");
        if (list.length >= 3 && list.length <= 5) return list.slice(0, 3);
      }
    }
    return [];
  }

  function ensureDateNearLabel(labels, value) {
    if (!value) return "ready";
    const parts = value.split("/");
    if (parts.length !== 3) return "missing";
    const list = dateControlsNearLabel(labels);
    if (list.length < 3) return "missing";

    let changed = false;
    let unresolved = false;
    parts.forEach((part, index) => {
      const el = list[index];
      if (!el) { unresolved = true; return; }
      if (el.tagName === "SELECT") {
        const option = findDateOption(el, part, index);
        if (!option) { unresolved = true; return; }
        if (el.value !== option.value || el.selectedIndex !== option.index) {
          el.selectedIndex = option.index;
          el.value = option.value;
          fire(el);
          changed = true;
        }
      } else if (!dateControlMatches(el, part, index)) {
        setNativeControlValue(el, part);
        fire(el);
        changed = true;
      }
    });

    if (unresolved) return "waiting";
    if (!parts.every((part, index) => dateControlMatches(list[index], part, index))) return "waiting";
    return changed ? "changed" : "ready";
  }

  function exactFieldLabelNode(labels) {
    const needles = (Array.isArray(labels) ? labels : [labels]).map(norm).filter(Boolean);
    const nodes = [...document.querySelectorAll("label,td,th,div,span,p,b,strong")];

    const exact = nodes
      .filter((node) => needles.includes(norm(node.textContent)))
      .sort((a, b) => {
        const aControls = controls(a).filter((el) => visible(el) && el.type !== "hidden").length;
        const bControls = controls(b).filter((el) => visible(el) && el.type !== "hidden").length;
        return aControls - bControls || a.children.length - b.children.length;
      });

    return exact[0] || labelCandidates(labels)[0] || null;
  }

  function controlsFromExactField(labels, selector, count = 1) {
    const node = exactFieldLabelNode(labels);
    if (!node) return [];

    // Some KD-MID layouts put the control inside the same TD/DIV as the label.
    const inside = [...node.querySelectorAll(selector)].filter(visible);
    if (inside.length >= count) return inside.slice(0, count);

    // Otherwise use the first controls that occur AFTER this exact field label.
    // This is intentionally NOT based on a parent <tr>, because KD-MID can wrap
    // several fields inside one outer row/table and that caused Имя to overwrite Фамилия.
    const all = [...document.querySelectorAll(selector)].filter(visible);
    const following = all.filter((el) =>
      Boolean(node.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING)
    );
    return following.slice(0, count);
  }

  function textControlForField(labels) {
    return controlsFromExactField(
      labels,
      'input:not([type="hidden"]):not([type="button"]):not([type="submit"]),textarea',
      1
    )[0] || null;
  }

  function selectControlForField(labels) {
    return controlsFromExactField(labels, "select", 1)[0] || null;
  }

  function dateControlsForField(labels) {
    const list = controlsFromExactField(
      labels,
      'input:not([type="hidden"]):not([type="button"]):not([type="submit"]),select',
      3
    );
    if (list.length < 3) return [];
    const selectIndex = list.findIndex((el) => el.tagName === "SELECT");
    if (selectIndex !== 1) return [];
    return [list[0], list[1], list[2]];
  }

  function firstFollowingControl(labels, selector) {
    return controlsFromExactField(labels, selector, 1)[0] || null;
  }

  function followingControls(labels, selector, count = 1) {
    return controlsFromExactField(labels, selector, count);
  }

  function ensureTextAfterLabel(labels, value) {
    if (value == null || value === "") return "ready";
    const el = firstFollowingControl(labels, 'input:not([type="hidden"]):not([type="button"]):not([type="submit"]),textarea');
    if (!el) return "missing";
    return writeTextControl(el, value);
  }

  function ensureSelectAfterLabel(labels, values) {
    const el = firstFollowingControl(labels, "select");
    if (!el) return "missing";
    return writeSelectControl(el, values);
  }

  function ensureDateAfterLabel(labels, value) {
    const list = followingControls(labels, 'input:not([type="hidden"]),select', 3);
    return writeDateControls(list, value);
  }

  let fieldContinueTimer = 0;
  function continueAutofill(payload, delay = 140) {
    window.clearTimeout(fieldContinueTimer);
    fieldContinueTimer = window.setTimeout(() => run(payload), delay);
  }

  function personalPageControls() {
    return {
      surname: textControlForField("Фамилия (согласно паспорту)"),
      givenNames: textControlForField("Имя, другие имена, отчество (согласно паспорту)"),
      otherNames: selectControlForField("Есть ли у Вас другие когда-либо использовавшиеся имена"),
      sex: selectControlForField("Пол"),
      dob: dateControlsForField("Дата рождения"),
      birthPlace: textControlForField("Место рождения"),
      bornInRussia: selectControlForField("Вы родились в России?"),
    };
  }

  function passportPageControls() {
    return {
      passportNo: textControlForField("Номер паспорта"),
      issue: dateControlsForField("Дата выдачи"),
      expiry: dateControlsForField("Действителен до"),
    };
  }

  function isPersonalInfoPage() {
    const body = norm(document.body.innerText || "");
    return body.includes("ПЕРСОНАЛЬНАЯ ИНФОРМАЦИЯ") &&
      body.includes("ФАМИЛИЯ (СОГЛАСНО ПАСПОРТУ)") &&
      body.includes("МЕСТО РОЖДЕНИЯ");
  }

  function fillPersonalInfoPage(payload) {
    if (!isPersonalInfoPage()) return { handled: false, ready: false };
    const A = payload.applicant || {};
    const C = personalPageControls();
    const steps = [
      ["Фамилия", () => C.surname ? writeTextControl(C.surname, A.surname) : ensureTextAfterLabel("Фамилия (согласно паспорту)", A.surname)],
      ["Имя", () => C.givenNames ? writeTextControl(C.givenNames, A.givenNames) : ensureTextAfterLabel("Имя, другие имена, отчество (согласно паспорту)", A.givenNames)],
      ["Другие имена", () => C.otherNames ? writeSelectControl(C.otherNames, ["НЕТ","NO"]) : ensureSelectAfterLabel("Есть ли у Вас другие когда-либо использовавшиеся имена", ["НЕТ","NO"])],
      ["Пол", () => C.sex ? writeSelectControl(C.sex, [A.sex]) : ensureSelectAfterLabel("Пол", [A.sex])],
      ["Дата рождения", () => C.dob.every(Boolean) ? writeDateControls(C.dob, A.birthDate) : ensureDateAfterLabel("Дата рождения", A.birthDate)],
      ["Место рождения", () => C.birthPlace ? writeTextControl(C.birthPlace, A.birthPlace) : ensureTextAfterLabel("Место рождения", A.birthPlace)],
      ["Родились в России", () => C.bornInRussia ? writeSelectControl(C.bornInRussia, ["НЕТ","NO"]) : ensureSelectAfterLabel("Вы родились в России?", ["НЕТ","NO"])],
    ];

    for (const [label, fn] of steps) {
      const state = fn();
      if (state === "changed") {
        status(`KD-MID Visa VN: đã tự điền ${label}. Đang chuyển sang trường kế tiếp…`, "wait");
        continueAutofill(payload);
        return { handled: true, ready: false };
      }
      if (state !== "ready") {
        status(`KD-MID Visa VN: đang chờ đúng trường ${label}; Companion sẽ tự thử lại, không cần bấm chuột.`, "wait");
        continueAutofill(payload, 220);
        return { handled: true, ready: false };
      }
    }

    const finalC = personalPageControls();
    const distinctPersonalTextControls =
      finalC.surname &&
      finalC.givenNames &&
      finalC.birthPlace &&
      finalC.surname !== finalC.givenNames &&
      finalC.surname !== finalC.birthPlace &&
      finalC.givenNames !== finalC.birthPlace;

    const finalReady =
      distinctPersonalTextControls &&
      finalC.surname && String(finalC.surname.value) === String(A.surname || "") &&
      finalC.givenNames && String(finalC.givenNames.value) === String(A.givenNames || "") &&
      finalC.otherNames && selectAlreadyHas(finalC.otherNames, ["НЕТ","NO"]) &&
      finalC.sex && selectAlreadyHas(finalC.sex, [A.sex]) &&
      finalC.dob.length === 3 && parseDmyStrict(A.birthDate) &&
        parseDmyStrict(A.birthDate).every((part, index) => dateControlMatches(finalC.dob[index], part, index)) &&
      finalC.birthPlace && String(finalC.birthPlace.value) === String(A.birthPlace || "") &&
      finalC.bornInRussia && selectAlreadyHas(finalC.bornInRussia, ["НЕТ","NO"]);

    if (!finalReady) {
      if (!distinctPersonalTextControls) {
        status("KD-MID Visa VN: phát hiện selector trùng ô giữa Фамилия / Имя / Место рождения; đang dò lại theo nhãn chính xác.", "wait");
      } else {
        status(`KD-MID Visa VN: chưa xác nhận đủ dữ liệu trang cá nhân; đang tự sửa lại. DOB phải là DD/MM/YYYY = ${A.birthDate || ""}.`, "wait");
      }
      continueAutofill(payload, 180);
      return { handled: true, ready: false };
    }

    refreshAspNetValidators();
    status(`KD-MID Visa VN: trang cá nhân OK: ${payloadIdentity(payload)}.`);
    return { handled: true, ready: true };
  }

  function isPassportInfoPage() {
    const body = norm(document.body.innerText || "");
    return body.includes("ИНФОРМАЦИЯ О ПАСПОРТЕ") &&
      body.includes("НОМЕР ПАСПОРТА") &&
      body.includes("ДАТА ВЫДАЧИ") &&
      body.includes("ДЕЙСТВИТЕЛЕН ДО");
  }

  function fillPassportInfoPage(payload) {
    if (!isPassportInfoPage()) return { handled: false, ready: false };
    const A = payload.applicant || {};
    const C = passportPageControls();

    const steps = [
      ["Номер паспорта", () => C.passportNo ? writeTextControl(C.passportNo, A.passportNo) : ensureTextAfterLabel("Номер паспорта", A.passportNo)],
      ["Дата выдачи", () => C.issue.every(Boolean) ? writeDateControls(C.issue, A.passportIssue) : ensureDateAfterLabel("Дата выдачи", A.passportIssue)],
      ["Действителен до", () => C.expiry.every(Boolean) ? writeDateControls(C.expiry, A.passportExpiry) : ensureDateAfterLabel("Действителен до", A.passportExpiry)],
    ];

    for (const [label, fn] of steps) {
      const state = fn();
      if (state === "changed") {
        status(`KD-MID Visa VN: đã tự điền ${label}. Đang chuyển sang trường hộ chiếu kế tiếp…`, "wait");
        continueAutofill(payload);
        return { handled: true, ready: false };
      }
      if (state !== "ready") {
        status(`KD-MID Visa VN: đang chờ đúng trường hộ chiếu ${label}; Companion sẽ tự thử lại, không cần bấm chuột.`, "wait");
        continueAutofill(payload, 220);
        return { handled: true, ready: false };
      }
    }

    refreshAspNetValidators();
    status(`KD-MID Visa VN: trang hộ chiếu OK: ${A.passportNo || ""} · cấp ${A.passportIssue || ""} · hết hạn ${A.passportExpiry || ""}.`);
    return { handled: true, ready: true };
  }

  function routeDeleteButtons() {
    return [...document.querySelectorAll("button,input[type=\"button\"],input[type=\"submit\"]")]
      .filter(visible)
      .filter((el) => norm(el.textContent || el.value || "") === "УДАЛИТЬ");
  }

  function routeCityLabels() {
    return [...document.querySelectorAll("label,td,th,div,span,p,b,strong")]
      .filter(visible)
      .filter((el) => norm(el.textContent) === "НАСЕЛЕННЫЙ ПУНКТ");
  }

  function routeCityControl() {
    // Use the geometry that is actually visible to the user:
    // exact "Населенный пункт" label -> text input -> "Удалить" button.
    // The real route input is physically BETWEEN that label and that button.
    const labels = routeCityLabels();
    const deletes = routeDeleteButtons();
    const inputs = [...document.querySelectorAll(
      'input:not([type="hidden"]):not([type="button"]):not([type="submit"]):not([type="checkbox"]):not([type="radio"])'
    )].filter(visible);

    const candidates = [];
    for (const label of labels) {
      const lr = label.getBoundingClientRect();

      for (const del of deletes) {
        const dr = del.getBoundingClientRect();
        if (dr.top <= lr.bottom) continue;
        if (dr.top - lr.bottom > 220) continue;

        for (const input of inputs) {
          const ir = input.getBoundingClientRect();
          const betweenVertically = ir.top >= lr.bottom - 8 && ir.bottom <= dr.top + 8;
          const nearLabelX = Math.abs(ir.left - lr.left) <= 220;
          const nearDeleteX = Math.abs(ir.left - dr.left) <= 220;
          const usefulWidth = ir.width >= 120;

          if (!betweenVertically || !nearLabelX || !nearDeleteX || !usefulWidth) continue;

          const score =
            Math.abs(ir.top - lr.bottom) * 10 +
            Math.abs(dr.top - ir.bottom) * 10 +
            Math.abs(ir.left - lr.left) +
            Math.abs(ir.left - dr.left);

          candidates.push({ input, score });
        }
      }
    }

    candidates.sort((a, b) => a.score - b.score);
    return candidates[0]?.input || null;
  }

  function routeCityControlLooksRight(el) {
    if (!el) return false;
    return routeCityControl() === el;
  }

  function typeRouteCityValue(el, value) {
    if (!el) return false;
    const text = String(value || "");
    activateControl(el);

    try { el.setSelectionRange(0, String(el.value || "").length); } catch {}

    let inserted = false;
    try {
      inserted = Boolean(document.execCommand?.("insertText", false, text));
    } catch {}

    if (!inserted || String(el.value || "").trim() !== text) {
      try {
        if (typeof el.setRangeText === "function") {
          const len = String(el.value || "").length;
          el.setSelectionRange(0, len);
          el.setRangeText(text, 0, len, "end");
          inserted = true;
        }
      } catch {}
    }

    if (String(el.value || "").trim() !== text) {
      setNativeControlValue(el, text);
    }

    try {
      el.dispatchEvent(new InputEvent("input", {
        bubbles: true,
        data: text,
        inputType: "insertText",
      }));
    } catch {
      el.dispatchEvent(new Event("input", { bubbles: true }));
    }

    // IMPORTANT: keep focus and DO NOT fire change/blur yet.
    // KD-MID opens a second autocomplete list after typing МОСКВА; the city
    // becomes valid only after selecting МОСКВА from that list.
    try { el.focus({ preventScroll: true }); } catch { try { el.focus(); } catch {} }
    return String(el.value || "").trim() === text;
  }

  function routeSuggestionNode(input, value = "МОСКВА") {
    if (!input) return null;
    const wanted = norm(value);
    const ir = input.getBoundingClientRect();

    const selectors = [
      '[role="option"]',
      'li.ui-menu-item',
      '.ui-autocomplete li',
      '[class*="autocomplete"] li',
      '[class*="suggest"] li',
      '[class*="dropdown"] li',
      'li',
      'a',
      'div',
      'span',
    ].join(",");

    const candidates = [...document.querySelectorAll(selectors)]
      .filter((node) => visible(node))
      .filter((node) => norm(node.textContent) === wanted)
      .filter((node) => !node.contains(input) && node !== input)
      .map((node) => {
        const r = node.getBoundingClientRect();
        const verticalGap = r.top - ir.bottom;
        const horizontalOverlap = Math.min(r.right, ir.right) - Math.max(r.left, ir.left);
        const nearBelow = verticalGap >= -12 && verticalGap <= 260;
        const overlaps = horizontalOverlap > 0 || Math.abs(r.left - ir.left) < 180;
        const roleBonus = node.getAttribute("role") === "option" ? -500 : 0;
        const classBonus = /autocomplete|suggest|menu|dropdown/i.test(node.className || "") ? -250 : 0;
        const leafBonus = node.children.length === 0 ? -40 : 0;
        const score = Math.abs(verticalGap) * 10 + Math.abs(r.left - ir.left) + roleBonus + classBonus + leafBonus;
        return { node, score, nearBelow, overlaps };
      })
      .filter((item) => item.nearBelow && item.overlaps)
      .sort((a, b) => a.score - b.score);

    return candidates[0]?.node || null;
  }

  function chooseRouteSuggestion(input, value = "МОСКВА") {
    const node = routeSuggestionNode(input, value);
    if (!node) return false;

    try {
      node.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, view: window }));
      node.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true, view: window }));
      node.click();
    } catch {
      try { node.click(); } catch { return false; }
    }
    return true;
  }

  const ROUTE_TYPED_AT_KEY = "kd-mid-vn:route-typed-at:v1";
  const ROUTE_SELECTED_AT_KEY = "kd-mid-vn:route-selected-at:v1";

  function routeValidationErrorVisible(input) {
    if (!input) return true;
    let current = input.parentElement;
    for (let depth = 0; depth < 8 && current; depth += 1, current = current.parentElement) {
      const text = norm(current.innerText || current.textContent || "");
      if (!text.includes("НАСЕЛЕННЫЙ ПУНКТ")) continue;
      return (
        text.includes("НЕДОПУСТИМО ПУСТОЕ ЗНАЧЕНИЕ") ||
        text.includes("ЗНАЧЕНИЕ НЕ УДОВЛЕТВОРЯЕТ ШАБЛОНУ") ||
        text.includes("ДОПУСТИМЫ ТОЛЬКО РУССКИЕ БУКВЕННЫЕ")
      );
    }
    return false;
  }

  function isVisitInfoPage() {
    const body = norm(document.body.innerText || "");
    return body.includes("В КАКОЕ УЧРЕЖДЕНИЕ НАПРАВЛЯЕТЕСЬ") &&
      body.includes("МАРШРУТ (НАСЕЛЕННЫЕ ПУНКТЫ)") &&
      body.includes("МЕДИЦИНСКОМ СТРАХОВАНИИ") &&
      body.includes("БЫЛИ ЛИ ВЫ КОГДА-НИБУДЬ В РОССИИ");
  }

  function fillVisitInfoPage(payload) {
    if (!isVisitInfoPage()) return { handled: false, ready: false };
    const A = payload.applicant || {};

    // IMPORTANT: this first select is NOT a yes/no question.
    // It must remain "Организация", never "НЕТ".
    let state = ensureSelectAfterLabel("В какое учреждение направляетесь?", ["ОРГАНИЗАЦИЯ","ORGANIZATION"]);
    if (state === "changed") {
      status("KD-MID Visa VN: đã chọn nơi hướng đến = Организация. Đang điền thông tin tổ chức…", "wait");
      continueAutofill(payload);
      return { handled: true, ready: false };
    }
    if (state !== "ready") {
      status("KD-MID Visa VN: đang chờ dropdown Организация; không được đổi trường này thành НЕТ.", "wait");
      continueAutofill(payload, 220);
      return { handled: true, ready: false };
    }

    const textSteps = [
      ["Наименование организации", payload.organization],
      ["Адрес", payload.organizationAddress],
      ["ИНН организации", payload.tin],
      ["Номер указания (телекса)", payload.telex],
      ["Номер приглашения", payload.invitation || ""],
    ];

    for (const [label, value] of textSteps) {
      if (!value && label === "Номер приглашения") continue;
      state = ensureTextAfterLabel(label, value);
      if (state === "changed") {
        refreshAspNetValidators();
        status(`KD-MID Visa VN: đã tự điền ${label}. Đang tiếp tục tự động…`, "wait");
        continueAutofill(payload);
        return { handled: true, ready: false };
      }
      if (state !== "ready") {
        status(`KD-MID Visa VN: đang chờ đúng trường ${label}; Companion sẽ tự thử lại.`, "wait");
        continueAutofill(payload, 220);
        return { handled: true, ready: false };
      }
    }

    const routeValue = "МОСКВА";
    const routeInput = routeCityControl();
    if (!routeInput || !routeCityControlLooksRight(routeInput)) {
      status("KD-MID Visa VN: chưa khóa đúng ô Маршрут / Населенный пункт hiển thị trên màn hình; đang tự dò lại.", "wait");
      continueAutofill(payload, 220);
      return { handled: true, ready: false };
    }

    const selectedAt = Number(sessionStorage.getItem(ROUTE_SELECTED_AT_KEY) || "0");
    if (selectedAt) {
      const age = Date.now() - selectedAt;
      if (age < 1200) {
        status("KD-MID Visa VN: đã chọn МОСКВА trong gợi ý; đang chờ KD-MID xác nhận và ổn định lại ô…", "wait");
        continueAutofill(payload, 260);
        return { handled: true, ready: false };
      }

      sessionStorage.removeItem(ROUTE_SELECTED_AT_KEY);
      sessionStorage.removeItem(ROUTE_TYPED_AT_KEY);

      const settledInput = routeCityControl();
      const accepted =
        settledInput &&
        routeCityControlLooksRight(settledInput) &&
        String(settledInput.value || "").trim() === routeValue &&
        !routeValidationErrorVisible(settledInput);

      if (!accepted) {
        status("KD-MID Visa VN: KD-MID chưa chấp nhận gợi ý МОСКВА sau khi chọn; đang nhập lại từ đầu, không báo OK giả.", "wait");
        if (settledInput) {
          activateControl(settledInput);
          setNativeControlValue(settledInput, "");
          settledInput.dispatchEvent(new Event("input", { bubbles: true }));
        }
        continueAutofill(payload, 260);
        return { handled: true, ready: false };
      }
    }

    const liveRouteInput = routeCityControl();
    if (!liveRouteInput || !routeCityControlLooksRight(liveRouteInput)) {
      status("KD-MID Visa VN: chưa khóa được đúng ô Населенный пункт đang hiển thị; đang dò lại.", "wait");
      continueAutofill(payload, 220);
      return { handled: true, ready: false };
    }

    const liveValue = String(liveRouteInput.value || "").trim();
    const hasRouteError = routeValidationErrorVisible(liveRouteInput);
    const typedAt = Number(sessionStorage.getItem(ROUTE_TYPED_AT_KEY) || "0");

    if (liveValue !== routeValue) {
      const typed = typeRouteCityValue(liveRouteInput, routeValue);
      if (!typed) {
        status("KD-MID Visa VN: chưa gõ được МОСКВА vào đúng ô Населенный пункт; đang thử lại.", "wait");
        continueAutofill(payload, 260);
        return { handled: true, ready: false };
      }
      sessionStorage.setItem(ROUTE_TYPED_AT_KEY, String(Date.now()));
      status("KD-MID Visa VN: đã gõ МОСКВА vào đúng ô. Đang chờ danh sách gợi ý xuất hiện…", "wait");
      continueAutofill(payload, 360);
      return { handled: true, ready: false };
    }

    if (hasRouteError) {
      const suggestion = routeSuggestionNode(liveRouteInput, routeValue);
      if (suggestion) {
        const chosen = chooseRouteSuggestion(liveRouteInput, routeValue);
        if (chosen) {
          sessionStorage.setItem(ROUTE_SELECTED_AT_KEY, String(Date.now()));
          status("KD-MID Visa VN: đã click đúng gợi ý МОСКВА; đang chờ KD-MID xác nhận, chưa báo OK.", "wait");
          continueAutofill(payload, 300);
          return { handled: true, ready: false };
        }
      }

      if (!typedAt || Date.now() - typedAt > 1400) {
        typeRouteCityValue(liveRouteInput, routeValue);
        sessionStorage.setItem(ROUTE_TYPED_AT_KEY, String(Date.now()));
      }

      status("KD-MID Visa VN: МОСКВА mới chỉ được gõ, chưa được KD-MID chấp nhận. Đang chờ đúng gợi ý МОСКВА để click.", "wait");
      continueAutofill(payload, 360);
      return { handled: true, ready: false };
    }

    sessionStorage.removeItem(ROUTE_TYPED_AT_KEY);
    sessionStorage.removeItem(ROUTE_SELECTED_AT_KEY);

    state = ensureSelectAfterLabel(
      "Имеете ли Вы документ о медицинском страховании, действительный на территории России?",
      A.hasInsurance ? ["ДА","YES"] : ["НЕТ","NO"]
    );
    if (state === "changed") {
      status(`KD-MID Visa VN: bảo hiểm = ${A.hasInsurance ? "ДА" : "НЕТ"}. Đang tiếp tục…`, "wait");
      continueAutofill(payload);
      return { handled: true, ready: false };
    }
    if (state !== "ready") {
      status("KD-MID Visa VN: đang chờ đúng dropdown bảo hiểm ДА/НЕТ.", "wait");
      continueAutofill(payload, 220);
      return { handled: true, ready: false };
    }

    if (A.hasInsurance && A.insurancePolicy) {
      state = ensureTextAfterLabel(
        ["Название страховой компании и номер полиса","номер страхового документа"],
        A.insurancePolicy
      );
      if (state === "changed") {
        continueAutofill(payload);
        return { handled: true, ready: false };
      }
      if (state !== "ready") {
        continueAutofill(payload, 220);
        return { handled: true, ready: false };
      }
    }

    state = ensureSelectAfterLabel(
      "Были ли Вы когда-нибудь в России?",
      A.visitedRussia ? ["ДА","YES"] : ["НЕТ","NO"]
    );
    if (state === "changed") {
      status(`KD-MID Visa VN: từng đến Nga = ${A.visitedRussia ? "ДА" : "НЕТ"}. Đang tiếp tục…`, "wait");
      continueAutofill(payload);
      return { handled: true, ready: false };
    }
    if (state !== "ready") {
      status("KD-MID Visa VN: đang chờ đúng dropdown từng đến Nga ДА/НЕТ.", "wait");
      continueAutofill(payload, 220);
      return { handled: true, ready: false };
    }

    if (A.visitedRussia) {
      state = ensureTextAfterLabel("Сколько раз Вы были в России", A.visitsCount);
      if (state === "changed") {
        continueAutofill(payload);
        return { handled: true, ready: false };
      }
      if (state !== "ready") {
        continueAutofill(payload, 220);
        return { handled: true, ready: false };
      }

      state = ensureDateAfterLabel(["Даты Вашей последней поездки","Дата въезда"], A.lastVisitFrom);
      if (state === "changed") {
        continueAutofill(payload);
        return { handled: true, ready: false };
      }
      if (state !== "ready") {
        continueAutofill(payload, 220);
        return { handled: true, ready: false };
      }

      state = ensureDateAfterLabel("Дата выезда", A.lastVisitTo);
      if (state === "changed") {
        continueAutofill(payload);
        return { handled: true, ready: false };
      }
      if (state !== "ready") {
        continueAutofill(payload, 220);
        return { handled: true, ready: false };
      }
    }

    const finalRoute = routeCityControl();
    if (
      !finalRoute ||
      !routeCityControlLooksRight(finalRoute) ||
      String(finalRoute.value).trim() !== "МОСКВА" ||
      routeValidationErrorVisible(finalRoute)
    ) {
      status("KD-MID Visa VN: Маршрут chưa khớp payload; chưa được phép bấm Далее.", "wait");
      continueAutofill(payload, 180);
      return { handled: true, ready: false };
    }

    refreshAspNetValidators();
    status(`KD-MID Visa VN: trang thông tin chuyến đi OK. KD-MID đã chấp nhận gợi ý Населенный пункт = ${finalRoute.value}; không còn lỗi đỏ.`);
    return { handled: true, ready: true };
  }

  function isContactInfoPage() {
    const body = norm(document.body.innerText || "");
    return body.includes("ИМЕЕТЕ ЛИ ВЫ АДРЕС ПОСТОЯННОГО ПРОЖИВАНИЯ") &&
      body.includes("АДРЕС ВАШЕГО ПОСТОЯННОГО ПРОЖИВАНИЯ") &&
      body.includes("МЕСТО РАБОТЫ (УЧЕБЫ)") &&
      body.includes("РАБОЧИЙ АДРЕС");
  }

  function contactInfoControls() {
    // This KD-MID page has a stable visual/control order. Previous label-based
    // lookup could miss "Ваш личный E-mail" even though the value exists in the
    // payload. Use the page's actual control sequence and deliberately skip Fax.
    const textInputs = [...document.querySelectorAll(
      'input:not([type="hidden"]):not([type="button"]):not([type="submit"]):not([type="checkbox"]):not([type="radio"]):not([type="password"])'
    )].filter(visible);
    const selects = [...document.querySelectorAll("select")].filter(visible);

    if (textInputs.length >= 10 && selects.length >= 4) {
      return {
        hasPermanentAddress: selects[0],
        permanentAddress: textInputs[0],
        personalPhone: textInputs[1],
        personalFax: textInputs[2],
        personalEmail: textInputs[3],
        worksOrStudies: selects[1],
        employer: textInputs[4],
        position: textInputs[5],
        workAddress: textInputs[6],
        workPhone: textInputs[7],
        workFax: textInputs[8],
        workEmail: textInputs[9],
        children: selects[2],
        relatives: selects[3],
      };
    }

    // Fallback for minor markup variations.
    return {
      hasPermanentAddress: selectControlForField("Имеете ли Вы адрес постоянного проживания?"),
      permanentAddress: textControlForField("Адрес вашего постоянного проживания"),
      personalPhone: textControlForField("Ваш личный телефон"),
      personalFax: textControlForField("Ваш личный факс"),
      personalEmail: textControlForField(["Ваш личный E-mail", "Ваш личный Email"]),
      worksOrStudies: selectControlForField("Вы работаете (работали ранее), учитесь (учились ранее)?"),
      employer: textControlForField("Место работы (учебы)"),
      position: textControlForField("Должность"),
      workAddress: textControlForField("Рабочий адрес"),
      workPhone: textControlForField("Рабочий телефон"),
      workFax: textControlForField("Рабочий факс"),
      workEmail: textControlForField(["Рабочий E-mail", "Рабочий Email"]),
      children: selectControlForField("Дети до 16 лет"),
      relatives: selectControlForField("Имеете ли Вы в настоящее время родственников"),
    };
  }

  function fillContactInfoPage(payload) {
    if (!isContactInfoPage()) return { handled: false, ready: false };
    const A = payload.applicant || {};
    const C = contactInfoControls();

    const clearFax = (control) => {
      if (!control || !String(control.value || "")) return;
      activateControl(control);
      setNativeControlValue(control, "");
      control.dispatchEvent(new Event("input", { bubbles: true }));
      control.dispatchEvent(new Event("change", { bubbles: true }));
      try { control.blur(); } catch {}
    };

    clearFax(C.personalFax);
    clearFax(C.workFax);

    const optionalText = (control, value) => {
      const text = String(value ?? "");
      if (!control) return text ? "missing" : "ready";
      if (!text) {
        if (!String(control.value || "")) return "ready";
        activateControl(control);
        setNativeControlValue(control, "");
        control.dispatchEvent(new Event("input", { bubbles: true }));
        control.dispatchEvent(new Event("change", { bubbles: true }));
        try { control.blur(); } catch {}
        return String(control.value || "") === "" ? "changed" : "waiting";
      }
      return writeTextControl(control, text);
    };

    const steps = [
      ["Có địa chỉ thường trú", () => C.hasPermanentAddress ? writeSelectControl(C.hasPermanentAddress, ["ДА","YES"]) : "missing"],
      ["Địa chỉ thường trú", () => optionalText(C.permanentAddress, payload.fixedPermanentAddress || A.personalAddress)],
      ["Điện thoại cá nhân", () => optionalText(C.personalPhone, A.phone)],
      ["E-mail cá nhân", () => optionalText(C.personalEmail, A.email)],
      ["Đang làm việc/học tập", () => C.worksOrStudies ? writeSelectControl(C.worksOrStudies, ["ДА","YES"]) : "missing"],
      ["Nơi làm việc/học tập", () => optionalText(C.employer, A.workStudyPlace || payload.employer)],
      ["Chức vụ", () => optionalText(C.position, A.position || payload.defaultPosition)],
      ["Địa chỉ cơ quan", () => optionalText(C.workAddress, A.workAddress || payload.employerAddress)],
      ["Điện thoại cơ quan", () => optionalText(C.workPhone, A.workPhone || payload.fixedWorkPhone)],
      ["E-mail cơ quan", () => optionalText(C.workEmail, A.workEmail || payload.employerEmail)],
      ["Trẻ em dưới 16 tuổi", () => C.children ? writeSelectControl(C.children, A.childrenUnder16 ? ["ДА","YES"] : ["НЕТ","NO"]) : "missing"],
      ["Người thân tại Nga", () => C.relatives ? writeSelectControl(C.relatives, A.relativesInRussia ? ["ДА","YES"] : ["НЕТ","NO"]) : "missing"],
    ];

    // Fax fields are intentionally skipped. KD-MID does not require them and
    // the profile does not store fax numbers.
    for (const [label, fn] of steps) {
      const state = fn();
      if (state === "changed") {
        status(`KD-MID Visa VN: đã điền ${label}. Đang tiếp tục trang liên hệ…`, "wait");
        continueAutofill(payload, 140);
        return { handled: true, ready: false };
      }
      if (state !== "ready") {
        const detail = label === "E-mail cá nhân"
          ? ` (payload email: ${String(A.email || "") || "trống"})`
          : "";
        status(`KD-MID Visa VN: đang chờ đúng trường ${label}${detail}; chưa được phép bấm Далее.`, "wait");
        continueAutofill(payload, 220);
        return { handled: true, ready: false };
      }
    }

    const finalC = contactInfoControls();
    const expected = {
      permanentAddress: String(payload.fixedPermanentAddress || A.personalAddress || ""),
      personalPhone: String(A.phone || ""),
      personalEmail: String(A.email || ""),
      employer: String(A.workStudyPlace || payload.employer || ""),
      position: String(A.position || payload.defaultPosition || ""),
      workAddress: String(A.workAddress || payload.employerAddress || ""),
      workPhone: String(A.workPhone || payload.fixedWorkPhone || ""),
      workEmail: String(A.workEmail || payload.employerEmail || ""),
    };

    const textPairs = [
      [finalC.permanentAddress, expected.permanentAddress],
      [finalC.personalPhone, expected.personalPhone],
      [finalC.personalEmail, expected.personalEmail],
      [finalC.employer, expected.employer],
      [finalC.position, expected.position],
      [finalC.workAddress, expected.workAddress],
      [finalC.workPhone, expected.workPhone],
      [finalC.workEmail, expected.workEmail],
    ];

    const usedControls = textPairs.filter(([control, value]) => Boolean(value) && control).map(([control]) => control);
    const uniqueTextCount = new Set(usedControls).size;
    const textReady = textPairs.every(([control, value]) => {
      if (!value) return !control || String(control.value || "") === "";
      return Boolean(control) && String(control.value) === String(value);
    });

    const ready =
      uniqueTextCount === usedControls.length &&
      finalC.hasPermanentAddress && selectAlreadyHas(finalC.hasPermanentAddress, ["ДА","YES"]) &&
      finalC.worksOrStudies && selectAlreadyHas(finalC.worksOrStudies, ["ДА","YES"]) &&
      finalC.children && selectAlreadyHas(finalC.children, A.childrenUnder16 ? ["ДА","YES"] : ["НЕТ","NO"]) &&
      finalC.relatives && selectAlreadyHas(finalC.relatives, A.relativesInRussia ? ["ДА","YES"] : ["НЕТ","NO"]) &&
      textReady;

    if (!ready) {
      status("KD-MID Visa VN: trang liên hệ còn trường sai/đang trỏ nhầm ô; đang tự sửa, chưa bấm Далее.", "wait");
      continueAutofill(payload, 180);
      return { handled: true, ready: false };
    }

    if (A.childrenUnder16 || A.relativesInRussia) {
      status("KD-MID Visa VN: đã chọn ДА cho mục cuối theo hồ sơ. KD-MID có thể mở trường chi tiết; hãy điền phần chi tiết phát sinh trước khi tiếp tục.", "wait");
      return { handled: true, ready: false };
    }

    refreshAspNetValidators();
    status("KD-MID Visa VN: trang liên hệ/cơ quan đã điền đúng. Hai dòng Fax được bỏ qua.");
    return { handled: true, ready: true };
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
    const state = writeTextControl(el, value);
    return state === "ready" || state === "changed";
  }

  function setSelect(labels, values) {
    const el = blockControls(labels).find((item) => item.tagName === "SELECT");
    if (!el) return false;
    const wants = (Array.isArray(values) ? values : [values]).map(norm);
    const option = [...el.options].find((o) => wants.includes(norm(o.textContent))) ||
      [...el.options].find((o) => wants.some((want) => want && norm(o.textContent).includes(want)));
    if (!option) return false;
    const state = writeSelectControl(el, [option.textContent, option.value]);
    return state === "ready" || state === "changed";
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
    let resolved = true;
    parts.forEach((part, index) => {
      const el = list[index];
      if (!el) { resolved = false; return; }
      if (el.tagName === "SELECT") {
        const option = findDateOption(el, part, index);
        if (!option) { resolved = false; return; }
        if (el.value !== option.value || el.selectedIndex !== option.index) {
          el.selectedIndex = option.index;
          el.value = option.value;
          fire(el);
        }
      } else if (!dateControlMatches(el, part, index)) {
        el.value = part;
        fire(el);
      }
    });
    return resolved && parts.every((part, index) => dateControlMatches(list[index], part, index));
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

  function fillVisaRequestPage(payload) {
    if (!isVisaRequestPage()) return { handled: false, ready: false };
    const A = payload.applicant || {};

    let state = ensureSelectNearLabel("Гражданство", [payload.citizenship, "ВЬЕТНАМ"]);
    if (state === "changed") {
      status("KD-MID Visa VN: đã chọn Гражданство = ВЬЕТНАМ. Đang chờ KD-MID cập nhật…", "wait");
      return { handled: true, ready: false };
    }
    if (state !== "ready") {
      status("KD-MID Visa VN: đang chờ trường Гражданство…", "wait");
      return { handled: true, ready: false };
    }

    const former = A.hadFormerRussianCitizenship ? ["ДА"] : ["НЕТ"];
    state = ensureVisaFormerCitizenship(Boolean(A.hadFormerRussianCitizenship));
    if (state === "changed") {
      status("KD-MID Visa VN: đã chọn quốc tịch Liên Xô/Nga = " + former[0] + ". Đang chờ cập nhật…", "wait");
      return { handled: true, ready: false };
    }
    if (state !== "ready") {
      status("KD-MID Visa VN: đang dò đúng dropdown ДА/НЕТ của quốc tịch Liên Xô/Nga…", "wait");
      return { handled: true, ready: false };
    }

    if (A.hadFormerRussianCitizenship) {
      const lostDateState = ensureDateNearLabel(["Когда?","Когда"], A.formerCitizenshipLostDate);
      if (lostDateState === "changed") return { handled: true, ready: false };
      setText(["В связи с чем?","В связи с чем"], A.formerCitizenshipLossReason);
    }

    state = ensureSelectNearLabel("Цель поездки (раздел)", [payload.purposeSection, "УЧЕБА"]);
    if (state === "changed") {
      status("KD-MID Visa VN: đã chọn Цель поездки (раздел) = УЧЕБА. Đang chờ danh sách mục đích…", "wait");
      return { handled: true, ready: false };
    }
    if (state !== "ready") {
      status("KD-MID Visa VN: đang chờ Цель поездки (раздел)…", "wait");
      return { handled: true, ready: false };
    }

    state = ensureSelectNearLabel("Цель поездки", [payload.purpose, "УЧЕБА"]);
    if (state === "changed") {
      status("KD-MID Visa VN: đã chọn Цель поездки = УЧЕБА. Đang chờ loại visa…", "wait");
      return { handled: true, ready: false };
    }
    if (state !== "ready") {
      status("KD-MID Visa VN: đang chờ KD-MID nạp Цель поездки…", "wait");
      return { handled: true, ready: false };
    }

    state = ensureSelectNearLabel("Категория и вид визы", [payload.visaType, "ОБЫКНОВЕННАЯ УЧЕБНАЯ"]);
    if (state === "changed") {
      status("KD-MID Visa VN: đã chọn ОБЫКНОВЕННАЯ УЧЕБНАЯ. Đang chờ trường tiếp theo…", "wait");
      return { handled: true, ready: false };
    }
    if (state !== "ready") {
      status("KD-MID Visa VN: đang chờ KD-MID nạp Категория и вид визы…", "wait");
      return { handled: true, ready: false };
    }

    state = ensureSelectNearLabel("Кратность визы", [payload.entries, "ОДНОКРАТНАЯ"]);
    if (state === "changed") {
      status("KD-MID Visa VN: đã chọn Кратность визы = ОДНОКРАТНАЯ.", "wait");
      return { handled: true, ready: false };
    }
    if (state !== "ready") {
      status("KD-MID Visa VN: đang chờ Кратность визы…", "wait");
      return { handled: true, ready: false };
    }

    const entryState = ensureDateNearLabel("Дата въезда в Россию", payload.entryDate);
    if (entryState === "changed") {
      status("KD-MID Visa VN: đã điền ngày vào Nga. Đang chờ ổn định…", "wait");
      return { handled: true, ready: false };
    }
    if (entryState !== "ready") {
      status("KD-MID Visa VN: đang chờ trường ngày vào Nga…", "wait");
      return { handled: true, ready: false };
    }

    const exitState = ensureDateNearLabel("Дата выезда из России", payload.exitDate);
    if (exitState === "changed") {
      status("KD-MID Visa VN: đã điền ngày rời Nga. Đang kiểm tra trang…", "wait");
      return { handled: true, ready: false };
    }
    if (exitState !== "ready") {
      status("KD-MID Visa VN: đang chờ trường ngày rời Nga…", "wait");
      return { handled: true, ready: false };
    }

    status("KD-MID Visa VN: trang visa đã đúng: ВЬЕТНАМ · НЕТ · УЧЕБА · УЧЕБА · ОБЫКНОВЕННАЯ УЧЕБНАЯ · ОДНОКРАТНАЯ.");
    return { handled: true, ready: true };
  }

  function fillPage(payload) {
    const visaPage = fillVisaRequestPage(payload);
    if (visaPage.handled) return visaPage.ready ? 1 : 0;

    const personalPage = fillPersonalInfoPage(payload);
    if (personalPage.handled) return personalPage.ready ? 1 : 0;

    const passportPage = fillPassportInfoPage(payload);
    if (passportPage.handled) return passportPage.ready ? 1 : 0;

    const visitPage = fillVisitInfoPage(payload);
    if (visitPage.handled) return visitPage.ready ? 1 : 0;

    const contactPage = fillContactInfoPage(payload);
    if (contactPage.handled) return contactPage.ready ? 1 : 0;

    const A = payload.applicant || {};
    let recognized = 0;
    const mark = (ok) => { if (ok) recognized += 1; };

    recognized += fillPassword(payload);

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

  const pendingNavigationKey = "kd-mid-vn:navigation-pending:v1";

  function clickNamed(labels, delay = 700) {
    const wants = labels.map(norm);
    const candidates = [...document.querySelectorAll("button,input[type=button],input[type=submit],a")];
    const button = candidates.find((el) => wants.includes(norm(el.textContent || el.value)));
    if (!button || button.disabled) return false;

    const sig = pageSignature() + ":" + wants.join(",");
    const pending = sessionStorage.getItem(pendingNavigationKey);
    if (pending === sig) return true;

    const previousAt = Number(sessionStorage.getItem(CLICK_KEY + ":" + sig) || "0");
    if (Date.now() - previousAt < 5000) return true;

    sessionStorage.setItem(CLICK_KEY + ":" + sig, String(Date.now()));
    sessionStorage.setItem(pendingNavigationKey, sig);
    setTimeout(() => {
      button.click();
      window.setTimeout(() => {
        if (sessionStorage.getItem(pendingNavigationKey) === sig) {
          sessionStorage.removeItem(pendingNavigationKey);
        }
      }, 8000);
    }, delay);
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
    if (isPersonalInfoPage() && recognized < 1) return false;
    if (isPassportInfoPage() && recognized < 1) return false;
    if (isVisitInfoPage() && recognized < 1) return false;

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
  let lastRunSignature = "";
  function run(payload) {
    addHints();
    const currentSig = pageSignature();
    if (lastRunSignature && currentSig !== lastRunSignature) {
      sessionStorage.removeItem(pendingNavigationKey);
    }
    lastRunSignature = currentSig;

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
  const hashPayload = readPayloadFromHash();
  let currentPayload = hashPayload || readSharedPayload();
  let currentRevision = payloadRevision(currentPayload);

  function applyLatestPayload(payload, source = "hồ sơ") {
    if (!payload) return;
    const nextRevision = payloadRevision(payload);
    if (currentPayload && nextRevision && currentRevision && nextRevision < currentRevision) {
      console.warn("[KD-MID Visa VN] Bỏ qua payload cũ", { nextRevision, currentRevision, identity: payloadIdentity(payload) });
      return;
    }
    currentPayload = payload;
    currentRevision = Math.max(currentRevision || 0, nextRevision || 0);
    gmSet(SHARED_PAYLOAD_KEY, JSON.stringify(payload));
    status(`KD-MID Visa VN Companion v${VERSION} đã nhận ${source}: ${payloadIdentity(payload)}.`);
    startProgressiveRun(payload);
  }

  if (!currentPayload) {
    status(`KD-MID Visa VN Companion v${VERSION} đang chạy nhưng chưa nhận được hồ sơ. Quay lại App-Manager và bấm “Bắt đầu tự động đến PDF”.`, "wait");
  } else {
    status(`KD-MID Visa VN Companion v${VERSION} đang dùng payload: ${payloadIdentity(currentPayload)}.`);
    startProgressiveRun(currentPayload);
  }

  window.addEventListener("hashchange", () => {
    const fresh = readPayloadFromHash();
    if (fresh) applyLatestPayload(fresh, "dữ liệu cập nhật");
  });

  try {
    GM_addValueChangeListener(SHARED_PAYLOAD_KEY, (_name, oldValue, newValue) => {
      if (!newValue || newValue === oldValue) return;
      try {
        const fresh = JSON.parse(newValue);
        const freshRevision = payloadRevision(fresh);
        if (currentRevision && freshRevision && freshRevision < currentRevision) return;
        if (currentPayload?.applicant?.id && fresh?.applicant?.id && fresh.applicant.id !== currentPayload.applicant.id) {
          console.warn("[KD-MID Visa VN] Bỏ qua payload của hồ sơ khác", payloadIdentity(fresh));
          return;
        }
        if (payloadIdentity(fresh) === payloadIdentity(currentPayload) && freshRevision === currentRevision) return;
        applyLatestPayload(fresh, "payload mới từ App-Manager");
      } catch {}
    });
  } catch (error) {
    console.warn("[KD-MID Visa VN] payload listener unavailable", error);
  }

  let captchaIdleTimer = 0;
  document.addEventListener("input", (event) => {
    const current = currentPayload || readSharedPayload();
    if (!current || !isPasswordCaptchaPage()) return;
    if (event.target !== findCaptchaInput()) return;
    window.clearTimeout(captchaIdleTimer);
    if (captchaValue().length >= 5) {
      captchaIdleTimer = window.setTimeout(() => run(current), 700);
    }
  }, true);

  document.addEventListener("change", (event) => {
    const current = currentPayload || readSharedPayload();
    if (!current || !isPasswordCaptchaPage()) return;
    if (event.target !== findCaptchaInput() || captchaValue().length < 3) return;
    window.setTimeout(() => run(current), 120);
  }, true);

  document.addEventListener("keydown", (event) => {
    const current = currentPayload || readSharedPayload();
    if (!current || !isPasswordCaptchaPage()) return;
    if (event.key !== "Enter" || event.target !== findCaptchaInput() || captchaValue().length < 3) return;
    event.preventDefault();
    window.setTimeout(() => run(current), 50);
  }, true);

  function isOwnStatusMutation(mutation) {
    const nodes = [...mutation.addedNodes, ...mutation.removedNodes];
    return nodes.length > 0 && nodes.every((node) => node?.id === "kd-mid-vn-status");
  }

  const observer = new MutationObserver((mutations) => {
    if (mutations.length && mutations.every(isOwnStatusMutation)) return;
    const current = currentPayload || readSharedPayload();
    addHints();
    if (!current) return;
    window.clearTimeout(observer._kdmidTimer);
    observer._kdmidTimer = window.setTimeout(() => run(current), 180);
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
})();
