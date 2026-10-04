import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const dashboard = fs.readFileSync("app/management-dashboard-v2.tsx", "utf8");
const tool = fs.readFileSync("app/tools/kd-mid-visa/kd-mid-visa.tsx", "utf8");
const page = fs.readFileSync("app/tools/kd-mid-visa/page.tsx", "utf8");
const companion = fs.readFileSync("public/kd-mid-visa-companion.user.js", "utf8");

test("KD-MID Visa is registered as an internal Tool", () => {
  assert.match(dashboard, /id: "tool-kd-mid-visa"/);
  assert.match(dashboard, /href: "\/tools\/kd-mid-visa"/);
  assert.match(dashboard, /name: "KD-MID Visa VN"/);
  assert.match(page, /requireChatGPTUser\("\/tools\/kd-mid-visa"\)/);
});

test("Companion v0.9.27 is active in script and UI", () => {
  assert.match(companion, /@version\s+0\.9\.27/);
  assert.match(companion, /const VERSION = "0\.9\.27"/);
  assert.match(tool, /Companion v0\.9\.27/);
});

test("landing, password and official A4 flows remain intact", () => {
  assert.match(companion, /fillLandingPage/);
  assert.match(companion, /РУССКИЙ \(RUSSIAN\)/);
  assert.match(companion, /function fillPassword/);
  assert.match(companion, /ВВЕДИТЕ НАДПИСЬ С КАРТИНКИ/);
  assert.match(companion, /ПЕЧАТЬ ФОРМАТА A4/);
  assert.match(companion, /printButton\.click/);
});

test("visa request page keeps the required study values", () => {
  assert.match(companion, /function fillVisaRequestPage/);
  assert.match(companion, /ВЬЕТНАМ/);
  assert.match(companion, /УЧЕБА/);
  assert.match(companion, /ОБЫКНОВЕННАЯ УЧЕБНАЯ/);
  assert.match(companion, /ОДНОКРАТНАЯ/);
});

