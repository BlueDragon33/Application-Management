"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import styles from "./visa-intake.module.css";

type ApplicantForm = {
  surname: string;
  givenNames: string;
  birthDate: string;
  birthPlace: string;
  sex: string;
  passportNo: string;
  passportIssue: string;
  passportExpiry: string;
  phone: string;
  email: string;
  routeCity: string;
  workStudyPlace: string;
  position: string;
  workAddress: string;
  workPhone: string;
  workEmail: string;
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
    passportNo: "",
    passportIssue: "",
    passportExpiry: "",
    phone: "",
    email: "",
    routeCity: "МОСКВА",
    workStudyPlace: "",
    position: "",
    workAddress: "",
    workPhone: "",
    workEmail: "",
    preferredEmbassy: "ПОСОЛЬСТВО РФ ВО ВЬЕТНАМЕ",
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

function DateFields({
  value,
  onChange,
  required = false,
}: {
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
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
      value={year}
      onChange={(event) => update(day, month, clean(event.target.value, 4))}
    />
  </div>;
}

function Field({ label, ru, hint, children }: { label: string; ru?: string; hint?: string; children: React.ReactNode }) {
  return <label className={styles.field}>
    <span>{label}</span>
    {ru ? <small className={styles.ru}>{ru}</small> : null}
    {children}
    {hint ? <small className={styles.hint}>{hint}</small> : null}
  </label>;
}

export default function VisaIntakePage() {
  const [token, setToken] = useState("");
  const [applicant, setApplicant] = useState<ApplicantForm>(blank());
  const [permanentAddress, setPermanentAddress] = useState("");
  const [linkLabel, setLinkLabel] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [missing, setMissing] = useState<string[]>([]);
  const [confirmed, setConfirmed] = useState(false);
  const [receipt, setReceipt] = useState<{ queueNo: number | null; applicantName: string } | null>(null);

  useEffect(() => {
    const value = new URLSearchParams(window.location.search).get("token") ?? "";
    setToken(value);
    if (!value) {
      setError("Link form chưa có mã thu hồ sơ.");
      setLoading(false);
      return;
    }
    void fetch(`/api/kd-mid-visa-intake/public?token=${encodeURIComponent(value)}`, { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json() as {
          ok?: boolean;
          error?: string;
          link?: { label?: string };
          defaults?: Record<string, unknown>;
        };
        if (!response.ok || !data.ok) throw new Error(data.error || "Link không hợp lệ.");
        const defaults = data.defaults ?? {};
        setLinkLabel(String(data.link?.label ?? ""));
        setPermanentAddress(upperPlain(String(defaults.permanentAddress ?? "")));
        setApplicant((current) => ({
          ...current,
          routeCity: upperPlain(String(defaults.routeCity ?? current.routeCity)) || "МОСКВА",
          workStudyPlace: upperPlain(String(defaults.employer ?? "")),
          position: upperPlain(String(defaults.position ?? "")),
          workAddress: upperPlain(String(defaults.workAddress ?? "")),
          workPhone: String(defaults.workPhone ?? ""),
          workEmail: String(defaults.workEmail ?? "").toLowerCase(),
          preferredEmbassy: String(defaults.preferredEmbassy ?? current.preferredEmbassy),
        }));
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : "Không thể mở form."))
      .finally(() => setLoading(false));
  }, []);

  const baseFields = useMemo(() => [
    applicant.surname, applicant.givenNames, applicant.birthDate, applicant.birthPlace,
    applicant.passportNo, applicant.passportIssue, applicant.passportExpiry,
    applicant.phone, applicant.email, applicant.workStudyPlace, applicant.position,
    applicant.workAddress, applicant.workPhone, applicant.workEmail,
  ], [applicant]);

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
        body: JSON.stringify({ token, applicant, confirmedAccurate: confirmed }),
      });
      const data = await response.json() as {
        ok?: boolean;
        error?: string;
        missing?: string[];
        submission?: { queueNo: number | null; applicantName: string };
      };
      if (!response.ok || !data.ok || !data.submission) {
        setMissing(Array.isArray(data.missing) ? data.missing : []);
        throw new Error(data.error || "Chưa thể gửi hồ sơ.");
      }
      setReceipt(data.submission);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể gửi hồ sơ.");
    } finally {
      setSending(false);
    }
  }

  if (loading) return <main className={styles.page}><section className={styles.card}><h1>Đang mở form hồ sơ Visa Nga…</h1></section></main>;

  if (receipt) {
    return <main className={styles.page}><section className={styles.successCard}>
      <span>ĐÃ GỬI HỒ SƠ</span>
      <h1>{receipt.applicantName}</h1>
      <p>Hồ sơ đã được chuyển vào hàng chờ xác minh. Người phụ trách sẽ kiểm tra trước khi lưu vào danh sách làm hồ sơ Visa.</p>
      <div className={styles.receipt}><small>Số thứ tự tiếp nhận</small><strong>#{receipt.queueNo ?? "—"}</strong></div>
      <p className={styles.muted}>Bạn không cần gửi lại nếu chưa được yêu cầu chỉnh sửa.</p>
    </section></main>;
  }

  return <main className={styles.page}>
    <header className={styles.hero}>
      <div><span>FORM THU THẬP HỒ SƠ VISA NGA</span><h1>Điền thông tin cá nhân để chuẩn bị hồ sơ KD-MID</h1><p>Hướng dẫn hoàn toàn bằng tiếng Việt. Hãy nhập đúng theo hộ chiếu và kiểm tra kỹ trước khi gửi.</p></div>
      <div className={styles.progress}><small>Mức hoàn thành cơ bản</small><strong>{completion}%</strong><div><i style={{ width: `${completion}%` }} /></div></div>
    </header>

    <form className={styles.form} onSubmit={submit}>
      <datalist id="visa-day-options">{dayOptions.map((value) => <option key={value} value={value} />)}</datalist>
      <datalist id="visa-month-options">{monthOptions.map((value) => <option key={value} value={value} />)}</datalist>
      {linkLabel ? <div className={styles.batch}>Đợt thu hồ sơ: <strong>{linkLabel}</strong></div> : null}
      {error ? <div className={styles.error}><strong>{error}</strong>{missing.length ? <ul>{missing.map((item) => <li key={item}>{item}</li>)}</ul> : null}</div> : null}

      <section className={styles.section}>
        <header><b>01</b><div><h2>Thông tin cá nhân</h2><p>Nhập đúng như hộ chiếu. Họ và tên dùng chữ Latin không dấu.</p></div></header>
        <div className={styles.grid}>
          <Field label="Họ" ru="Фамилия" hint="Ví dụ: NGUYEN"><input required value={applicant.surname} onChange={(e) => set("surname", upperPlain(e.target.value))} /></Field>
          <Field label="Tên và tên đệm" ru="Имя, другие имена, отчество" hint="Ví dụ: DINH NAM"><input required value={applicant.givenNames} onChange={(e) => set("givenNames", upperPlain(e.target.value))} /></Field>
          <Field label="Ngày sinh" ru="Дата рождения" hint="Ngày và tháng có thể gõ hoặc chọn; năm nhập 4 chữ số."><DateFields required value={applicant.birthDate} onChange={(value) => set("birthDate", value)} /></Field>
          <Field label="Nơi sinh" ru="Место рождения"><input required value={applicant.birthPlace} onChange={(e) => set("birthPlace", upperPlain(e.target.value))} /></Field>
          <Field label="Giới tính" ru="Пол"><select value={applicant.sex} onChange={(e) => set("sex", e.target.value)}><option value="МУЖСКОЙ">Nam</option><option value="ЖЕНСКИЙ">Nữ</option></select></Field>
          <Field label="Nơi đến tại Nga" ru="Маршрут (населенные пункты)" hint="Thông thường là МОСКВА"><input required value={applicant.routeCity} onChange={(e) => set("routeCity", upperPlain(e.target.value))} /></Field>
        </div>
      </section>

      <section className={styles.section}>
        <header><b>02</b><div><h2>Hộ chiếu</h2><p>Mỗi ngày dùng 3 ô Ngày · Tháng · Năm để tránh nhập sai. Ngày cấp không được ở tương lai; ngày hết hạn phải sau ngày cấp và hộ chiếu phải còn hạn.</p></div></header>
        <div className={styles.grid}>
          <Field label="Số hộ chiếu" ru="Номер паспорта"><input required value={applicant.passportNo} onChange={(e) => set("passportNo", upperPlain(e.target.value))} /></Field>
          <Field label="Ngày cấp hộ chiếu" ru="Дата выдачи"><DateFields required value={applicant.passportIssue} onChange={(value) => set("passportIssue", value)} /></Field>
          <Field label="Ngày hết hạn hộ chiếu" ru="Действителен до"><DateFields required value={applicant.passportExpiry} onChange={(value) => set("passportExpiry", value)} /></Field>
        </div>
      </section>

      <section className={styles.section}>
        <header><b>03</b><div><h2>Liên hệ & địa chỉ</h2><p>Fax không cần nhập. Địa chỉ thường trú bên dưới là địa chỉ dùng chung của đợt hồ sơ này.</p></div></header>
        <div className={styles.grid}>
          <Field label="Địa chỉ thường trú dùng cho hồ sơ" ru="Адрес вашего постоянного проживания"><input readOnly value={permanentAddress} /></Field>
          <Field label="Điện thoại cá nhân" ru="Ваш личный телефон"><input required value={applicant.phone} onChange={(e) => set("phone", e.target.value)} /></Field>
          <Field label="Email cá nhân" ru="Ваш личный E-mail"><input type="email" required value={applicant.email} onChange={(e) => set("email", e.target.value.toLowerCase())} /></Field>
        </div>
      </section>

      <section className={styles.section}>
        <header><b>04</b><div><h2>Nơi làm việc / học tập</h2><p>Các ô đã có giá trị mặc định của đơn vị. Chỉ sửa nếu thông tin của bạn khác.</p></div></header>
        <div className={styles.grid}>
          <Field label="Nơi làm việc / học tập" ru="Место работы (учебы)"><input required value={applicant.workStudyPlace} onChange={(e) => set("workStudyPlace", upperPlain(e.target.value))} /></Field>
          <Field label="Chức vụ / tư cách" ru="Должность"><input required value={applicant.position} onChange={(e) => set("position", upperPlain(e.target.value))} /></Field>
          <Field label="Địa chỉ cơ quan" ru="Рабочий адрес"><input required value={applicant.workAddress} onChange={(e) => set("workAddress", upperPlain(e.target.value))} /></Field>
          <Field label="Điện thoại cơ quan" ru="Рабочий телефон"><input required value={applicant.workPhone} onChange={(e) => set("workPhone", e.target.value)} /></Field>
          <Field label="Email cơ quan" ru="Рабочий E-mail"><input type="email" required value={applicant.workEmail} onChange={(e) => set("workEmail", e.target.value.toLowerCase())} /></Field>
        </div>
      </section>

      <section className={styles.section}>
        <header><b>05</b><div><h2>Lịch sử liên quan đến Nga</h2><p>Chọn Có chỉ khi đúng với trường hợp của bạn; các trường chi tiết sẽ tự xuất hiện.</p></div></header>
        <div className={styles.checks}>
          <label><input type="checkbox" checked={applicant.hadFormerRussianCitizenship} onChange={(e) => set("hadFormerRussianCitizenship", e.target.checked)} /><span><strong>Đã từng có quốc tịch Liên Xô hoặc Nga</strong><small>Если Вы имели гражданство СССР или России</small></span></label>
          <label><input type="checkbox" checked={applicant.visitedRussia} onChange={(e) => set("visitedRussia", e.target.checked)} /><span><strong>Đã từng đến Nga</strong><small>Были ли Вы когда-нибудь в России?</small></span></label>
          <label><input type="checkbox" checked={applicant.hasInsurance} onChange={(e) => set("hasInsurance", e.target.checked)} /><span><strong>Có bảo hiểm có hiệu lực tại Nga</strong><small>Документ о медицинском страховании</small></span></label>
        </div>
        {applicant.hadFormerRussianCitizenship ? <div className={styles.grid}>
          <Field label="Ngày mất quốc tịch"><DateFields required value={applicant.formerCitizenshipLostDate} onChange={(value) => set("formerCitizenshipLostDate", value)} /></Field>
          <Field label="Lý do mất quốc tịch"><input required value={applicant.formerCitizenshipLossReason} onChange={(e) => set("formerCitizenshipLossReason", upperPlain(e.target.value))} /></Field>
        </div> : null}
        {applicant.visitedRussia ? <div className={styles.grid}>
          <Field label="Số lần đã đến Nga"><input required inputMode="numeric" value={applicant.visitsCount} onChange={(e) => set("visitsCount", e.target.value)} /></Field>
          <Field label="Chuyến gần nhất - từ ngày"><DateFields required value={applicant.lastVisitFrom} onChange={(value) => set("lastVisitFrom", value)} /></Field>
          <Field label="Chuyến gần nhất - đến ngày"><DateFields required value={applicant.lastVisitTo} onChange={(value) => set("lastVisitTo", value)} /></Field>
        </div> : null}
        {applicant.hasInsurance ? <div className={styles.grid}><Field label="Tên công ty bảo hiểm / số hợp đồng"><input required value={applicant.insurancePolicy} onChange={(e) => set("insurancePolicy", upperPlain(e.target.value))} /></Field></div> : null}
      </section>

      <section className={styles.section}>
        <header><b>06</b><div><h2>Gia đình & nơi nộp hồ sơ</h2><p>Nếu không đánh dấu hai mục đầu thì hệ thống hiểu là Không.</p></div></header>
        <div className={styles.checks}>
          <label><input type="checkbox" checked={applicant.childrenUnder16} onChange={(e) => set("childrenUnder16", e.target.checked)} /><span><strong>Có trẻ em dưới 16 tuổi đi cùng / ghi trong hộ chiếu</strong><small>Дети до 16 лет...</small></span></label>
          <label><input type="checkbox" checked={applicant.relativesInRussia} onChange={(e) => set("relativesInRussia", e.target.checked)} /><span><strong>Có người thân hiện đang ở Nga</strong><small>Родственники на территории России</small></span></label>
        </div>
        <div className={styles.grid}>
          <Field label="Nơi dự kiến nộp hồ sơ" ru="Место подачи заявления"><select value={applicant.preferredEmbassy} onChange={(e) => set("preferredEmbassy", e.target.value)}>{embassies.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
          <Field label="Ghi chú đặc biệt" hint="Nếu Có ở các mục trẻ em/người thân, hãy ghi rõ thông tin cần người phụ trách biết."><textarea rows={4} value={applicant.specialNotes} onChange={(e) => set("specialNotes", upperPlain(e.target.value))} /></Field>
        </div>
      </section>

      <section className={styles.confirm}>
        <label><input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} /><span><strong>Tôi xác nhận các thông tin trên là đúng theo giấy tờ của mình.</strong><small>Hồ sơ sẽ được gửi tới người phụ trách để xác minh trước khi dùng điền visa.kdmid.ru.</small></span></label>
        <button disabled={sending || !confirmed} type="submit">{sending ? "Đang gửi…" : "Hoàn thành & gửi hồ sơ"}</button>
      </section>
    </form>
  </main>;
}
