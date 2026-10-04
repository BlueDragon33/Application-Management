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

test("Companion v0.9.7 is active in script and UI", () => {
  assert.match(companion, /@version\s+0\.9\.7/);
  assert.match(companion, /const VERSION = "0\.9\.7"/);
  assert.match(tool, /Companion v0\.9\.7/);
});

test("landing page still selects Vietnam and Russian before continuing", () => {
  assert.match(companion, /РУССКИЙ \(RUSSIAN\)/);
  assert.match(companion, /Я прочитал эту информацию/);
  assert.match(companion, /fillLandingPage/);
});

test("password page still fills both password fields and waits for manual CAPTCHA", () => {
  assert.match(companion, /function fillPassword/);
  assert.match(companion, /ПОДТВЕРЖДЕНИЕ ПАРОЛЯ/);
  assert.match(companion, /ВВЕДИТЕ НАДПИСЬ С КАРТИНКИ/);
  assert.match(companion, /ОТПРАВИТЬ/);
});

test("visa request page keeps the exact required values", () => {
  assert.match(companion, /function fillVisaRequestPage/);
  assert.match(companion, /ВЬЕТНАМ/);
  assert.match(companion, /УЧЕБА/);
  assert.match(companion, /ОБЫКНОВЕННАЯ УЧЕБНАЯ/);
  assert.match(companion, /ОДНОКРАТНАЯ/);
  assert.match(companion, /function ensureVisaFormerCitizenship/);
});

test("personal information page maps each field independently", () => {
  assert.match(companion, /function fillPersonalInfoPage/);
  assert.match(companion, /ensureTextAfterLabel\("Фамилия \(согласно паспорту\)"/);
  assert.match(companion, /ensureTextAfterLabel\("Имя, другие имена, отчество \(согласно паспорту\)"/);
  assert.match(companion, /ensureSelectAfterLabel\("Пол"/);
  assert.match(companion, /ensureDateAfterLabel\("Дата рождения"/);
  assert.match(companion, /ensureTextAfterLabel\("Место рождения"/);
});

test("Russian month names are supported for KD-MID date selects", () => {
  assert.match(companion, /const RU_MONTHS = \["","ЯНВАРЬ","ФЕВРАЛЬ","МАРТ"/);
  assert.match(companion, /function findDateOption/);
  assert.match(companion, /monthName = RU_MONTHS\[monthNumber\]/);
  assert.match(companion, /options\[monthNumber\]/);
});

test("date fill is not considered ready when a month option cannot be resolved", () => {
  assert.match(companion, /if \(!option\) \{ unresolved = true; return; \}/);
  assert.match(companion, /if \(unresolved\) return "waiting"/);
  assert.match(companion, /dateControlMatches/);
});

test("App-Manager normalizes dd/mm/yyyy dates before sending them to KD-MID", () => {
  assert.match(tool, /function normalizeDmy/);
  assert.match(tool, /birthDate: normalizeDmy\(applicant\.birthDate\)/);
  assert.match(tool, /passportIssue: normalizeDmy\(applicant\.passportIssue\)/);
  assert.match(tool, /entryDate: normalizeDmy\(common\.entryDate\)/);
  assert.match(tool, /function DateTextInput/);
});

test("saving a profile persists immediately and overwrites the shared Companion payload", () => {
  assert.match(tool, /function persistStoreSnapshot/);
  assert.match(tool, /persistStoreSnapshot\(nextStore\)/);
  assert.match(tool, /Đã lưu và đồng bộ payload mới/);
  assert.match(tool, /KD_MID_SET_PAYLOAD/);
  assert.match(companion, /data\.type === "KD_MID_SET_PAYLOAD"/);
  assert.match(companion, /gmSet\(SHARED_PAYLOAD_KEY, JSON\.stringify\(fresh\)\)/);
});

test("launch re-reads the persisted selected profile instead of trusting a stale React closure", () => {
  assert.match(tool, /const persisted = safeLoad\(\)/);
  assert.match(tool, /const latestSelected = persisted\.applicants\.find/);
  assert.match(tool, /const latestPayload = buildPayload\(latestSelected, latestCommon, autoAdvance\)/);
  assert.match(tool, /Payload MỚI|payload MỚI|Đã gửi payload MỚI/);
});

test("payloads carry a revision so Tampermonkey detects every profile update", () => {
  assert.match(tool, /_payloadRevision: Date\.now\(\)/);
  assert.match(companion, /_payloadRevision: data\.payload\._payloadRevision \|\| Date\.now\(\)/);
});

test("same KD-MID tab always reloads when the payload hash or GM payload changes", () => {
  assert.match(tool, /_launchToken: Date\.now\(\)/);
  assert.match(companion, /window\.addEventListener\("hashchange"/);
  assert.match(companion, /GM_addValueChangeListener\(SHARED_PAYLOAD_KEY/);
  assert.match(companion, /currentPayload = fresh/);
  assert.match(companion, /startProgressiveRun\(fresh\)/);
  assert.doesNotMatch(companion, /if \(remote\)/);
});

test("application ID and official A4 flow remain intact", () => {
  assert.match(companion, /saveConfirmedApplicationRecord/);
  assert.match(companion, /ПЕЧАТЬ ФОРМАТА A4/);
  assert.match(companion, /printButton\.click/);
});

test("three Vietnam missions remain available", () => {
  assert.match(tool, /ПОСОЛЬСТВО РФ ВО ВЬЕТНАМЕ/);
  assert.match(tool, /ГЕНКОНСУЛЬСТВО РФ В ДАНАНГЕ/);
  assert.match(tool, /ГЕНКОНСУЛЬСТВО РФ В ХОШИМИНЕ/);
});