test("personal page writes all required fields in one pass", () => {
  assert.match(companion, /function fillPersonalInfoPage/);
  assert.match(companion, /let waitingFor = ""/);
  assert.match(companion, /let changed = false/);
  assert.match(companion, /for \(const \[label, fn\] of steps\)/);
  assert.match(companion, /const checks = \[/);
  assert.match(companion, /trang cá nhân OK/);
  assert.doesNotMatch(companion.slice(companion.indexOf("function fillPersonalInfoPage"), companion.indexOf("function setText")), /đã điền " \+ label/);
});

test("personal page maps surname, given names, sex, DOB and birth place independently", () => {
  assert.match(companion, /ensureTextAfterLabel\("Фамилия \(согласно паспорту\)"/);
  assert.match(companion, /ensureTextAfterLabel\("Имя, другие имена, отчество \(согласно паспорту\)"/);
  assert.match(companion, /ensureSelectAfterLabel\("Пол"/);
  assert.match(companion, /ensureDateAfterLabel\("Дата рождения"/);
  assert.match(companion, /ensureTextAfterLabel\("Место рождения"/);
});

test("Russian month names are supported and date is not ready until the month really matches", () => {
  assert.match(companion, /const RU_MONTHS = \["","ЯНВАРЬ","ФЕВРАЛЬ","МАРТ"/);
  assert.match(companion, /function findDateOption/);
  assert.match(companion, /monthName = RU_MONTHS\[monthNumber\]/);
  assert.match(companion, /if \(!option\) \{ unresolved = true; return; \}/);
  assert.match(companion, /dateControlMatches/);
});

test("App-Manager normalizes profile dates before building the payload", () => {
  assert.match(tool, /function normalizeDmy/);
  assert.match(tool, /birthDate: normalizeDmy\(applicant\.birthDate\)/);
  assert.match(tool, /passportIssue: normalizeDmy\(applicant\.passportIssue\)/);
  assert.match(tool, /entryDate: normalizeDmy\(common\.entryDate\)/);
  assert.match(tool, /function DateTextInput/);
});

test("save writes one canonical applicant payload immediately", () => {
  assert.match(tool, /const activePayloadKey/);
  assert.match(tool, /function persistActivePayload/);
  assert.match(tool, /persistStoreSnapshot\(nextStore\)/);
  assert.match(tool, /const payload = buildPayload\(normalized, nextStore\.common, autoAdvance\)/);
  assert.match(tool, /persistActivePayload\(payload\)/);
  assert.match(tool, /KD_MID_SET_PAYLOAD/);
});

test("profile selection is persisted synchronously and refreshes the active payload", () => {
  assert.match(tool, /function selectApplicant\(id: string\)/);
  assert.match(tool, /persistStoreSnapshot\(next\)/);
  assert.match(tool, /persistActivePayload\(payload\)/);
  assert.match(tool, /onChange=\{\(event\) => selectApplicant\(event\.target\.value\)\}/);
});

test("launch uses persisted selectedId before potentially stale React state", () => {
  assert.match(tool, /const requestedId = persisted\.selectedId \|\| store\.selectedId/);
  assert.match(tool, /const latestSelected = persisted\.applicants\.find/);
  assert.match(tool, /const revision = Date\.now\(\)/);
  assert.match(tool, /buildPayload\(latestSelected, latestCommon, autoAdvance, revision\)/);
  assert.match(tool, /persistActivePayload\(latestPayload\)/);
});

test("launch performs a post-persist payload sanity check", () => {
  assert.match(tool, /const persistedPayload = readActivePayload\(\)/);
  assert.match(tool, /payload vừa lưu không khớp hồ sơ đang chọn/);
  assert.match(tool, /target\.close\(\)/);
});

test("explicit launch hash purges the previous shared payload before storing the new one", () => {
  assert.match(companion, /GM_deleteValue\(SHARED_PAYLOAD_KEY\)/);
  assert.match(companion, /gmSet\(SHARED_PAYLOAD_KEY, JSON\.stringify\(payload\)\)/);
});

test("Companion rejects payloads belonging to another applicant", () => {
  assert.match(companion, /fresh\.applicant\.id !== currentPayload\.applicant\.id/);
  assert.match(companion, /Bỏ qua payload của hồ sơ khác/);
});

test("ASP.NET validation is refreshed after personal values are written", () => {
  assert.match(companion, /function refreshAspNetValidators/);
  assert.match(companion, /ValidatorValidate/);
  assert.match(companion, /refreshAspNetValidators\(\)/);
});

test("three Vietnam missions remain available", () => {
  assert.match(tool, /ПОСОЛЬСТВО РФ ВО ВЬЕТНАМЕ/);
  assert.match(tool, /ГЕНКОНСУЛЬСТВО РФ В ДАНАНГЕ/);
  assert.match(tool, /ГЕНКОНСУЛЬСТВО РФ В ХОШИМИНЕ/);
});


test("passport page has an exact handler for passport number and both passport dates", () => {
  assert.match(companion, /function isPassportInfoPage/);
  assert.match(companion, /function fillPassportInfoPage/);
  assert.match(companion, /ensureTextAfterLabel\("Номер паспорта"/);
  assert.match(companion, /ensureDateAfterLabel\("Дата выдачи"/);
  assert.match(companion, /ensureDateAfterLabel\("Действителен до"/);
  assert.match(companion, /страница hộ chiếu|trang hộ chiếu OK/);
});

test("generic fill no longer handles passport date fields", () => {
  const fill = companion.slice(companion.indexOf("function fillPage"), companion.indexOf("function addHints"));
  assert.match(fill, /fillPassportInfoPage\(payload\)/);
  assert.doesNotMatch(fill, /mark\(setDate\("Дата выдачи"/);
  assert.doesNotMatch(fill, /mark\(setDate\("Действителен до"/);
});

test("passport date fields use dd/mm/yyyy and Russian month mapping before Next", () => {
  assert.match(tool, /Дата выдачи паспорта · dd\/mm\/yyyy/);
  assert.match(tool, /Паспорт действителен до · dd\/mm\/yyyy/);
  assert.match(tool, /đổi 06 thành Июнь/);
  assert.match(companion, /findDateOption/);
  assert.match(companion, /isPassportInfoPage\(\) && recognized < 1/);
});

test("navigation clicks are latched so the same page is not clicked repeatedly while loading", () => {
  assert.match(companion, /pendingNavigationKey/);
  assert.match(companion, /if \(pending === sig\) return true/);
  assert.match(companion, /Date\.now\(\) - previousAt < 5000/);
  assert.match(companion, /sessionStorage\.removeItem\(pendingNavigationKey\)/);
});


test("v0.9.27 emulates real focus/edit/blur lifecycle so fields fill without user clicks", () => {
  assert.match(companion, /el\.focus\(\{ preventScroll: true \}\)/);
  assert.match(companion, /new FocusEvent\("focusin"/);
  assert.match(companion, /new FocusEvent\("focusout"/);
  assert.match(companion, /function setNativeControlValue/);
});

test("personal and passport pages advance one field per automatic tick", () => {
  assert.match(companion, /đang chuyển sang trường kế tiếp/);
  assert.match(companion, /không cần bấm chuột vào ô/);
  assert.match(companion, /đang chuyển sang trường hộ chiếu kế tiếp/);
});

test("status-box DOM mutations do not recursively retrigger the runner", () => {
  assert.match(companion, /function isOwnStatusMutation/);
  assert.match(companion, /mutations\.every\(isOwnStatusMutation\)/);
});


test("v0.9.27 handles the visit information page with exact field semantics", () => {
  assert.match(companion, /function isVisitInfoPage/);
  assert.match(companion, /function fillVisitInfoPage/);
  assert.match(companion, /В КАКОЕ УЧРЕЖДЕНИЕ НАПРАВЛЯЕТЕСЬ/);
  assert.match(companion, /МАРШРУТ \(НАСЕЛЕННЫЕ ПУНКТЫ\)/);
  assert.match(companion, /МЕДИЦИНСКОМ СТРАХОВАНИИ/);
  assert.match(companion, /БЫЛИ ЛИ ВЫ КОГДА-НИБУДЬ В РОССИИ/);
});

test("the first visit-page select is Organization and is never treated as a yes/no field", () => {
  assert.match(companion, /ensureSelectAfterLabel\("В какое учреждение направляетесь\?", \["ОРГАНИЗАЦИЯ","ORGANIZATION"\]\)/);
  assert.match(companion, /this first select is NOT a yes\/no question/);
  const visit = companion.slice(companion.indexOf("function fillVisitInfoPage"), companion.indexOf("function setText"));
  assert.doesNotMatch(visit, /setYesNo\("В какое учреждение направляетесь/);
});

test("visit page automatically continues after every filled field without mouse clicks", () => {
  assert.match(companion, /function continueAutofill/);
  assert.match(companion, /continueAutofill\(payload\)/);
  assert.match(companion, /Companion sẽ tự thử lại/);
});

test("generic visit-page filling was removed to prevent cross-targeting selects", () => {
  const fill = companion.slice(companion.indexOf("function fillPage"), companion.indexOf("function addHints"));
  assert.match(fill, /fillVisitInfoPage\(payload\)/);
  assert.doesNotMatch(fill, /mark\(setText\("Наименование организации"/);
  assert.doesNotMatch(fill, /mark\(setYesNo\("Были ли Вы когда-нибудь в России"/);
});

test("visit page cannot auto-advance until its dedicated handler is ready", () => {
  const segment = companion.slice(companion.indexOf("function maybeAdvance"), companion.indexOf("function status"));
  assert.match(segment, /isVisitInfoPage\(\) && recognized < 1/);
});


test("v0.9.27 directly maps stable personal-page controls by page order", () => {
  assert.match(companion, /function personalPageControls/);
  assert.match(companion, /surname: texts\[0\]/);
  assert.match(companion, /givenNames: texts\[1\]/);
  assert.match(companion, /dob: \[texts\[2\].*selects\[2\].*texts\[3\]/s);
  assert.match(companion, /birthPlace: texts\[4\]/);
  assert.match(companion, /bornInRussia: selects\[3\]/);
});

test("v0.9.27 directly maps passport-page controls by page order", () => {
  assert.match(companion, /function passportPageControls/);
  assert.match(companion, /passportNo: texts\[0\]/);
  assert.match(companion, /issue: \[texts\[1\].*selects\[0\].*texts\[2\]/s);
  assert.match(companion, /expiry: \[texts\[3\].*selects\[1\].*texts\[4\]/s);
});

test("v0.9.27 programmatically clicks and focuses controls before writing", () => {
  assert.match(companion, /function activateControl/);
  assert.match(companion, /el\.dispatchEvent\(new MouseEvent\("mousedown"/);
  assert.match(companion, /el\.click\(\)/);
  assert.match(companion, /function writeTextControl/);
  assert.match(companion, /function writeSelectControl/);
  assert.match(companion, /function writeDateControls/);
});

test("personal page uses direct mapped controls before label fallback", () => {
  assert.match(companion, /C\.givenNames \? writeTextControl\(C\.givenNames, A\.givenNames\)/);
  assert.match(companion, /C\.birthPlace \? writeTextControl\(C\.birthPlace, A\.birthPlace\)/);
  assert.match(companion, /C\.dob\.every\(Boolean\) \? writeDateControls\(C\.dob, A\.birthDate\)/);
});


test("v0.9.27 fills KD-MID dates in postback-safe order", () => {
  assert.match(companion, /month dropdown can trigger an ASP\.NET postback/);
  assert.match(companion, /Select the month FIRST/);
  assert.match(companion, /return dateControlMatches\(monthEl, parts\[1\], 1\) \? "changed" : "waiting"/);
});

test("v0.9.27 only fills day and year after the month already matches", () => {
  const fn = companion.slice(companion.indexOf("function writeDateControls"), companion.indexOf("function refreshAspNetValidators"));
  const monthBranch = fn.indexOf('if (monthEl.tagName === "SELECT"');
  const dayWrite = fn.indexOf('if (!dateControlMatches(dayEl');
  const yearWrite = fn.indexOf('if (!dateControlMatches(yearEl');
  assert.ok(monthBranch >= 0 && dayWrite > monthBranch && yearWrite > dayWrite);
});


test("v0.9.27 writes KD-MID day and year atomically after month is stable", () => {
  assert.match(companion, /function writeDateTextAtomic/);
  assert.match(companion, /Do NOT blur\/change here/);
  assert.match(companion, /write DAY \+ YEAR atomically/);
  assert.match(companion, /const dayOk = dayReadyBefore \|\| writeDateTextAtomic\(dayEl, parts\[0\]\)/);
  assert.match(companion, /const yearOk = yearReadyBefore \|\| writeDateTextAtomic\(yearEl, parts\[2\]\)/);
});

test("v0.9.27 does not use fire() on day/year while the date group is incomplete", () => {
  const fn = companion.slice(companion.indexOf("function writeDateTextAtomic"), companion.indexOf("function refreshAspNetValidators"));
  assert.doesNotMatch(fn, /fire\(el\)/);
  assert.match(fn, /refreshAspNetValidators\(\)/);
});


test("v0.9.27 binds personal fields to their own DOM row instead of global input order", () => {
  assert.match(companion, /function controlsForField/);
  assert.match(companion, /node\.closest\?\.\("tr"\)/);
  assert.match(companion, /textControlForField\("Место рождения"\)/);
  assert.match(companion, /dateControlsForField\("Дата рождения"\)/);
});

test("v0.9.27 enforces strict DD\/MM\/YYYY before writing dates", () => {
  assert.match(companion, /function parseDmyStrict/);
  assert.match(companion, /\^\(\\d\{2\}\)\\\/\(\\d\{2\}\)\\\/\(\\d\{4\}\)\$/);
  assert.match(companion, /const parts = parseDmyStrict\(value\)/);
});

test("v0.9.27 validates the actual row-bound personal controls before declaring page OK", () => {
  assert.match(companion, /const finalC = personalPageControls\(\)/);
  assert.match(companion, /finalC\.dob\.length === 3/);
  assert.match(companion, /DOB phải là DD\/MM\/YYYY/);
});


test("v0.9.27 resolves each personal field from its exact label, not a shared outer row", () => {
  assert.match(companion, /function exactFieldLabelNode/);
  assert.match(companion, /function controlsFromExactField/);
  assert.match(companion, /This is intentionally NOT based on a parent <tr>/);
  assert.doesNotMatch(companion, /node\.closest\?\.\("tr"\)/);
});

test("v0.9.27 prevents surname, given names and birth place from sharing one input", () => {
  assert.match(companion, /const distinctPersonalTextControls/);
  assert.match(companion, /finalC\.surname !== finalC\.givenNames/);
  assert.match(companion, /finalC\.givenNames !== finalC\.birthPlace/);
  assert.match(companion, /selector trùng ô giữa Фамилия \/ Имя \/ Место рождения/);
});

test("v0.9.27 requires DOB controls to be exactly input-select-input after the DOB label", () => {
  assert.match(companion, /function dateControlsForField/);
  assert.match(companion, /if \(selectIndex !== 1\) return \[\]/);
});


test("v0.9.27 targets the route-city input explicitly", () => {
  assert.match(companion, /function routeCityControl/);
  assert.match(companion, /Маршрут \(населенные пункты\)/);
  assert.match(companion, /Населенный пункт/);
  assert.match(companion, /writeTextControl\(routeInput, routeValue\)/);
});

test("v0.9.27 defaults route city to МОСКВА and blocks Next until route matches", () => {
  assert.match(companion, /payload\.city \|\| "МОСКВА"/);
  assert.match(companion, /Маршрут chưa khớp payload; chưa được phép bấm Далее/);
});


test("v0.9.27 resolves the visible route input by geometry near the exact label", () => {
  assert.match(companion, /function visualFieldInput/);
  assert.match(companion, /getBoundingClientRect/);
  assert.match(companion, /visualFieldInput\("Населенный пункт"\)/);
});

test("v0.9.27 only accepts the route input if it visually matches the displayed route label", () => {
  assert.match(companion, /function routeCityControlLooksRight/);
  assert.match(companion, /!routeCityControlLooksRight\(routeInput\)/);
  assert.match(companion, /!routeCityControlLooksRight\(finalRoute\)/);
});

test("v0.9.27 DOM fallback restricts route input to the section before insurance", () => {
  assert.match(companion, /beforeInsurance/);
  assert.match(companion, /НАСЕЛЕННЫЙ ПУНКТ/);
  assert.match(companion, /УДАЛИТЬ/);
});


test("v0.9.27 hard-targets the actual gray route card input", () => {
  assert.match(companion, /function routeCityCardInput/);
  assert.match(companion, /НАСЕЛЕННЫЙ ПУНКТ/);
  assert.match(companion, /УДАЛИТЬ/);
  assert.match(companion, /inputs\.length !== 1/);
});

test("v0.9.27 always fills exactly МОСКВА into the real route input", () => {
  assert.match(companion, /const routeValue = "МОСКВА"/);
  assert.match(companion, /setNativeControlValue\(routeInput, routeValue\)/);
  assert.match(companion, /routeInput\.setAttribute\("value", routeValue\)/);
  assert.match(companion, /ô Населенный пункт thật vẫn chưa nhận МОСКВА/);
});


test("v0.9.27 anchors the real route input from the visible Удалить button", () => {
  assert.match(companion, /function routeDeleteButtons/);
  assert.match(companion, /norm\(el\.textContent \|\| el\.value \|\| ""\) === "УДАЛИТЬ"/);
  assert.match(companion, /for \(const button of routeDeleteButtons\(\)\)/);
  assert.match(companion, /text\.includes\("НАСЕЛЕННЫЙ ПУНКТ"\)/);
});

test("v0.9.27 types МОСКВА as Cyrillic keystrokes into the route input", () => {
  assert.match(companion, /function typeRouteCityValue/);
  assert.match(companion, /new KeyboardEvent\("keydown"/);
  assert.match(companion, /new InputEvent\("beforeinput"/);
  assert.match(companion, /inputType: "insertText"/);
  assert.match(companion, /const routeValue = "МОСКВА"/);
});

test("v0.9.27 route readiness is tied to the same Delete-anchored input", () => {
  assert.match(companion, /return routeCityControl\(\) === el/);
  assert.match(companion, /đã khóa đúng ô Маршрут/);
});


test("v0.9.27 has a dedicated contact-information page handler", () => {
  assert.match(companion, /function isContactInfoPage/);
  assert.match(companion, /function contactInfoControls/);
  assert.match(companion, /function fillContactInfoPage/);
  assert.match(companion, /Адрес вашего постоянного проживания/);
  assert.match(companion, /Место работы \(учебы\)/);
  assert.match(companion, /Рабочий E-mail/);
});

test("v0.9.27 verifies contact fields are distinct before Next", () => {
  assert.match(companion, /const uniqueTextCount = new Set\(distinctText\)\.size/);
  assert.match(companion, /uniqueTextCount === distinctText\.length/);
  assert.match(companion, /страница liên hệ|trang liên hệ còn trường sai/);
});

test("v0.9.27 no longer uses generic contact filling", () => {
  const fill = companion.slice(companion.indexOf("function fillPage"), companion.indexOf("function addHints"));
  assert.match(fill, /fillContactInfoPage\(payload\)/);
  assert.doesNotMatch(fill, /mark\(setText\("Адрес вашего постоянного проживания"/);
  assert.doesNotMatch(fill, /mark\(setText\("Место работы \(учебы\)"/);
});

test("v0.9.27 uses browser editing pipeline for МОСКВА route insertion", () => {
  assert.match(companion, /execCommand\?\.\("insertText", false, text\)/);
  assert.match(companion, /setRangeText/);
  assert.match(companion, /closest to the user's successful manual paste/);
});


test("v0.9.27 keeps route input focused so KD-MID can open autocomplete", () => {
  assert.match(companion, /DO NOT fire change\/blur yet/);
  assert.match(companion, /second autocomplete list after typing МОСКВА/);
});

test("v0.9.27 selects the second МОСКВА suggestion before route validation passes", () => {
  assert.match(companion, /function routeSuggestionNode/);
  assert.match(companion, /function chooseRouteSuggestion/);
  assert.match(companion, /role="option"/);
  assert.match(companion, /ArrowDown/);
  assert.match(companion, /Enter/);
});

test("v0.9.27 treats route validator errors as not ready", () => {
  assert.match(companion, /function routeValidationErrorVisible/);
  assert.match(companion, /ЗНАЧЕНИЕ НЕ УДОВЛЕТВОРЯЕТ ШАБЛОНУ/);
  assert.match(companion, /ДОПУСТИМЫ ТОЛЬКО РУССКИЕ БУКВЕННЫЕ/);
  assert.match(companion, /routeValidationErrorVisible\(finalRoute\)/);
});

test("v0.9.27 status explains the two-step route selection", () => {
  assert.match(companion, /chọn МОСКВА lần 2/);
  assert.match(companion, /danh sách gợi ý của KD-MID/);
});


test("v0.9.27 locates the displayed route input between label and Delete button", () => {
  assert.match(companion, /function routeCityLabels/);
  assert.match(companion, /exact "Населенный пункт" label -> text input -> "Удалить" button/);
  assert.match(companion, /betweenVertically/);
});

test("v0.9.27 never falls back to blind ArrowDown Enter for route suggestion", () => {
  const chooser = companion.slice(companion.indexOf("function chooseRouteSuggestion"), companion.indexOf("function routeValidationErrorVisible"));
  assert.doesNotMatch(chooser, /ArrowDown/);
  assert.doesNotMatch(chooser, /Enter/);
});

test("v0.9.27 waits for KD-MID to settle after clicking МОСКВА suggestion", () => {
  assert.match(companion, /ROUTE_SELECTED_AT_KEY/);
  assert.match(companion, /age < 1200/);
  assert.match(companion, /đang chờ KD-MID xác nhận và ổn định lại ô/);
});

test("v0.9.27 rejects false route success after server validation clears the input", () => {
  assert.match(companion, /const accepted =/);
  assert.match(companion, /!routeValidationErrorVisible\(settledInput\)/);
  assert.match(companion, /không báo OK giả/);
});

test("v0.9.27 only reports OK after route has value and no red validation error", () => {
  assert.match(companion, /không còn lỗi đỏ/);
  assert.match(companion, /routeValidationErrorVisible\(finalRoute\)/);
});


test("v0.9.27 stores optional contact/work fields per applicant", () => {
  assert.match(tool, /workStudyPlace: string/);
  assert.match(tool, /workAddress: string/);
  assert.match(tool, /workEmail: string/);
  assert.match(tool, /childrenUnder16: boolean/);
  assert.match(tool, /relativesInRussia: boolean/);
});

test("v0.9.27 applicant editor exposes optional contact/work inputs", () => {
  assert.match(tool, /Место работы \(учебы\) · Nơi làm việc \/ học tập/);
  assert.match(tool, /Рабочий адрес · Địa chỉ cơ quan/);
  assert.match(tool, /Рабочий телефон · Điện thoại cơ quan/);
  assert.match(tool, /Рабочий E-mail · Email cơ quan/);
  assert.match(tool, /Không có thì để trống/);
});

test("v0.9.27 final two profile flags default to no when unchecked", () => {
  assert.match(tool, /childrenUnder16: false/);
  assert.match(tool, /relativesInRussia: false/);
  assert.match(tool, /Có trẻ em dưới 16 tuổi đi cùng/);
  assert.match(tool, /Có người thân hiện đang ở Nga/);
  assert.match(companion, /A\.childrenUnder16 \? \["ДА","YES"\] : \["НЕТ","NO"\]/);
  assert.match(companion, /A\.relativesInRussia \? \["ДА","YES"\] : \["НЕТ","NO"\]/);
});

test("v0.9.27 deliberately skips both fax fields", () => {
  const contact = companion.slice(companion.indexOf("function fillContactInfoPage"), companion.indexOf("function setText"));
  assert.match(contact, /Fax fields are intentionally skipped/);
  assert.doesNotMatch(contact, /Ваш личный факс/);
  assert.doesNotMatch(contact, /Рабочий факс/);
});

test("v0.9.27 contact handler uses applicant-specific work fields and leaves blank values blank", () => {
  assert.match(companion, /optionalText/);
  assert.match(companion, /A\.workStudyPlace/);
  assert.match(companion, /A\.workAddress/);
  assert.match(companion, /A\.workPhone/);
  assert.match(companion, /A\.workEmail/);
  assert.match(companion, /setNativeControlValue\(control, ""\)/);
  assert.match(companion, /String\(control\.value \|\| ""\) === ""/);
});

test("v0.9.27 phone and email are no longer launch-required", () => {
  const missing = tool.slice(tool.indexOf("function applicantMissingFields"), tool.indexOf("function emitChange"));
  assert.doesNotMatch(missing, /Điện thoại cá nhân/);
  assert.doesNotMatch(missing, /Email cá nhân/);
});


test("v0.9.27 maps KD-MID contact inputs by stable page order including fax slots", () => {
  assert.match(companion, /textInputs\.length >= 10 && selects\.length >= 4/);
  assert.match(companion, /personalEmail: textInputs\[3\]/);
  assert.match(companion, /employer: textInputs\[4\]/);
  assert.match(companion, /workEmail: textInputs\[9\]/);
});

test("v0.9.27 explicitly skips and clears both fax controls", () => {
  assert.match(companion, /personalFax: textInputs\[2\]/);
  assert.match(companion, /workFax: textInputs\[8\]/);
  assert.match(companion, /clearFax\(C\.personalFax\)/);
  assert.match(companion, /clearFax\(C\.workFax\)/);
});

test("v0.9.27 personal email comes from applicant payload and no longer depends only on label lookup", () => {
  assert.match(companion, /\["E-mail cá nhân", \(\) => optionalText\(C\.personalEmail, A\.email\)\]/);
  assert.match(companion, /payload email:/);
});


test("v0.9.27 payload falls back to saved common work defaults when applicant overrides are blank", () => {
  assert.match(tool, /workStudyPlace: applicant\.workStudyPlace\.trim\(\) \|\| common\.employer/);
  assert.match(tool, /position: applicant\.position\.trim\(\) \|\| common\.defaultPosition/);
  assert.match(tool, /workAddress: applicant\.workAddress\.trim\(\) \|\| common\.employerAddress/);
  assert.match(tool, /workPhone: applicant\.workPhone\.trim\(\) \|\| fixedWorkPhone/);
  assert.match(tool, /workEmail: applicant\.workEmail\.trim\(\) \|\| common\.employerEmail/);
});

test("v0.9.27 legacy blank work fields are hydrated from current common defaults", () => {
  assert.match(tool, /String\(item\.workStudyPlace \?\? ""\)\.trim\(\) \|\| common\.employer/);
  assert.match(tool, /String\(item\.position \?\? ""\)\.trim\(\) \|\| common\.defaultPosition/);
  assert.match(tool, /String\(item\.workAddress \?\? ""\)\.trim\(\) \|\| common\.employerAddress/);
  assert.match(tool, /String\(item\.workEmail \?\? ""\)\.trim\(\) \|\| common\.employerEmail/);
});

test("v0.9.27 companion uses common work defaults when applicant-specific values are blank", () => {
  assert.match(companion, /A\.workStudyPlace \|\| payload\.employer/);
  assert.match(companion, /A\.position \|\| payload\.defaultPosition/);
  assert.match(companion, /A\.workAddress \|\| payload\.employerAddress/);
  assert.match(companion, /A\.workPhone \|\| payload\.fixedWorkPhone/);
  assert.match(companion, /A\.workEmail \|\| payload\.employerEmail/);
});
