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
const resultMigration = fs.readFileSync("drizzle/0010_visa_intake_results.sql", "utf8");
const schema = fs.readFileSync("db/schema.ts", "utf8");

test("visa intake has isolated link and submission tables", () => {
  assert.match(migration, /CREATE TABLE IF NOT EXISTS `visa_intake_links`/);
  assert.match(migration, /token_hash/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS `visa_intake_submissions`/);
  assert.match(migration, /queue_no.*AUTOINCREMENT/);
  assert.match(schema, /export const visaIntakeLinks/);
  assert.match(schema, /export const visaIntakeSubmissions/);
  assert.match(resultMigration, /CREATE TABLE IF NOT EXISTS `visa_intake_results`/);
  assert.match(resultMigration, /pdf_blob/);
  assert.match(schema, /export const visaIntakeResults/);
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
  assert.match(publicPage, /function upperPlain/);
  assert.match(publicPage, /function DateFields/);
  assert.match(publicPage, /visa-day-options/);
  assert.match(publicPage, /visa-month-options/);
  assert.doesNotMatch(publicPage, /function formatDmy/);
  assert.match(publicWorkerPage, /const upperPlain =/);
  assert.match(publicWorkerPage, /data-date="birthDate"/);
  assert.match(publicWorkerPage, /data-part="day"/);
  assert.match(publicWorkerPage, /data-part="month"/);
  assert.match(publicWorkerPage, /data-part="year"/);
  assert.match(publicWorkerPage, /localStorage\.setItem\(storageKey/);
  assert.match(publicWorkerPage, /submissionId:receipt\?\.status==="rejected"/);
  assert.match(publicWorkerPage, /setInterval\(\(\)=>void checkStatus\(\),15000\)/);
  assert.match(publicWorkerPage, /data-correction/);
  assert.match(publicWorkerPage, /↻ Cập nhật trạng thái/);
  assert.match(publicWorkerPage, /checkStatus\(true\)/);
  assert.doesNotMatch(publicWorkerPage, /const formatDmy =/);
});

test("public submit validates dates, emails, conditional fields and a confirmation", () => {
  assert.match(publicApi, /function validDmy/);
  assert.match(publicApi, /function upperPlain/);
  assert.match(publicApi, /normalize\("NFD"\)/);
  assert.match(publicApi, /Ngày cấp hộ chiếu không được ở tương lai/);
  assert.match(publicApi, /Ngày hết hạn hộ chiếu phải sau ngày cấp/);
  assert.match(publicApi, /Hộ chiếu đã hết hạn/);
  assert.match(publicApi, /Email cá nhân không hợp lệ/);
  assert.match(publicApi, /if \(applicant\.visitedRussia\)/);
  assert.match(publicApi, /if \(applicant\.hasInsurance/);
  assert.match(publicApi, /Xác nhận thông tin là đúng sự thật/);
  assert.match(publicApi, /submissionId/);
  assert.match(publicApi, /existing\.status !== "rejected"/);
  assert.match(publicApi, /SET status='pending'/i);
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
  assert.match(adminApi, /CORRECTION_FIELD_REQUIRED/);
  assert.match(adminApi, /correctionFields/);
  assert.match(adminApi, /resubmittedFields/);
  assert.match(publicApi, /resubmittedFields/);
  assert.match(tool, /data-resubmitted/);
  assert.match(tool, /ĐÃ SỬA/);
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


test("resubmitted corrections are green for admin and can be clicked red again", () => {
  assert.match(publicApi, /resubmittedFields = Array\.isArray\(previousValidation\.correctionFields\)/);
  assert.match(tool, /wasResubmitted = item\.resubmittedFields\?\.includes\(key\)/);
  assert.match(tool, /data-resubmitted=\{item\.status === "pending" && wasResubmitted && !selectedForReturn\}/);
  assert.match(tool, /Ô xanh = người gửi đã sửa/);
});

test("sender can manually refresh the intake status without waiting for polling", () => {
  assert.match(publicPage, /function refreshSubmissionStatus\(manual = false\)/);
  assert.match(publicPage, /↻ Cập nhật trạng thái/);
  assert.match(publicWorkerPage, /refreshWaiting/);
  assert.match(publicWorkerPage, /refreshReturned/);
});


test("intake batches keep a recoverable stable public link after reset", () => {
  assert.match(adminApi, /publicPath: `\/visa-intake\?batch=/);
  assert.match(publicApi, /function validBatchId/);
  assert.match(publicApi, /function linkByAccess/);
  assert.match(publicApi, /WHERE id=\? LIMIT 1/);
  assert.match(tool, /function intakePublicUrl/);
  assert.match(tool, /item\.publicPath/);
  assert.match(tool, /intakeLinks\.filter\(\(item\) => item\.status === "active"\)/);
});

test("accepted intake submissions can receive and download one PDF result", () => {
  assert.match(adminApi, /action === "send-result"/);
  assert.match(adminApi, /RESULT_PDF_TOO_LARGE/);
  assert.match(adminApi, /"%PDF-"/);
  assert.match(adminApi, /visa_intake_results/);
  assert.match(publicApi, /wantsResult/);
  assert.match(publicApi, /application\/pdf/);
  assert.match(publicApi, /downloadUrl/);
  assert.match(tool, /Gửi PDF kết quả/);
  assert.match(publicPage, /ĐÃ TIẾP NHẬN HỒ SƠ/);
  assert.match(publicPage, /Nhận kết quả/);
  assert.match(publicWorkerPage, /ĐÃ TIẾP NHẬN HỒ SƠ/);
  assert.match(publicWorkerPage, /Tải PDF kết quả/);
});

test("closed batches still allow an existing submission to check status and receive results", () => {
  assert.match(publicApi, /if\(submissionId\)|if \(submissionId\)/);
  assert.match(publicApi, /link\.status!==?"active"|link\.status !== "active"/);
  assert.match(publicApi, /Người đã gửi hồ sơ vẫn có thể mở lại link/);
});


test("closing an intake link removes its admin card while preserving server-side history", () => {
  assert.match(tool, /intakeLinks\.filter\(\(item\) => item\.status === "active"\)/);
  assert.match(tool, /setShareUrl\(\(current\) => current\.includes/);
  assert.match(tool, /Tab đợt này đã được ẩn khỏi danh sách/);
  assert.match(publicApi, /Người đã gửi hồ sơ vẫn có thể mở lại link/);
});


test("admin can delete only pending or rejected submissions from the verification queue with confirmation", () => {
  assert.match(tool, /function deleteIntakeSubmission\(submission: IntakeSubmission\)/);
  assert.match(tool, /Xóa khỏi hàng chờ/);
  assert.match(tool, /window\.confirm/);
  assert.match(tool, /action: "delete-submission"/);
  assert.match(api, /SUBMISSION_DELETE_LOCKED/);
  assert.match(api, /\["pending", "rejected"\]\.includes\(existing\.status\)/);
});


test("completed submissions including those with PDF can be removed from the admin queue without deleting result data", () => {
  assert.match(tool, /completed = \["approved", "imported"\]\.includes\(submission\.status\)/);
  assert.match(tool, /action: completed \? "archive-submission" : "delete-submission"/);
  assert.match(tool, /PDF kết quả vẫn được giữ trên server/);
  assert.match(api, /action === "archive-submission"/);
  assert.match(api, /adminHidden: true/);
  assert.match(api, /preservedResult: true/);
  assert.match(api, /validation\.adminHidden===true/);
  assert.match(api, /\["approved", "imported"\]\.includes\(existing\.status\)/);
});


test("public intake exposes complete visa request fields and server derives passport expiry from issue date", () => {
  for (const field of ["citizenship","purposeSection","purpose","visaType","entries","entryDate","exitDate","destinationType","organization","organizationAddress","tin","telex","invitation","hasOtherNames","otherNames","bornInRussia","hasPermanentAddress","personalAddress","personalFax","worksOrStudies","workFax","passwordOverride","applicationId"]) {
    assert.match(publicPage, new RegExp(field));
    assert.match(publicApi, new RegExp(field));
  }
  assert.match(publicApi, /function passportExpiryFromIssue/);
  assert.match(publicApi, /passportExpiry: passportExpiryFromIssue\(passportIssue\)/);
  assert.match(publicPage, /readOnly value=\{applicant\.passportExpiry\}/);
});


test("production standalone intake exposes the same complete KD-MID field set", () => {
  for (const field of ["citizenship","purposeSection","purpose","visaType","entries","entryDate","exitDate","destinationType","organization","organizationAddress","tin","telex","invitation","hasOtherNames","otherNames","bornInRussia","hasPermanentAddress","personalAddress","personalFax","worksOrStudies","workFax","passwordOverride","applicationId"]) {
    assert.match(publicWorkerPage, new RegExp('name="' + field + '"|data-date="' + field + '"'));
  }
  assert.match(publicWorkerPage, /passportExpiryFromIssue/);
  assert.match(publicWorkerPage, /readonly required/);
});

test("payload and bookmarklet no longer overwrite editable address and fax profile fields", () => {
  assert.match(tool, /personalAddress: applicant\.hasPermanentAddress === false/);
  assert.match(tool, /A\.personalAddress\|\|p\.fixedPermanentAddress/);
  assert.match(tool, /Ваш личный факс/);
  assert.match(tool, /Рабочий факс/);
});


test("admin creates two persistent intake form types and snapshots the type in defaults", () => {
  assert.match(tool, /intakeFormType/);
  assert.match(tool, /Link 1 · Nhập học/);
  assert.match(tool, /Link 2 · Người thường/);
  assert.match(adminApi, /formType = text\(body\.formType, 20\) === "general"/);
  assert.match(adminApi, /formType,/);
  assert.match(adminApi, /defaults\.formType==="general"/);
});

test("general intake does not inherit study-only KD-MID defaults while student intake requires Telex", () => {
  assert.match(tool, /purposeSection: student \? store\.common\.purposeSection : ""/);
  assert.match(tool, /telex: student \? store\.common\.telex : ""/);
  assert.match(publicApi, /student \? "УЧЕБА" : ""/);
  assert.match(publicApi, /student \? "МОСКВА" : ""/);
  assert.match(publicApi, /\["telex", "Mã Telex"\]/);
});
