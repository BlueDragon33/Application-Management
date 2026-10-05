"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import styles from "./visa-intake.module.css";

type ApplicantForm = {
  surname: string;
  givenNames: string;
  birthDate: string;
  birthPlace: string;
  sex: string;
  hasOtherNames: boolean;
  otherNames: string;
  bornInRussia: boolean;
  citizenship: string;
  purposeSection: string;
  purpose: string;
  visaType: string;
  entries: string;
  entryDate: string;
  exitDate: string;
  destinationType: string;
  organization: string;
  organizationAddress: string;
  tin: string;
  telex: string;
  invitation: string;
  passportNo: string;
  passportIssue: string;
  passportExpiry: string;
  hasPermanentAddress: boolean;
  personalAddress: string;
  phone: string;
  personalFax: string;
  email: string;
  routeCity: string;
  worksOrStudies: boolean;
  workStudyPlace: string;
  position: string;
  workAddress: string;
  workPhone: string;
  workFax: string;
  workEmail: string;
  passwordOverride: string;
  applicationId: string;
  preferredEmbassy: string;
  hadFormerRussianCitizenship: boolean;
  formerCitizenshipLostDate: string;
  formerCitizenshipLossReason: string;
  visitedRussia: boolean;
  visitsCount: string;
  lastVisitFrom: string;
  lastVisitTo: string;
  hasInsurance: boolean;
  insurancePolicy: string;
  childrenUnder16: boolean;
  relativesInRussia: boolean;
  specialNotes: string;
};

const embassies = [
  ["ПОСОЛЬСТВО РФ ВО ВЬЕТНАМЕ", "Đại sứ quán Liên bang Nga tại Hà Nội"],
  ["ГЕНКОНСУЛЬСТВО РФ В ДАНАНГЕ", "Tổng Lãnh sự quán Liên bang Nga tại Đà Nẵng"],
  ["ГЕНКОНСУЛЬСТВО РФ В ХОШИМИНЕ", "Tổng Lãnh sự quán Liên bang Nga tại TP. Hồ Chí Minh"],
];

function blank(): ApplicantForm {
  return {
    surname: "",
    givenNames: "",
    birthDate: "",
    birthPlace: "",
    sex: "МУЖСКОЙ",
    hasOtherNames: false,
    otherNames: "",
    bornInRussia: false,
    citizenship: "ВЬЕТНАМ",
    purposeSection: "",
    purpose: "",
    visaType: "",
    entries: "",
    entryDate: "",
    exitDate: "",
    destinationType: "",
    organization: "",
    organizationAddress: "",
    tin: "",
    telex: "",
    invitation: "",
    passportNo: "",
    passportIssue: "",
    passportExpiry: "",
    hasPermanentAddress: true,
    personalAddress: "",
    phone: "",
    personalFax: "",
    email: "",
    routeCity: "",
    worksOrStudies: true,
    workStudyPlace: "",
    position: "",
    workAddress: "",
    workPhone: "",
    workFax: "",
    workEmail: "",
    passwordOverride: "",
    applicationId: "",
    preferredEmbassy: "",
    hadFormerRussianCitizenship: false,
    formerCitizenshipLostDate: "",
    formerCitizenshipLossReason: "",
    visitedRussia: false,
    visitsCount: "",
    lastVisitFrom: "",
    lastVisitTo: "",
    hasInsurance: false,
    insurancePolicy: "",
    childrenUnder16: false,
    relativesInRussia: false,
    specialNotes: "",
  };
}

function upperPlain(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, (letter) => letter === "đ" ? "d" : "D")
    .toUpperCase();
}

const dayOptions = Array.from({ length: 31 }, (_, index) => String(index + 1).padStart(2, "0"));
const monthOptions = Array.from({ length: 12 }, (_, index) => String(index + 1).padStart(2, "0"));

function composeDmy(day: string, month: string, year: string) {
  return day || month || year ? `${day}/${month}/${year}` : "";
}

function normalizeTwoDigits(value: string, max: number) {
  if (!value) return "";
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1 || number > max) return value;
  return String(number).padStart(2, "0");
}

function passportExpiryFromIssue(value: string) {
  const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return "";
  return `${match[1]}/${match[2]}/${Number(match[3]) + 10}`;
}

