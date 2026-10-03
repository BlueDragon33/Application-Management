import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const dashboard = fs.readFileSync("app/management-dashboard-v2.tsx", "utf8");
const tool = fs.readFileSync("app/tools/kd-mid-visa/kd-mid-visa.tsx", "utf8");
const pdf = fs.readFileSync("app/tools/kd-mid-visa/visa-pdf.ts", "utf8");
const page = fs.readFileSync("app/tools/kd-mid-visa/page.tsx", "utf8");
const companion = fs.readFileSync("public/kd-mid-visa-companion.user.js", "utf8");

test("KD-MID Visa is registered as an internal Tool", () => {
  assert.match(dashboard, /id: "tool-kd-mid-visa"/);
  assert.match(dashboard, /href: "\/tools\/kd-mid-visa"/);
  assert.match(dashboard, /name: "KD-MID Visa VN"/);
  assert.match(page, /requireChatGPTUser\("\/tools\/kd-mid-visa"\)/);
});

test("KD-MID Visa keeps applicant data local and exposes resume credentials", () => {
  assert.match(tool, /application-management:kd-mid-visa:v1/);
  assert.match(tool, /surname5/);
  assert.match(tool, /birthYear/);
  assert.match(tool, /qllhs2025/);
  assert.match(tool, /Application ID/);
  assert.match(tool, /localStorage/);
});

test("fixed address and work phone are enforced for every applicant", () => {
  assert.match(tool, /ВЬЕТНАМ, Г\. ХАНОЙ, УЛИЦА НГИА ДО, ДОРОГА ХОАНГ КУОК ВЬЕТ, ДОМ Ш9/);
  assert.match(tool, /\+842437555706/);
  assert.match(tool, /personalAddress: fixedPermanentAddress/);
  assert.match(tool, /workPhone: fixedWorkPhone/);
  assert.match(pdf, /FIXED_ADDRESS = "ВЬЕТНАМ, Г\. ХАНОЙ, УЛИЦА НГИА ДО, ДОРОГА ХОАНГ КУОК ВЬЕТ, ДОМ Ш9"/);
  assert.match(pdf, /FIXED_WORK_PHONE = "\+842437555706"/);
});

test("Russian labels expose English and Vietnamese hover help", () => {
  assert.match(tool, /const russianHints/);
  assert.match(tool, /English:/);
  assert.match(tool, /Tiếng Việt:/);
});

test("PDF export offers the three Russian missions in Vietnam", () => {
  assert.match(pdf, /ПОСОЛЬСТВО РФ ВО ВЬЕТНАМЕ/);
  assert.match(pdf, /ГЕНКОНСУЛЬСТВО РФ В ДАНАНГЕ/);
  assert.match(pdf, /ГЕНКОНСУЛЬСТВО РФ В ХОШИМИНЕ/);
  assert.match(tool, /Xuất PDF visa/);
  assert.match(tool, /Получатель анкеты/);
  assert.match(tool, /visaConsulates\.map/);
});

test("PDF generator reproduces the official two-page A4 structure", () => {
  assert.match(pdf, /PAGE_W_PT = 595/);
  assert.match(pdf, /PAGE_H_PT = 842/);
  assert.match(pdf, /ПЕЧАТНАЯ ФОРМА ЭЛЕКТРОННОЙ ВИЗОВОЙ АНКЕТЫ/);
  assert.match(pdf, /Страница 1 из 2/);
  assert.match(pdf, /Страница 2 из 2/);
  assert.match(pdf, /Фотография и подпись/);
  assert.match(pdf, /Служебная информация \(формируется автоматически\)/);
  assert.match(pdf, /buildImagePdf/);
  assert.match(pdf, /generateVisaApplicationPdf/);
});

test("PDF export does not invent an official application ID", () => {
  assert.match(pdf, /function applicationNumber/);
  assert.match(pdf, /\/\^\\d\{6,12\}\$\//);
  assert.match(tool, /Nếu chưa có, PDF vẫn được tạo nhưng để trống ID\/barcode/);
});

test("PDF export keeps optional Russia visit and insurance rows dynamic", () => {
  assert.match(pdf, /visitExtra = visited \? 22\.2 : 0/);
  assert.match(pdf, /insuranceExtra = insured \? 22\.2 : 0/);
  assert.match(pdf, /Даты Вашей последней поездки в Россию/);
  assert.match(pdf, /Название страховой компании и номер/);
});

test("PDF export page exposes an applicant selector", () => {
  assert.match(tool, /HỒ SƠ ĐANG DÙNG/);
  assert.match(tool, /store\.applicants\.map/);
  assert.match(tool, /selectedId: event\.target\.value/);
  assert.match(tool, /Sửa hồ sơ đang chọn/);
});


test("KD-MID applicant form supports per-applicant route and former USSR/Russia citizenship", () => {
  assert.match(tool, /routeCity: string/);
  assert.match(tool, /hadFormerRussianCitizenship: boolean/);
  assert.match(tool, /formerCitizenshipLostDate: string/);
  assert.match(tool, /formerCitizenshipLossReason: string/);
  assert.match(tool, /Маршрут \(населенные пункты\)/);
  assert.match(tool, /Когда\?/);
  assert.match(tool, /В связи с чем\?/);
  assert.match(tool, /НЕТ · Không/);
  assert.match(tool, /ДА · Có/);
});

test("PDF prints route override and former citizenship details when applicable", () => {
  assert.match(pdf, /applicant\.routeCity\.trim\(\) \|\| common\.city/);
  assert.match(pdf, /applicant\.hadFormerRussianCitizenship/);
  assert.match(pdf, /formerCitizenshipLostDate/);
  assert.match(pdf, /formerCitizenshipLossReason/);
  assert.match(pdf, /ДА,/);
});


test("production workflow uses the official KD-MID site and companion bridge", () => {
  assert.match(tool, /Kết nối KD-MID/);
  assert.match(tool, /Mở KD-MID chính thức/);
  assert.match(tool, /visa\.kdmid\.ru/);
  assert.match(tool, /#kdmid-bridge=/);
  assert.match(tool, /KD_MID_PAYLOAD/);
  assert.match(tool, /KD_MID_ACK/);
  assert.match(tool, /Barcode chỉ hợp lệ khi do KD-MID tạo/);
  assert.match(companion, /@match\s+https:\/\/visa\.kdmid\.ru\/\*/);
  assert.match(companion, /ВЬЕТНАМ/);
  assert.match(companion, /РУССКИЙ/);
  assert.match(companion, /Я прочитал эту информацию/);
  assert.match(companion, /ЗАПОЛНИТЬ НОВУЮ АНКЕТУ/);
  assert.match(companion, /Печать формата A4/);
});

test("companion fills per-applicant route and former citizenship fields", () => {
  assert.match(companion, /A\.routeCity \|\| payload\.city/);
  assert.match(companion, /A\.hadFormerRussianCitizenship/);
  assert.match(companion, /formerCitizenshipLostDate/);
  assert.match(companion, /formerCitizenshipLossReason/);
  assert.match(companion, /Наименование учреждения/);
});
