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

test("Companion v0.9.2 is the published userscript contract", () => {
  assert.match(companion, /@version\s+0\.9\.2/);
  assert.match(companion, /const VERSION = "0\.9\.2"/);
  assert.match(companion, /@match\s+https:\/\/visa\.kdmid\.ru\/\*/);
  assert.match(tool, /Companion v0\.9\.2/);
});

test("landing page selects Vietnam and exact Russian sequentially", () => {
  assert.match(companion, /function findSelectWithExactOption/);
  assert.match(companion, /function fillLandingPage/);
  assert.match(companion, /РУССКИЙ \(RUSSIAN\)/);
  assert.match(companion, /Я прочитал эту информацию/);
  const segment = companion.slice(companion.indexOf("function fillLandingPage"), companion.indexOf("function setYesNo"));
  assert.ok(segment.indexOf("ВЬЕТНАМ") < segment.indexOf("РУССКИЙ (RUSSIAN)"));
});

test("password page fills both passwords and waits for manual CAPTCHA", () => {
  assert.match(companion, /function fillPassword/);
  assert.match(companion, /ПОДТВЕРЖДЕНИЕ ПАРОЛЯ/);
  assert.match(companion, /ВВЕДИТЕ НАДПИСЬ С КАРТИНКИ/);
  assert.match(companion, /ОТПРАВИТЬ/);
});

test("application ID is saved only on confirmation page", () => {
  assert.match(companion, /function isIdConfirmationPage/);
  assert.match(companion, /ИДЕНТИФИКАЦИОННЫЙ НОМЕР ВАШЕЙ АНКЕТЫ/);
  assert.match(companion, /saveConfirmedApplicationRecord/);
  assert.match(companion, /ДАЛЕЕ/);
});

test("visa request page is filled sequentially for dependent selects", () => {
  assert.match(companion, /function isVisaRequestPage/);
  assert.match(companion, /function fillVisaRequestPage/);
  assert.match(companion, /function findSelectNearLabel/);
  assert.match(companion, /Цель поездки \(раздел\)/);
  assert.match(companion, /Цель поездки/);
  assert.match(companion, /Категория и вид визы/);
  assert.match(companion, /Кратность визы/);
  assert.match(companion, /ОБЫКНОВЕННАЯ УЧЕБНАЯ/);
  assert.match(companion, /ОДНОКРАТНАЯ/);
  assert.match(companion, /options\.length <= 1/);
});

test("visa request page does not auto-advance until all dependent fields are ready", () => {
  const segment = companion.slice(companion.indexOf("function maybeAdvance"), companion.indexOf("function status"));
  assert.match(segment, /isVisaRequestPage\(\) && recognized < 1/);
  assert.match(companion, /trang visa đã điền đủ các trường phụ thuộc/);
});

test("three Vietnam missions and fixed defaults remain available", () => {
  assert.match(tool, /ПОСОЛЬСТВО РФ ВО ВЬЕТНАМЕ/);
  assert.match(tool, /ГЕНКОНСУЛЬСТВО РФ В ДАНАНГЕ/);
  assert.match(tool, /ГЕНКОНСУЛЬСТВО РФ В ХОШИМИНЕ/);
  assert.match(tool, /\+842437555706/);
});

test("official A4 print remains server-generated", () => {
  assert.match(companion, /maybeAutoPrint/);
  assert.match(companion, /ПЕЧАТЬ ФОРМАТА A4/);
  assert.match(companion, /printButton\.click/);
});