function DateFields({
  value,
  onChange,
  required = false,
  readOnly = false,
}: {
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  readOnly?: boolean;
}) {
  const [day = "", month = "", year = ""] = value.split("/");
  const clean = (input: string, length: number) => input.replace(/\D/g, "").slice(0, length);
  const update = (nextDay: string, nextMonth: string, nextYear: string) => onChange(composeDmy(nextDay, nextMonth, nextYear));

  return <div className={styles.dateFields}>
    <input
      aria-label="Ngày"
      title="Ngày"
      placeholder="NGÀY"
      inputMode="numeric"
      maxLength={2}
      list="visa-day-options"
      required={required}
      readOnly={readOnly}
      value={day}
      onChange={(event) => update(clean(event.target.value, 2), month, year)}
      onBlur={() => update(normalizeTwoDigits(day, 31), month, year)}
    />
    <input
      aria-label="Tháng"
      title="Tháng"
      placeholder="THÁNG"
      inputMode="numeric"
      maxLength={2}
      list="visa-month-options"
      required={required}
      readOnly={readOnly}
      value={month}
      onChange={(event) => update(day, clean(event.target.value, 2), year)}
      onBlur={() => update(day, normalizeTwoDigits(month, 12), year)}
    />
    <input
      aria-label="Năm"
      title="Năm"
      placeholder="NĂM"
      inputMode="numeric"
      maxLength={4}
      required={required}
      readOnly={readOnly}
      value={year}
      onChange={(event) => update(day, month, clean(event.target.value, 4))}
    />
  </div>;
}

function Field({ label, ru, hint, children, fieldKey, correctionFields = [] }: { label: string; ru?: string; hint?: string; children: React.ReactNode; fieldKey?: string; correctionFields?: string[] }) {
  return <label className={styles.field} data-correction={fieldKey ? correctionFields.includes(fieldKey) : false}>
    <span>{label}</span>
    {ru ? <small className={styles.ru}>{ru}</small> : null}
    {children}
    {hint ? <small className={styles.hint}>{hint}</small> : null}
  </label>;
}

