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

test("KD-MID Visa keeps local applicant and resume data", () => {
  assert.match(tool, /application-management:kd-mid-visa:v1/);
  assert.match(tool, /surname5/);
  assert.match(tool, /birthYear/);
  assert.match(tool, /qllhs2025/);
  assert.match(tool, /Application ID/);
  assert.match(tool, /localStorage/);
});

test("fixed defaults and three Vietnam missions remain available", () => {
  assert.match(tool, /ВЬЕТНАМ, Г\. ХАНОЙ, УЛИЦА НГИА ДО, ДОРОГА ХОАНГ КУОК ВЬЕТ, ДОМ Ш9/);
  assert.match(tool, /\+842437555706/);
  assert.match(tool, /ПОСОЛЬСТВО РФ ВО ВЬЕТНАМЕ/);
  assert.match(tool, /ГЕНКОНСУЛЬСТВО РФ В ДАНАНГЕ/);
  assert.match(tool, /ГЕНКОНСУЛЬСТВО РФ В ХОШИМИНЕ/);
});

test("production workflow opens official KD-MID directly", () => {
  assert.match(tool, /buildDirectAutomationUrl/);
  assert.match(tool, /#kdmidv8=/);
  assert.match(tool, /window\.open\(buildDirectAutomationUrl/);
  assert.doesNotMatch(tool, /window\.open\("about:blank"/);
  assert.match(companion, /@match\s+https:\/\/visa\.kdmid\.ru\/\*/);
  assert.match(companion, /readPayloadFromHash\(\) \|\| readSharedPayload\(\)/);
});

test("Companion v0.9 initializes the first KD-MID page", () => {
  assert.match(companion, /VERSION = "0\.9\.1"/);
  assert.match(companion, /ВЬЕТНАМ/);
  assert.match(companion, /РУССКИЙ/);
  assert.match(companion, /Я прочитал эту информацию/);
  assert.match(companion, /ЗАПОЛНИТЬ НОВУЮ АНКЕТУ/);
});

test("Companion v0.9 fills both password fields and waits for manual CAPTCHA", () => {
  assert.match(companion, /function fillPassword/);
  assert.match(companion, /input\[type="password"\]/);
  assert.match(companion, /function isPasswordCaptchaPage/);
  assert.match(companion, /ПОДТВЕРЖДЕНИЕ ПАРОЛЯ/);
  assert.match(companion, /ВВЕДИТЕ НАДПИСЬ С КАРТИНКИ/);
  assert.match(companion, /Tool sẽ tự bấm «Отправить» khi bạn nhập xong/);
  assert.match(companion, /ОТПРАВИТЬ/);
  assert.match(companion, /document\.addEventListener\("input"/);
});

test("password/CAPTCHA page is handled before application-ID confirmation", () => {
  const segment = companion.slice(companion.indexOf("function maybeAdvance"), companion.indexOf("function status"));
  assert.ok(segment.indexOf("isPasswordCaptchaPage") >= 0);
  assert.ok(segment.indexOf("isIdConfirmationPage") >= 0);
  assert.ok(segment.indexOf("isPasswordCaptchaPage") < segment.indexOf("isIdConfirmationPage"));
});

test("Companion saves ID only on the confirmation page and then advances", () => {
  assert.match(companion, /function isIdConfirmationPage/);
  assert.match(companion, /ИДЕНТИФИКАЦИОННЫЙ НОМЕР ВАШЕЙ АНКЕТЫ/);
  assert.match(companion, /ПЕЧАТЬ НОМЕРА АНКЕТЫ/);
  assert.match(companion, /saveConfirmedApplicationRecord/);
  assert.match(companion, /Đang bấm «Далее»/);
});

test("Companion continues normal profile filling and official A4 printing", () => {
  assert.match(companion, /A\.routeCity \|\| payload\.city/);
  assert.match(companion, /A\.hadFormerRussianCitizenship/);
  assert.match(companion, /Наименование учреждения/);
  assert.match(companion, /maybeAutoPrint/);
  assert.match(companion, /ПЕЧАТЬ ФОРМАТА A4/);
  assert.match(companion, /printButton\.click/);
});

test("UI describes v0.9 and manual CAPTCHA correctly", () => {
  assert.match(tool, /Companion v0\.9/);
  assert.match(tool, /Password tự điền · CAPTCHA nhập tay/);
  assert.match(tool, /Lưu ID rồi tiếp tục tự động/);
  assert.match(tool, /không tự đọc\/giải CAPTCHA/);
});


test("v0.9.1 targets country and language by their own option lists", () => {
  assert.match(companion, /function selectContainingOption/);
  assert.match(companion, /setSelectByOption\(\["ВЬЕТНАМ","VIETNAM"\]\)/);
  assert.match(companion, /setSelectByOption\(\["РУССКИЙ","RUSSIAN"\]\)/);
  assert.match(companion, /function landingPageReady/);
  assert.match(companion, /trang đầu đã đúng Việt Nam \+ Russian/);
});

test("landing page cannot advance until Russian is actually selected", () => {
  const segment = companion.slice(companion.indexOf("function maybeAdvance"), companion.indexOf("function status"));
  assert.match(segment, /isLandingPage\(\)/);
  assert.match(segment, /landingPageReady\(\)/);
  assert.ok(segment.indexOf("landingPageReady") < segment.indexOf("ЗАПОЛНИТЬ НОВУЮ АНКЕТУ"));
});
