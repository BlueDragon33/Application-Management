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

test("Companion v0.9.5 is active", () => {
  assert.match(companion, /@version\s+0\.9\.3/);
  assert.match(companion, /const VERSION = "0\.9\.3"/);
  assert.match(tool, /Companion v0\.9\.3/);
});

test("landing page selects Vietnam and Russian before continuing", () => {
  assert.match(companion, /РУССКИЙ \(RUSSIAN\)/);
  assert.match(companion, /Я прочитал эту информацию/);
  assert.match(companion, /fillLandingPage/);
});

test("password page fills both password fields and waits for manual CAPTCHA", () => {
  assert.match(companion, /function fillPassword/);
  assert.match(companion, /ПОДТВЕРЖДЕНИЕ ПАРОЛЯ/);
  assert.match(companion, /ВВЕДИТЕ НАДПИСЬ С КАРТИНКИ/);
  assert.match(companion, /ОТПРАВИТЬ/);
});

test("visa request page follows the exact desired values", () => {
  assert.match(companion, /function fillVisaRequestPage/);
  assert.match(companion, /Гражданство/);
  assert.match(companion, /ВЬЕТНАМ/);
  assert.match(companion, /Если Вы имели гражданство СССР или России/);
  assert.match(companion, /Цель поездки \(раздел\)/);
  assert.match(companion, /Цель поездки/);
  assert.match(companion, /ОБЫКНОВЕННАЯ УЧЕБНАЯ/);
  assert.match(companion, /ОДНОКРАТНАЯ/);
  assert.match(companion, /ВЬЕТНАМ · НЕТ · УЧЕБА · УЧЕБА · ОБЫКНОВЕННАЯ УЧЕБНАЯ · ОДНОКРАТНАЯ/);
});

test("dependent visa selects are changed one at a time", () => {
  assert.match(companion, /function ensureSelectNearLabel/);
  assert.match(companion, /return "changed"/);
  assert.match(companion, /return \{ handled: true, ready: false \}/);
  assert.match(companion, /đang chờ KD-MID nạp Цель поездки/);
  assert.match(companion, /đang chờ KD-MID nạp Категория и вид визы/);
});

test("Цель поездки label matching prefers exact text over Цель поездки (раздел)", () => {
  assert.match(companion, /Number\(b\.exact\) - Number\(a\.exact\)/);
  assert.match(companion, /findSelectNearExactLabel/);
});

test("visa page cannot auto-advance until the whole page is ready", () => {
  const segment = companion.slice(companion.indexOf("function maybeAdvance"), companion.indexOf("function status"));
  assert.match(segment, /isVisaRequestPage\(\) && recognized < 1/);
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


test("v0.9.5 identifies the USSR/Russia citizenship dropdown by its DA/NET options", () => {
  assert.match(companion, /function findYesNoSelect/);
  assert.match(companion, /value === "ДА"/);
  assert.match(companion, /value === "НЕТ"/);
  assert.match(companion, /function ensureVisaFormerCitizenship/);
  assert.match(companion, /ensureVisaFormerCitizenship\(Boolean\(A\.hadFormerRussianCitizenship\)\)/);
});

test("v0.9.5 no longer relies on the long former-citizenship label to find that select", () => {
  const segment = companion.slice(
    companion.indexOf('const former = A.hadFormerRussianCitizenship'),
    companion.indexOf('if (A.hadFormerRussianCitizenship)', companion.indexOf('const former = A.hadFormerRussianCitizenship'))
  );
  assert.doesNotMatch(segment, /ensureSelectNearLabel\("Если Вы имели гражданство СССР или России"/);
  assert.match(segment, /ensureVisaFormerCitizenship/);
});


test("v0.9.5 maps personal-information fields by the control following each exact label", () => {
  assert.match(companion, /function firstFollowingControl/);
  assert.match(companion, /function ensureTextAfterLabel/);
  assert.match(companion, /function ensureSelectAfterLabel/);
  assert.match(companion, /function ensureDateAfterLabel/);
  assert.match(companion, /function fillPersonalInfoPage/);
  assert.match(companion, /Фамилия \(согласно паспорту\)/);
  assert.match(companion, /Имя, другие имена, отчество \(согласно паспорту\)/);
  assert.match(companion, /Место рождения/);
});

test("v0.9.5 stops generic filling from overwriting personal fields", () => {
  const fill = companion.slice(companion.indexOf("function fillPage"), companion.indexOf("function addHints"));
  assert.match(fill, /fillPersonalInfoPage\(payload\)/);
  assert.doesNotMatch(fill, /setText\("Фамилия \(согласно паспорту\)"/);
  assert.doesNotMatch(fill, /setText\("Место рождения"/);
});

test("personal page cannot auto-advance until every field is validated", () => {
  const segment = companion.slice(companion.indexOf("function maybeAdvance"), companion.indexOf("function status"));
  assert.match(segment, /isPersonalInfoPage\(\) && recognized < 1/);
});
