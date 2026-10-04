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

test("Companion v0.9.11 is active in script and UI", () => {
  assert.match(companion, /@version\s+0\.9\.11/);
  assert.match(companion, /const VERSION = "0\.9\.11"/);
  assert.match(tool, /Companion v0\.9\.11/);
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


test("v0.9.11 emulates a real focus/edit/blur lifecycle so KD-MID accepts text without user clicks", () => {
  assert.match(companion, /el\.focus\(\{ preventScroll: true \}\)/);
  assert.match(companion, /new FocusEvent\("focusin"/);
  assert.match(companion, /new FocusEvent\("focusout"/);
  assert.match(companion, /function setNativeControlValue/);
});

test("personal and passport pages progress one field per automatic tick without requiring mouse clicks", () => {
  assert.match(companion, /đang chuyển sang trường kế tiếp/);
  assert.match(companion, /không cần bấm chuột vào ô/);
  assert.match(companion, /đang chuyển sang trường hộ chiếu kế tiếp/);
});

test("observer ignores Companion status-box mutations to avoid self-triggered run loops", () => {
  assert.match(companion, /function isOwnStatusMutation/);
  assert.match(companion, /mutations\.every\(isOwnStatusMutation\)/);
});
