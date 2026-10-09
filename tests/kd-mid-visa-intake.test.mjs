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
const deviceMigration = fs.readFileSync("drizzle/0011_visa_intake_device_recovery.sql", "utf8");
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
  assert.match(worker, /publicVisaIntakePage\(request, env\)/);
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
  assert.match(tool, /employer: student \? store\.common\.employer : ""/);
  assert.match(tool, /workPhone: student \? fixedWorkPhone : ""/);
  assert.match(tool, /permanentAddress: student \? fixedPermanentAddress : ""/);
  assert.match(tool, /preferredEmbassy: student \? store\.common\.embassy : ""/);
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
  assert.match(tool, /link\.publicPath/);
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

test("closed batches stop sender-side recovery and result access", () => {
  assert.match(publicApi, /link\.status!==?"active"|link\.status !== "active"/);
  assert.match(publicApi, /Link này không còn cho phép người nhận mở lại hồ sơ hoặc nhận kết quả/);
});


test("closing an intake link removes its admin card while preserving server-side history", () => {
  assert.match(tool, /intakeLinks\.filter\(\(item\) => item\.status === "active"\)/);
  assert.match(tool, /setShareUrl\(\(current\) => current\.includes/);
  assert.match(tool, /Tab đợt này đã được ẩn khỏi danh sách/);
  assert.match(publicApi, /Link này không còn cho phép người nhận mở lại hồ sơ hoặc nhận kết quả/);
});


test("admin can delete only pending or rejected submissions from the verification queue with confirmation", () => {
  assert.match(tool, /function deleteIntakeSubmission\(submission: IntakeSubmission\)/);
  assert.match(tool, /Xóa khỏi hàng chờ/);
  assert.match(tool, /window\.confirm/);
  assert.match(tool, /action: completed \? "archive-submission" : "delete-submission"/);
  assert.match(adminApi, /SUBMISSION_DELETE_LOCKED/);
  assert.match(adminApi, /\["pending", "rejected"\]\.includes\(existing\.status\)/);
});


test("completed submissions including those with PDF can be removed from the admin queue without deleting result data", () => {
  assert.match(tool, /completed = \["approved", "imported"\]\.includes\(submission\.status\)/);
  assert.match(tool, /action: completed \? "archive-submission" : "delete-submission"/);
  assert.match(tool, /PDF kết quả vẫn được giữ trên server/);
  assert.match(adminApi, /action === "archive-submission"/);
  assert.match(adminApi, /adminHidden: true/);
  assert.match(adminApi, /preservedResult: true/);
  assert.match(adminApi, /validation\.adminHidden===true/);
  assert.match(adminApi, /\["approved", "imported"\]\.includes\(existing\.status\)/);
});


test("public intake exposes complete visa request fields and only defaults passport expiry from issue date", () => {
  for (const field of ["citizenship","purposeSection","purpose","visaType","entries","entryDate","exitDate","destinationType","organization","organizationAddress","tin","telex","invitation","hasOtherNames","otherNames","bornInRussia","hasPermanentAddress","personalAddress","personalFax","worksOrStudies","workFax","passwordOverride","applicationId"]) {
    assert.match(publicPage, new RegExp(field));
    assert.match(publicApi, new RegExp(field));
  }
  assert.match(publicApi, /function passportExpiryFromIssue/);
  assert.match(publicApi, /passportExpiry: text\(source\.passportExpiry, 10\) \|\| passportExpiryFromIssue\(passportIssue\)/);
  assert.match(publicPage, /value=\{applicant\.passportExpiry\} onChange=\{\(value\) => set\("passportExpiry", value\)\}/);
});


test("production standalone intake exposes the same complete KD-MID field set", () => {
  for (const field of ["citizenship","purposeSection","purpose","visaType","entries","entryDate","exitDate","destinationType","organization","organizationAddress","tin","telex","invitation","hasOtherNames","otherNames","bornInRussia","hasPermanentAddress","personalAddress","personalFax","worksOrStudies","workFax","passwordOverride","applicationId"]) {
    assert.match(publicWorkerPage, new RegExp('name="' + field + '"|data-date="' + field + '"'));
  }
  assert.match(publicWorkerPage, /passportExpiryFromIssue/);
  assert.doesNotMatch(publicWorkerPage, /data-date="passportExpiry"[\s\S]{0,500}readonly required/);
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


test("React public intake visibly distinguishes student and general forms", () => {
  assert.match(publicPage, /LINK 1 · MẪU NHẬP HỌC/);
  assert.match(publicPage, /LINK 2 · MẪU VISA NGƯỜI THƯỜNG/);
  assert.match(publicPage, /required=\{formType === "student"\} value=\{applicant\.telex\}/);
  assert.match(publicPage, /-- Chọn nơi nộp hồ sơ --/);
  assert.match(publicPage, /purposeSection: ""/);
  assert.match(publicPage, /routeCity: ""/);
});


test("production worker renders student versus general intake from persisted formType", () => {
  assert.match(publicWorkerPage, /LINK 1 · MẪU NHẬP HỌC/);
  assert.match(publicWorkerPage, /LINK 2 · MẪU VISA NGƯỜI THƯỜNG/);
  assert.match(publicWorkerPage, /formType = data\.link\?\.formType === "general"/);
  assert.match(publicWorkerPage, /el\.required=student/);
  assert.match(publicWorkerPage, /student \? "МОСКВА" : ""/);
  assert.match(publicWorkerPage, /-- Chọn nơi nộp hồ sơ --/);
});


test("public intake binds each submitted record to a stable hashed browser device identity", () => {
  assert.match(publicApi, /function validDeviceId/);
  assert.match(publicApi, /async function deviceIdentity/);
  assert.match(publicApi, /device_hash/);
  assert.match(publicApi, /device_code/);
  assert.match(publicApi, /WHERE link_id=\? AND device_hash=\?/);
  assert.match(publicApi, /Thiết bị này không khớp/);
  assert.match(adminApi, /device_code/);
  assert.match(tool, /Thiết bị \$\{item\.deviceCode\}/);
  assert.match(deviceMigration, /visa_intake_submissions_link_device_idx/);
});

test("closing an intake link disables sender recovery while preserving admin-side records", () => {
  assert.match(publicApi, /Link này không còn cho phép người nhận mở lại hồ sơ hoặc nhận kết quả/);
  assert.match(publicApi, /if\(link\.status!==?"active"\|\|link\.expired\)/);
});


test("both intake variants include visible filling guidance and student common-default notice", () => {
  assert.match(publicPage, /Hướng dẫn điền hồ sơ/);
  assert.match(publicPage, /Thông tin chung Link 1 đã nạp sẵn/);
  assert.match(publicWorkerPage, /Hướng dẫn điền hồ sơ/);
  assert.match(publicWorkerPage, /Thông tin chung Link 1 đã nạp sẵn/);
});

test("sender browser keeps a stable device id and automatically recovers the server submission after tab close", () => {
  assert.match(publicPage, /visa-intake:device-id:v1/);
  assert.match(publicPage, /deviceId=\$\{encodeURIComponent\(deviceValue\)\}/);
  assert.match(publicPage, /data\.submission\?\.applicant/);
  assert.match(publicWorkerPage, /visa-intake:device-id:v1/);
  assert.match(publicWorkerPage, /data\.submission\?\.applicant/);
  assert.match(publicWorkerPage, /deviceId,applicant/);
});


test("student common defaults are written directly into empty production form fields and old blank drafts cannot erase them", () => {
  assert.match(publicWorkerPage, /const mergeCommonDefaultsIntoDraft = draft/);
  assert.match(publicWorkerPage, /if\(!String\(merged\[key\] \?\? ""\)\.trim\(\) && String\(value \?\? ""\)\.trim\(\)\) merged\[key\]=String\(value\)/);
  assert.match(publicWorkerPage, /currentApplicant=normalizePersonalApplicant\(mergeCommonDefaultsIntoDraft\(currentApplicant\)\)/);
  assert.match(publicWorkerPage, /currentApplicant=normalizePersonalApplicant\(mergeCommonDefaultsIntoDraft\(\{\}\)\)/);
  assert.match(publicWorkerPage, /được điền sẵn trực tiếp trong từng ô/);
});


test("student intake links always expose complete shared defaults, including old links with blank defaults", () => {
  for (const value of [
    "05/10/2026",
    "31/12/2026",
    "7707740714",
    "321422",
    "МОСКВА",
    "СТУДЕНТ",
    "+842437555706",
    "lequydonqllhs@gmail.com",
    "ПОСОЛЬСТВО РФ ВО ВЬЕТНАМЕ",
  ]) {
    assert.match(publicApi, new RegExp(value.replace(/[.*+?^$()|[\]{}]/g, "\\$&")));
  }
  assert.match(publicApi, /defaults=fillStudentDefaults\(defaults\)/);
  assert.match(publicApi, /const recoveredDefaults = fillStudentDefaults\(link\.defaults\)/);
  assert.match(adminApi, /const safeDefaults = student \? fillStudentDefaults\(submittedDefaults\) : submittedDefaults/);
});


test("Link 1 client has its own complete fallback defaults and recovered blank data cannot clear them", () => {
  assert.match(publicWorkerPage, /const STUDENT_FORM_DEFAULTS = \{/);
  assert.match(publicWorkerPage, /withStudentFallbacks\(rawDefaults\)/);
  assert.match(publicWorkerPage, /currentApplicant=normalizePersonalApplicant\(student \? mergeCommonDefaultsIntoDraft\(data\.submission\.applicant\)/);
  assert.match(publicPage, /const STUDENT_FORM_DEFAULTS/);
  assert.match(publicPage, /const STUDENT_SHARED_KEYS/);
  assert.match(publicPage, /if \(resolvedFormType === "student"\)/);
  assert.match(publicPage, /!String\(recovered\[key\] \?\? ""\)\.trim\(\)/);
});


test("production visa intake server-renders Link 1 defaults into input value attributes before JavaScript runs", () => {
  assert.match(publicWorkerPage, /export async function publicVisaIntakePage\(request: Request, env: VisaIntakePageEnv\)/);
  assert.match(publicWorkerPage, /resolveServerDefaults\(request, env\)/);
  assert.match(publicWorkerPage, /name="workStudyPlace" value="\$\{htmlAttr\(serverDefaults\.employer\)\}"/);
  assert.match(publicWorkerPage, /name="position" value="\$\{htmlAttr\(serverDefaults\.position\)\}"/);
  assert.match(publicWorkerPage, /name="workAddress" value="\$\{htmlAttr\(serverDefaults\.workAddress\)\}"/);
  assert.match(publicWorkerPage, /name="workPhone" value="\$\{htmlAttr\(serverDefaults\.workPhone\)\}"/);
  assert.match(publicWorkerPage, /name="workEmail" type="email" value="\$\{htmlAttr\(serverDefaults\.workEmail\)\}"/);
  assert.match(publicWorkerPage, /name="telex" value="\$\{htmlAttr\(serverDefaults\.telex\)\}"/);
  assert.match(publicWorkerPage, /value="\$\{entryDate\.day\}"/);
  assert.match(publicWorkerPage, /STUDENT_SERVER_DEFAULTS/);
});


test("passport expiry defaults to issue date plus ten years but remains editable end-to-end", () => {
  assert.match(publicPage, /keepManualExpiry/);
  assert.match(publicApi, /text\(source\.passportExpiry, 10\) \|\| passportExpiryFromIssue\(passportIssue\)/);
  assert.match(publicWorkerPage, /passportExpiryManuallyEdited/);
  assert.match(publicWorkerPage, /passportExpiry:value\("passportExpiry"\) \|\| passportExpiryFromIssue/);
  assert.match(tool, /normalizeDmy\(applicant\.passportExpiry\) \|\| passportExpiryFromIssue/);
  assert.match(tool, /normalizeDmy\(next\.passportExpiry\) \|\| passportExpiryFromIssue/);
});


test("public intake mirrors KD-MID select controls for canonical choice fields", () => {
  for (const field of ["citizenship","purposeSection","purpose","visaType","entries","destinationType"]) {
    assert.match(publicWorkerPage, new RegExp('<select name="' + field + '"'));
  }
  assert.match(publicPage, /function SelectRussian/);
  assert.match(publicPage, /ОДНОКРАТНАЯ/);
  assert.match(publicPage, /ДВУКРАТНАЯ/);
  assert.match(publicPage, /МНОГОКРАТНАЯ/);
  assert.match(publicPage, /ФИЗИЧЕСКОЕ ЛИЦО/);
});

test("Russian labels show Vietnamese translations on hover without an online translation dependency", () => {
  assert.match(publicPage, /title=\{russianTranslation\(ru\)\}/);
  assert.match(publicWorkerPage, /const russianTranslations = \{/);
  assert.match(publicWorkerPage, /el\.setAttribute\("title", translated\)/);
});


test("passport expiry UI has no extra subtitle, auto-fills +10, stays editable, and preserves a recovered manual value", () => {
  assert.doesNotMatch(publicWorkerPage, /Ngày hết hạn hộ chiếu\s*<small>/);
  assert.doesNotMatch(publicPage, /label="Ngày hết hạn hộ chiếu"\s+ru=/);
  assert.match(publicWorkerPage, /const syncPassportExpiry = \(\) =>/);
  assert.match(publicWorkerPage, /fillDate\("passportExpiry",next\)/);
  assert.match(publicWorkerPage, /passportExpiryManuallyEdited=true/);
  assert.match(publicPage, /const previousAuto = passportExpiryFromIssue\(current\.passportIssue\)/);
  assert.match(publicPage, /keepManualExpiry/);
  assert.match(publicPage, /const recoveredExpiry = String\(recovered\.passportExpiry \?\? ""\)\.trim\(\)/);
  assert.match(publicPage, /merged\.passportExpiry = recoveredExpiry \|\| passportExpiryFromIssue/);
});


test("five marked personal text fields normalize Vietnamese accents and uppercase immediately", () => {
  for (const field of ["surname","givenNames","birthPlace","otherNames","routeCity"]) {
    assert.match(publicPage, new RegExp('set\\("' + field + '", upperPlain\\(e\\.target\\.value\\)\\)'));
  }
  assert.match(publicWorkerPage, /const personalUpperPlainNames = \["surname","givenNames","birthPlace","otherNames","routeCity"\]/);
  assert.match(publicWorkerPage, /const normalizePlainElement = el =>/);
  assert.match(publicWorkerPage, /el\.value=normalized/);
});

test("personal required fields show a star and stay visually highlighted until valid", () => {
  for (const field of ["surname","givenNames","birthDate","birthPlace","sex","passportNo","passportIssue","passportExpiry","phone","email"]) {
    assert.match(publicWorkerPage, new RegExp('data-field="' + field + '" data-personal-required="true"'));
  }
  assert.match(publicPage, /personalRequired \? <b className=\{styles\.requiredMark\}/);
  assert.match(publicPage, /data-personal-required=\{personalRequired\}/);
  assert.match(publicWorkerPage, /data-personal-required="true"/);
  assert.match(publicWorkerPage, /:has\(input:required:invalid\)/);
  assert.match(publicWorkerPage, /class="required-mark">\*<\/b>/);
});

test("other names is marked required only when the applicant says they used another name", () => {
  assert.match(publicPage, /applicant\.hasOtherNames \? <Field fieldKey="otherNames"[^>]*personalRequired/);
  assert.match(publicWorkerPage, /syncOtherNamesRequired/);
  assert.match(publicWorkerPage, /otherNamesInput\.required=otherNamesSelect\?\.value==="ДА"/);
});


test("production inline visa-intake script is valid JavaScript", () => {
  const script = publicWorkerPage.match(/<script>\n([\s\S]*?)\n<\/script>/)?.[1];
  assert.ok(script, "inline worker script");
  assert.doesNotThrow(() => new Function(script));
});

test("personal uppercase normalization survives restored drafts and runs on input/change/blur/compositionend", () => {
  assert.match(publicWorkerPage, /const personalUpperPlainNames = \["surname","givenNames","birthPlace","otherNames","routeCity"\]/);
  assert.match(publicWorkerPage, /const normalizePersonalApplicant = applicant =>/);
  assert.match(publicWorkerPage, /applicant=normalizePersonalApplicant\(applicant\)/);
  assert.match(publicWorkerPage, /"input","change","blur","compositionend"/);
  assert.match(publicWorkerPage, /normalizePlainElement\(el\)/);
  assert.match(publicPage, /PERSONAL_UPPER_PLAIN_KEYS/);
});

test("standalone form submit cannot be silently blocked by native validation", () => {
  assert.match(publicWorkerPage, /<form id="form" novalidate>/);
  assert.match(publicWorkerPage, /const collectClientInvalid = \(\) =>/);
  assert.match(publicWorkerPage, /Còn trường bắt buộc chưa điền hoặc chưa hợp lệ/);
  assert.match(publicWorkerPage, /normalizePersonalApplicant\(readApplicant\(\)\)/);
  assert.match(publicWorkerPage, /form\.addEventListener\("invalid"/);
});

test("autosave is resilient and stores normalized personal fields", () => {
  assert.match(publicWorkerPage, /const persistFormDraft = \(\) =>/);
  assert.match(publicWorkerPage, /saveLocal\(normalizePersonalApplicant\(readApplicant\(\)\)\)/);
  assert.match(publicWorkerPage, /visa-intake autosave skipped/);
});
