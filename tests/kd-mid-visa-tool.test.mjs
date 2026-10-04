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

test("KD-MID Visa keeps applicant data local and resume credentials", () => {
  assert.match(tool, /application-management:kd-mid-visa:v1/);
  assert.match(tool, /surname5/);
  assert.match(tool, /birthYear/);
  assert.match(tool, /qllhs2025/);
  assert.match(tool, /Application ID/);
  assert.match(tool, /localStorage/);
});

test("fixed address and work phone are enforced", () => {
  assert.match(tool, /ВЬЕТНАМ, Г\. ХАНОЙ, УЛИЦА НГИА ДО, ДОРОГА ХОАНГ КУОК ВЬЕТ, ДОМ Ш9/);
  assert.match(tool, /\+842437555706/);
  assert.match(tool, /personalAddress: fixedPermanentAddress/);
  assert.match(tool, /workPhone: fixedWorkPhone/);
});

test("three Russian missions in Vietnam are selectable", () => {
  assert.match(tool, /ПОСОЛЬСТВО РФ ВО ВЬЕТНАМЕ/);
  assert.match(tool, /ГЕНКОНСУЛЬСТВО РФ В ДАНАНГЕ/);
  assert.match(tool, /ГЕНКОНСУЛЬСТВО РФ В ХОШИМИНЕ/);
  assert.match(tool, /Получатель анкеты/);
  assert.match(tool, /visaConsulates\.map/);
});

test("Russian labels expose English and Vietnamese hover help", () => {
  assert.match(tool, /const russianHints/);
  assert.match(tool, /English:/);
  assert.match(tool, /Tiếng Việt:/);
});

test("applicant form supports route and former USSR/Russia citizenship", () => {
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

test("production workflow uses the official KD-MID site only", () => {
  assert.match(tool, /Kết nối KD-MID/);
  assert.match(tool, /Mở KD-MID chính thức/);
  assert.match(tool, /visa\.kdmid\.ru/);
  assert.match(tool, /buildDirectAutomationUrl/);
  assert.match(tool, /#kdmidv8=/);
  assert.doesNotMatch(tool, /window\.open\("about:blank", "kdmidVisa"\)/);
  assert.match(tool, /Barcode chỉ hợp lệ khi do KD-MID tạo/);
  assert.doesNotMatch(tool, /Tạo & tải PDF/);
  assert.doesNotMatch(tool, /renderPdfExport/);
});

test("companion initializes official KD-MID country, language and consent", () => {
  assert.match(companion, /@match\s+https:\/\/visa\.kdmid\.ru\/\*/);
  assert.match(companion, /ВЬЕТНАМ/);
  assert.match(companion, /РУССКИЙ/);
  assert.match(companion, /Я прочитал эту информацию/);
  assert.match(companion, /ЗАПОЛНИТЬ НОВУЮ АНКЕТУ/);
  assert.match(companion, /COMPLETE NEW APPLICATION/);
});

test("companion fills route, conditional fields and mission", () => {
  assert.match(companion, /A\.routeCity \|\| payload\.city/);
  assert.match(companion, /A\.hadFormerRussianCitizenship/);
  assert.match(companion, /formerCitizenshipLostDate/);
  assert.match(companion, /formerCitizenshipLossReason/);
  assert.match(companion, /Наименование учреждения/);
});

test("companion captures official application ID and requests official A4 PDF", () => {
  assert.match(companion, /Идентификационный номер Вашей анкеты/);
  assert.match(companion, /KD_MID_RECORD/);
  assert.match(companion, /GM_setValue/);
  assert.match(companion, /SHARED_RECORD_KEY/);
  assert.match(companion, /maybeAutoPrint/);
  assert.match(companion, /ПЕЧАТЬ ФОРМАТА A4/);
  assert.match(companion, /PRINT A4/);
  assert.match(companion, /printButton\.click/);
});

test("companion never solves CAPTCHA and resumes only after user input", () => {
  assert.match(companion, /findCaptchaInput/);
  assert.match(companion, /isCaptchaPage/);
  assert.match(companion, /captchaReady/);
  assert.match(companion, /Hãy nhập ký tự CAPTCHA trong ảnh/);
  assert.match(companion, /document\.addEventListener\("input"/);
  assert.match(companion, /không tự đọc\/giải CAPTCHA|Hãy nhập ký tự CAPTCHA trong ảnh/);
});

test("automatic KD-MID flow is enabled by default and carries auto-print intent", () => {
  assert.match(tool, /useState\(true\)/);
  assert.match(tool, /autoPrint: true/);
  assert.match(tool, /Bắt đầu tự động đến PDF/);
  assert.match(tool, /Kiểm tra trước khi chạy/);
});

test("connect page exposes visible applicant selection", () => {
  assert.match(tool, /Chọn hồ sơ sử dụng/);
  assert.match(tool, /store\.applicants\.map/);
  assert.match(tool, /selectedId: event\.target\.value/);
  assert.match(tool, /Đang dùng/);
  assert.match(tool, /Sửa hồ sơ/);
});


test("v0.8 opens KD-MID directly and transfers payload through a self-clearing hash", () => {
  assert.match(companion, /@version\s+0\.8\.0/);
  assert.match(companion, /HASH_PREFIX = "#kdmidv8="/);
  assert.match(companion, /readPayloadFromHash/);
  assert.match(companion, /history\.replaceState/);
  assert.match(tool, /encodeAutomationPayload/);
  assert.match(tool, /buildDirectAutomationUrl/);
  assert.match(tool, /window\.open\(buildDirectAutomationUrl/);
  assert.match(tool, /Trang sẽ không tự đóng/);
});

test("connect page treats App-Manager Companion status as informational in v0.8", () => {
  assert.match(tool, /companionVersion/);
  assert.match(tool, /Companion v0\.8 sẽ tự kiểm tra khi mở KD-MID/);
  assert.match(tool, /đang hoạt động trên App-Manager/);
  assert.match(tool, /dòng trạng thái trên App-Manager chỉ là thông tin phụ/);
  assert.match(tool, /KD_MID_PING/);
});