export default function VisaIntakePage() {
  const [token, setToken] = useState("");
  const [batch, setBatch] = useState("");
  const [accessKey, setAccessKey] = useState("");
  const [applicant, setApplicant] = useState<ApplicantForm>(blank());
  const [permanentAddress, setPermanentAddress] = useState("");
  const [linkLabel, setLinkLabel] = useState("");
  const [formType, setFormType] = useState<"student" | "general">("student");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [statusChecking, setStatusChecking] = useState(false);
  const [error, setError] = useState("");
  const [missing, setMissing] = useState<string[]>([]);
  const [confirmed, setConfirmed] = useState(false);
  const [receipt, setReceipt] = useState<{ id: string; queueNo: number | null; applicantName: string; status: string; reviewNote?: string | null; correctionFields?: string[]; resubmittedFields?: string[]; revision?: number; result?: { available: true; fileName: string; fileSize: number; uploadedAt: string; downloadUrl: string } | null } | null>(null);
  const correctionFields = receipt?.status === "rejected" ? (receipt.correctionFields ?? []) : [];

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tokenValue = params.get("token") ?? "";
    const batchValue = params.get("batch") ?? "";
    const key = batchValue ? `batch:${batchValue}` : tokenValue ? `token:${tokenValue}` : "";
    setToken(tokenValue); setBatch(batchValue); setAccessKey(key);
    let saved: { applicant?: ApplicantForm; receipt?: typeof receipt } | null = null;
    try {
      const raw = key ? window.localStorage.getItem(`visa-intake:draft:${key}`) : null;
      saved = raw ? JSON.parse(raw) as { applicant?: ApplicantForm; receipt?: typeof receipt } : null;
      if (saved?.applicant) setApplicant({ ...blank(), ...saved.applicant });
      if (saved?.receipt) setReceipt(saved.receipt);
    } catch {}
    if (!tokenValue && !batchValue) { setError("Link form chưa có mã thu hồ sơ."); setLoading(false); return; }
    const access = batchValue ? `batch=${encodeURIComponent(batchValue)}` : `token=${encodeURIComponent(tokenValue)}`;
    const receiptPart = saved?.receipt?.id ? `&submissionId=${encodeURIComponent(saved.receipt.id)}` : "";
    void fetch(`/api/kd-mid-visa-intake/public?${access}${receiptPart}`, { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json() as { ok?: boolean; error?: string; link?: { label?: string; formType?: string }; defaults?: Record<string, unknown>; submission?: typeof receipt };
        if (!response.ok || !data.ok) throw new Error(data.error || "Link không hợp lệ.");
        const defaults = data.defaults ?? {};
        const resolvedFormType = data.link?.formType === "general" || defaults.formType === "general" ? "general" : "student";
        setFormType(resolvedFormType);
        setLinkLabel(String(data.link?.label ?? ""));
        setPermanentAddress(upperPlain(String(defaults.permanentAddress ?? "")));
        setApplicant((current) => ({
          ...current,
          citizenship: current.citizenship || upperPlain(String(defaults.citizenship ?? "")) || "ВЬЕТНАМ",
          purposeSection: current.purposeSection || upperPlain(String(defaults.purposeSection ?? "")),
          purpose: current.purpose || upperPlain(String(defaults.purpose ?? "")),
          visaType: current.visaType || upperPlain(String(defaults.visaType ?? "")),
          entries: current.entries || upperPlain(String(defaults.entries ?? "")),
          entryDate: current.entryDate || String(defaults.entryDate ?? ""),
          exitDate: current.exitDate || String(defaults.exitDate ?? ""),
          destinationType: current.destinationType || upperPlain(String(defaults.destinationType ?? "")),
          organization: current.organization || upperPlain(String(defaults.organization ?? "")),
          organizationAddress: current.organizationAddress || upperPlain(String(defaults.organizationAddress ?? "")),
          tin: current.tin || String(defaults.tin ?? ""),
          telex: current.telex || String(defaults.telex ?? ""),
          invitation: current.invitation || String(defaults.invitation ?? ""),
          passwordOverride: current.passwordOverride || String(defaults.password ?? ""),
          personalAddress: current.personalAddress || upperPlain(String(defaults.permanentAddress ?? "")),
          routeCity: current.routeCity || upperPlain(String(defaults.routeCity ?? "")),
          workStudyPlace: current.workStudyPlace || upperPlain(String(defaults.employer ?? "")),
          position: current.position || upperPlain(String(defaults.position ?? "")),
          workAddress: current.workAddress || upperPlain(String(defaults.workAddress ?? "")),
          workPhone: current.workPhone || String(defaults.workPhone ?? ""),
          workEmail: current.workEmail || String(defaults.workEmail ?? "").toLowerCase(),
          preferredEmbassy: current.preferredEmbassy || String(defaults.preferredEmbassy ?? ""),
        }));
        if (data.submission) setReceipt((current) => current ? { ...current, ...data.submission } : data.submission ?? null);
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : "Không thể mở form."))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => {
    if (!accessKey) return;
    try { window.localStorage.setItem(`visa-intake:draft:${accessKey}`, JSON.stringify({ applicant, receipt })); } catch {}
  }, [accessKey, applicant, receipt]);

  async function refreshSubmissionStatus(manual = false) {
    if ((!token && !batch) || !receipt?.id) return;
    if (manual) setStatusChecking(true);
    try {
      const access = batch ? `batch=${encodeURIComponent(batch)}` : `token=${encodeURIComponent(token)}`;
      const response = await fetch(`/api/kd-mid-visa-intake/public?${access}&submissionId=${encodeURIComponent(receipt.id)}`, { cache: "no-store" });
      const data = await response.json() as { ok?: boolean; error?: string; submission?: typeof receipt };
      if (!response.ok || !data.ok || !data.submission) {
        if (manual) setError(data.error || "Không cập nhật được trạng thái hồ sơ.");
        return;
      }
      setReceipt((current) => current ? { ...current, ...data.submission } : data.submission ?? null);
      document.title = data.submission.status === "rejected" ? "⚠ HỒ SƠ CẦN SỬA · Visa Nga" : data.submission.result?.available ? "📄 ĐÃ CÓ KẾT QUẢ · Visa Nga" : ["approved", "imported"].includes(data.submission.status) ? "✓ ĐÃ TIẾP NHẬN HỒ SƠ · Visa Nga" : "Form hồ sơ Visa Nga";
    } catch {
      if (manual) setError("Không cập nhật được trạng thái hồ sơ. Vui lòng thử lại.");
    } finally {
      if (manual) setStatusChecking(false);
    }
  }

  useEffect(() => {
    if ((!token && !batch) || !receipt?.id) return;
    void refreshSubmissionStatus(false);
    const timer = window.setInterval(() => void refreshSubmissionStatus(false), 15000);
    return () => window.clearInterval(timer);
  }, [token, batch, receipt?.id]);

  const baseFields = useMemo(() => {
    const fields = [
      applicant.citizenship, applicant.purposeSection, applicant.purpose, applicant.visaType, applicant.entries, applicant.entryDate, applicant.exitDate,
      applicant.destinationType, applicant.routeCity, applicant.surname, applicant.givenNames, applicant.birthDate, applicant.birthPlace,
      applicant.passportNo, applicant.passportIssue, applicant.passportExpiry, applicant.phone, applicant.email, applicant.preferredEmbassy,
    ];
    if (formType === "student") fields.push(applicant.organization, applicant.organizationAddress, applicant.tin, applicant.telex);
    return fields;
  }, [applicant, formType]);

  const completion = Math.round((baseFields.filter((value) => value.trim()).length / baseFields.length) * 100);

  function set<K extends keyof ApplicantForm>(key: K, value: ApplicantForm[K]) {
    setApplicant((current) => ({ ...current, [key]: value }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSending(true);
    setError("");
    setMissing([]);
    try {
      const response = await fetch("/api/kd-mid-visa-intake/public", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, batch, applicant, confirmedAccurate: confirmed, submissionId: receipt?.status === "rejected" ? receipt.id : undefined }),
      });
      const data = await response.json() as {
        ok?: boolean;
        error?: string;
        missing?: string[];
        submission?: { id: string; queueNo: number | null; applicantName: string; status?: string; correctionFields?: string[]; resubmittedFields?: string[]; revision?: number; result?: { available: true; fileName: string; fileSize: number; uploadedAt: string; downloadUrl: string } | null };
      };
      if (!response.ok || !data.ok || !data.submission) {
        setMissing(Array.isArray(data.missing) ? data.missing : []);
        throw new Error(data.error || "Chưa thể gửi hồ sơ.");
      }
      setReceipt({ ...data.submission, status: data.submission.status ?? "pending", correctionFields: data.submission.correctionFields ?? [] });
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể gửi hồ sơ.");
    } finally {
      setSending(false);
    }
  }

  if (loading) return <main className={styles.page}><section className={styles.card}><h1>Đang mở form hồ sơ Visa Nga…</h1></section></main>;

  if (receipt && receipt.status !== "rejected") {
    const accepted = ["approved", "imported"].includes(receipt.status);
    return <main className={styles.page}><section className={styles.successCard}>
      <span>{accepted ? "ĐÃ TIẾP NHẬN HỒ SƠ" : "ĐÃ GỬI HỒ SƠ"}</span>
      <h1>{receipt.applicantName}</h1>
      <p>{accepted ? "Hồ sơ của bạn đã được người phụ trách xác minh và tiếp nhận." : "Hồ sơ đã được chuyển vào hàng chờ xác minh. Người phụ trách sẽ kiểm tra trước khi tiếp nhận."}</p>
      <div className={styles.receipt}><small>Số thứ tự tiếp nhận</small><strong>#{receipt.queueNo ?? "—"}</strong></div>
      <div className={styles.resultBox}>
        <strong>Nhận kết quả</strong>
        {receipt.result?.available ? <><p>Đã có PDF kết quả: <b>{receipt.result.fileName}</b></p><a href={receipt.result.downloadUrl}>Tải PDF kết quả</a></> : <p>{accepted ? "Hồ sơ đã được tiếp nhận. PDF kết quả sẽ xuất hiện tại đây khi người phụ trách gửi." : "Sau khi hồ sơ được tiếp nhận, kết quả PDF sẽ được gửi tại đây."}</p>}
      </div>
      <p className={styles.muted}>{accepted ? "Bạn có thể giữ link này để cập nhật trạng thái và nhận kết quả." : (receipt.revision ?? 0) > 0 ? "Bạn đã gửi lại nội dung đã sửa. Hãy chờ người phụ trách xác minh." : "Bạn không cần gửi lại nếu chưa được yêu cầu chỉnh sửa."}</p>
      <button className={styles.statusRefresh} type="button" disabled={statusChecking} onClick={() => void refreshSubmissionStatus(true)}>{statusChecking ? "↻ Đang cập nhật…" : "↻ Cập nhật trạng thái"}</button>
    </section></main>;
  }
  return <main className={styles.page}>
    <header className={styles.hero}>
      <div><span>{formType === "student" ? "LINK 1 · MẪU NHẬP HỌC" : "LINK 2 · MẪU VISA NGƯỜI THƯỜNG"}</span><h1>{formType === "student" ? "Điền hồ sơ nhập học để chuẩn bị KD-MID" : "Điền hồ sơ visa cá nhân để chuẩn bị KD-MID"}</h1><p>{formType === "student" ? "Các dữ liệu học tập dùng chung đã được nạp sẵn. Hãy kiểm tra Mã Telex và thông tin cá nhân trước khi gửi." : "Mẫu tổng quát không tự áp các giá trị visa học tập. Hãy nhập đúng thông tin theo mục đích chuyến đi của bạn."}</p></div>
      <div className={styles.progress}><small>Mức hoàn thành cơ bản</small><strong>{completion}%</strong><div><i style={{ width: `${completion}%` }} /></div></div>
    </header>

    <form className={styles.form} onSubmit={submit}>
      {receipt?.status === "rejected" ? <div className={styles.returnAlert}><strong>⚠ HỒ SƠ BỊ TRẢ VỀ · CẦN SỬA</strong><p>{receipt.reviewNote || "Hãy sửa các ô được đánh dấu đỏ rồi gửi lại."}</p><small>Giữ nguyên số tiếp nhận #{receipt.queueNo ?? "—"} · {correctionFields.length} ô cần sửa.</small><button className={styles.statusRefresh} type="button" disabled={statusChecking} onClick={() => void refreshSubmissionStatus(true)}>{statusChecking ? "↻ Đang cập nhật…" : "↻ Cập nhật trạng thái"}</button></div> : null}
      <datalist id="visa-day-options">{dayOptions.map((value) => <option key={value} value={value} />)}</datalist>
      <datalist id="visa-month-options">{monthOptions.map((value) => <option key={value} value={value} />)}</datalist>
      {linkLabel ? <div className={styles.batch}>Đợt thu hồ sơ: <strong>{linkLabel}</strong> · <b>{formType === "student" ? "MẪU NHẬP HỌC" : "NGƯỜI THƯỜNG"}</b></div> : null}
      {error ? <div className={styles.error}><strong>{error}</strong>{missing.length ? <ul>{missing.map((item) => <li key={item}>{item}</li>)}</ul> : null}</div> : null}

      <section className={styles.section}>
        <header><b>01</b><div><h2>Thông tin visa & thư mời</h2><p>{formType === "student" ? "Dữ liệu nhập học dùng chung đã được điền sẵn; kiểm tra Mã Telex trước khi gửi." : "Mẫu người thường chỉ điền sẵn dữ liệu an toàn. Mục đích, loại visa, lịch trình và thông tin thư mời phải nhập theo hồ sơ thực tế."}</p></div></header>
        <div className={styles.grid}>
          <Field fieldKey="citizenship" correctionFields={correctionFields} label="Quốc tịch" ru="Гражданство"><input required value={applicant.citizenship} onChange={(e) => set("citizenship", upperPlain(e.target.value))} /></Field>
          <Field fieldKey="purposeSection" correctionFields={correctionFields} label="Nhóm mục đích" ru="Цель поездки (раздел)"><input required value={applicant.purposeSection} onChange={(e) => set("purposeSection", upperPlain(e.target.value))} /></Field>
          <Field fieldKey="purpose" correctionFields={correctionFields} label="Mục đích chuyến đi" ru="Цель поездки"><input required value={applicant.purpose} onChange={(e) => set("purpose", upperPlain(e.target.value))} /></Field>
          <Field fieldKey="visaType" correctionFields={correctionFields} label="Loại visa" ru="Категория и вид визы"><input required value={applicant.visaType} onChange={(e) => set("visaType", upperPlain(e.target.value))} /></Field>
          <Field fieldKey="entries" correctionFields={correctionFields} label="Số lần nhập cảnh" ru="Кратность визы"><input required value={applicant.entries} onChange={(e) => set("entries", upperPlain(e.target.value))} /></Field>
          <Field fieldKey="entryDate" correctionFields={correctionFields} label="Ngày vào Nga" ru="Дата въезда в Россию"><DateFields required value={applicant.entryDate} onChange={(value) => set("entryDate", value)} /></Field>
          <Field fieldKey="exitDate" correctionFields={correctionFields} label="Ngày ra Nga" ru="Дата выезда из России"><DateFields required value={applicant.exitDate} onChange={(value) => set("exitDate", value)} /></Field>
          <Field fieldKey="destinationType" correctionFields={correctionFields} label="Loại nơi đến" ru="В какое учреждение направляетесь?"><input required value={applicant.destinationType} onChange={(e) => set("destinationType", upperPlain(e.target.value))} /></Field>
          <Field fieldKey="organization" correctionFields={correctionFields} label="Tên tổ chức tiếp nhận" ru="Наименование организации"><input required={formType === "student"} value={applicant.organization} onChange={(e) => set("organization", upperPlain(e.target.value))} /></Field>
          <Field fieldKey="organizationAddress" correctionFields={correctionFields} label="Địa chỉ tổ chức" ru="Адрес"><input required={formType === "student"} value={applicant.organizationAddress} onChange={(e) => set("organizationAddress", upperPlain(e.target.value))} /></Field>
          <Field fieldKey="tin" correctionFields={correctionFields} label="INN tổ chức" ru="ИНН организации"><input required={formType === "student"} value={applicant.tin} onChange={(e) => set("tin", e.target.value.replace(/\D/g, ""))} /></Field>
          <Field fieldKey="telex" correctionFields={correctionFields} label={formType === "student" ? "Mã Telex" : "Mã Telex / Số chỉ thị"} ru="Номер указания (телекса)" hint={formType === "student" ? "Bắt buộc đối với mẫu nhập học." : "Nếu hồ sơ không dùng Telex thì có thể để trống."}><input required={formType === "student"} value={applicant.telex} onChange={(e) => set("telex", e.target.value)} /></Field>
          <Field fieldKey="invitation" correctionFields={correctionFields} label="Số giấy mời" ru="Номер приглашения" hint="Không có thì để trống."><input value={applicant.invitation} onChange={(e) => set("invitation", e.target.value)} /></Field>
        </div>
      </section>

      <section className={styles.section}>
        <header><b>02</b><div><h2>Thông tin cá nhân</h2><p>Nhập đúng như hộ chiếu. Họ và tên dùng chữ Latin không dấu.</p></div></header>
        <div className={styles.grid}>
          <Field fieldKey="surname" correctionFields={correctionFields} label="Họ" ru="Фамилия" hint="Ví dụ: NGUYEN"><input required value={applicant.surname} onChange={(e) => set("surname", upperPlain(e.target.value))} /></Field>
          <Field fieldKey="givenNames" correctionFields={correctionFields} label="Tên và tên đệm" ru="Имя, другие имена, отчество" hint="Ví dụ: DINH NAM"><input required value={applicant.givenNames} onChange={(e) => set("givenNames", upperPlain(e.target.value))} /></Field>
          <Field fieldKey="birthDate" correctionFields={correctionFields} label="Ngày sinh" ru="Дата рождения" hint="Ngày và tháng có thể gõ hoặc chọn; năm nhập 4 chữ số."><DateFields required value={applicant.birthDate} onChange={(value) => set("birthDate", value)} /></Field>
          <Field fieldKey="birthPlace" correctionFields={correctionFields} label="Nơi sinh" ru="Место рождения"><input required value={applicant.birthPlace} onChange={(e) => set("birthPlace", upperPlain(e.target.value))} /></Field>
          <Field fieldKey="sex" correctionFields={correctionFields} label="Giới tính" ru="Пол"><select value={applicant.sex} onChange={(e) => set("sex", e.target.value)}><option value="МУЖСКОЙ">Nam</option><option value="ЖЕНСКИЙ">Nữ</option></select></Field>
          <Field fieldKey="hasOtherNames" correctionFields={correctionFields} label="Đã từng dùng tên khác?" ru="Есть ли у Вас другие когда-либо использовавшиеся имена"><select value={applicant.hasOtherNames ? "ДА" : "НЕТ"} onChange={(e) => set("hasOtherNames", e.target.value === "ДА")}><option value="НЕТ">Không</option><option value="ДА">Có</option></select></Field>
          {applicant.hasOtherNames ? <Field fieldKey="otherNames" correctionFields={correctionFields} label="Tên khác đã từng dùng"><input required value={applicant.otherNames} onChange={(e) => set("otherNames", upperPlain(e.target.value))} /></Field> : null}
          <Field fieldKey="bornInRussia" correctionFields={correctionFields} label="Sinh tại Nga?" ru="Вы родились в России?"><select value={applicant.bornInRussia ? "ДА" : "НЕТ"} onChange={(e) => set("bornInRussia", e.target.value === "ДА")}><option value="НЕТ">Không</option><option value="ДА">Có</option></select></Field>
          <Field fieldKey="routeCity" correctionFields={correctionFields} label="Nơi đến tại Nga" ru="Маршрут (населенные пункты)" hint="Thông thường là МОСКВА"><input required value={applicant.routeCity} onChange={(e) => set("routeCity", upperPlain(e.target.value))} /></Field>
        </div>
      </section>

      <section className={styles.section}>
        <header><b>03</b><div><h2>Hộ chiếu</h2><p>Mỗi ngày dùng 3 ô Ngày · Tháng · Năm để tránh nhập sai. Ngày cấp không được ở tương lai; ngày hết hạn phải sau ngày cấp và hộ chiếu phải còn hạn.</p></div></header>
        <div className={styles.grid}>
          <Field fieldKey="passportNo" correctionFields={correctionFields} label="Số hộ chiếu" ru="Номер паспорта"><input required value={applicant.passportNo} onChange={(e) => set("passportNo", upperPlain(e.target.value))} /></Field>
          <Field fieldKey="passportIssue" correctionFields={correctionFields} label="Ngày cấp hộ chiếu" ru="Дата выдачи"><DateFields required value={applicant.passportIssue} onChange={(value) => setApplicant((current) => ({ ...current, passportIssue: value, passportExpiry: passportExpiryFromIssue(value) }))} /></Field>
          <Field fieldKey="passportExpiry" correctionFields={correctionFields} label="Ngày hết hạn hộ chiếu" ru="Действителен до" hint="Tự động: cùng ngày/tháng của ngày cấp, năm +10."><DateFields required readOnly value={applicant.passportExpiry} onChange={() => undefined} /></Field>
        </div>
      </section>

      <section className={styles.section}>
        <header><b>04</b><div><h2>Liên hệ & địa chỉ</h2><p>Địa chỉ thường trú được nạp mặc định theo đợt; Fax không có thì để trống.</p></div></header>
        <div className={styles.grid}>
          <Field fieldKey="hasPermanentAddress" correctionFields={correctionFields} label="Có địa chỉ thường trú?" ru="Имеете ли Вы адрес постоянного проживания?"><select value={applicant.hasPermanentAddress ? "ДА" : "НЕТ"} onChange={(e) => set("hasPermanentAddress", e.target.value === "ДА")}><option value="ДА">Có</option><option value="НЕТ">Không</option></select></Field>
          {applicant.hasPermanentAddress ? <Field fieldKey="personalAddress" correctionFields={correctionFields} label="Địa chỉ thường trú" ru="Адрес вашего постоянного проживания"><input required value={applicant.personalAddress || permanentAddress} onChange={(e) => set("personalAddress", upperPlain(e.target.value))} /></Field> : null}
          <Field fieldKey="phone" correctionFields={correctionFields} label="Điện thoại cá nhân" ru="Ваш личный телефон"><input required value={applicant.phone} onChange={(e) => set("phone", e.target.value)} /></Field>
          <Field fieldKey="personalFax" correctionFields={correctionFields} label="Fax cá nhân" ru="Ваш личный факс" hint="Không có thì để trống."><input value={applicant.personalFax} onChange={(e) => set("personalFax", e.target.value)} /></Field>
          <Field fieldKey="email" correctionFields={correctionFields} label="Email cá nhân" ru="Ваш личный E-mail"><input type="email" required value={applicant.email} onChange={(e) => set("email", e.target.value.toLowerCase())} /></Field>
        </div>
      </section>

      <section className={styles.section}>
        <header><b>05</b><div><h2>Nơi làm việc / học tập</h2><p>Các ô đã có giá trị mặc định của đơn vị. Chỉ sửa nếu thông tin của bạn khác.</p></div></header>
        <div className={styles.grid}>
          <Field fieldKey="worksOrStudies" correctionFields={correctionFields} label="Đang làm việc / học tập?" ru="Вы работаете (работали ранее), учитесь (учились ранее)?"><select value={applicant.worksOrStudies ? "ДА" : "НЕТ"} onChange={(e) => set("worksOrStudies", e.target.value === "ДА")}><option value="ДА">Có</option><option value="НЕТ">Không</option></select></Field>
          {applicant.worksOrStudies ? <>
          <Field fieldKey="workStudyPlace" correctionFields={correctionFields} label="Nơi làm việc / học tập" ru="Место работы (учебы)"><input required value={applicant.workStudyPlace} onChange={(e) => set("workStudyPlace", upperPlain(e.target.value))} /></Field>
          <Field fieldKey="position" correctionFields={correctionFields} label="Chức vụ / tư cách" ru="Должность"><input required value={applicant.position} onChange={(e) => set("position", upperPlain(e.target.value))} /></Field>
          <Field fieldKey="workAddress" correctionFields={correctionFields} label="Địa chỉ cơ quan" ru="Рабочий адрес"><input required value={applicant.workAddress} onChange={(e) => set("workAddress", upperPlain(e.target.value))} /></Field>
          <Field fieldKey="workPhone" correctionFields={correctionFields} label="Điện thoại cơ quan" ru="Рабочий телефон"><input required value={applicant.workPhone} onChange={(e) => set("workPhone", e.target.value)} /></Field>
          <Field fieldKey="workFax" correctionFields={correctionFields} label="Fax cơ quan" ru="Рабочий факс" hint="Không có thì để trống."><input value={applicant.workFax} onChange={(e) => set("workFax", e.target.value)} /></Field>
          <Field fieldKey="workEmail" correctionFields={correctionFields} label="Email cơ quan" ru="Рабочий E-mail"><input type="email" required value={applicant.workEmail} onChange={(e) => set("workEmail", e.target.value.toLowerCase())} /></Field>
          </> : null}
        </div>
      </section>

      <section className={styles.section}>
        <header><b>06</b><div><h2>Lịch sử liên quan đến Nga</h2><p>Chọn Có chỉ khi đúng với trường hợp của bạn; các trường chi tiết sẽ tự xuất hiện.</p></div></header>
        <div className={styles.checks}>
          <label data-correction={correctionFields.includes("hadFormerRussianCitizenship")}><input type="checkbox" checked={applicant.hadFormerRussianCitizenship} onChange={(e) => set("hadFormerRussianCitizenship", e.target.checked)} /><span><strong>Đã từng có quốc tịch Liên Xô hoặc Nga</strong><small>Если Вы имели гражданство СССР или России</small></span></label>
          <label data-correction={correctionFields.includes("visitedRussia")}><input type="checkbox" checked={applicant.visitedRussia} onChange={(e) => set("visitedRussia", e.target.checked)} /><span><strong>Đã từng đến Nga</strong><small>Были ли Вы когда-нибудь в России?</small></span></label>
          <label data-correction={correctionFields.includes("hasInsurance")}><input type="checkbox" checked={applicant.hasInsurance} onChange={(e) => set("hasInsurance", e.target.checked)} /><span><strong>Có bảo hiểm có hiệu lực tại Nga</strong><small>Документ о медицинском страховании</small></span></label>
        </div>
        {applicant.hadFormerRussianCitizenship ? <div className={styles.grid}>
          <Field fieldKey="formerCitizenshipLostDate" correctionFields={correctionFields} label="Ngày mất quốc tịch"><DateFields required value={applicant.formerCitizenshipLostDate} onChange={(value) => set("formerCitizenshipLostDate", value)} /></Field>
          <Field fieldKey="formerCitizenshipLossReason" correctionFields={correctionFields} label="Lý do mất quốc tịch"><input required value={applicant.formerCitizenshipLossReason} onChange={(e) => set("formerCitizenshipLossReason", upperPlain(e.target.value))} /></Field>
        </div> : null}
        {applicant.visitedRussia ? <div className={styles.grid}>
          <Field fieldKey="visitsCount" correctionFields={correctionFields} label="Số lần đã đến Nga"><input required inputMode="numeric" value={applicant.visitsCount} onChange={(e) => set("visitsCount", e.target.value)} /></Field>
          <Field fieldKey="lastVisitFrom" correctionFields={correctionFields} label="Chuyến gần nhất - từ ngày"><DateFields required value={applicant.lastVisitFrom} onChange={(value) => set("lastVisitFrom", value)} /></Field>
          <Field fieldKey="lastVisitTo" correctionFields={correctionFields} label="Chuyến gần nhất - đến ngày"><DateFields required value={applicant.lastVisitTo} onChange={(value) => set("lastVisitTo", value)} /></Field>
        </div> : null}
        {applicant.hasInsurance ? <div className={styles.grid}><Field fieldKey="insurancePolicy" correctionFields={correctionFields} label="Tên công ty bảo hiểm / số hợp đồng"><input required value={applicant.insurancePolicy} onChange={(e) => set("insurancePolicy", upperPlain(e.target.value))} /></Field></div> : null}
      </section>

      <section className={styles.section}>
        <header><b>07</b><div><h2>Gia đình & nơi nộp hồ sơ</h2><p>Nếu không đánh dấu hai mục đầu thì hệ thống hiểu là Không.</p></div></header>
        <div className={styles.checks}>
          <label data-correction={correctionFields.includes("childrenUnder16")}><input type="checkbox" checked={applicant.childrenUnder16} onChange={(e) => set("childrenUnder16", e.target.checked)} /><span><strong>Có trẻ em dưới 16 tuổi đi cùng / ghi trong hộ chiếu</strong><small>Дети до 16 лет...</small></span></label>
          <label data-correction={correctionFields.includes("relativesInRussia")}><input type="checkbox" checked={applicant.relativesInRussia} onChange={(e) => set("relativesInRussia", e.target.checked)} /><span><strong>Có người thân hiện đang ở Nga</strong><small>Родственники на территории России</small></span></label>
        </div>
        <div className={styles.grid}>
          <Field fieldKey="preferredEmbassy" correctionFields={correctionFields} label="Nơi dự kiến nộp hồ sơ" ru="Место подачи заявления"><select required value={applicant.preferredEmbassy} onChange={(e) => set("preferredEmbassy", e.target.value)}><option value="">-- Chọn nơi nộp hồ sơ --</option>{embassies.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
          <Field fieldKey="specialNotes" correctionFields={correctionFields} label="Ghi chú đặc biệt" hint="Nếu Có ở các mục trẻ em/người thân, hãy ghi rõ thông tin cần người phụ trách biết."><textarea rows={4} value={applicant.specialNotes} onChange={(e) => set("specialNotes", upperPlain(e.target.value))} /></Field>
        </div>
      </section>

      <section className={styles.section}>
        <header><b>08</b><div><h2>Thông tin KD-MID</h2><p>Mật khẩu được nạp mặc định theo đợt. Application ID chưa có thì để trống; hệ thống sẽ ghi lại sau khi tạo hồ sơ.</p></div></header>
        <div className={styles.grid}>
          <Field fieldKey="passwordOverride" correctionFields={correctionFields} label="Mật khẩu KD-MID"><input value={applicant.passwordOverride} onChange={(e) => set("passwordOverride", e.target.value)} /></Field>
          <Field fieldKey="applicationId" correctionFields={correctionFields} label="Application ID" hint="Chưa có thì để trống."><input inputMode="numeric" value={applicant.applicationId} onChange={(e) => set("applicationId", e.target.value.replace(/\D/g, ""))} /></Field>
        </div>
      </section>

      <section className={styles.confirm}>
        <label><input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} /><span><strong>Tôi xác nhận các thông tin trên là đúng theo giấy tờ của mình.</strong><small>Hồ sơ sẽ được gửi tới người phụ trách để xác minh trước khi dùng điền visa.kdmid.ru.</small></span></label>
        <button disabled={sending || !confirmed} type="submit">{sending ? "Đang gửi…" : "Hoàn thành & gửi hồ sơ"}</button>
      </section>
    </form>
  </main>;
}
