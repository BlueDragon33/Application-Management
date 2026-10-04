"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import styles from "./kd-mid-visa.module.css";
const visaConsulates = [
  { value: "ПОСОЛЬСТВО РФ ВО ВЬЕТНАМЕ", label: "Đại sứ quán Liên bang Nga tại Hà Nội" },
  { value: "ГЕНКОНСУЛЬСТВО РФ В ДАНАНГЕ", label: "Tổng Lãnh sự quán Liên bang Nga tại Đà Nẵng" },
  { value: "ГЕНКОНСУЛЬСТВО РФ В ХОШИМИНЕ", label: "Tổng Lãnh sự quán Liên bang Nga tại TP. Hồ Chí Minh" },
] as const;

type Route = "dashboard" | "applicants" | "intake" | "common" | "records" | "backup" | "connect";
type KeepMode = "full" | "record" | "none";
type DeleteScope = "applicants" | "records" | "common" | "payload" | "intakeDrafts";

type CommonData = {
  password: string;
  citizenship: string;
  purposeSection: string;
  purpose: string;
  visaType: string;
  entries: string;
  entryDate: string;
  exitDate: string;
  organization: string;
  organizationAddress: string;
  tin: string;
  telex: string;
  invitation: string;
  city: string;
  embassy: string;
  employer: string;
  employerAddress: string;
  employerEmail: string;
  defaultPosition: string;
};

type Applicant = {
  id: string;
  surname: string;
  givenNames: string;
  birthDate: string;
  birthPlace: string;
  sex: string;
  passportNo: string;
  passportIssue: string;
  passportExpiry: string;
  personalAddress: string;
  phone: string;
  email: string;
  workStudyPlace: string;
  position: string;
  workAddress: string;
  workPhone: string;
  workEmail: string;
  childrenUnder16: boolean;
  relativesInRussia: boolean;
  passwordOverride: string;
  routeCity: string;
  hadFormerRussianCitizenship: boolean;
  formerCitizenshipLostDate: string;
  formerCitizenshipLossReason: string;
  visitedRussia: boolean;
  visitsCount: string;
  lastVisitFrom: string;
  lastVisitTo: string;
  hasInsurance: boolean;
  insurancePolicy: string;
  applicationId: string;
  preferredEmbassy: string;
  intakeOrder?: number;
  intakeSubmissionId?: string;
  specialNotes?: string;
};

type IntakeLink = {
  id: string;
  label: string;
  status: string;
  createdBy: string;
  createdAt: string;
  expiresAt: string | null;
  publicPath: string;
  submissionCount: number;
  resultCount: number;
};

type IntakeSubmission = {
  queueNo: number;
  id: string;
  linkId: string;
  status: string;
  applicantName: string;
  passportNo: string;
  email: string;
  phone: string;
  applicant: Record<string, unknown>;
  validation: Record<string, unknown>;
  submittedAt: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
  correctionFields: string[];
  resubmittedFields: string[];
  revision: number;
  importedApplicantId: string | null;
  result: { available: true; fileName: string; fileSize: number; uploadedAt: string } | null;
};

type ResumeRecord = {
  id: string;
  applicationId: string;
  surname5: string;
  birthYear: string;
  password: string;
  applicantName: string;
  updatedAt: string;
};

type Store = {
  version: 1;
  common: CommonData;
  applicants: Applicant[];
  records: ResumeRecord[];
  selectedId: string;
};

const storageKey = "application-management:kd-mid-visa:v1";
const activePayloadKey = "application-management:kd-mid-visa:active-payload:v1";
const fixedPermanentAddress = "ВЬЕТНАМ, Г. ХАНОЙ, УЛИЦА НГИА ДО, ДОРОГА ХОАНГ КУОК ВЬЕТ, ДОМ Ш9"; // canonical full address; do not truncate suffix
const fixedWorkPhone = "+842437555706";

const defaultCommon: CommonData = {
  password: "qllhs2025",
  citizenship: "ВЬЕТНАМ",
  purposeSection: "УЧЕБА",
  purpose: "УЧЕБА",
  visaType: "ОБЫКНОВЕННАЯ УЧЕБНАЯ",
  entries: "ОДНОКРАТНАЯ",
  entryDate: "05/10/2026",
  exitDate: "31/12/2026",
  organization: "МИН-ВО НАУКИ И ВЫСШЕГО ОБРАЗОВАНИЯ РФ (МИНОБРНАУКИ РОССИИ)",
  organizationAddress: "125993, МОСКВА, УЛ. ТВЕРСКАЯ, Д.11, СТР.1, 4",
  tin: "7707740714",
  telex: "321422",
  invitation: "",
  city: "МОСКВА",
  embassy: "ПОСОЛЬСТВО РФ ВО ВЬЕТНАМЕ",
  employer: "ГОСУДАРСТВЕННЫЙ ТЕХНИЧЕСКИЙ УНИВЕРСИТЕТ ИМЕНИ ЛЕ КУИ ДОНА",
  employerAddress: "ВЬЕТНАМ, Г. ХАНОЙ, УЛИЦА НГИА ДО, ДОРОГА ХОАНГ КУОК ВЬЕТ",
  employerEmail: "lequydonqllhs@gmail.com",
  defaultPosition: "СТУДЕНТ",
};

function emptyApplicant(): Applicant {
  return {
    id: crypto.randomUUID(),
    surname: "",
    givenNames: "",
    birthDate: "",
    birthPlace: "",
    sex: "МУЖСКОЙ",
    passportNo: "",
    passportIssue: "",
    passportExpiry: "",
    personalAddress: fixedPermanentAddress,
    phone: "",
    email: "",
    workStudyPlace: defaultCommon.employer,
    position: defaultCommon.defaultPosition,
    workAddress: defaultCommon.employerAddress,
    workPhone: fixedWorkPhone,
    workEmail: defaultCommon.employerEmail,
    childrenUnder16: false,
    relativesInRussia: false,
    passwordOverride: "",
    routeCity: "МОСКВА",
    hadFormerRussianCitizenship: false,
    formerCitizenshipLostDate: "",
    formerCitizenshipLossReason: "",
    visitedRussia: false,
    visitsCount: "",
    lastVisitFrom: "",
    lastVisitTo: "",
    hasInsurance: false,
    insurancePolicy: "",
    applicationId: "",
    preferredEmbassy: defaultCommon.embassy,
    specialNotes: "",
  };
}

function safeLoad(): Store {
  const fallback: Store = { version: 1, common: defaultCommon, applicants: [], records: [], selectedId: "" };
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<Store>;
    return {
      version: 1,
      common: { ...defaultCommon, ...(parsed.common ?? {}) },
      applicants: Array.isArray(parsed.applicants) ? parsed.applicants.map((item) => {
        const common = { ...defaultCommon, ...(parsed.common ?? {}) };
        return {
          ...item,
          routeCity: item.routeCity || "МОСКВА",
          hadFormerRussianCitizenship: item.hadFormerRussianCitizenship ?? false,
          formerCitizenshipLostDate: item.formerCitizenshipLostDate ?? "",
          formerCitizenshipLossReason: item.formerCitizenshipLossReason ?? "",
          personalAddress: fixedPermanentAddress,
          workStudyPlace: String(item.workStudyPlace ?? "").trim() || common.employer,
          position: String(item.position ?? "").trim() || common.defaultPosition,
          workAddress: String(item.workAddress ?? "").trim() || common.employerAddress,
          workPhone: String(item.workPhone ?? "").trim() || fixedWorkPhone,
          workEmail: String(item.workEmail ?? "").trim() || common.employerEmail,
          childrenUnder16: item.childrenUnder16 ?? false,
          relativesInRussia: item.relativesInRussia ?? false,
          preferredEmbassy: item.preferredEmbassy || common.embassy,
          specialNotes: item.specialNotes ?? "",
        };
      }) : [],
      records: Array.isArray(parsed.records) ? parsed.records : [],
      selectedId: typeof parsed.selectedId === "string" ? parsed.selectedId : "",
    };
  } catch {
    return fallback;
  }
}

function persistStoreSnapshot(next: Store) {
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(next));
  } catch {
    // The normal React persistence effect remains the fallback.
  }
}

function persistActivePayload(payload: ReturnType<typeof buildPayload>) {
  try {
    window.localStorage.setItem(activePayloadKey, JSON.stringify(payload));
  } catch {}
}

function readActivePayload() {
  try {
    const raw = window.localStorage.getItem(activePayloadKey);
    return raw ? JSON.parse(raw) as ReturnType<typeof buildPayload> : null;
  } catch {
    return null;
  }
}

function normalizeDmy(value: string) {
  const raw = value.trim();
  if (!raw) return "";
  const iso = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  const dmy = raw.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  const parts = iso ? [iso[3], iso[2], iso[1]] : dmy ? [dmy[1], dmy[2], dmy[3]] : null;
  if (!parts) return raw;
  const day = Number(parts[0]);
  const month = Number(parts[1]);
  const year = Number(parts[2]);
  const check = new Date(Date.UTC(year, month - 1, day));
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) return raw;
  return `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}/${year}`;
}

function surname5(value: string) {
  return value.trim().replace(/\s+/g, "").toUpperCase().slice(0, 5);
}

function birthYear(value: string) {
  const match = value.match(/(19|20)\d{2}/g);
  return match?.at(-1) ?? "";
}

function displayName(applicant: Applicant) {
  return [applicant.surname, applicant.givenNames].filter(Boolean).join(" ") || "Hồ sơ chưa đặt tên";
}

function applicantMissingFields(applicant: Applicant) {
  const checks: Array<[string, string]> = [
    ["surname", "Họ / Surname"],
    ["givenNames", "Tên + đệm / Given & middle names"],
    ["birthDate", "Ngày sinh"],
    ["birthPlace", "Nơi sinh"],
    ["passportNo", "Số hộ chiếu"],
    ["passportIssue", "Ngày cấp hộ chiếu"],
    ["passportExpiry", "Ngày hết hạn hộ chiếu"],
  ];
  return checks.filter(([key]) => !String(applicant[key as keyof Applicant] ?? "").trim()).map(([, label]) => label);
}

function emitChange(el: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement) {
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
}

function buildPayload(applicant: Applicant, common: CommonData, autoAdvance = false, revision = Date.now()) {
  const normalizedApplicant = {
    ...applicant,
    workStudyPlace: applicant.workStudyPlace.trim() || common.employer,
    position: applicant.position.trim() || common.defaultPosition,
    workAddress: applicant.workAddress.trim() || common.employerAddress,
    workPhone: applicant.workPhone.trim() || fixedWorkPhone,
    workEmail: applicant.workEmail.trim() || common.employerEmail,
    birthDate: normalizeDmy(applicant.birthDate),
    passportIssue: normalizeDmy(applicant.passportIssue),
    passportExpiry: normalizeDmy(applicant.passportExpiry),
    formerCitizenshipLostDate: normalizeDmy(applicant.formerCitizenshipLostDate),
    lastVisitFrom: normalizeDmy(applicant.lastVisitFrom),
    lastVisitTo: normalizeDmy(applicant.lastVisitTo),
  };
  return {
    ...common,
    entryDate: normalizeDmy(common.entryDate),
    exitDate: normalizeDmy(common.exitDate),
    embassy: applicant.preferredEmbassy || common.embassy,
    fixedPermanentAddress: "ВЬЕТНАМ, Г. ХАНОЙ, УЛИЦА НГИА ДО, ДОРОГА ХОАНГ КУОК ВЬЕТ, ДОМ Ш9",
    fixedWorkPhone,
    _automation: { autoAdvance, autoPrint: true },
    _payloadRevision: revision,
    applicant: {
      ...normalizedApplicant,
      personalAddress: "ВЬЕТНАМ, Г. ХАНОЙ, УЛИЦА НГИА ДО, ДОРОГА ХОАНГ КУОК ВЬЕТ, ДОМ Ш9",
      password: applicant.passwordOverride || common.password,
      surname5: surname5(applicant.surname),
      birthYear: birthYear(normalizedApplicant.birthDate),
    },
  };
}

