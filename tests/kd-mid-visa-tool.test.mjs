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
  assert.match(tool, /Cố định cho mọi hồ sơ/);
});

test("Russian labels expose English and Vietnamese hover help", () => {
  assert.match(tool, /const russianHints/);
  assert.match(tool, /English:/);
  assert.match(tool, /Tiếng Việt:/);
  assert.match(companion, /addHoverHints/);
  assert.match(companion, /Purpose of visit/);
  assert.match(companion, /Mục đích chuyến đi/);
});

test("KD-MID Visa supports persistent companion automation and keeps a bookmarklet fallback", () => {
  assert.match(tool, /buildAutomationUrl/);
  assert.match(tool, /#kdmid-bridge=/);
  assert.match(tool, /postMessage\(\{ type: "KD_MID_PAYLOAD"/);
  assert.match(tool, /KD_MID_ACK/);
  assert.match(tool, /kd-mid-visa-companion\.user\.js/);
  assert.match(tool, /Mở KD-MID & tự điền/);
  assert.match(tool, /Tự bấm Далее/);
  assert.match(tool, /javascript:/);
  assert.match(companion, /@match\s+https:\/\/visa\.kdmid\.ru\/\*/);
  assert.match(companion, /KD_MID_PAYLOAD/);
  assert.match(companion, /KD_MID_ACK/);
  assert.match(companion, /maybeAutoAdvance/);
  assert.match(companion, /Печать формата A4/);
});

test("KD-MID Visa blocks automation when required passport fields are incomplete", () => {
  assert.match(tool, /function applicantMissingFields/);
  assert.match(tool, /Ngày sinh/);
  assert.match(tool, /Ngày cấp hộ chiếu/);
  assert.match(tool, /Ngày hết hạn hộ chiếu/);
  assert.match(tool, /Chưa thể tự điền\. Hồ sơ còn thiếu/);
});


test("KD-MID connect page exposes a visible applicant selector", () => {
  assert.match(tool, /Chọn hồ sơ sử dụng/);
  assert.match(tool, /store\.applicants\.map/);
  assert.match(tool, /value=\{selected\?\.id \?\? ""\}/);
  assert.match(tool, /setStore\(\(current\) => \(\{ \.\.\.current, selectedId: event\.target\.value \}\)\)/);
  assert.match(tool, /Đang dùng/);
  assert.match(tool, /Sửa hồ sơ/);
});
