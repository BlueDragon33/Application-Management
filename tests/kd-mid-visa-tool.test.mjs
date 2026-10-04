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

test("Companion v0.9.29 is active in script and UI", () => {
  assert.match(companion, /@version\s+0\.9\.29/);
  assert.match(companion, /const VERSION = "0\.9\.29"/);
  assert.match(tool, /Companion v0\.9\.29/);
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

test("personal page fills each required field autonomously and verifies the page before Next", () => {
  assert.match(companion, /function fillPersonalInfoPage/);
  assert.match(companion, /for \(const \[label, fn\] of steps\)/);
  assert.match(companion, /continueAutofill\(payload/);
  assert.match(companion, /const finalReady =/);
  assert.match(companion, /trang cá nhân OK/);
  assert.match(companion, /finalC\.surname/);
  assert.match(companion, /finalC\.givenNames/);
  assert.match(companion, /finalC\.birthPlace/);
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


test("v0.9.29 emulates real focus/edit/blur lifecycle so fields fill without user clicks", () => {
  assert.match(companion, /el\.focus\(\{ preventScroll: true \}\)/);
  assert.match(companion, /new FocusEvent\("focusin"/);
  assert.match(companion, /new FocusEvent\("focusout"/);
  assert.match(companion, /function setNativeControlValue/);
});

test("personal and passport pages retry automatically without requiring user clicks", () => {
  assert.match(companion, /không cần bấm chuột/);
  assert.match(companion, /continueAutofill\(payload/);
  assert.match(companion, /function fillPassportInfoPage/);
});

test("status-box DOM mutations do not recursively retrigger the runner", () => {
  assert.match(companion, /function isOwnStatusMutation/);
  assert.match(companion, /mutations\.every\(isOwnStatusMutation\)/);
});


test("v0.9.29 handles the visit information page with exact field semantics", () => {
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


test("v0.9.29 resolves personal and passport fields from exact labels", () => {
  assert.match(companion, /function personalPageControls/);
  assert.match(companion, /textControlForField\("Фамилия \(согласно паспорту\)"\)/);
  assert.match(companion, /textControlForField\("Имя, другие имена, отчество \(согласно паспорту\)"\)/);
  assert.match(companion, /dateControlsForField\("Дата рождения"\)/);
  assert.match(companion, /function passportPageControls/);
  assert.match(companion, /dateControlsForField\("Дата выдачи"\)/);
  assert.match(companion, /dateControlsForField\("Действителен до"\)/);
});

test("v0.9.29 keeps personal text controls distinct before declaring the page ready", () => {
  assert.match(companion, /const distinctPersonalTextControls/);
  assert.match(companion, /finalC\.surname !== finalC\.givenNames/);
  assert.match(companion, /finalC\.givenNames !== finalC\.birthPlace/);
  assert.match(companion, /selector trùng ô giữa Фамилия \/ Имя \/ Место рождения/);
});

test("v0.9.29 writes dates month-first and day-year atomically", () => {
  assert.match(companion, /function writeDateControls/);
  assert.match(companion, /Step 1: month only/);
  assert.match(companion, /Step 2: once the month is stable, write DAY \+ YEAR atomically/);
  assert.match(companion, /writeDateTextAtomic\(dayEl, parts\[0\]\)/);
  assert.match(companion, /writeDateTextAtomic\(yearEl, parts\[2\]\)/);
  assert.match(companion, /function parseDmyStrict/);
});

test("v0.9.29 targets the visible route field between the label and Delete button", () => {
  assert.match(companion, /function routeCityControl/);
  assert.match(companion, /function routeCityLabels/);
  assert.match(companion, /function routeDeleteButtons/);
  assert.match(companion, /betweenVertically/);
  assert.match(companion, /exact "Населенный пункт" label -> text input -> "Удалить" button/);
});

test("v0.9.29 types МОСКВА through the browser editing pipeline and keeps focus for autocomplete", () => {
  assert.match(companion, /function typeRouteCityValue/);
  assert.match(companion, /execCommand\?\.\("insertText", false, text\)/);
  assert.match(companion, /setRangeText/);
  assert.match(companion, /DO NOT fire change\/blur yet/);
  assert.match(companion, /second autocomplete list after typing МОСКВА/);
});

test("v0.9.29 selects an exact МОСКВА autocomplete item and waits for KD-MID acceptance", () => {
  assert.match(companion, /function routeSuggestionNode/);
  assert.match(companion, /function chooseRouteSuggestion/);
  assert.match(companion, /ROUTE_SELECTED_AT_KEY/);
  assert.match(companion, /routeValidationErrorVisible/);
  assert.match(companion, /không báo OK giả/);
  assert.match(companion, /không còn lỗi đỏ/);
});

test("v0.9.29 stores optional contact/work fields per applicant", () => {
  assert.match(tool, /workStudyPlace: string/);
  assert.match(tool, /workAddress: string/);
  assert.match(tool, /workEmail: string/);
  assert.match(tool, /childrenUnder16: boolean/);
  assert.match(tool, /relativesInRussia: boolean/);
});

test("v0.9.29 applicant editor exposes optional contact/work inputs", () => {
  assert.match(tool, /Место работы \(учебы\) · Nơi làm việc \/ học tập/);
  assert.match(tool, /Рабочий адрес · Địa chỉ cơ quan/);
  assert.match(tool, /Рабочий телефон · Điện thoại cơ quan/);
  assert.match(tool, /Рабочий E-mail · Email cơ quan/);
  assert.match(tool, /Không có thì để trống/);
});

test("v0.9.29 final two profile flags default to no when unchecked", () => {
  assert.match(tool, /childrenUnder16: false/);
  assert.match(tool, /relativesInRussia: false/);
  assert.match(tool, /Có trẻ em dưới 16 tuổi đi cùng/);
  assert.match(tool, /Có người thân hiện đang ở Nga/);
  assert.match(companion, /A\.childrenUnder16 \? \["ДА","YES"\] : \["НЕТ","NO"\]/);
  assert.match(companion, /A\.relativesInRussia \? \["ДА","YES"\] : \["НЕТ","NO"\]/);
});

test("v0.9.29 deliberately skips both fax fields", () => {
  const contact = companion.slice(companion.indexOf("function fillContactInfoPage"), companion.indexOf("function setText"));
  assert.match(contact, /Fax fields are intentionally skipped/);
  assert.doesNotMatch(contact, /Ваш личный факс/);
  assert.doesNotMatch(contact, /Рабочий факс/);
});

test("v0.9.29 contact handler uses applicant-specific work fields and leaves blank values blank", () => {
  assert.match(companion, /optionalText/);
  assert.match(companion, /A\.workStudyPlace/);
  assert.match(companion, /A\.workAddress/);
  assert.match(companion, /A\.workPhone/);
  assert.match(companion, /A\.workEmail/);
  assert.match(companion, /setNativeControlValue\(control, ""\)/);
  assert.match(companion, /String\(control\.value \|\| ""\) === ""/);
});

test("v0.9.29 phone and email are no longer launch-required", () => {
  const missing = tool.slice(tool.indexOf("function applicantMissingFields"), tool.indexOf("function emitChange"));
  assert.doesNotMatch(missing, /Điện thoại cá nhân/);
  assert.doesNotMatch(missing, /Email cá nhân/);
});


test("v0.9.29 maps KD-MID contact inputs by stable page order including fax slots", () => {
  assert.match(companion, /textInputs\.length >= 10 && selects\.length >= 4/);
  assert.match(companion, /personalEmail: textInputs\[3\]/);
  assert.match(companion, /employer: textInputs\[4\]/);
  assert.match(companion, /workEmail: textInputs\[9\]/);
});

test("v0.9.29 explicitly skips and clears both fax controls", () => {
  assert.match(companion, /personalFax: textInputs\[2\]/);
  assert.match(companion, /workFax: textInputs\[8\]/);
  assert.match(companion, /clearFax\(C\.personalFax\)/);
  assert.match(companion, /clearFax\(C\.workFax\)/);
});

test("v0.9.29 personal email comes from applicant payload and no longer depends only on label lookup", () => {
  assert.match(companion, /\["E-mail cá nhân", \(\) => optionalText\(C\.personalEmail, A\.email\)\]/);
  assert.match(companion, /payload email:/);
});


test("v0.9.29 payload falls back to saved common work defaults when applicant overrides are blank", () => {
  assert.match(tool, /workStudyPlace: applicant\.workStudyPlace\.trim\(\) \|\| common\.employer/);
  assert.match(tool, /position: applicant\.position\.trim\(\) \|\| common\.defaultPosition/);
  assert.match(tool, /workAddress: applicant\.workAddress\.trim\(\) \|\| common\.employerAddress/);
  assert.match(tool, /workPhone: applicant\.workPhone\.trim\(\) \|\| fixedWorkPhone/);
  assert.match(tool, /workEmail: applicant\.workEmail\.trim\(\) \|\| common\.employerEmail/);
});

test("v0.9.29 legacy blank work fields are hydrated from current common defaults", () => {
  assert.match(tool, /String\(item\.workStudyPlace \?\? ""\)\.trim\(\) \|\| common\.employer/);
  assert.match(tool, /String\(item\.position \?\? ""\)\.trim\(\) \|\| common\.defaultPosition/);
  assert.match(tool, /String\(item\.workAddress \?\? ""\)\.trim\(\) \|\| common\.employerAddress/);
  assert.match(tool, /String\(item\.workEmail \?\? ""\)\.trim\(\) \|\| common\.employerEmail/);
});

test("v0.9.29 companion uses common work defaults when applicant-specific values are blank", () => {
  assert.match(companion, /A\.workStudyPlace \|\| payload\.employer/);
  assert.match(companion, /A\.position \|\| payload\.defaultPosition/);
  assert.match(companion, /A\.workAddress \|\| payload\.employerAddress/);
  assert.match(companion, /A\.workPhone \|\| payload\.fixedWorkPhone/);
  assert.match(companion, /A\.workEmail \|\| payload\.employerEmail/);
});


test("v0.9.29 resolves the final relatives-in-Russia dropdown explicitly", () => {
  assert.match(companion, /function yesNoSelectForQuestion/);
  assert.match(companion, /Имеете ли Вы в настоящее время родственников на территории России\?/);
  assert.match(companion, /fallbackFromEnd = 1/);
});

test("v0.9.29 defaults the final relatives dropdown to НЕТ when the profile checkbox is off", () => {
  assert.match(companion, /A\.relativesInRussia \? \["ДА","YES"\] : \["НЕТ","NO"\]/);
  assert.match(companion, /đã chọn НЕТ ở dòng cuối 'người thân tại Nga'/);
});

test("v0.9.29 uses the last yes-no dropdown as the final relatives fallback", () => {
  assert.match(companion, /return allYesNo\.at\(-fallbackFromEnd\) \|\| null/);
  assert.match(companion, /\], 1\)/);
});


test("v0.9.29 preserves the complete canonical permanent address including ДОМ Ш9", () => {
  const full = "ВЬЕТНАМ, Г. ХАНОЙ, УЛИЦА НГИА ДО, ДОРОГА ХОАНГ КУОК ВЬЕТ, ДОМ Ш9";
  assert.ok(tool.includes(full));
  assert.ok(companion.includes(full));
});

test("v0.9.29 contact autofill ignores stale truncated address payloads", () => {
  assert.match(companion, /optionalText\(C\.permanentAddress, CANONICAL_PERMANENT_ADDRESS\)/);
  assert.match(companion, /permanentAddress: CANONICAL_PERMANENT_ADDRESS/);
});