function encodeAutomationPayload(payload: ReturnType<typeof buildPayload>) {
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return window.btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function buildDirectAutomationUrl(applicant: Applicant, common: CommonData, autoAdvance: boolean) {
  const payload = { ...buildPayload(applicant, common, autoAdvance), _launchToken: Date.now() };
  return `https://visa.kdmid.ru/#kdmidv8=${encodeAutomationPayload(payload)}`;
}

function buildBookmarklet(applicant: Applicant, common: CommonData) {
  const payload = buildPayload(applicant, common);
  const encoded = encodeURIComponent(JSON.stringify(payload));
  const code = `(()=>{const p=JSON.parse(decodeURIComponent("${encoded}"));const A=p.applicant;
const norm=s=>(s||"").replace(/\\s+/g," ").trim().toUpperCase();
const fire=e=>{e.dispatchEvent(new Event("input",{bubbles:true}));e.dispatchEvent(new Event("change",{bubbles:true}))};
const all=(root=document)=>[...root.querySelectorAll("input,select,textarea")];
const labelBlock=t=>{const n=norm(t);const els=[...document.querySelectorAll("label,td,div,span,p,b,strong")].filter(e=>norm(e.textContent).includes(n));for(const e of els){let x=e;for(let i=0;i<5&&x;i++,x=x.parentElement){if(all(x).length)return x}}return null};
const blockControls=t=>{const b=labelBlock(t);return b?all(b):[]};
const setText=(label,v)=>{if(v==null||v==="")return false;const c=blockControls(label).filter(e=>e.tagName!=="SELECT");const e=c.find(x=>x.type!=="hidden"&&x.type!=="button"&&x.type!=="submit");if(!e)return false;e.value=v;fire(e);return true};
const setSelect=(label,v)=>{const c=blockControls(label).filter(e=>e.tagName==="SELECT");const e=c[0];if(!e)return false;const want=norm(v);const o=[...e.options].find(o=>norm(o.textContent)===want)||[...e.options].find(o=>norm(o.textContent).includes(want));if(!o)return false;e.value=o.value;fire(e);return true};
const setYesNo=(label,val)=>setSelect(label,val?"ДА":"НЕТ");
const setDate=(label,v)=>{if(!v)return false;const [d,m,y]=v.split("/");const c=blockControls(label).filter(e=>e.type!=="hidden");if(c.length<3)return false;const vals=[d,m,y];c.slice(0,3).forEach((e,i)=>{if(e.tagName==="SELECT"){const o=[...e.options].find(o=>norm(o.textContent)===norm(vals[i])||String(o.value)===String(vals[i]));if(o)e.value=o.value}else e.value=vals[i];fire(e)});return true};
const setAnyText=(labels,v)=>labels.some(l=>setText(l,v));
const setAnySelect=(labels,v)=>labels.some(l=>setSelect(l,v));
setAnySelect(["Гражданство"],p.citizenship);
setYesNo("Если Вы имели гражданство СССР или России",A.hadFormerRussianCitizenship);
if(A.hadFormerRussianCitizenship){setDate("Когда",A.formerCitizenshipLostDate);setAnyText(["В связи с чем","В связи с чем?"],A.formerCitizenshipLossReason)};
setAnySelect(["Цель поездки (раздел)"],p.purposeSection);
setAnySelect(["Цель поездки"],p.purpose);
setAnySelect(["Категория и вид визы"],p.visaType);
setAnySelect(["Кратность визы"],p.entries);
setDate("Дата въезда в Россию",p.entryDate);setDate("Дата выезда из России",p.exitDate);
setAnyText(["Фамилия (согласно паспорту)"],A.surname);
setAnyText(["Имя, другие имена, отчество"],A.givenNames);
setYesNo("Есть ли у Вас другие когда-либо использовавшиеся имена",false);
setAnySelect(["Пол"],A.sex);
setDate("Дата рождения",A.birthDate);
setAnyText(["Место рождения"],A.birthPlace);
setYesNo("Вы родились в России",false);
setAnyText(["Номер паспорта"],A.passportNo);
setDate("Дата выдачи",A.passportIssue);setDate("Действителен до",A.passportExpiry);
setAnyText(["Наименование организации"],p.organization);
setAnyText(["Адрес"],p.organizationAddress);
setAnyText(["ИНН организации"],p.tin);
setAnyText(["Номер указания (телекса)"],p.telex);
setAnyText(["Номер приглашения"],p.invitation);
setAnyText(["Населенный пункт"],A.routeCity||p.city);
setYesNo("Имеете ли Вы документ о медицинском страховании",A.hasInsurance);
if(A.hasInsurance)setAnyText(["Название страховой компании и номер полиса","номер страхового документа"],A.insurancePolicy);
setYesNo("Были ли Вы когда-нибудь в России",A.visitedRussia);
if(A.visitedRussia){setAnyText(["Сколько раз Вы были в России"],A.visitsCount);setDate("Дата въезда",A.lastVisitFrom);setDate("Дата выезда",A.lastVisitTo)}
setYesNo("Имеете ли Вы адрес постоянного проживания",true);
setAnyText(["Адрес вашего постоянного проживания"],p.fixedPermanentAddress||A.personalAddress);
setAnyText(["Ваш личный телефон"],A.phone);setAnyText(["Ваш личный E-mail"],A.email);
setYesNo("Вы работаете",true);
setAnyText(["Место работы (учебы)"],A.workStudyPlace);
setAnyText(["Должность"],A.position);
setAnyText(["Рабочий адрес"],A.workAddress);
setAnyText(["Рабочий телефон"],A.workPhone);
setAnyText(["Рабочий E-mail"],A.workEmail);
setYesNo("Дети до 16 лет",Boolean(A.childrenUnder16));setYesNo("Имеете ли Вы в настоящее время родственников",Boolean(A.relativesInRussia));
setAnySelect(["Наименование учреждения"],p.embassy);
const text=document.body.innerText||"";const id=(text.match(/(?:Номер анкеты|№ заявления \\(сайт\\))[^0-9]{0,40}(\\d{6,12})/i)||[])[1];
if(id&&window.opener){window.opener.postMessage({type:"KD_MID_RECORD",applicationId:id,surname5:A.surname5,birthYear:A.birthYear,password:A.password,applicantName:(A.surname+" "+A.givenNames).trim(),complete:/Печать формата A4|Печать формата Letter/i.test(text)},"*")}
const notes=[...document.querySelectorAll("[data-kdmid-vn-note]")];notes.forEach(n=>n.remove());
[["Цель поездки","Mục đích chuyến đi"],["Номер указания","Số telex/chỉ thị"],["Место рождения","Nơi sinh theo hộ chiếu"],["Были ли Вы когда-нибудь в России","Bạn đã từng đến Nga chưa?"],["Имеете ли Вы документ о медицинском страховании","Bảo hiểm có hiệu lực tại Nga"]].forEach(([ru,vi])=>{const b=labelBlock(ru);if(b){const s=document.createElement("div");s.dataset.kdmidVnNote="1";s.textContent="🇻🇳 "+vi;s.style.cssText="margin:6px 0;padding:6px 9px;border-left:3px solid #16a34a;background:#ecfdf5;color:#14532d;font:600 12px/1.4 Arial";b.appendChild(s)}});
alert("KD-MID Visa VN: đã điền các trường nhận diện được trên trang này. Hãy kiểm tra lại trước khi bấm Далее.");})();`;
  return "javascript:" + code.replace(/\n+/g, " ");
}

const russianHints: Array<{ ru: string; en: string; vi: string }> = [
  { ru: "Гражданство", en: "Citizenship", vi: "Quốc tịch" },
  { ru: "Цель поездки", en: "Purpose of visit", vi: "Mục đích chuyến đi" },
  { ru: "Категория и вид визы", en: "Visa category and type", vi: "Loại và diện visa" },
  { ru: "Кратность визы", en: "Number of entries", vi: "Số lần nhập cảnh" },
  { ru: "Фамилия", en: "Surname", vi: "Họ" },
  { ru: "Имя, другие имена, отчество", en: "First name, middle names, patronymic", vi: "Tên, tên đệm, tên cha" },
  { ru: "Дата рождения", en: "Date of birth", vi: "Ngày sinh" },
  { ru: "Место рождения", en: "Place of birth", vi: "Nơi sinh" },
  { ru: "Пол", en: "Sex", vi: "Giới tính" },
  { ru: "Номер паспорта", en: "Passport number", vi: "Số hộ chiếu" },
  { ru: "Дата выдачи паспорта", en: "Passport issue date", vi: "Ngày cấp hộ chiếu" },
  { ru: "Паспорт действителен до", en: "Passport valid until", vi: "Hộ chiếu có giá trị đến" },
  { ru: "Наименование организации", en: "Name of organization", vi: "Tên cơ quan/tổ chức" },
  { ru: "Адрес организации", en: "Organization address", vi: "Địa chỉ tổ chức" },
  { ru: "ИНН", en: "TIN / taxpayer ID", vi: "Mã số thuế tổ chức" },
  { ru: "Номер указания (телекса)", en: "Directive (telex) number", vi: "Số chỉ thị/telex" },
  { ru: "Номер приглашения", en: "Invitation number", vi: "Số giấy mời" },
  { ru: "Маршрут", en: "Itinerary / route", vi: "Lộ trình / nơi đến" },
  { ru: "Должность", en: "Position", vi: "Chức danh/vị trí" },
  { ru: "МУЖСКОЙ", en: "Male", vi: "Nam" },
  { ru: "ЖЕНСКИЙ", en: "Female", vi: "Nữ" },
  { ru: "УЧЕБА", en: "Study", vi: "Học tập" },
  { ru: "ОДНОКРАТНАЯ", en: "Single-entry", vi: "Nhập cảnh một lần" },
  { ru: "ОБЫКНОВЕННАЯ УЧЕБНАЯ", en: "Common educational visa", vi: "Visa học tập thông thường" },
  { ru: "МОСКВА", en: "Moscow", vi: "Moskva/Moscow" },
  { ru: "ВЬЕТНАМ", en: "Vietnam", vi: "Việt Nam" },
];

function russianTooltip(label: string) {
  const upper = label.toUpperCase();
  const match = [...russianHints].sort((a, b) => b.ru.length - a.ru.length).find((item) => upper.includes(item.ru.toUpperCase()));
  return match ? `English: ${match.en}\nTiếng Việt: ${match.vi}` : undefined;
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  const tooltip = russianTooltip(label);
  return <label className={styles.field}><span className={tooltip ? styles.ruLabel : undefined} title={tooltip}>{label}{tooltip ? <i className={styles.helpDot}>?</i> : null}</span>{children}{hint ? <small>{hint}</small> : null}</label>;
}

function TextInput({ value, onChange, placeholder = "" }: { value: string; onChange: (value: string) => void; placeholder?: string }) {
  return <input value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />;
}

function DateTextInput({ value, onChange, placeholder = "dd/mm/yyyy" }: { value: string; onChange: (value: string) => void; placeholder?: string }) {
  return <input
    inputMode="numeric"
    value={value}
    placeholder={placeholder}
    onChange={(event) => onChange(event.target.value)}
    onBlur={(event) => onChange(normalizeDmy(event.target.value))}
  />;
}

export default function KdMidVisaTool({ user }: { user: { displayName: string; email: string } }) {
  const [route, setRoute] = useState<Route>("dashboard");
  const [store, setStore] = useState<Store>({ version: 1, common: defaultCommon, applicants: [], records: [], selectedId: "" });
  const [hydrated, setHydrated] = useState(false);
  const [notice, setNotice] = useState("");
  const [editing, setEditing] = useState<Applicant | null>(null);
  const [keepPrompt, setKeepPrompt] = useState<ResumeRecord | null>(null);
  const [bookmarklet, setBookmarklet] = useState("");
  const [autoAdvance, setAutoAdvance] = useState(true);
  const [companionVersion, setCompanionVersion] = useState("");
  const [intakeLinks, setIntakeLinks] = useState<IntakeLink[]>([]);
  const [intakeSubmissions, setIntakeSubmissions] = useState<IntakeSubmission[]>([]);
  const [intakeLoading, setIntakeLoading] = useState(false);
  const [intakeLabel, setIntakeLabel] = useState("");
  const [shareUrl, setShareUrl] = useState("");
  const [resultUploadingId, setResultUploadingId] = useState("");
  const [correctionSelections, setCorrectionSelections] = useState<Record<string, string[]>>({});
  const [deleteSelection, setDeleteSelection] = useState<Record<DeleteScope, boolean>>({
    applicants: false,
    records: false,
    common: false,
    payload: false,
    intakeDrafts: false,
  });

  useEffect(() => {
    const loaded = safeLoad();
    setStore(loaded);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(storageKey, JSON.stringify(store));
  }, [hydrated, store]);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const data = event.data as Partial<ResumeRecord> & { type?: string; complete?: boolean; version?: string };

      if (data?.type === "KD_MID_COMPANION_READY") {
        setCompanionVersion(String(data.version ?? ""));
        return;
      }

      if (data?.type !== "KD_MID_RECORD" || !data.applicationId) return;
      const record: ResumeRecord = {
        id: String(data.applicationId),
        applicationId: String(data.applicationId),
        surname5: String(data.surname5 ?? ""),
        birthYear: String(data.birthYear ?? ""),
        password: String(data.password ?? store.common.password),
        applicantName: String(data.applicantName ?? ""),
        updatedAt: new Date().toISOString(),
      };
      setStore((current) => {
        const records = [record, ...current.records.filter((item) => item.applicationId !== record.applicationId)];
        const applicants = current.applicants.map((item) => item.id === current.selectedId ? { ...item, applicationId: record.applicationId } : item);
        return { ...current, records, applicants };
      });
      setNotice(`Đã ghi nhận Application ID ${record.applicationId}.`);
      if (data.complete) setKeepPrompt(record);
    };
    window.addEventListener("message", onMessage);
    window.postMessage({ type: "KD_MID_PING" }, window.location.origin);
    return () => window.removeEventListener("message", onMessage);
  }, [store.common.password]);

  useEffect(() => {
    if (route === "intake") void loadIntake();
  }, [route]);

    const selected = useMemo(() => store.applicants.find((item) => item.id === store.selectedId) ?? store.applicants[0] ?? null, [store.applicants, store.selectedId]);
  const completeCount = store.applicants.filter((item) => item.applicationId).length;

  function selectApplicant(id: string) {
    setStore((current) => {
      const next = { ...current, selectedId: id };
      persistStoreSnapshot(next);
      const applicant = next.applicants.find((item) => item.id === id);
      if (applicant) {
        const payload = buildPayload(applicant, next.common, autoAdvance);
        persistActivePayload(payload);
        window.postMessage({ type: "KD_MID_SET_PAYLOAD", payload }, window.location.origin);
      }
      return next;
    });
  }

  function mutateCommon<K extends keyof CommonData>(key: K, value: CommonData[K]) {
    setStore((current) => {
      const next = { ...current, common: { ...current.common, [key]: value } };
      persistStoreSnapshot(next);
      const currentApplicant = next.applicants.find((item) => item.id === next.selectedId) ?? next.applicants[0];
      if (currentApplicant) {
        const payload = buildPayload(currentApplicant, next.common, autoAdvance);
        persistActivePayload(payload);
        window.postMessage({ type: "KD_MID_SET_PAYLOAD", payload }, window.location.origin);
      }
      return next;
    });
  }

  function saveApplicant(next: Applicant) {
    setStore((current) => {
      const exists = current.applicants.some((item) => item.id === next.id);
      const normalized = {
        ...next,
        surname: next.surname.trim().toUpperCase(),
        givenNames: next.givenNames.trim().toUpperCase(),
        birthDate: normalizeDmy(next.birthDate),
        birthPlace: next.birthPlace.trim().toUpperCase(),
        passportIssue: normalizeDmy(next.passportIssue),
        passportExpiry: normalizeDmy(next.passportExpiry),
        formerCitizenshipLostDate: normalizeDmy(next.formerCitizenshipLostDate),
        lastVisitFrom: normalizeDmy(next.lastVisitFrom),
        lastVisitTo: normalizeDmy(next.lastVisitTo),
        personalAddress: fixedPermanentAddress,
      };
      const applicants = exists ? current.applicants.map((item) => item.id === normalized.id ? normalized : item) : [normalized, ...current.applicants];
      const nextStore = { ...current, applicants, selectedId: normalized.id };
      // Persist NOW instead of waiting for useEffect. This removes the save→run race.
      persistStoreSnapshot(nextStore);
      // One canonical payload is written at Save time. Launch reuses this exact normalized applicant.
      const payload = buildPayload(normalized, nextStore.common, autoAdvance);
      persistActivePayload(payload);
      window.postMessage({ type: "KD_MID_SET_PAYLOAD", payload }, window.location.origin);
      return nextStore;
    });
    setEditing(null);
    setNotice(`Đã lưu và đồng bộ payload mới: ${next.surname.trim().toUpperCase()} · ${next.givenNames.trim().toUpperCase()} · ${normalizeDmy(next.birthDate)}.`);
  }

  function removeApplicant(id: string) {
    if (!window.confirm("Xóa hồ sơ cá nhân này khỏi máy?")) return;
    setStore((current) => ({ ...current, applicants: current.applicants.filter((item) => item.id !== id), selectedId: current.selectedId === id ? "" : current.selectedId }));
  }

  async function loadIntake() {
    setIntakeLoading(true);
    try {
      const response = await fetch("/api/kd-mid-visa-intake/admin", { cache: "no-store" });
      const data = await response.json() as { ok?: boolean; error?: string; links?: IntakeLink[]; submissions?: IntakeSubmission[] };
      if (!response.ok || !data.ok) throw new Error(data.error || "Không tải được hộp thư hồ sơ.");
      setIntakeLinks(data.links ?? []);
      setIntakeSubmissions(data.submissions ?? []);
    } catch (reason) {
      setNotice(reason instanceof Error ? reason.message : "Không tải được hộp thư hồ sơ.");
    } finally {
      setIntakeLoading(false);
    }
  }

  async function intakeAction(payload: Record<string, unknown>) {
    const response = await fetch("/api/kd-mid-visa-intake/admin", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json() as {
      ok?: boolean;
      error?: string;
      token?: string;
      link?: Partial<IntakeLink>;
      links?: IntakeLink[];
      submissions?: IntakeSubmission[];
    };
    if (!response.ok || !data.ok) throw new Error(data.error || "Thao tác hộp thư thất bại.");
    setIntakeLinks(data.links ?? []);
    setIntakeSubmissions(data.submissions ?? []);
    return data;
  }

  async function createIntakeLink() {
    try {
      const data = await intakeAction({
        action: "create-link",
        label: intakeLabel,
        defaults: {
          routeCity: store.common.city,
          employer: store.common.employer,
          position: store.common.defaultPosition,
          workAddress: store.common.employerAddress,
          workPhone: fixedWorkPhone,
          workEmail: store.common.employerEmail,
          permanentAddress: fixedPermanentAddress,
          preferredEmbassy: store.common.embassy,
        },
      });
      const publicPath = String(data.link?.publicPath || "");
      if (!publicPath) throw new Error("Không nhận được đường dẫn đợt thu hồ sơ.");
      const url = `${window.location.origin}${publicPath}`;
      setShareUrl(url);
      await navigator.clipboard.writeText(url).catch(() => undefined);
      setNotice("Đã tạo và sao chép link Form hồ sơ Visa. Gửi link này cho người cần điền.");
    } catch (reason) {
      setNotice(reason instanceof Error ? reason.message : "Không tạo được link Form.");
    }
  }

  function applicantFromIntake(submission: IntakeSubmission): Applicant {
    const source = submission.applicant;
    const value = (key: string) => typeof source[key] === "string" ? String(source[key]) : "";
    const flag = (key: string) => source[key] === true;
    return {
      ...emptyApplicant(),
      id: crypto.randomUUID(),
      surname: value("surname").toUpperCase(),
      givenNames: value("givenNames").toUpperCase(),
      birthDate: normalizeDmy(value("birthDate")),
      birthPlace: value("birthPlace").toUpperCase(),
      sex: value("sex") || "МУЖСКОЙ",
      passportNo: value("passportNo").toUpperCase(),
      passportIssue: normalizeDmy(value("passportIssue")),
      passportExpiry: normalizeDmy(value("passportExpiry")),
      phone: value("phone"),
      email: value("email"),
      routeCity: value("routeCity").toUpperCase() || store.common.city,
      workStudyPlace: value("workStudyPlace") || store.common.employer,
      position: value("position") || store.common.defaultPosition,
      workAddress: value("workAddress") || store.common.employerAddress,
      workPhone: value("workPhone") || fixedWorkPhone,
      workEmail: value("workEmail") || store.common.employerEmail,
      preferredEmbassy: value("preferredEmbassy") || store.common.embassy,
      hadFormerRussianCitizenship: flag("hadFormerRussianCitizenship"),
      formerCitizenshipLostDate: normalizeDmy(value("formerCitizenshipLostDate")),
      formerCitizenshipLossReason: value("formerCitizenshipLossReason"),
      visitedRussia: flag("visitedRussia"),
      visitsCount: value("visitsCount"),
      lastVisitFrom: normalizeDmy(value("lastVisitFrom")),
      lastVisitTo: normalizeDmy(value("lastVisitTo")),
      hasInsurance: flag("hasInsurance"),
      insurancePolicy: value("insurancePolicy"),
      childrenUnder16: flag("childrenUnder16"),
      relativesInRussia: flag("relativesInRussia"),
      specialNotes: value("specialNotes"),
      personalAddress: fixedPermanentAddress,
      intakeOrder: submission.queueNo,
      intakeSubmissionId: submission.id,
    };
  }

  async function verifyAndImport(submission: IntakeSubmission) {
    try {
      await intakeAction({ action: "review", submissionId: submission.id, decision: "approved" });
      const imported = applicantFromIntake(submission);
      setStore((current) => {
        const withoutDuplicate = current.applicants.filter((item) => item.intakeSubmissionId !== submission.id);
        const applicants = [...withoutDuplicate, imported].sort((a, b) => {
          const left = a.intakeOrder ?? Number.MAX_SAFE_INTEGER;
          const right = b.intakeOrder ?? Number.MAX_SAFE_INTEGER;
          return left - right;
        });
        const next = { ...current, applicants, selectedId: current.selectedId || imported.id };
        persistStoreSnapshot(next);
        return next;
      });
      await intakeAction({ action: "mark-imported", submissionId: submission.id, applicantId: imported.id });
      setNotice(`Đã xác minh và lưu #${submission.queueNo} · ${submission.applicantName} vào danh sách làm Visa theo đúng thứ tự tiếp nhận.`);
    } catch (reason) {
      setNotice(reason instanceof Error ? reason.message : "Không thể xác minh và lưu hồ sơ.");
    }
  }

  function toggleCorrectionField(submissionId: string, field: string) {
    setCorrectionSelections((current) => {
      const selected = current[submissionId] ?? [];
      const next = selected.includes(field) ? selected.filter((item) => item !== field) : [...selected, field];
      return { ...current, [submissionId]: next };
    });
  }

  async function deleteIntakeSubmission(submission: IntakeSubmission) {
    const completed = ["approved", "imported"].includes(submission.status);
    const message = completed
      ? `Xóa hồ sơ #${submission.queueNo} · ${submission.applicantName} khỏi hàng chờ quản trị?\n\nHồ sơ và PDF kết quả vẫn được giữ trên server để người khai tiếp tục xem trạng thái và tải kết quả.`
      : `Xóa hồ sơ #${submission.queueNo} · ${submission.applicantName} khỏi hàng chờ?\n\nThao tác này sẽ xóa bản gửi này khỏi hệ thống và không thể hoàn tác.`;
    if (!window.confirm(message)) return;
    try {
      await intakeAction({
        action: completed ? "archive-submission" : "delete-submission",
        submissionId: submission.id,
      });
      setCorrectionSelections((current) => {
        const next = { ...current };
        delete next[submission.id];
        return next;
      });
      setNotice(completed
        ? `Đã ẩn #${submission.queueNo} · ${submission.applicantName} khỏi hàng chờ quản trị; PDF và dữ liệu người khai vẫn được giữ.`
        : `Đã xóa #${submission.queueNo} · ${submission.applicantName} khỏi hàng chờ xác minh.`);
    } catch (reason) {
      setNotice(reason instanceof Error ? reason.message : "Không thể xóa hồ sơ khỏi hàng chờ.");
    }
  }

  async function rejectIntake(submission: IntakeSubmission) {
    const correctionFields = correctionSelections[submission.id] ?? [];
    if (!correctionFields.length) {
      setNotice("Hãy click chọn ít nhất một ô sai trước khi trả hồ sơ.");
      return;
    }
    const note = window.prompt("Ghi chú thêm cho người sửa (không bắt buộc):", "") ?? "";
    try {
      await intakeAction({ action: "review", submissionId: submission.id, decision: "rejected", note, correctionFields });
      setCorrectionSelections((current) => {
        const next = { ...current };
        delete next[submission.id];
        return next;
      });
      setNotice(`Đã trả hồ sơ #${submission.queueNo}; người gửi sẽ thấy ${correctionFields.length} ô cần sửa được bôi đỏ.`);
    } catch (reason) {
      setNotice(reason instanceof Error ? reason.message : "Không thể cập nhật hồ sơ.");
    }
  }

  function intakePublicUrl(link: IntakeLink) {
    return `${window.location.origin}${link.publicPath || `/visa-intake?batch=${encodeURIComponent(link.id)}`}`;
  }

  async function uploadIntakeResult(submission: IntakeSubmission, file: File | null) {
    if (!file) return;
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      setNotice("Chỉ chấp nhận file PDF kết quả.");
      return;
    }
    if (file.size > 2_000_000) {
      setNotice("PDF kết quả không được vượt quá 2 MB.");
      return;
    }
    setResultUploadingId(submission.id);
    try {
      const form = new FormData();
      form.set("action", "send-result");
      form.set("submissionId", submission.id);
      form.set("file", file, file.name);
      const response = await fetch("/api/kd-mid-visa-intake/admin", { method: "POST", body: form });
      const data = await response.json() as { ok?: boolean; error?: string; links?: IntakeLink[]; submissions?: IntakeSubmission[] };
      if (!response.ok || !data.ok) throw new Error(data.error || "Không gửi được PDF kết quả.");
      setIntakeLinks(data.links ?? []);
      setIntakeSubmissions(data.submissions ?? []);
      setNotice(`Đã gửi PDF kết quả cho #${submission.queueNo} · ${submission.applicantName}. Người khai sẽ thấy trong mục Nhận kết quả.`);
    } catch (reason) {
      setNotice(reason instanceof Error ? reason.message : "Không gửi được PDF kết quả.");
    } finally {
      setResultUploadingId("");
    }
  }

  async function closeIntakeLink(linkId: string) {
    if (!window.confirm("Đóng link này? Người khác sẽ không gửi thêm hồ sơ qua link đó.")) return;
    try {
      await intakeAction({ action: "close-link", linkId });
      setShareUrl((current) => current.includes(`batch=${encodeURIComponent(linkId)}`) ? "" : current);
      setNotice("Đã đóng link thu hồ sơ. Tab đợt này đã được ẩn khỏi danh sách.");
    } catch (reason) {
      setNotice(reason instanceof Error ? reason.message : "Không đóng được link.");
    }
  }

  async function prepareBridge() {
    if (!selected) {
      setNotice("Hãy tạo hoặc chọn một hồ sơ trước.");
      setRoute("applicants");
      return;
    }
    const value = buildBookmarklet(selected, store.common);
    setBookmarklet(value);
    try {
      await navigator.clipboard.writeText(value);
      setNotice("Đã sao chép bookmarklet KD-MID AutoFill VN. Tạo bookmark và dán vào ô URL.");
    } catch {
      setNotice("Bookmarklet đã được tạo. Sao chép thủ công ở mục Kết nối KD-MID.");
    }
    setRoute("connect");
  }

  function openKdmid() {
    window.open("https://visa.kdmid.ru/", "kdmidVisa");
  }

  function openResumeRecord(record: ResumeRecord) {
    const revision = Date.now();
    const matchedApplicant = store.applicants.find((item) => item.applicationId === record.applicationId);
    const fallbackApplicant: Applicant = matchedApplicant ?? {
      ...emptyApplicant(),
      id: `resume:${record.applicationId}`,
      surname: record.surname5,
      givenNames: record.applicantName,
      birthDate: record.birthYear ? `01/01/${record.birthYear}` : "",
      applicationId: record.applicationId,
      passwordOverride: record.password,
    };
    const base = buildPayload(fallbackApplicant, store.common, false, revision);
    const payload = {
      ...base,
      _automation: { autoAdvance: false, autoPrint: false, mode: "resume" },
      _resumeRecord: {
        applicationId: record.applicationId,
        surname5: record.surname5,
        birthYear: record.birthYear,
        password: record.password,
        applicantName: record.applicantName,
      },
      _launchToken: revision,
    };
    persistActivePayload(payload);
    window.postMessage({ type: "KD_MID_SET_PAYLOAD", payload }, window.location.origin);
    const target = window.open(`https://visa.kdmid.ru/#kdmidv8=${encodeAutomationPayload(payload)}`, "_blank");
    if (!target) {
      setNotice("Trình duyệt đã chặn cửa sổ KD-MID. Hãy cho phép pop-up rồi bấm lại.");
      return;
    }
    setNotice(`Đang mở lại Application ID ${record.applicationId}: Companion sẽ tự đi qua luồng khôi phục và dừng ở hồ sơ để bạn xem/sửa.`);
  }

  function openAutomaticKdmid() {
    // Always re-read the just-persisted store at click time. Do not trust a stale React closure.
    const persisted = safeLoad();
    const requestedId = persisted.selectedId || store.selectedId;
    const latestSelected = persisted.applicants.find((item) => item.id === requestedId)
      ?? store.applicants.find((item) => item.id === requestedId)
      ?? selected;
    const latestCommon = persisted.common ?? store.common;

    if (!latestSelected) {
      setNotice("Hãy tạo hoặc chọn một hồ sơ trước.");
      setRoute("applicants");
      return;
    }

    const missing = applicantMissingFields(latestSelected);
    if (!latestSelected.routeCity.trim()) missing.push("Маршрут / Nơi đến tại Nga");
    if (latestSelected.hadFormerRussianCitizenship) {
      if (!latestSelected.formerCitizenshipLostDate.trim()) missing.push("Когда? / Ngày mất quốc tịch Liên Xô/Nga");
      if (!latestSelected.formerCitizenshipLossReason.trim()) missing.push("В связи с чем? / Lý do mất quốc tịch");
    }
    if (latestSelected.visitedRussia) {
      if (!latestSelected.visitsCount.trim()) missing.push("Số lần đã đến Nga");
      if (!latestSelected.lastVisitFrom.trim()) missing.push("Ngày bắt đầu chuyến Nga gần nhất");
      if (!latestSelected.lastVisitTo.trim()) missing.push("Ngày kết thúc chuyến Nga gần nhất");
    }
    if (latestSelected.hasInsurance && !latestSelected.insurancePolicy.trim()) missing.push("Số hợp đồng bảo hiểm");
    if (missing.length) {
      setNotice(`Chưa thể tự điền. Hồ sơ còn thiếu: ${missing.join(", ")}.`);
      setRoute("applicants");
      return;
    }

    const revision = Date.now();
    const latestPayload = buildPayload(latestSelected, latestCommon, autoAdvance, revision);
    persistActivePayload(latestPayload);
    window.postMessage({ type: "KD_MID_SET_PAYLOAD", payload: latestPayload }, window.location.origin);
    const urlPayload = { ...latestPayload, _launchToken: revision };
    const target = window.open(`https://visa.kdmid.ru/#kdmidv8=${encodeAutomationPayload(urlPayload)}`, "_blank");
    if (!target) {
      setNotice("Trình duyệt đã chặn cửa sổ KD-MID. Hãy cho phép pop-up cho App-Manager rồi thử lại.");
      return;
    }

    const persistedPayload = readActivePayload();
    if (persistedPayload && (
      persistedPayload.applicant?.id !== latestSelected.id ||
      persistedPayload.applicant?.surname !== latestSelected.surname ||
      persistedPayload.applicant?.givenNames !== latestSelected.givenNames
    )) {
      setNotice("Lỗi nội bộ: payload vừa lưu không khớp hồ sơ đang chọn. Đã dừng để tránh gửi sai.");
      target.close();
      return;
    }

    setNotice(`Payload v0.9.31 đã khóa: Surname=${latestSelected.surname}; Given names=${latestSelected.givenNames}; DOB=${normalizeDmy(latestSelected.birthDate)}; Passport=${latestSelected.passportNo}. Mỗi lần chạy sẽ mở tab KD-MID mới để không dùng cache/payload cũ.`);
  }

  function saveManualRecord() {
    if (!selected?.applicationId) {
      setNotice("Hồ sơ đang chọn chưa có Application ID.");
      return;
    }
    const record: ResumeRecord = {
      id: selected.applicationId,
      applicationId: selected.applicationId,
      surname5: surname5(selected.surname),
      birthYear: birthYear(selected.birthDate),
      password: selected.passwordOverride || store.common.password,
      applicantName: displayName(selected),
      updatedAt: new Date().toISOString(),
    };
    setStore((current) => ({ ...current, records: [record, ...current.records.filter((item) => item.applicationId !== record.applicationId)] }));
    setNotice("Đã cập nhật bản ghi mở lại hồ sơ.");
  }

  function applyKeep(mode: KeepMode) {
    const record = keepPrompt;
    setKeepPrompt(null);
    if (!record) return;
    if (mode === "full") {
      setNotice("Đã giữ đầy đủ hồ sơ và bản ghi mở lại trên máy.");
      return;
    }
    setStore((current) => ({
      ...current,
      applicants: mode === "record" ? current.applicants.filter((item) => item.applicationId !== record.applicationId) : current.applicants.filter((item) => item.applicationId !== record.applicationId),
      records: mode === "none" ? current.records.filter((item) => item.applicationId !== record.applicationId) : current.records,
    }));
    setNotice(mode === "record" ? "Đã xóa dữ liệu cá nhân, chỉ giữ thông tin mở lại hồ sơ." : "Đã xóa cả hồ sơ cá nhân và bản ghi mở lại.");
  }

  function intakeDraftKeys() {
    const keys: string[] = [];
    try {
      for (let index = 0; index < window.localStorage.length; index += 1) {
        const key = window.localStorage.key(index);
        if (key?.startsWith("visa-intake:draft:")) keys.push(key);
      }
    } catch {}
    return keys;
  }

  function setDeleteScope(scope: DeleteScope, checked: boolean) {
    setDeleteSelection((current) => ({ ...current, [scope]: checked }));
  }

  function setAllDeleteScopes(checked: boolean) {
    setDeleteSelection({
      applicants: checked,
      records: checked,
      common: checked,
      payload: checked,
      intakeDrafts: checked,
    });
  }

  function deleteSelectedLocalData() {
    const labels: Record<DeleteScope, string> = {
      applicants: "Hồ sơ cá nhân",
      records: "Bản ghi mở lại",
      common: "Trường dùng chung",
      payload: "Payload KD-MID/Companion",
      intakeDrafts: "Bản nháp Form thu hồ sơ",
    };
    const selectedScopes = (Object.keys(deleteSelection) as DeleteScope[]).filter((scope) => deleteSelection[scope]);
    if (!selectedScopes.length) {
      setNotice("Hãy chọn ít nhất một nhóm dữ liệu cần xóa.");
      return;
    }

    const effectiveScopes = deleteSelection.applicants && !deleteSelection.payload
      ? [...selectedScopes, "payload" as DeleteScope]
      : selectedScopes;
    const uniqueScopes = [...new Set(effectiveScopes)];
    const names = uniqueScopes.map((scope) => labels[scope]);
    const extra = deleteSelection.applicants && !deleteSelection.payload
      ? "\n\nPayload KD-MID/Companion cũng sẽ được xóa tự động để tránh dùng nhầm hồ sơ đã xóa."
      : "";
    if (!window.confirm(`Xóa các nhóm dữ liệu sau trên máy này?\n\n• ${names.join("\n• ")}${extra}\n\nThao tác này không thể hoàn tác nếu chưa có file backup.`)) return;

    setStore((current) => {
      const applicants = deleteSelection.applicants ? [] : current.applicants;
      const records = deleteSelection.records ? [] : current.records;
      const common = deleteSelection.common ? defaultCommon : current.common;
      const selectedId = deleteSelection.applicants
        ? ""
        : applicants.some((item) => item.id === current.selectedId) ? current.selectedId : applicants[0]?.id ?? "";
      const next: Store = { ...current, applicants, records, common, selectedId };
      persistStoreSnapshot(next);
      return next;
    });

    if (deleteSelection.payload || deleteSelection.applicants) {
      try { window.localStorage.removeItem(activePayloadKey); } catch {}
      setBookmarklet("");
    }
    if (deleteSelection.intakeDrafts) {
      for (const key of intakeDraftKeys()) {
        try { window.localStorage.removeItem(key); } catch {}
      }
    }

    setDeleteSelection({ applicants: false, records: false, common: false, payload: false, intakeDrafts: false });
    setNotice(`Đã xóa: ${names.join(", ")}.`);
  }

  function exportBackup() {
    const blob = new Blob([JSON.stringify(store, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `kd-mid-visa-backup-${new Date().toISOString().slice(0,10)}.json`; a.click();
    URL.revokeObjectURL(url);
  }

  function importBackup(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result)) as Store;
        setStore({ version: 1, common: { ...defaultCommon, ...(parsed.common ?? {}) }, applicants: parsed.applicants ?? [], records: parsed.records ?? [], selectedId: parsed.selectedId ?? "" });
        setNotice("Đã nhập bản sao lưu.");
      } catch {
        setNotice("Không đọc được tệp backup JSON.");
      }
    };
    reader.readAsText(file);
  }

  function renderDashboard() {
    return <>
      <section className={styles.hero}>
        <div><span>TOOL · RUSSIA VISA</span><h2>Chuẩn bị hồ sơ KD-MID nhanh hơn, vẫn kiểm tra trước khi gửi.</h2><p>Form chính thức giữ tiếng Nga. Tool quản lý dữ liệu dùng chung, chỉ yêu cầu nhập phần khác nhau của từng người và tạo bridge tự điền cho visa.kdmid.ru.</p></div>
        <div className={styles.heroActions}><button onClick={() => { setEditing(emptyApplicant()); setRoute("applicants"); }}>+ Hồ sơ mới</button><button className={styles.secondary} onClick={() => setRoute("connect")}>Mở KD-MID chính thức</button></div>
      </section>
      <section className={styles.metrics}>
        <article><span>Hồ sơ cá nhân</span><strong>{store.applicants.length}</strong><small>{completeCount} đã có Application ID</small></article>
        <article><span>Bản ghi mở lại</span><strong>{store.records.length}</strong><small>ID · Surname5 · năm sinh · password</small></article>
        <article><span>Telex mặc định</span><strong>{store.common.telex}</strong><small>{store.common.city}</small></article>
        <article><span>Lưu trữ</span><strong>Local + D1</strong><small>Form gửi ngoài lưu tạm để xác minh; hồ sơ đã duyệt lưu vào danh sách xử lý trên máy.</small></article>
      </section>
      <section className={styles.panel}>
        <header><div><span>LUỒNG LÀM VIỆC</span><h3>4 bước</h3></div></header>
        <div className={styles.steps}>
          <article><b>01</b><strong>Tạo hồ sơ</strong><p>Nhập họ tên, hộ chiếu, liên hệ, lịch sử Nga và bảo hiểm.</p></article>
          <article><b>02</b><strong>Dùng trường chung</strong><p>Study · visa học tập · single entry · Bộ · TIN · telex · Moscow.</p></article>
          <article><b>03</b><strong>Điền trên KD-MID chính thức</strong><p>Companion mở visa.kdmid.ru, mặc định Việt Nam + tiếng Nga và điền hồ sơ trên hệ thống thật.</p></article>
          <article><b>04</b><strong>Lấy PDF chính thức</strong><p>Đến màn hình cuối, chính KD-MID tạo Application ID, barcode và bản in A4; Tool không tự chế mã.</p></article>
        </div>
      </section>
    </>;
  }

  function renderApplicants() {
    return <section className={styles.panel}>
      <header><div><span>HỒ SƠ CÁ NHÂN</span><h3>Chỉ nhập phần khác nhau</h3></div><button onClick={() => setEditing(emptyApplicant())}>+ Thêm hồ sơ</button></header>
      {!store.applicants.length ? <div className={styles.empty}>Chưa có hồ sơ. Tạo hồ sơ đầu tiên để bắt đầu.</div> : <div className={styles.table}>
        {store.applicants.map((item) => <article key={item.id} data-selected={selected?.id === item.id}>
          <button className={styles.pick} onClick={() => selectApplicant(item.id)}><strong>{displayName(item)}</strong><small>{item.passportNo || "Chưa có số hộ chiếu"} · {item.birthDate || "Chưa có ngày sinh"}</small></button>
          <span>{item.applicationId ? `ID ${item.applicationId}` : "Chưa có ID"}</span>
          <button onClick={() => setEditing({ ...item })}>Sửa</button><button className={styles.danger} onClick={() => removeApplicant(item.id)}>Xóa</button>
        </article>)}
      </div>}
      {selected ? <div className={styles.selectedBar}><span>Đang chọn</span><strong>{displayName(selected)}</strong><button onClick={() => setRoute("connect")}>Điền trên KD-MID</button></div> : null}
    </section>;
  }

  function renderIntake() {
    const pending = intakeSubmissions.filter((item) => item.status === "pending");
    const fieldLabels: Array<[string,string]> = [
      ["surname","Họ"],["givenNames","Tên + đệm"],["birthDate","Ngày sinh"],["birthPlace","Nơi sinh"],
      ["sex","Giới tính"],["passportNo","Số hộ chiếu"],["passportIssue","Ngày cấp"],["passportExpiry","Hết hạn"],
      ["phone","Điện thoại"],["email","Email"],["routeCity","Nơi đến Nga"],["workStudyPlace","Nơi làm việc/học tập"],
      ["position","Chức vụ"],["workAddress","Địa chỉ cơ quan"],["workPhone","Điện thoại cơ quan"],["workEmail","Email cơ quan"],
      ["preferredEmbassy","Nơi nộp hồ sơ"],["hadFormerRussianCitizenship","Đã có Q.tịch Nga/LX"],
      ["formerCitizenshipLostDate","Ngày mất Q.tịch Nga/LX"],["formerCitizenshipLossReason","Lý do mất Q.tịch"],
      ["visitedRussia","Đã từng đến Nga"],["visitsCount","Số lần đến Nga"],["lastVisitFrom","Chuyến Nga từ"],["lastVisitTo","Chuyến Nga đến"],
      ["hasInsurance","Có bảo hiểm Nga"],["insurancePolicy","Bảo hiểm"],["childrenUnder16","Trẻ em dưới 16 tuổi"],
      ["relativesInRussia","Người thân tại Nga"],["specialNotes","Ghi chú"]
    ];

    return <section className={styles.panel}>
      <header><div><span>FORM GỬI TỪ BÊN NGOÀI</span><h3>Thu hồ sơ → xác minh → lưu theo thứ tự</h3></div><button onClick={() => void loadIntake()} disabled={intakeLoading}>{intakeLoading ? "Đang tải…" : "Làm mới"}</button></header>
      <div className={styles.intakeCreate}>
        <div><strong>Tạo link Form tiếng Việt</strong><small>Link chỉ dùng để nhập hồ sơ; không mở được khu quản trị. Sau khi gửi, hồ sơ sẽ vào hàng chờ bên dưới.</small></div>
        <input value={intakeLabel} onChange={(e) => setIntakeLabel(e.target.value)} placeholder="Tên đợt / nhóm, ví dụ: Đợt Visa tháng 10" />
        <button onClick={() => void createIntakeLink()}>Tạo link & sao chép</button>
        {shareUrl ? <div className={styles.shareUrl}><input readOnly value={shareUrl}/><button className={styles.secondary} onClick={() => void navigator.clipboard.writeText(shareUrl)}>Sao chép</button><a href={shareUrl} target="_blank" rel="noreferrer">Mở form ↗</a></div> : null}
      </div>
      <div className={styles.intakeLinks}>
        {intakeLinks.filter((item) => item.status === "active").map((item) => {
          const url = intakePublicUrl(item);
          return <article key={item.id} data-status={item.status}>
            <div className={styles.intakeLinkMeta}><strong>{item.label}</strong><small>Tạo {new Date(item.createdAt).toLocaleString("vi-VN")} · {item.submissionCount} hồ sơ · {item.resultCount} PDF kết quả · Đang mở</small></div>
            <div className={styles.intakeLinkUrl}><input readOnly value={url}/><button className={styles.secondary} onClick={() => void navigator.clipboard.writeText(url)}>Sao chép</button><a href={url} target="_blank" rel="noreferrer">Mở form ↗</a></div>
            <button className={styles.danger} onClick={() => void closeIntakeLink(item.id)}>Đóng link</button>
          </article>;
        })}
      </div>
      <div className={styles.intakeHeader}><strong>Hàng chờ xác minh</strong><span>{pending.length} hồ sơ đang chờ · sắp theo số tiếp nhận tăng dần</span></div>
      {!intakeSubmissions.length ? <div className={styles.empty}>Chưa có hồ sơ nào gửi qua Form.</div> : <div className={styles.intakeList}>
        {intakeSubmissions.map((item) => <details key={item.id} open={item.status === "pending"} data-status={item.status}>
          <summary><b>#{item.queueNo}</b><div><strong>{item.applicantName}</strong><small>{item.passportNo} · {item.email} · {new Date(item.submittedAt).toLocaleString("vi-VN")}</small></div><span>{item.status === "pending" ? (item.revision > 0 ? "Đã sửa · chờ xác minh" : "Chờ xác minh") : item.status === "imported" ? "Đã tiếp nhận" : item.status === "approved" ? "Đã duyệt" : "Cần chỉnh sửa"}</span></summary>
          <div className={styles.intakeDetail}>
            <div className={styles.intakeFields}>
              {fieldLabels.map(([key,label]) => {
                const raw = item.applicant[key];
                const selectedForReturn = (correctionSelections[item.id] ?? []).includes(key);
                const wasReturned = item.correctionFields?.includes(key);
                const wasResubmitted = item.resubmittedFields?.includes(key);
                if ((raw === undefined || raw === null || raw === "") && !selectedForReturn && !wasReturned && !wasResubmitted) return null;
                const display = typeof raw === "boolean" ? (raw ? "Có" : "Không") : String(raw || "—");
                return <button
                  type="button"
                  key={key}
                  className={styles.intakeField}
                  data-selected={selectedForReturn || (item.status === "rejected" && wasReturned)}
                  data-resubmitted={item.status === "pending" && wasResubmitted && !selectedForReturn}
                  disabled={item.status !== "pending"}
                  onClick={() => toggleCorrectionField(item.id, key)}
                  title={item.status === "pending" ? (wasResubmitted ? "Ô này đã được người gửi sửa. Click nếu vẫn sai để chuyển lại màu đỏ." : "Click để đánh dấu ô này cần sửa") : undefined}
                ><span>{label}</span><strong>{display}</strong>{item.status === "pending" && wasResubmitted && !selectedForReturn ? <small>ĐÃ SỬA</small> : null}</button>;
              })}
            </div>
            {item.status === "pending" ? <div className={styles.intakeReviewBox}>
              <small>{item.revision > 0 ? "Ô xanh = người gửi đã sửa. Nếu vẫn sai, click ô xanh để chuyển đỏ và trả lại; nếu đúng, bấm Xác minh & lưu hồ sơ." : "Muốn trả hồ sơ: click trực tiếp vào từng ô sai phía trên. Ô được chọn sẽ chuyển đỏ."}</small>
              <div className={styles.intakeActions}><button onClick={() => void verifyAndImport(item)}>✓ Xác minh & lưu hồ sơ</button><button className={styles.danger} disabled={!(correctionSelections[item.id]?.length)} onClick={() => void rejectIntake(item)}>Trả lại · {correctionSelections[item.id]?.length ?? 0} ô cần sửa</button><button className={styles.danger} onClick={() => void deleteIntakeSubmission(item)}>Xóa khỏi hàng chờ</button></div>
            </div> : null}
            {item.status === "rejected" ? <div className={styles.returnedInfo}><strong>Đã trả về để sửa</strong><span>{item.reviewNote || "Không có ghi chú thêm."}</span><small>{item.correctionFields?.length ?? 0} ô đã được đánh dấu sai.</small><button className={styles.danger} onClick={() => void deleteIntakeSubmission(item)}>Xóa khỏi hàng chờ</button></div> : null}
            {["approved", "imported"].includes(item.status) ? <div className={styles.resultSendBox}>
              <div><strong>Kết quả PDF cho người khai</strong><small>{item.result ? `Đã gửi ${item.result.fileName} · ${Math.ceil(item.result.fileSize / 1024)} KB · ${new Date(item.result.uploadedAt).toLocaleString("vi-VN")}` : "Chưa gửi PDF kết quả."}</small></div>
              <div className={styles.intakeActions}><label className={styles.resultFileButton}>{resultUploadingId === item.id ? "Đang gửi…" : item.result ? "Thay PDF kết quả" : "Gửi PDF kết quả"}<input type="file" accept="application/pdf,.pdf" disabled={resultUploadingId === item.id} onChange={(event) => { const file = event.target.files?.[0] ?? null; event.currentTarget.value = ""; void uploadIntakeResult(item, file); }} /></label><button className={styles.danger} onClick={() => void deleteIntakeSubmission(item)}>Xóa khỏi hàng chờ</button></div>
            </div> : null}
          </div>
        </details>)}
      </div>}
    </section>;
  }

  function renderCommon() {
    const c = store.common;
    return <section className={styles.panel}>
      <header><div><span>TRƯỜNG DÙNG CHUNG</span><h3>Dữ liệu giống nhau từ hai mẫu</h3></div></header>
      <div className={styles.formGrid}>
        <Field label="Password mặc định" hint="Có thể ghi đè riêng từng hồ sơ."><TextInput value={c.password} onChange={(v) => mutateCommon("password", v)} /></Field>
        <Field label="Гражданство · Quốc tịch"><TextInput value={c.citizenship} onChange={(v) => mutateCommon("citizenship", v)} /></Field>
        <Field label="Цель поездки · Mục đích"><TextInput value={c.purpose} onChange={(v) => mutateCommon("purpose", v)} /></Field>
        <Field label="Категория и вид визы"><TextInput value={c.visaType} onChange={(v) => mutateCommon("visaType", v)} /></Field>
        <Field label="Кратность визы"><TextInput value={c.entries} onChange={(v) => mutateCommon("entries", v)} /></Field>
        <Field label="Ngày vào Nga · dd/mm/yyyy"><DateTextInput value={c.entryDate} onChange={(v) => mutateCommon("entryDate", v)} /></Field>
        <Field label="Ngày ra Nga · dd/mm/yyyy"><DateTextInput value={c.exitDate} onChange={(v) => mutateCommon("exitDate", v)} /></Field>
        <Field label="Наименование организации"><TextInput value={c.organization} onChange={(v) => mutateCommon("organization", v)} /></Field>
        <Field label="Адрес организации"><TextInput value={c.organizationAddress} onChange={(v) => mutateCommon("organizationAddress", v)} /></Field>
        <Field label="ИНН"><TextInput value={c.tin} onChange={(v) => mutateCommon("tin", v)} /></Field>
        <Field label="Номер указания (телекса)"><TextInput value={c.telex} onChange={(v) => mutateCommon("telex", v)} /></Field>
        <Field label="Номер приглашения" hint="Để trống nếu giấy ghi НЕТ."><TextInput value={c.invitation} onChange={(v) => mutateCommon("invitation", v)} /></Field>
        <Field label="Маршрут mặc định · Населенный пункт" hint="Hồ sơ cá nhân có thể ghi đè giá trị này."><TextInput value={c.city} onChange={(v) => mutateCommon("city", v)} /></Field>
        <Field label="Nơi nộp hồ sơ · Получатель анкеты" hint="Chọn đúng cơ quan tiếp nhận; Tool sẽ điền lựa chọn này trên visa.kdmid.ru."><select value={c.embassy} onChange={(event) => mutateCommon("embassy", event.target.value)}>{visaConsulates.map((item) => <option key={item.value} value={item.value}>{item.label} · {item.value}</option>)}</select></Field>
        <Field label="Nơi làm việc / học tập"><TextInput value={c.employer} onChange={(v) => mutateCommon("employer", v)} /></Field>
        <Field label="Địa chỉ cơ quan"><TextInput value={c.employerAddress} onChange={(v) => mutateCommon("employerAddress", v)} /></Field>
        <Field label="Email cơ quan"><TextInput value={c.employerEmail} onChange={(v) => mutateCommon("employerEmail", v)} /></Field>
        <Field label="Chức danh mặc định"><TextInput value={c.defaultPosition} onChange={(v) => mutateCommon("defaultPosition", v)} /></Field>
        <Field label="Адрес вашего постоянного проживания · Địa chỉ thường trú" hint="Cố định cho mọi hồ sơ."><input value={fixedPermanentAddress} readOnly /></Field>
        <Field label="Рабочий телефон · Điện thoại cơ quan" hint="Cố định cho mọi hồ sơ."><input value={fixedWorkPhone} readOnly /></Field>
      </div>
    </section>;
  }

  function renderRecords() {
    return <section className={styles.panel}>
      <header><div><span>BẢN GHI MỞ LẠI</span><h3>Mở lại hồ sơ KD-MID đã lưu để xem / chỉnh sửa</h3></div>{selected?.applicationId ? <button onClick={saveManualRecord}>Cập nhật từ hồ sơ đang chọn</button> : null}</header>
      {!store.records.length ? <div className={styles.empty}>Chưa có bản ghi. Khi bridge phát hiện Application ID, tool sẽ tự lưu.</div> : <div className={styles.records}>
        {store.records.map((record) => <article key={record.applicationId}><div><span>Application ID</span><strong>{record.applicationId}</strong></div><div><span>5 chữ đầu Surname</span><strong>{record.surname5}</strong></div><div><span>Năm sinh</span><strong>{record.birthYear}</strong></div><div><span>Password</span><strong>{record.password}</strong></div><div><span>Hồ sơ</span><strong>{record.applicantName || "—"}</strong></div><button className={styles.recordOpen} onClick={() => openResumeRecord(record)}>Mở lại / sửa ↗</button></article>)}
      </div>}
    </section>;
  }

  function renderConnect() {
    return <section className={styles.panel}>
      <header><div><span>KẾT NỐI KD-MID</span><h3>Tự động điền visa.kdmid.ru</h3></div><button onClick={() => void prepareBridge()} disabled={!selected}>Tạo bookmarklet dự phòng</button></header>
      <div className={styles.autoConnect}>
        <div><span>KHUYÊN DÙNG</span><h4>Tự động từ trang đầu đến PDF A4 chính thức</h4><p>Mỗi lần bấm chạy, Companion nhận lại <strong>hồ sơ mới nhất vừa lưu</strong> và mở <strong>một tab KD-MID mới</strong> để loại bỏ payload cũ, rồi tự chọn <strong>Việt Nam</strong> + <strong>Русский</strong> + tích <strong>“Я прочитал эту информацию”</strong>, tự mở hồ sơ mới, điền mật khẩu mặc định và <strong>dừng ở CAPTCHA để bạn tự nhập ký tự trong ảnh</strong>. Sau khi bạn nhập CAPTCHA, Companion tiếp tục tự động, ghi nhớ Application ID, điền các trang còn lại và cuối cùng bấm <strong>Печать формата A4</strong>.</p></div>
        <div className={styles.autoActions}><a className={styles.installLink} href="/kd-mid-visa-companion.user.js" target="_blank" rel="noreferrer">1. Cài / cập nhật Companion v0.9.31 ↗</a><span className={styles.companionState} data-ready={Boolean(companionVersion)}>{companionVersion ? `✓ Companion ${companionVersion} đang hoạt động trên App-Manager` : "Companion v0.9.31 sẽ tự kiểm tra khi mở KD-MID"}</span><button onClick={openAutomaticKdmid} disabled={!selected}>3. Bắt đầu tự động đến PDF</button></div>
        <div className={styles.profileChooser}>
          <div><span>BƯỚC 2</span><strong>Chọn hồ sơ sử dụng</strong><small>Danh sách lấy trực tiếp từ mục Hồ sơ cá nhân đã lưu trên máy này.</small></div>
          {store.applicants.length ? <div className={styles.profileChooserControl}>
            <select value={selected?.id ?? ""} onChange={(event) => selectApplicant(event.target.value)}>
              {store.applicants.map((item) => <option key={item.id} value={item.id}>{displayName(item)}{item.passportNo ? ` · ${item.passportNo}` : ""}</option>)}
            </select>
            {selected ? <button className={styles.secondary} onClick={() => setEditing({ ...selected })}>Sửa hồ sơ</button> : null}
          </div> : <div className={styles.profileChooserEmpty}><span>Chưa có hồ sơ nào.</span><button onClick={() => { setEditing(emptyApplicant()); setRoute("applicants"); }}>+ Tạo hồ sơ</button></div>}
          {selected ? <div className={styles.profileSummary}><span>Payload sẽ gửi</span><strong>{selected.surname} | {selected.givenNames}</strong><small>Ngày sinh {normalizeDmy(selected.birthDate) || "—"} · {selected.passportNo || "Chưa có số hộ chiếu"}</small></div> : null}
        </div>
        <label className={styles.autoToggle}><input type="checkbox" checked={autoAdvance} onChange={(event) => setAutoAdvance(event.target.checked)} /><span><strong>Tự động toàn bộ sau CAPTCHA</strong><small>Bật mặc định. Companion không giải CAPTCHA: Tool điền password rồi chờ bạn nhập ký tự trong ảnh. Khi CAPTCHA đã được nhập, Tool tự tiếp tục các trang và yêu cầu KD-MID xuất PDF A4 chính thức.</small></span></label>
      </div>
      <div className={styles.connectGrid}>
        <article><b>1</b><strong>Cài Companion v0.9.31</strong><p>Tampermonkey/Violentmonkey phải báo script <strong>Enabled</strong>. Nếu đã cài bản cũ, mở lại nút cài để cập nhật lên v0.9.31.</p></article>
        <article><b>2</b><strong>Chọn hồ sơ ngay phía trên</strong><p>{selected ? `Đang chọn: ${displayName(selected)}.` : "Chưa chọn hồ sơ."} Nếu có nhiều hồ sơ, mở danh sách và chọn đúng người trước khi chạy.</p></article>
        <article><b>3</b><strong>Password tự điền · CAPTCHA nhập tay</strong><p>Companion tự điền cả <strong>Пароль</strong> và <strong>Подтверждение пароля</strong>. CAPTCHA không được tự giải; bạn nhập ký tự trong ảnh. Sau khi nhập xong, Companion tự bấm <strong>Отправить</strong>.</p></article>
        <article><b>4</b><strong>Lưu ID rồi tiếp tục tự động</strong><p>Ở trang xác nhận <strong>Идентификационный номер Вашей анкеты</strong>, Companion lưu ID vào hồ sơ/Bản ghi mở lại, tự bấm <strong>Далее</strong>, rồi tiếp tục các trang còn lại đến <strong>Печать формата A4</strong>.</p></article>
      </div>
      <div className={styles.bridgeBox}>
        <div><strong>Phương án dự phòng: Bookmarklet</strong><small>Dùng khi không muốn cài userscript. Cần bấm bookmarklet trên từng trang KD-MID.</small></div>
        <textarea readOnly value={bookmarklet} placeholder="Bấm “Tạo bookmarklet dự phòng” để tạo javascript:..." />
        <div className={styles.bridgeActions}><button onClick={async () => { if (!bookmarklet) return; await navigator.clipboard.writeText(bookmarklet); setNotice("Đã sao chép bookmarklet."); }} disabled={!bookmarklet}>Sao chép bookmarklet</button><button className={styles.secondary} onClick={openKdmid}>Mở KD-MID thủ công ↗</button></div>
      </div>
      <div className={styles.warning}><strong>Kiểm tra trước khi chạy</strong><p>Với v0.9.31, dòng trạng thái trên App-Manager chỉ là thông tin phụ. Luồng chính được kiểm tra trực tiếp khi tab <strong>visa.kdmid.ru</strong> mở: nếu Companion nhận hồ sơ, đoạn <code>#kdmidv8=...</code> sẽ tự biến mất và hộp trạng thái KD-MID Visa VN xuất hiện ở góc dưới. Tool không tự đọc/giải CAPTCHA; sau khi bạn nhập CAPTCHA, Companion tiếp tục và PDF/barcode do chính <strong>visa.kdmid.ru</strong> tạo. <strong>Barcode chỉ hợp lệ khi do KD-MID tạo.</strong></p></div>
    </section>;
  }

  function renderBackup() {
    return <section className={styles.panel}>
      <header><div><span>SAO LƯU</span><h3>Backup cục bộ</h3></div></header>
      <div className={styles.backupGrid}>
        <article><strong>Xuất JSON</strong><p>Tệp có thể chứa thông tin hộ chiếu và password. Chỉ lưu ở nơi an toàn.</p><button onClick={exportBackup}>Tải bản sao lưu</button></article>
        <article><strong>Nhập JSON</strong><p>Khôi phục hồ sơ, trường dùng chung và bản ghi mở lại.</p><label className={styles.fileButton}>Chọn tệp<input type="file" accept="application/json,.json" onChange={(event) => { const file = event.target.files?.[0]; if (file) importBackup(file); }} /></label></article>
        <article className={styles.deleteCard}>
          <strong>Xóa dữ liệu có chọn lọc</strong>
          <p>Chỉ xóa đúng nhóm bạn chọn trên máy hiện tại. Dữ liệu không được chọn vẫn giữ nguyên.</p>
          <div className={styles.deleteToolbar}>
            <button className={styles.secondary} type="button" onClick={() => setAllDeleteScopes(true)}>Chọn tất cả</button>
            <button className={styles.secondary} type="button" onClick={() => setAllDeleteScopes(false)}>Bỏ chọn</button>
          </div>
          <div className={styles.deleteChoices}>
            <label><input type="checkbox" checked={deleteSelection.applicants} onChange={(event) => setDeleteScope("applicants", event.target.checked)} /><span><strong>Hồ sơ cá nhân</strong><small>{store.applicants.length} hồ sơ · xóa mục này cũng tự xóa payload đang hoạt động</small></span></label>
            <label><input type="checkbox" checked={deleteSelection.records} onChange={(event) => setDeleteScope("records", event.target.checked)} /><span><strong>Bản ghi mở lại</strong><small>{store.records.length} bản ghi Application ID</small></span></label>
            <label><input type="checkbox" checked={deleteSelection.common} onChange={(event) => setDeleteScope("common", event.target.checked)} /><span><strong>Trường dùng chung</strong><small>Đưa cấu hình chung về mặc định ban đầu</small></span></label>
            <label><input type="checkbox" checked={deleteSelection.payload} onChange={(event) => setDeleteScope("payload", event.target.checked)} /><span><strong>Payload KD-MID / Companion</strong><small>Xóa dữ liệu tạm đang chờ tự điền trên KD-MID</small></span></label>
            <label><input type="checkbox" checked={deleteSelection.intakeDrafts} onChange={(event) => setDeleteScope("intakeDrafts", event.target.checked)} /><span><strong>Bản nháp Form thu hồ sơ</strong><small>Xóa các bản nháp visa-intake đã lưu trong trình duyệt này</small></span></label>
          </div>
          <button className={styles.danger} disabled={!Object.values(deleteSelection).some(Boolean)} onClick={deleteSelectedLocalData}>Xóa dữ liệu đã chọn</button>
        </article>
      </div>
    </section>;
  }

  return <main className={styles.shell}>
    <aside className={styles.sidebar}>
      <Link href="/?view=applications" className={styles.back}>← Application Management</Link>
      <div className={styles.brand}><span>KV</span><div><strong>KD-MID Visa VN</strong><small>Form Nga · hướng dẫn Việt</small></div></div>
      <nav>
        {([["dashboard","Tổng quan"],["applicants","Hồ sơ cá nhân"],["intake","Form thu hồ sơ"],["common","Trường dùng chung"],["connect","Kết nối KD-MID"],["records","Bản ghi mở lại"],["backup","Sao lưu dữ liệu"]] as Array<[Route,string]>).map(([id,label]) => <button key={id} data-active={route === id} onClick={() => setRoute(id)}>{label}</button>)}
      </nav>
      <div className={styles.privacy}><strong>● Local-first + Intake D1</strong><small>Hồ sơ tự tạo vẫn lưu trên máy. Hồ sơ gửi qua Form được lưu tạm trên D1 để xác minh trước khi nhập vào danh sách xử lý.</small></div>
      <div className={styles.user}><span>{user.displayName.slice(0,1).toUpperCase()}</span><div><strong>{user.displayName}</strong><small>{user.email}</small></div></div>
    </aside>

    <section className={styles.main}>
      <header className={styles.topbar}><div><span>APPLICATION MANAGEMENT · TOOL</span><h1>{route === "dashboard" ? "Tổng quan" : route === "applicants" ? "Hồ sơ cá nhân" : route === "intake" ? "Form thu hồ sơ" : route === "common" ? "Trường dùng chung" : route === "connect" ? "Kết nối KD-MID" : route === "records" ? "Bản ghi mở lại" : "Sao lưu dữ liệu"}</h1></div><div><button className={styles.secondary} onClick={() => setRoute("connect")}>Mở KD-MID chính thức</button><button onClick={() => setEditing(emptyApplicant())}>+ Hồ sơ mới</button></div></header>
      {notice ? <div className={styles.notice}>{notice}<button onClick={() => setNotice("")}>×</button></div> : null}
      <div className={styles.content}>{route === "dashboard" ? renderDashboard() : route === "applicants" ? renderApplicants() : route === "intake" ? renderIntake() : route === "common" ? renderCommon() : route === "connect" ? renderConnect() : route === "records" ? renderRecords() : renderBackup()}</div>
    </section>

    {editing ? <div className={styles.modalBackdrop} onMouseDown={(event) => { if (event.currentTarget === event.target) setEditing(null); }}><section className={styles.modal}>
      <header><div><span>HỒ SƠ CÁ NHÂN</span><h2>{displayName(editing)}</h2></div><button onClick={() => setEditing(null)}>×</button></header>
      <div className={styles.modalBody}>
        <div className={styles.formGrid}>
          <Field label="Фамилия · Surname" hint="Họ đúng như hộ chiếu; không nhập tên vào ô này."><TextInput value={editing.surname} onChange={(v) => setEditing({ ...editing, surname: v.toUpperCase() })} /></Field>
          <Field label="Имя, другие имена · Given/Middle names" hint="Tên + tên đệm đúng như hộ chiếu."><TextInput value={editing.givenNames} onChange={(v) => setEditing({ ...editing, givenNames: v.toUpperCase() })} /></Field>
          <Field label="Дата рождения · dd/mm/yyyy" hint="Ví dụ 03/03/1991; Tool tự chuẩn hóa ngày/tháng và chọn đúng tháng tiếng Nga trên KD-MID."><DateTextInput value={editing.birthDate} onChange={(v) => setEditing({ ...editing, birthDate: v })} placeholder="03/03/1991" /></Field>
          <Field label="Место рождения · Nơi sinh"><TextInput value={editing.birthPlace} onChange={(v) => setEditing({ ...editing, birthPlace: v })} /></Field>
          <Field label="Пол · Giới tính"><select value={editing.sex} onChange={(e) => setEditing({ ...editing, sex: e.target.value })}><option>МУЖСКОЙ</option><option>ЖЕНСКИЙ</option></select></Field>
          <Field label="Маршрут (населенные пункты) · Nơi đến tại Nga" hint={`Mặc định: ${store.common.city}`}><TextInput value={editing.routeCity || store.common.city} onChange={(v) => setEditing({ ...editing, routeCity: v.toUpperCase() })} /></Field>
          <Field label="Nơi nộp hồ sơ · Место подачи заявления"><select value={editing.preferredEmbassy || store.common.embassy} onChange={(e) => setEditing({ ...editing, preferredEmbassy: e.target.value })}>{visaConsulates.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></Field>
          <Field label="Если Вы имели гражданство СССР или России... · Đã từng có quốc tịch Liên Xô/Nga?"><select value={editing.hadFormerRussianCitizenship ? "ДА" : "НЕТ"} onChange={(e) => setEditing({ ...editing, hadFormerRussianCitizenship: e.target.value === "ДА" })}><option value="НЕТ">НЕТ · Không</option><option value="ДА">ДА · Có</option></select></Field>
          <Field label="Номер паспорта"><TextInput value={editing.passportNo} onChange={(v) => setEditing({ ...editing, passportNo: v.toUpperCase() })} /></Field>
          <Field label="Дата выдачи паспорта · dd/mm/yyyy" hint="Nhập dạng 25/06/2025. Companion sẽ đổi 06 thành Июнь trên KD-MID."><DateTextInput value={editing.passportIssue} onChange={(v) => setEditing({ ...editing, passportIssue: v })} placeholder="25/06/2025" /></Field>
          <Field label="Паспорт действителен до · dd/mm/yyyy" hint="Nhập dạng 25/06/2035. Companion sẽ kiểm tra đủ ngày · tháng Nga · năm trước khi bấm Далее."><DateTextInput value={editing.passportExpiry} onChange={(v) => setEditing({ ...editing, passportExpiry: v })} placeholder="25/06/2035" /></Field>
          <Field label="Адрес вашего постоянного проживания · Địa chỉ thường trú" hint="Cố định cho mọi hồ sơ."><input value={fixedPermanentAddress} readOnly /></Field>
          <Field label="Điện thoại cá nhân" hint="Không có thì để trống."><TextInput value={editing.phone} onChange={(v) => setEditing({ ...editing, phone: v })} /></Field>
          <Field label="Email cá nhân" hint="Không có thì để trống."><TextInput value={editing.email} onChange={(v) => setEditing({ ...editing, email: v })} /></Field>
          <Field label="Место работы (учебы) · Nơi làm việc / học tập" hint={`Mặc định: ${store.common.employer}`}><TextInput value={editing.workStudyPlace} onChange={(v) => setEditing({ ...editing, workStudyPlace: v })} /></Field>
          <Field label="Должность · Chức danh" hint={`Mặc định: ${store.common.defaultPosition}`}><TextInput value={editing.position} onChange={(v) => setEditing({ ...editing, position: v })} /></Field>
          <Field label="Рабочий адрес · Địa chỉ cơ quan" hint={`Mặc định: ${store.common.employerAddress}`}><TextInput value={editing.workAddress} onChange={(v) => setEditing({ ...editing, workAddress: v })} /></Field>
          <Field label="Рабочий телефон · Điện thoại cơ quan" hint={`Mặc định: ${fixedWorkPhone}`}><TextInput value={editing.workPhone} onChange={(v) => setEditing({ ...editing, workPhone: v })} /></Field>
          <Field label="Рабочий E-mail · Email cơ quan" hint={`Mặc định: ${store.common.employerEmail}`}><TextInput value={editing.workEmail} onChange={(v) => setEditing({ ...editing, workEmail: v })} /></Field>
          <Field label="Password riêng" hint={`Để trống = dùng ${store.common.password}`}><TextInput value={editing.passwordOverride} onChange={(v) => setEditing({ ...editing, passwordOverride: v })} /></Field>
          <Field label="Application ID" hint="Bridge sẽ tự ghi khi nhận diện được."><TextInput value={editing.applicationId} onChange={(v) => setEditing({ ...editing, applicationId: v.replace(/\D/g, "") })} /></Field>
          <Field label="Ghi chú hồ sơ" hint="Dùng cho trường hợp đặc biệt cần kiểm tra thủ công."><TextInput value={editing.specialNotes || ""} onChange={(v) => setEditing({ ...editing, specialNotes: v })} /></Field>
        </div>
        {editing.hadFormerRussianCitizenship ? <div className={styles.formGrid}>
          <Field label="Когда? · Mất quốc tịch khi nào?" hint="dd/mm/yyyy"><DateTextInput value={editing.formerCitizenshipLostDate} onChange={(v) => setEditing({ ...editing, formerCitizenshipLostDate: v })} /></Field>
          <Field label="В связи с чем? · Lý do mất quốc tịch"><TextInput value={editing.formerCitizenshipLossReason} onChange={(v) => setEditing({ ...editing, formerCitizenshipLossReason: v })} /></Field>
        </div> : null}
        <div className={styles.toggleRow}>
          <label><input type="checkbox" checked={editing.visitedRussia} onChange={(e) => setEditing({ ...editing, visitedRussia: e.target.checked })} /> Đã từng đến Nga</label>
          <label><input type="checkbox" checked={editing.hasInsurance} onChange={(e) => setEditing({ ...editing, hasInsurance: e.target.checked })} /> Có bảo hiểm hiệu lực tại Nga</label>
          <label><input type="checkbox" checked={editing.childrenUnder16} onChange={(e) => setEditing({ ...editing, childrenUnder16: e.target.checked })} /> Có trẻ em dưới 16 tuổi đi cùng / ghi trong hộ chiếu</label>
          <label><input type="checkbox" checked={editing.relativesInRussia} onChange={(e) => setEditing({ ...editing, relativesInRussia: e.target.checked })} /> Có người thân hiện đang ở Nga</label>
        </div>
        {editing.visitedRussia ? <div className={styles.formGrid}><Field label="Số lần đến Nga"><TextInput value={editing.visitsCount} onChange={(v) => setEditing({ ...editing, visitsCount: v })} /></Field><Field label="Chuyến gần nhất · từ"><DateTextInput value={editing.lastVisitFrom} onChange={(v) => setEditing({ ...editing, lastVisitFrom: v })} /></Field><Field label="Chuyến gần nhất · đến"><DateTextInput value={editing.lastVisitTo} onChange={(v) => setEditing({ ...editing, lastVisitTo: v })} /></Field></div> : null}
        {editing.hasInsurance ? <div className={styles.formGrid}><Field label="Tên công ty / số policy"><TextInput value={editing.insurancePolicy} onChange={(v) => setEditing({ ...editing, insurancePolicy: v })} /></Field></div> : null}
        <div className={styles.resumePreview}><span>Bản ghi mở lại sẽ là</span><strong>{editing.applicationId || "Application ID"} · {surname5(editing.surname) || "SURNA"} · {birthYear(editing.birthDate) || "YYYY"} · {editing.passwordOverride || store.common.password}</strong></div>
      </div>
      <footer><button className={styles.secondary} onClick={() => setEditing(null)}>Hủy</button><button onClick={() => saveApplicant(editing)}>Lưu hồ sơ</button></footer>
    </section></div> : null}

    {keepPrompt ? <div className={styles.modalBackdrop}><section className={styles.keepCard}><span>HỒ SƠ ĐÃ HOÀN TẤT</span><h2>Giữ lại thông tin nào?</h2><p>Application ID <strong>{keepPrompt.applicationId}</strong> đã được nhận từ KD-MID.</p><div><button onClick={() => applyKeep("full")}>Lưu đầy đủ</button><button className={styles.secondary} onClick={() => applyKeep("record")}>Chỉ giữ bản ghi mở lại</button><button className={styles.danger} onClick={() => applyKeep("none")}>Không lưu</button></div></section></div> : null}
  </main>;
}
