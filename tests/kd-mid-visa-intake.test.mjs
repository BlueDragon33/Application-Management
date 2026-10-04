import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const tool = fs.readFileSync("app/tools/kd-mid-visa/kd-mid-visa.tsx", "utf8");
const publicPage = fs.readFileSync("app/visa-intake/page.tsx", "utf8");
const publicApi = fs.readFileSync("app/api/kd-mid-visa-intake/public/route.ts", "utf8");
const adminApi = fs.readFileSync("app/api/kd-mid-visa-intake/admin/route.ts", "utf8");
const worker = fs.readFileSync("worker/index.ts", "utf8");
const publicWorkerPage = fs.readFileSync("worker/visa-intake-public.ts", "utf8");
const migration = fs.readFileSync("drizzle/0009_visa_intake.sql", "utf8");
const schema = fs.readFileSync("db/schema.ts", "utf8");

test("visa intake has isolated link and submission tables", () => {
  assert.match(migration, /CREATE TABLE IF NOT EXISTS `visa_intake_links`/);
  assert.match(migration, /token_hash/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS `visa_intake_submissions`/);
  assert.match(migration, /queue_no.*AUTOINCREMENT/);
  assert.match(schema, /export const visaIntakeLinks/);
  assert.match(schema, /export const visaIntakeSubmissions/);
});

test("only public intake page and public intake API bypass Production admin login", () => {
  assert.match(worker, /function isPublicVisaIntakeRequest/);
  assert.match(worker, /url\.pathname === "\/visa-intake"/);
  assert.match(worker, /publicVisaIntakePage\(\)/);
  assert.match(worker, /url\.pathname === "\/api\/kd-mid-visa-intake\/public"/);
  assert.doesNotMatch(worker, /url\.pathname === "\/api\/kd-mid-visa-intake\/admin".*return true/s);
});

test("public intake form is Vietnamese and covers required visa profile fields", () => {
  const formSource = publicWorkerPage + "\n" + publicPage;
  for (const phrase of [
    "Thông tin cá nhân",
    "Hộ chiếu",
    "Liên hệ & địa chỉ",
    "Nơi làm việc / học tập",
    "Lịch sử liên quan đến Nga",
    "Gia đình & nơi nộp hồ sơ",
    "Hoàn thành & gửi hồ sơ",
  ]) assert.ok(formSource.includes(phrase), phrase);
  assert.match(publicPage, /required value=\{applicant\.passportNo\}/);
  assert.match(publicPage, /required value=\{applicant\.email\}/);
  assert.match(publicPage, /childrenUnder16/);
  assert.match(publicPage, /relativesInRussia/);
});

test("public submit validates dates, emails, conditional fields and a confirmation", () => {
  assert.match(publicApi, /function validDmy/);
  assert.match(publicApi, /Email cá nhân không hợp lệ/);
  assert.match(publicApi, /if \(applicant\.visitedRussia\)/);
  assert.match(publicApi, /if \(applicant\.hasInsurance/);
  assert.match(publicApi, /Xác nhận thông tin là đúng sự thật/);
});

test("public link stores only a token hash and admin creates a 256-bit share token", () => {
  assert.match(adminApi, /crypto\.getRandomValues\(new Uint8Array\(32\)\)/);
  assert.match(adminApi, /await sha256\(token\)/);
  assert.doesNotMatch(migration, /token_plain|plain_token/);
});

test("admin inbox sorts by queue number and requires review before import", () => {
  assert.match(adminApi, /ORDER BY CASE status/);
  assert.match(adminApi, /queue_no ASC/);
  assert.match(adminApi, /SUBMISSION_NOT_APPROVED/);
  assert.match(tool, /Xác minh & lưu hồ sơ/);
  assert.match(tool, /intakeOrder: submission\.queueNo/);
  assert.match(tool, /left - right/);
});

test("approved intake submission is mapped into the local KD-MID applicant model", () => {
  assert.match(tool, /function applicantFromIntake/);
  assert.match(tool, /preferredEmbassy: value\("preferredEmbassy"\)/);
  assert.match(tool, /visitedRussia: flag\("visitedRussia"\)/);
  assert.match(tool, /childrenUnder16: flag\("childrenUnder16"\)/);
  assert.match(tool, /intakeSubmissionId: submission\.id/);
  assert.match(tool, /action: "mark-imported"/);
});

test("intake link snapshots the current common work and embassy defaults", () => {
  assert.match(tool, /employer: store\.common\.employer/);
  assert.match(tool, /workPhone: fixedWorkPhone/);
  assert.match(tool, /permanentAddress: fixedPermanentAddress/);
  assert.match(tool, /preferredEmbassy: store\.common\.embassy/);
});

test("applicant preferred embassy overrides common embassy in the KD-MID payload", () => {
  assert.match(tool, /embassy: applicant\.preferredEmbassy \|\| common\.embassy/);
});
