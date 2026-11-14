"use client";

/* Ảnh chuyển khoản được lấy qua endpoint bảo vệ và URL blob cục bộ. */
/* Architecture invariant: Quyền QT và audit Trung tâm nằm ở Application Management.\n   This is enforced by existing APIs; the redundant visible sidebar disclaimer was removed. */
/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {createPortal} from "react-dom";
import AuthenticatorStepUp from "../../authenticator-step-up";
import AccountExpiryPanel from "./account-expiry-panel";
import bindingUi from "./owner-binding-bulk.module.css";
import BoiOwnerOverview from "./boi-owner-overview";
import {useBoiSyncNotices,broadcastBoiChange} from "./manual-sync-notices";
import AiControlCenter, { type AiControlData } from "../../ai-control-center";
import { csvCell } from "../../report-exports";
import { parseBoiDeviceRegistry, type BoiDeviceRegistry } from "../../boi-device-registry";

type ControlRole = "viewer" | "reviewer" | "publisher" | "owner";
type DeviceStatus = "pending" | "approved" | "blocked";
type OwnerBindingDetail = {
  contract:"boi-owner-device-binding.v1";verified:true;
  bindingId:string;status:DeviceStatus;createdAt:string;purgeAllowed:boolean;
  account:{accountId:string;name:string|null;login:string|null;role:string|null;
    status:string;onboardingStage:string|null;createdAt:string;revision:number};
  dependencies:{sessions:number;activeSessions:number;syncGrants:number;syncEvents:number;otherTrustedDevices:number};
  preservesAccount:true;preservesLearning:true;preservesAudit:true;
};

type Credential = { version: 1; privateKey: CryptoKey | null; publicKey: JsonWebKey };
type ActivityDay = { date: string; loginCount: number; studyMinutes: number; quizAttempts: number; progressPercent: number };
type AccessAutomation = {
  enabled: boolean;
  defaultAccessDays: number;
  defaultDeviceLimit: number;
  activeAutoFreeDeviceCount: number;
  remainingAutoFreeDeviceSlots: number;
  updatedBy: string | null;
  updatedAt: string | null;
};
type Access = {
  deviceId: string;
  deviceCode: string;
  email: string;
  displayName: string;
  status: DeviceStatus;
  role: ControlRole;
  label: string | null;
  owner: boolean;
};
type LearningDevice = {
  deviceId: string;
  deviceCode: string;
  status: DeviceStatus;
  label: string | null;
  learnerName: string | null;
  learnerFamilyName: string | null;
  learnerGivenName: string | null;
  personRole: "learner" | "manager" | "teacher" | null;
  managementConfigured?: boolean;
  managementEnabled?: boolean;
  personCode: string | null;
  className: string | null;
  phone: string | null;
  registrationComplete: boolean;
  accessGroup: "unassigned" | "free" | "paid";
  paymentStatus: "unassigned" | "awaiting_payment" | "proof_submitted" | "free_approved" | "paid_verified";
  paymentAmount: number;
  paymentProofAvailable: boolean;
  paymentSubmittedAt: string | null;
  paymentVerifiedAt: string | null;
  paymentRejectedAt: string | null;
  paymentReviewNote: string | null;
  accessExpiresAt: string | null;
  accessExpired: boolean;
  accessExpiringSoon: boolean;
  accessDaysRemaining: number | null;
  personalEditEnabled: boolean;
  personalEditConfigured: boolean;
  autoConfirmedAt: string | null;
  createdAt: string;
  approvedAt: string | null;
  blockedAt: string | null;
  lastSeenAt: string;
  lastActivityAt: string;
  lastPresenceAt: string;
  offlineSinceAt: string | null;
  lastLearningActivityAt: string | null;
  active: boolean;
  completedLessons: number;
  completedSteps: number;
  completionPercent: number;
  masteryPercent: number;
  attempts: number;
  totalActiveSeconds: number;
  lastLesson: string | null;
  lastPart: string | null;
  scores: Record<string, number>;
  activityTimeline: ActivityDay[];
};
type DeletedLearningDevice = {
  deviceId: string;
  deviceCode: string;
  reason: "spam" | "duplicate" | "test" | "other";
  learnerName: string | null;
  deletedBy: string;
  deletedAt: string;
};
type BoiBridge = { baseUrl: string; token: string; expiresAt: number };
type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };
type AdminAppearance = {
  theme: "classic" | "soft" | "contrast";
  font: "classic" | "modern" | "readable";
  textSize: "normal" | "large" | "xlarge";
};

const defaultAdminAppearance: AdminAppearance = { theme: "classic", font: "classic", textSize: "normal" };

const adminThemes: { id: AdminAppearance["theme"]; name: string; paper: string; panel: string; ink: string; muted: string }[] = [
  { id: "classic", name: "Cổ điển", paper: "#f2eee5", panel: "#fffdf8", ink: "#182421", muted: "#64716c" },
  { id: "soft", name: "Xanh dịu", paper: "#eaf4f1", panel: "#fbfffd", ink: "#17352f", muted: "#58716a" },
  { id: "contrast", name: "Tương phản", paper: "#f4f6f7", panel: "#ffffff", ink: "#101820", muted: "#40515a" },
];

const adminFonts: { id: AdminAppearance["font"]; name: string; ui: string; heading: string; sample: string }[] = [
  { id: "classic", name: "Hiện đại & cổ điển", ui: "'Segoe UI', 'Noto Sans', Arial, sans-serif", heading: "'Noto Serif', 'Times New Roman', Georgia, serif", sample: "Tiêu đề trang trọng, nội dung rõ ràng" },
  { id: "modern", name: "Hiện đại", ui: "'Segoe UI', 'Noto Sans', Arial, sans-serif", heading: "'Segoe UI', 'Noto Sans', Arial, sans-serif", sample: "Đồng nhất và gọn trên màn hình" },
  { id: "readable", name: "Dễ đọc", ui: "Verdana, 'Noto Sans', Arial, sans-serif", heading: "Verdana, 'Noto Sans', Arial, sans-serif", sample: "Chữ thoáng, hỗ trợ tiếng Việt đầy đủ" },
];

type Dashboard = {
  actor: Access;
  application: { id: string; name: string; lessonCount: number };
  learningDevices: LearningDevice[];
  upstreamError: string | null;
  boiBridge: BoiBridge;
  automation?: AccessAutomation;
  deletedDevices?: DeletedLearningDevice[];
  deviceRegistry?: BoiDeviceRegistry;
};
type ApiData = Partial<Dashboard> & {
  ok?:boolean;verified?:boolean;deleted?:boolean;bindingId?:string;
  detail?:OwnerBindingDetail;applied?:boolean;
  device?: Access;
  challenge?: string;
  error?: string;
  code?: string;
  devices?: LearningDevice[];
  validationErrors?: string[];
  versions?: ContentVersion[];
  versionId?: string;
  currentSection?: unknown;
  proposedSection?: unknown;
  editScope?: EditScopeInfo;
  boiBridge?: BoiBridge;
  automation?: AccessAutomation;
  deletedDeviceId?: string;
  deletedDeviceCode?: string;
  restoredDeviceId?: string;
};
type ContentVersion = {
  id: string;
  version_number: number;
  status: "permission_requested" | "draft" | "review" | "published" | "changes_requested" | "denied" | "cancelled" | "archived";
  summary: string | null;
  created_by: string;
  editor_device_code?: string | null;
  edit_scope?: string | null;
  edit_lesson?: string | null;
  edit_section?: EditSection | "lesson" | null;
  edit_scope_label?: string | null;
  permission_note?: string | null;
  permission_reviewed_by?: string | null;
  permission_reviewed_at?: string | null;
  submitted_at: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};
type EditSection = "content" | "practice" | "analysis" | "review" | "quiz";
type EditScopeInfo = {
  lessonNumber: string;
  section: EditSection | "lesson";
  sectionLabel: string;
  label: string;
  value: string;
};

const editSectionLabels: Record<EditSection, string> = {
  content: "Nội dung",
  practice: "Thực hành",
  analysis: "Phân tích",
  review: "Ôn tập",
  quiz: "Kiểm tra",
};

function contentScope(version: ContentVersion | null): EditScopeInfo {
  const fallbackLesson = version?.edit_lesson ?? version?.edit_scope?.split(":")[0] ?? "—";
  const fallbackSection = version?.edit_section ?? version?.edit_scope?.split(":")[1] as EditSection | undefined;
  const section = fallbackSection && Object.hasOwn(editSectionLabels, fallbackSection) ? fallbackSection : "lesson";
  const sectionLabel = section === "lesson" ? "Toàn bài · yêu cầu cũ" : editSectionLabels[section];
  return {
    lessonNumber: fallbackLesson,
    section,
    sectionLabel,
    label: version?.edit_scope_label ?? `Bài ${fallbackLesson} · ${sectionLabel}`,
    value: version?.edit_scope ?? fallbackLesson,
  };
}

class ApiError extends Error {
  data: ApiData;
  constructor(message: string, data: ApiData) { super(message); this.data = data; }
}

function base64Url(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function openDb() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open("learning-control-device", 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains("credential")) request.result.createObjectStore("credential");
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function readCredential() {
  const db = await openDb();
  return new Promise<Credential | undefined>((resolve, reject) => {
    const request = db.transaction("credential", "readonly").objectStore("credential").get("primary");
    request.onsuccess = () => resolve(request.result as Credential | undefined);
    request.onerror = () => reject(request.error);
  });
}

async function writeCredential(value: Credential) {
  const db = await openDb();
  return new Promise<void>((resolve, reject) => {
    const request = db.transaction("credential", "readwrite").objectStore("credential").put(value, "primary");
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

async function credentialForDevice() {
  const current = await readCredential();
  if (current?.version === 1 && current.publicKey && current.privateKey) return current;
  const generated = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]) as CryptoKeyPair;
  const publicKey = await crypto.subtle.exportKey("jwk", generated.publicKey);
  const privateJwk = await crypto.subtle.exportKey("jwk", generated.privateKey);
  const privateKey = await crypto.subtle.importKey("jwk", privateJwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const credential = { version: 1, privateKey, publicKey } satisfies Credential;
  await writeCredential(credential);
  return credential;
}

async function api(path: string, body: Record<string, unknown>, signal?:AbortSignal) {
  const response = await fetch(path, {
    method: "POST",
    credentials: "same-origin",
    cache: "no-store",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    ...(signal?{signal}:{})
  });
  const data = await response.json() as ApiData;
  if (!response.ok) throw new ApiError(data.error ?? "Không thể kết nối dịch vụ quản trị.", data);
  return data;
}

async function register(credential: Credential) {
  const data = await api("/api/device", { action: "register", publicKey: credential.publicKey });
  if (!data.device) throw new ApiError("Máy chủ chưa trả về trạng thái thiết bị.", data);
  return data.device;
}

async function proof(credential: Credential, access: Access, signal?:AbortSignal) {
  const challenge = await api("/api/device", { action: "challenge", deviceId: access.deviceId },signal);
  if (!challenge.challenge || !credential.privateKey) throw new ApiError("Không thể tạo thử thách thiết bị.", challenge);
  const message = new TextEncoder().encode(`learning-control:${access.deviceId}:${challenge.challenge}`);
  const signature = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, credential.privateKey, message);
  return { proofDeviceId: access.deviceId, challenge: challenge.challenge, signature: base64Url(new Uint8Array(signature)) };
}

async function secureApi(path: string, credential: Credential, access: Access, body: Record<string, unknown>, signal?:AbortSignal) {
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await api(path, { ...body, ...await proof(credential, access, signal) }, signal);
    } catch (error) {
      lastError = error;
      if (!(error instanceof ApiError) || error.data.code !== "DEVICE_PROOF_EXPIRED") throw error;
    }
  }
  throw lastError;
}

/** A bounded, non-retrying Owner operation. On transport timeout its mutation
 * outcome is unknown: never silently resend destructive writes. */
async function boundedBindingApi(credential:Credential,access:Access,body:Record<string,unknown>) {
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),20_000);
  try { return await secureApi("/api/apps/boi-ech/device-bindings",credential,access,body,controller.signal); }
  catch(error) {
    if(controller.signal.aborted)throw new Error(
      "Yêu cầu quá 20 giây, chưa rõ kết quả. Đóng chi tiết và đồng bộ lại danh sách; không tự gửi lại lệnh xóa.");
    throw error;
  } finally {clearTimeout(timer);}
}

async function boiApi<T = ApiData>(bridge: BoiBridge, path: "/api/control/overview" | "/api/control/content" | "/api/control/ai", init?: { method?: "GET" | "POST"; body?: Record<string, unknown>; query?: string }) {
  if (!/^https:\/\/[a-z0-9.-]+$/i.test(bridge.baseUrl) || !bridge.token.startsWith("v1.")) {
    throw new ApiError("Vé kết nối Site Bơi ếch không hợp lệ.", {});
  }
  const request = {
    method: init?.method ?? "GET",
    mode: "cors",
    credentials: "omit",
    cache: "no-store",
    headers: { authorization: `Bearer ${bridge.token}`, "content-type": "application/json" },
    body: init?.body ? JSON.stringify(init.body) : undefined,
  } as const;
  const proxy = () => fetch("/api/apps/boi-ech/browser-proxy", {
    method: "POST", credentials: "same-origin", cache: "no-store",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ baseUrl: bridge.baseUrl, token: bridge.token, path, query: init?.query, method: request.method, body: init?.body }),
  });
  // A failed cross-origin read can fall back safely. Writes use one path only to avoid duplicate commands.
  let response: Response;
  if (request.method === "POST" || boiDirectUnavailable) response = await proxy();
  else {
    try { response = await fetch(`${bridge.baseUrl}${path}${init?.query ?? ""}`, request); }
    catch { boiDirectUnavailable = true; response = await proxy(); }
  }
  const data = await response.json().catch(() => ({ error: "Phản hồi Site Bơi ếch không hợp lệ." })) as T & { error?: string };
  if (!response.ok) throw new ApiError(data.error ?? "Không thể kết nối Site Bơi ếch.", data as unknown as ApiData);
  return data as T;
}

let boiDirectUnavailable = false;

async function boiBlob(bridge: BoiBridge, deviceId: string) {
  if (!/^https:\/\/[a-z0-9.-]+$/i.test(bridge.baseUrl) || !bridge.token.startsWith("v1.") || !/^[a-f0-9]{64}$/.test(deviceId)) {
    throw new Error("Thông tin xem ảnh chuyển khoản không hợp lệ.");
  }
  const directRequest = () => fetch(`${bridge.baseUrl}/api/control/payment-proof?deviceId=${encodeURIComponent(deviceId)}`, {
    method: "GET",
    mode: "cors",
    credentials: "omit",
    cache: "no-store",
    headers: { authorization: `Bearer ${bridge.token}` },
  });
  const response = boiDirectUnavailable ? await fetch("/api/apps/boi-ech/browser-proxy", {
    method: "POST", credentials: "same-origin", cache: "no-store", headers: { "content-type": "application/json" },
    body: JSON.stringify({ baseUrl: bridge.baseUrl, token: bridge.token, path: "/api/control/payment-proof", query: `?deviceId=${encodeURIComponent(deviceId)}` }),
  }) : await directRequest().catch(async () => {
    boiDirectUnavailable = true;
    return fetch("/api/apps/boi-ech/browser-proxy", {
      method: "POST", credentials: "same-origin", cache: "no-store", headers: { "content-type": "application/json" },
      body: JSON.stringify({ baseUrl: bridge.baseUrl, token: bridge.token, path: "/api/control/payment-proof", query: `?deviceId=${encodeURIComponent(deviceId)}` }),
    });
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({ error: "Không thể đọc ảnh chuyển khoản." })) as { error?: string };
    throw new Error(data.error ?? "Không thể đọc ảnh chuyển khoản.");
  }
  return URL.createObjectURL(await response.blob());
}

function formatDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(date) : "—";
}

function pendingLearnerLabel(device: LearningDevice) {
  const name = device.learnerName?.trim() || "Chưa nhập tên";
  const code = device.personCode?.trim()
    || (device.personRole === "teacher" ? "Chưa nhập số hiệu SQ/QNCN" : "Chưa nhập mã học viên");
  return `${name} - ${code}`;
}

function duration(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return hours > 0 ? `${hours} giờ ${minutes} phút` : `${minutes} phút`;
}

function mergeLearningDevices(current: LearningDevice[], incoming: LearningDevice[], discoverNew: boolean, statusOnly = false) {
  const incomingById = new Map(incoming.map((device) => [device.deviceId, device]));
  const currentIds = new Set(current.map((device) => device.deviceId));
  const merged = current.map((device) => {
    const update = incomingById.get(device.deviceId);
    if (!update) return device;
    if (!statusOnly) return update;
    return {
      ...device,
      ...update,
      deviceId: device.deviceId,
      deviceCode: device.deviceCode,
      activityTimeline: device.activityTimeline,
    };
  });
  if (discoverNew) {
    for (const device of incoming) {
      if (!currentIds.has(device.deviceId)) merged.push(device);
    }
  }
  return merged;
}

const roleLabels: Record<ControlRole, string> = {
  viewer: "Chỉ xem",
  reviewer: "Kiểm duyệt viên",
  publisher: "Người xuất bản",
  owner: "Chủ hệ thống",
};

const statusLabels: Record<DeviceStatus, string> = {
  pending: "Chờ duyệt",
  approved: "Đã cấp quyền",
  blocked: "Đã khóa",
};

function Laptop({ active, status, badge }: { active: boolean; status: DeviceStatus; badge?: number }) {
  return (
    <div className={`laptop ${active ? "is-active" : "is-idle"} status-${status}`} aria-hidden="true">
      <div className="laptop-screen"><i /><span /></div>
      <div className="laptop-base"><i /></div>
      {badge ? <b className="laptop-badge">{badge}</b> : null}
    </div>
  );
}

function DeviceGate({ access, checking, error, retry }: { access: Access | null; checking: boolean; error: string; retry: () => void }) {
  return (
    <main className="gate-shell">
      <section className="gate-card">
        <div className="brand-seal">BE</div>
        <span className={`eyebrow gate-${access?.status ?? "checking"}`}>{access ? statusLabels[access.status] : "Đang xác thực"}</span>
        <h1>{access?.status === "pending" ? "Thiết bị quản trị đang chờ Application Management cấp quyền." : access?.status === "blocked" ? "Thiết bị quản trị này đã bị khóa." : "Đang chuẩn bị khu quản trị Bơi ếch…"}</h1>
        <p>{access?.status === "pending" ? "Mã QT bên dưới thuộc Application Management. Sau khi Trung tâm cấp quyền, khu quản trị Bơi ếch sẽ tự kiểm tra lại." : error || "Khóa quản trị đang được kiểm tra trên thiết bị hiện tại."}</p>
        {access?.deviceCode ? <div className="gate-code"><span>Mã thiết bị quản trị</span><strong>{access.deviceCode}</strong><button onClick={() => navigator.clipboard.writeText(access.deviceCode)}>Sao chép mã</button></div> : null}
        <button className="button primary" onClick={retry} disabled={checking}>{checking ? "Đang kiểm tra…" : "Kiểm tra lại quyền"}</button>
        <small>Quyền thiết bị QT được quản lý tập trung tại Application Management; dữ liệu người học vẫn thuộc Bơi ếch.</small>
      </section>
    </main>
  );
}

const reviewFieldLabels: Record<string, string> = {
  outline: "Thông tin hiển thị", content: "Nội dung chi tiết", title: "Tiêu đề", meta: "Thông tin ngắn",
  status: "Nhãn trạng thái", group: "Nhóm bài", summary: "Giới thiệu", duration: "Thời lượng",
  target: "Mục tiêu đạt", objectives: "Mục tiêu học tập", core: "Nội dung cốt lõi", practice: "Thực hành",
  pass: "Tiêu chí đạt", bridge: "Kết nối lộ trình", safety: "An toàn", knowledge: "Phần học",
  analysis: "Điểm phân tích kỹ thuật",
  drills: "Bài tập", mistakes: "Phân tích lỗi", session: "Buổi tập", sessionPlan: "Buổi tập",
  questions: "Bài kiểm tra", memory: "Ghi nhớ", body: "Nội dung", steps: "Các bước", cue: "Khẩu lệnh",
  avoid: "Điều cần tránh", code: "Mã bài tập", goal: "Mục tiêu", volume: "Khối lượng", sign: "Dấu hiệu",
  cause: "Nguyên nhân", fix: "Cách sửa", time: "Thời gian", phases: "Các pha", analysisPhases: "Các pha dùng trong phần phân tích", short: "Tên ngắn",
  action: "Cách thực hiện", purpose: "Mục đích", name: "Tên", drill: "Bài tập sửa lỗi",
  q: "Câu hỏi", options: "Các phương án", answer: "Đáp án đúng", explain: "Giải thích",
};

function reviewLabel(key: string) {
  return reviewFieldLabels[key] ?? key.replace(/([A-Z])/g, " $1").trim();
}

function isReviewRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function sameReviewValue(current: unknown, proposed: unknown) {
  return JSON.stringify(current) === JSON.stringify(proposed);
}

function changedLeafCount(current: unknown, proposed: unknown): number {
  if (Array.isArray(proposed)) {
    const previous = Array.isArray(current) ? current : [];
    return proposed.reduce((total, item, index) => total + changedLeafCount(previous[index], item), 0)
      + Math.max(0, previous.length - proposed.length);
  }
  if (isReviewRecord(proposed)) {
    const previous = isReviewRecord(current) ? current : {};
    const keys = new Set([...Object.keys(previous), ...Object.keys(proposed)]);
    return [...keys].reduce((total, key) => total + changedLeafCount(previous[key], proposed[key]), 0);
  }
  return sameReviewValue(current, proposed) ? 0 : 1;
}

function reviewDisplay(fieldKey: string, value: unknown) {
  if (fieldKey === "answer" && typeof value === "number") return String.fromCharCode(65 + value);
  if (value === undefined || value === null || value === "") return "—";
  return String(value);
}

function DiffReviewValue({ fieldKey, current, proposed }: { fieldKey: string; current: unknown; proposed: unknown }) {
  const changed = !sameReviewValue(current, proposed);
  if (Array.isArray(proposed)) {
    const previous = Array.isArray(current) ? current : [];
    return <section className={`review-value group ${changed ? "changed-group" : ""}`}><h4>{reviewLabel(fieldKey)}{changed ? <small>Có thay đổi</small> : null}</h4><div>{proposed.map((item, index) => <article key={index}><strong>{fieldKey === "questions" ? `Câu ${index + 1}` : `Mục ${index + 1}`}</strong>{isReviewRecord(item) ? Object.entries(item).map(([key, child]) => <DiffReviewValue key={key} fieldKey={key} current={isReviewRecord(previous[index]) ? previous[index][key] : undefined} proposed={child} />) : <DiffReviewValue fieldKey={`Mục ${index + 1}`} current={previous[index]} proposed={item} />}</article>)}</div></section>;
  }
  if (isReviewRecord(proposed)) {
    const previous = isReviewRecord(current) ? current : {};
    return <section className={`review-value group ${changed ? "changed-group" : ""}`}><h4>{reviewLabel(fieldKey)}{changed ? <small>Có thay đổi</small> : null}</h4><div>{Object.entries(proposed).map(([key, child]) => <DiffReviewValue key={key} fieldKey={key} current={previous[key]} proposed={child} />)}</div></section>;
  }
  const nextDisplay = reviewDisplay(fieldKey, proposed);
  if (!changed) return <div className="review-value field"><span>{reviewLabel(fieldKey)}</span><p>{nextDisplay}</p></div>;
  return (
    <details className="review-value field changed">
      <summary><span>{reviewLabel(fieldKey)} <b>Đã thay đổi</b></span><p>{nextDisplay}</p><small>Nhấn để xem bản cũ</small></summary>
      <div className="previous-value"><span>Bản cũ đang trên máy chủ</span><p>{reviewDisplay(fieldKey, current)}</p></div>
    </details>
  );
}

function SectionDiffReview({ current, proposed }: { current: unknown; proposed: unknown }) {
  if (!isReviewRecord(proposed)) return <div className="lesson-review empty">Chưa có nội dung để đối chiếu.</div>;
  const previous = isReviewRecord(current) ? current : {};
  const changed = changedLeafCount(previous, proposed);
  return <div className="diff-review-shell"><div className="diff-review-summary"><div><span>Kết quả đối chiếu</span><strong>{changed} trường đã thay đổi</strong></div><p>Màu đỏ là nội dung mới. Nhấn vào từng trường màu đỏ để mở bản cũ ngay bên dưới.</p></div><div className="lesson-review diff-review">{Object.entries(proposed).map(([key, child]) => <DiffReviewValue key={key} fieldKey={key} current={previous[key]} proposed={child} />)}</div></div>;
}

function ContentReviewCenter({ bridge, access, automation, saveAutomation }: {
  bridge: BoiBridge;
  access: Access;
  automation?: AccessAutomation;
  saveAutomation: (enabled: boolean, defaultAccessDays: number, defaultDeviceLimit: number) => Promise<boolean>;
}) {
  const [versions, setVersions] = useState<ContentVersion[]>([]);
  const [currentSection, setCurrentSection] = useState<unknown>(null);
  const [proposalSection, setProposalSection] = useState<unknown>(null);
  const [loadedScope, setLoadedScope] = useState<EditScopeInfo | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [note, setNote] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  const selected = versions.find((item) => item.id === selectedId) ?? null;
  const scope = loadedScope ?? contentScope(selected);

  async function run(body: Record<string, unknown>, success: string) {
    setBusy(true);
    setNotice("");
    try {
      const data = await boiApi(bridge, "/api/control/content", { method: "POST", body });
      if (data.versions) setVersions(data.versions);
      if (data.versionId) setSelectedId(data.versionId);
      setNotice(success);
      return data;
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Không thể cập nhật nội dung.");
      return null;
    } finally { setBusy(false); }
  }

  useEffect(() => {
    let cancelled = false;
    boiApi(bridge, "/api/control/content")
      .then(async (data) => {
        if (cancelled) return;
        setVersions(data.versions ?? []);
        const priority = (data.versions ?? []).find((item) => ["permission_requested", "review"].includes(item.status));
        if (!priority) return;
        setSelectedId(priority.id);
        const detail = await boiApi(bridge, "/api/control/content", { query: `?versionId=${encodeURIComponent(priority.id)}` });
        if (cancelled) return;
        setVersions(detail.versions ?? []);
        setCurrentSection(detail.currentSection ?? null);
        setProposalSection(detail.proposedSection ?? null);
        setLoadedScope(detail.editScope ?? null);
        setNote(priority.permission_note ?? "");
      })
      .catch((error) => { if (!cancelled) setNotice(error instanceof Error ? error.message : "Chưa thể tải xưởng nội dung."); });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [access.deviceId, bridge.token]);

  async function openVersion(id: string) {
    setBusy(true);
    setSelectedId(id);
    setLoadedScope(null);
    setCurrentSection(null);
    setProposalSection(null);
    try {
      const data = await boiApi(bridge, "/api/control/content", { query: `?versionId=${encodeURIComponent(id)}` });
      setVersions(data.versions ?? []);
      setCurrentSection(data.currentSection ?? null);
      setProposalSection(data.proposedSection ?? null);
      setLoadedScope(data.editScope ?? null);
      const version = data.versions?.find((item) => item.id === id);
      setNote(version?.permission_note ?? "");
    } catch (error) { setNotice(error instanceof Error ? error.message : "Không thể mở phiên bản."); }
    finally { setBusy(false); }
  }

  const statusLabel: Record<ContentVersion["status"], string> = {
    permission_requested: "Xin quyền chỉnh sửa",
    draft: "Đang chỉnh sửa tại Bơi ếch",
    review: "Chờ kiểm tra bản sửa",
    published: "Đã cập nhật máy chủ",
    changes_requested: "Yêu cầu sửa lại",
    denied: "Từ chối cấp quyền",
    cancelled: "Đã hủy",
    archived: "Phiên bản cũ",
  };

  return (
    <section className="content-review-layout">
      {automation ? <AutomationCenter key={`${automation.updatedAt}-${automation.enabled}-${automation.defaultAccessDays}-${automation.defaultDeviceLimit}`} automation={automation} canManage={["publisher", "owner"].includes(access.role)} save={saveAutomation} /> : null}
      <section className="studio-grid review-center">
      <aside className="version-panel">
        <header><span>Luồng từ Site nội dung</span><h2>Yêu cầu chỉnh sửa</h2></header>
        <div className="editor-note">Khu quản trị Bơi ếch không sửa trực tiếp bài học. Mọi bản sửa phải được tạo và gửi từ Site Bơi ếch.</div>
        <div className="version-list">
          {versions.map((item) => <button key={item.id} className={selectedId === item.id ? "selected" : ""} onClick={() => void openVersion(item.id)}><span>{item.edit_scope_label ?? contentScope(item).label}</span><strong>{statusLabel[item.status]}</strong><small>{item.created_by} · {item.summary || "Không có mô tả"}</small></button>)}
          {versions.length === 0 ? <p>Chưa có yêu cầu nào từ Site Bơi ếch.</p> : null}
        </div>
      </aside>

      <div className="editor-panel">
        <header className="editor-heading"><div><span>{selected ? statusLabel[selected.status] : "Chọn một yêu cầu"}</span><h2>{selected ? `${scope.label} · ${selected.summary || "Yêu cầu chỉnh sửa"}` : "Kiểm soát thay đổi nội dung"}</h2></div></header>
        {selected ? <div className="request-facts"><div><span>Người yêu cầu</span><strong>{selected.created_by}</strong></div><div><span>Thiết bị nội dung</span><strong>{selected.editor_device_code || "—"}</strong></div><div><span>Yêu cầu lúc</span><strong>{formatDate(selected.created_at)}</strong></div><div><span>Trạng thái</span><strong>{statusLabel[selected.status]}</strong></div></div> : null}
        {selected?.status === "permission_requested" ? <div className="decision-card"><span className="review-scope-pill">{scope.label}</span><h3>Cho phép bắt đầu sửa đúng phần này?</h3><p>Chỉ sau khi được chấp thuận, đúng người dùng và đúng laptop mới mở được <strong>{scope.sectionLabel}</strong> của Bài {scope.lessonNumber}. Bốn phần còn lại không được tải vào trình biên tập.</p></div> : null}
        {selected && ["review", "published", "archived", "changes_requested"].includes(selected.status) && proposalSection ? <section className="section-review-panel"><header><div><span>Phạm vi gửi từ Site Bơi ếch</span><h3>{scope.label}</h3></div><small>Toàn bộ phần được gửi để duyệt; chỉ những trường thực sự thay đổi được đánh dấu đỏ.</small></header><SectionDiffReview current={currentSection} proposed={proposalSection} /></section> : null}
        {notice ? <div className="notice" role="status">{notice}</div> : null}
        <div className="editor-actions">
          {selected?.status === "permission_requested" ? <><textarea className="review-note" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Ghi chú cấp quyền (không bắt buộc)" /><button className="button danger" onClick={() => void run({ action: "deny-edit", versionId: selected.id, note }, "Đã từ chối yêu cầu chỉnh sửa.")} disabled={busy}>Từ chối</button><button className="button primary" onClick={() => void run({ action: "approve-edit", versionId: selected.id, note }, "Đã cho phép chỉnh sửa trên Site Bơi ếch.")} disabled={busy}>Cho phép sửa {scope.sectionLabel}</button></> : null}
          {selected?.status === "review" ? <><textarea className="review-note" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Nhận xét cụ thể cho người sửa" /><button className="button danger" onClick={() => void run({ action: "cancel", versionId: selected.id, note }, "Đã hủy bản chỉnh sửa.")} disabled={busy}>Hủy bỏ</button><button className="button accent" onClick={() => void run({ action: "request-changes", versionId: selected.id, note }, "Đã yêu cầu sửa lại trên Site Bơi ếch.")} disabled={busy}>Yêu cầu sửa lại</button></> : null}
          {selected?.status === "review" && ["publisher", "owner"].includes(access.role) ? <button className="button primary" onClick={() => void run({ action: "approve-publish", versionId: selected.id }, "Đã đồng ý cập nhật bản mới lên máy chủ.")} disabled={busy}>Đồng ý cập nhật</button> : null}
          {selected && ["archived", "published"].includes(selected.status) && ["publisher", "owner"].includes(access.role) ? <button className="button" onClick={() => void run({ action: "rollback", versionId: selected.id }, "Đã khôi phục phiên bản được chọn.")} disabled={busy}>Khôi phục phiên bản này</button> : null}
        </div>
      </div>
      </section>
    </section>
  );
}

const paymentStatusLabels: Record<LearningDevice["paymentStatus"], string> = {
  unassigned: "Chưa thanh toán",
  awaiting_payment: "Chưa thanh toán",
  proof_submitted: "Chưa thanh toán",
  free_approved: "Miễn phí",
  paid_verified: "Đã trả phí",
};

const deletedReasonLabels: Record<DeletedLearningDevice["reason"], string> = {
  spam: "Thiết bị rác / spam",
  duplicate: "Đăng ký trùng",
  test: "Thiết bị thử nghiệm",
  other: "Lý do khác",
};

const paymentStatusNotes: Record<LearningDevice["paymentStatus"], string> = {
  unassigned: "Chưa phân nhóm tài khoản.",
  awaiting_payment: "Đang chờ người học chuyển khoản 50.000đ.",
  proof_submitted: "Đã gửi ảnh chuyển khoản, đang chờ quản trị viên xác minh.",
  free_approved: "Tài khoản miễn phí đã được mở.",
  paid_verified: "Chuyển khoản đã được xác minh và tài khoản đã mở.",
};

function ActivityChart({ title, data, value, summary, color }: {
  title: string;
  data: ActivityDay[];
  value: (day: ActivityDay) => number;
  summary: string;
  color: string;
}) {
  const values = data.map(value);
  const maximum = Math.max(1, ...values);
  return (
    <article className="activity-chart">
      <header><span>{title}</span><strong>{summary}</strong></header>
      <div className="activity-bars" aria-label={`${title} trong 30 ngày`}>
        {data.map((day) => <i key={day.date} title={`${day.date}: ${value(day)}`} style={{ height: `${Math.max(value(day) > 0 ? 8 : 2, value(day) / maximum * 100)}%`, background: color }} />)}
      </div>
      <footer><span>{data[0]?.date.slice(5).replace("-", "/") ?? "—"}</span><span>{data.at(-1)?.date.slice(5).replace("-", "/") ?? "—"}</span></footer>
    </article>
  );
}

function AutomationCenter({ automation, canManage, save }: {
  automation: AccessAutomation;
  canManage: boolean;
  save: (enabled: boolean, defaultAccessDays: number, defaultDeviceLimit: number) => Promise<boolean>;
}) {
  const enabled = automation.enabled;
  const [days, setDays] = useState(automation.defaultAccessDays);
  const [deviceLimit, setDeviceLimit] = useState(automation.defaultDeviceLimit);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  async function persistAutomation(nextEnabled: boolean) {
    if (!canManage || savingRef.current) return false;
    savingRef.current = true;
    setSaving(true);
    try {
      return await save(nextEnabled, days, deviceLimit);
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }
  function toggleAutomation() {
    return persistAutomation(!enabled);
  }
  return (
    <section className="automation-inline" aria-labelledby="automatic-edit-title">
      <div className="automation-inline-copy">
        <span>Quy tắc tại tab Duyệt chỉnh sửa</span>
        <h2 id="automatic-edit-title">Tự động duyệt quyền sửa cục bộ</h2>
        <p>Khi bật, hồ sơ <strong>Giảng viên</strong> mới nhập đủ thông tin được dùng miễn phí và sửa bản riêng ngay trên thiết bị. Bản sửa chỉ lưu tại client; không gửi, không duyệt và không cập nhật nội dung máy chủ.</p>
      </div>
      <button className={`automation-switch ${enabled ? "on" : "off"}`} onClick={toggleAutomation} disabled={!canManage || saving} aria-pressed={enabled} aria-busy={saving}><i /><span>{saving ? "Đang lưu…" : enabled ? "Đang bật" : "Đang tắt"}</span></button>
      <label className="automation-days"><span>Thời hạn miễn phí</span><div><input type="number" min={1} max={365} value={days} onChange={(event) => setDays(Math.max(1, Math.min(365, Number(event.target.value) || 60)))} disabled={!canManage || saving} /><b>ngày</b></div></label>
      <label className="automation-days automation-device-limit"><span>Số thiết bị tự động</span><div><input type="number" min={1} max={1000} value={deviceLimit} onChange={(event) => setDeviceLimit(Math.max(1, Math.min(1000, Number(event.target.value) || 20)))} disabled={!canManage || saving} /><b>thiết bị</b></div></label>
      <button className="button" disabled={!canManage || saving || (days === automation.defaultAccessDays && deviceLimit === automation.defaultDeviceLimit)} onClick={() => persistAutomation(enabled)}>Lưu quy tắc</button>
      <small className="automation-usage"><b>{automation.activeAutoFreeDeviceCount}/{automation.defaultDeviceLimit}</b> thiết bị tự động đang còn quyền · còn {automation.remainingAutoFreeDeviceSlots} suất</small>
      <small className="automation-boundary"><b>Không tự động xuất bản.</b> Khi đủ hạn mức, hồ sơ mới chuyển sang chờ duyệt thủ công. Học viên không được cấp quyền sửa; bản sửa của Giảng viên chỉ trở thành nội dung máy chủ sau một lần duyệt riêng.</small>
    </section>
  );
}

function DeletedDevicesPanel({ devices, restore, readOnly = false }: {
  devices: DeletedLearningDevice[];
  restore: (device: DeletedLearningDevice, confirmation: string) => Promise<boolean>;
  readOnly?: boolean;
}) {
  const [confirmations, setConfirmations] = useState<Record<string, string>>({});
  const [busyDeviceId, setBusyDeviceId] = useState("");
  if (devices.length === 0) return null;
  if (readOnly) return <details className="deleted-devices-panel">
    <summary>Lịch sử thiết bị đã loại bỏ · {devices.length}</summary>
    <p className="boi-oversight-note">Chỉ giám sát lịch sử. Không cấp lại quyền hoặc tạo tài khoản từ registry thiết bị.</p>
    <ul>{devices.map(device=><li key={device.deviceId}>{device.deviceCode} · {deletedReasonLabels[device.reason]} · {formatDate(device.deletedAt)}</li>)}</ul>
  </details>;
  return (
    <details className="deleted-devices-panel">
      <summary><span>Danh sách đã loại bỏ</span><strong>{devices.length} thiết bị</strong><small>Có thể mở lại để chính thiết bị đó tạo một hồ sơ hoàn toàn mới.</small></summary>
      <div>{devices.map((device) => { const confirmation = confirmations[device.deviceId] ?? ""; return <article key={device.deviceId}><div><span>{device.learnerName || "Không có hồ sơ"}</span><strong>{device.deviceCode}</strong><small>{deletedReasonLabels[device.reason]} · Xóa lúc {formatDate(device.deletedAt)}</small><small>Người thực hiện: {device.deletedBy}</small></div><label><span>Nhập đúng mã để tạo lại từ đầu</span><input value={confirmation} onChange={(event) => setConfirmations((current) => ({ ...current, [device.deviceId]: event.target.value.toUpperCase() }))} placeholder={device.deviceCode} autoComplete="off" /></label><button className="button" disabled={busyDeviceId === device.deviceId || confirmation.trim().toUpperCase() !== device.deviceCode} onClick={async () => { setBusyDeviceId(device.deviceId); const ok = await restore(device, confirmation); if (!ok) setBusyDeviceId(""); }}>{busyDeviceId === device.deviceId ? "Đang xử lý…" : "Cho phép tạo hồ sơ mới"}</button></article>; })}</div>
    </details>
  );
}

function DeviceDrawer({ device, bridge, canManage, canDelete, managementBusy, activityLoading, close, action }: {
  device: LearningDevice;
  bridge: BoiBridge;
  canManage: boolean;
  canDelete: boolean;
  managementBusy: boolean;
  activityLoading: boolean;
  close: () => void;
  action: (operation: string, success: string, extra?: Record<string, unknown>) => Promise<boolean>;
}) {
  const legacyNameParts = device.learnerName?.trim().split(/\s+/).filter(Boolean) ?? [];
  const [profile, setProfile] = useState({
    learnerFamilyName: device.learnerFamilyName ?? (legacyNameParts.length > 1 ? legacyNameParts.slice(0, -1).join(" ") : ""),
    learnerGivenName: device.learnerGivenName ?? legacyNameParts.at(-1) ?? "",
    label: device.label ?? "",
    accessExpiresAt: device.accessExpiresAt ? device.accessExpiresAt.slice(0, 10) : "",
  });
  const [paymentReviewNote, setPaymentReviewNote] = useState("");
  const [proofUrl, setProofUrl] = useState("");
  const [proofError, setProofError] = useState("");
  const [proofLoading, setProofLoading] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [deleteReason, setDeleteReason] = useState("spam");
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const timeline = device.activityTimeline ?? [];
  const loginTotal = timeline.reduce((total, day) => total + day.loginCount, 0);
  const studyTotal = timeline.reduce((total, day) => total + day.studyMinutes, 0);
  const quizTotal = timeline.reduce((total, day) => total + day.quizAttempts, 0);
  const lastProgress = timeline.at(-1)?.progressPercent ?? device.completionPercent;
  const accessFinalized = device.status === "approved"
    && (device.paymentStatus === "free_approved" || device.paymentStatus === "paid_verified");
  const canGrantFree = device.registrationComplete
    && device.accessGroup === "unassigned"
    && device.paymentStatus === "unassigned";
  const paidEditBlocked = device.accessGroup === "paid" && device.paymentStatus !== "paid_verified";

  useEffect(() => () => { if (proofUrl) URL.revokeObjectURL(proofUrl); }, [proofUrl]);
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape" && !event.defaultPrevented) close(); };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [close]);

  async function loadProof() {
    setProofLoading(true);
    setProofError("");
    try {
      const nextUrl = await boiBlob(bridge, device.deviceId);
      setProofUrl((current) => { if (current) URL.revokeObjectURL(current); return nextUrl; });
    } catch (caught) { setProofError(caught instanceof Error ? caught.message : "Không thể tải ảnh chuyển khoản."); }
    finally { setProofLoading(false); }
  }

  return (
    <div className="drawer-backdrop" onMouseDown={(event) => { if (event.currentTarget === event.target) close(); }}>
      <aside className="device-drawer" role="dialog" aria-modal="true" aria-labelledby="device-drawer-title">
        <header><div><span>Hồ sơ thiết bị</span><h2 id="device-drawer-title">{device.learnerName || device.label || device.deviceCode}</h2></div><button onClick={close} aria-label="Đóng">×</button></header>
        <div className="drawer-hero"><Laptop active={device.active} status={device.status} /><div><span className={`state-chip ${device.active ? "online" : "offline"}`}>{device.active ? "Online" : "Offline"}</span><strong>{device.deviceCode}</strong><small>{device.active ? `Tín hiệu lúc ${formatDate(device.lastPresenceAt)}` : `Offline từ ${formatDate(device.offlineSinceAt)}`}</small></div><span className={`group-chip ${device.accessGroup}`}>{paymentStatusLabels[device.paymentStatus]}</span></div>

        <section className="progress-pair"><article><span>Hoàn thành</span><strong>{device.completionPercent}%</strong><div><i style={{ width: `${device.completionPercent}%` }} /></div><small>{device.completedSteps}/40 phần · {device.completedLessons}/8 bài đạt</small></article><article><span>Nắm vững</span><strong>{device.masteryPercent}%</strong><div><i style={{ width: `${device.masteryPercent}%` }} /></div><small>{device.attempts} lượt kiểm tra</small></article></section>

        <section className="activity-panel"><div><span>Hoạt động theo thiết bị</span><h3>{activityLoading ? "Đang tải biểu đồ…" : "Biểu đồ 30 ngày gần nhất"}</h3></div><div className="activity-grid"><ActivityChart title="Lần đăng nhập" data={timeline} value={(day) => day.loginCount} summary={`${loginTotal} lượt`} color="#247f77" /><ActivityChart title="Thời gian làm bài" data={timeline} value={(day) => day.studyMinutes} summary={`${studyTotal} phút`} color="#be7a3a" /><ActivityChart title="Lượt kiểm tra" data={timeline} value={(day) => day.quizAttempts} summary={`${quizTotal} lượt`} color="#7656a8" /><ActivityChart title="Tiến độ" data={timeline} value={(day) => day.progressPercent} summary={`${lastProgress}%`} color="#3b739b" /></div></section>

        <dl className="device-facts"><div><dt>Họ và tên</dt><dd>{device.learnerName || "Chưa gửi"}</dd></div><div><dt>Vai trò</dt><dd>{device.personRole === "teacher" ? "Giảng viên" : device.personRole === "manager" ? "Cán bộ quản lý" : device.personRole === "learner" ? "Học viên" : "Chưa chọn"}</dd></div><div><dt>{(device.personRole === "teacher" || device.personRole === "manager") ? "Số hiệu cán bộ / SQ / QNCN" : "Mã số học viên"}</dt><dd>{device.personCode || "Chưa gửi"}</dd></div><div><dt>Lớp / đơn vị</dt><dd>{device.className || "Chưa gửi"}</dd></div><div><dt>Số điện thoại</dt><dd>{device.phone || "Chưa gửi"}</dd></div><div><dt>Đang ở</dt><dd>{device.lastLesson ? `Bài ${device.lastLesson} · ${device.lastPart ?? "—"}` : "Chưa bắt đầu"}</dd></div><div><dt>Thời gian học</dt><dd>{duration(device.totalActiveSeconds)}</dd></div><div><dt>Trạng thái quyền</dt><dd>{device.accessExpired ? "Đã hết hạn · cần duyệt lại" : device.accessExpiringSoon ? `Sắp hết hạn · còn ${device.accessDaysRemaining ?? 0} ngày` : statusLabels[device.status]}</dd></div><div><dt>Thanh toán</dt><dd>{paymentStatusLabels[device.paymentStatus]}</dd></div><div><dt>Sửa bản riêng</dt><dd>{device.personRole !== "teacher" ? "Không áp dụng cho Học viên" : device.personalEditConfigured ? device.accessExpired ? "Tạm dừng vì hết hạn" : "Đang bật · chỉ thiết bị này" : "Đang tắt"}</dd></div><div><dt>Tự xác nhận lúc</dt><dd>{formatDate(device.autoConfirmedAt)}</dd></div><div><dt>Chi tiết thanh toán</dt><dd>{device.paymentReviewNote || paymentStatusNotes[device.paymentStatus]}</dd></div><div><dt>Tín hiệu thiết bị cuối</dt><dd>{formatDate(device.lastPresenceAt)}</dd></div><div><dt>Offline từ</dt><dd>{device.active ? "—" : formatDate(device.offlineSinceAt)}</dd></div><div><dt>Hoạt động học cuối</dt><dd>{formatDate(device.lastLearningActivityAt)}</dd></div><div><dt>Hết hạn</dt><dd>{formatDate(device.accessExpiresAt)}</dd></div></dl>

        <section className={`payment-review ${device.accessGroup}`}><div><span>Trạng thái thanh toán</span><h3>{paymentStatusLabels[device.paymentStatus]}</h3><p>{device.paymentReviewNote || paymentStatusNotes[device.paymentStatus]} {device.accessGroup === "paid" ? `Mức phí tài khoản: ${device.paymentAmount.toLocaleString("vi-VN")}đ.` : ""}</p></div>{device.paymentProofAvailable && canManage ? <button className="button" onClick={() => void loadProof()} disabled={proofLoading}>{proofLoading ? "Đang tải ảnh…" : proofUrl ? "Tải lại ảnh" : "Xem ảnh chuyển khoản"}</button> : null}{proofError ? <div className="alert warning">{proofError}</div> : null}{proofUrl ? <figure><img src={proofUrl} alt={`Ảnh chuyển khoản của ${device.learnerName || device.deviceCode}`} /><figcaption>Ảnh do thiết bị gửi lúc {formatDate(device.paymentSubmittedAt)}. Người quản trị cần đối chiếu trước khi xác minh.</figcaption></figure> : null}{device.paymentStatus === "proof_submitted" && canManage ? <label className="payment-note"><span>Lý do nếu ảnh chưa hợp lệ</span><textarea value={paymentReviewNote} onChange={(event) => setPaymentReviewNote(event.target.value)} placeholder="Ví dụ: Chưa thấy đúng số tiền hoặc nội dung chuyển khoản…" maxLength={500} /></label> : null}</section>

        {!canManage ?
          <div className="boi-oversight-note" role="status">Chỉ giám sát · Giảng viên và học viên được cán bộ quản lý xử lý quyền tại Bơi Ếch. Quyền tài khoản cán bộ được chỉnh tại Thời hạn & Chính sách; registry thiết bị không cấp quyền.</div> : null}
        <section className="profile-form"><label><span>Họ</span><input readOnly={!canManage} value={profile.learnerFamilyName} onChange={(event) => setProfile({ ...profile, learnerFamilyName: event.target.value })} /></label><label><span>Tên</span><input readOnly={!canManage} value={profile.learnerGivenName} onChange={(event) => setProfile({ ...profile, learnerGivenName: event.target.value })} /></label><label><span>Tên gợi nhớ thiết bị</span><input readOnly={!canManage} value={profile.label} onChange={(event) => setProfile({ ...profile, label: event.target.value })} /></label><label><span>Ngày hết hạn</span><input type="date" readOnly={!canManage} value={profile.accessExpiresAt} onChange={(event) => setProfile({ ...profile, accessExpiresAt: event.target.value })} /></label></section>
        {!device.registrationComplete ? <div className="alert warning">Chưa thể duyệt: thiết bị phải gửi đủ vai trò, mã định danh, họ tên, lớp/đơn vị và số điện thoại.</div> : null}
        {canManage ? <>{device.personRole === "teacher" ? <section className={`personal-edit-control ${device.personalEditConfigured ? "enabled" : "disabled"}`}><div><span>Quyền sửa cục bộ của Giảng viên</span><h3>{device.personalEditConfigured ? "Đang cho phép sửa bản riêng" : "Chưa bật sửa bản riêng"}</h3><p>{paidEditBlocked ? "Tài khoản đang ở luồng trả phí; cần xác minh thanh toán trước khi thay đổi quyền sửa cục bộ." : "Khi bật: tự mở tài khoản miễn phí theo thời hạn mặc định; nội dung sửa chỉ có tác dụng trên thiết bị và không thể cập nhật máy chủ."}</p></div><button className={`automation-switch ${device.personalEditConfigured ? "on" : "off"}`} disabled={paidEditBlocked} onClick={() => void action("toggle-personal-edit", device.personalEditConfigured ? "Đã tắt quyền sửa bản riêng trên thiết bị." : "Đã bật tài khoản miễn phí và quyền sửa bản riêng theo thời hạn mặc định.", { enabled: !device.personalEditConfigured })} aria-pressed={device.personalEditConfigured}><i /><span>{device.personalEditConfigured ? "Đang bật" : "Đang tắt"}</span></button></section> : <div className="personal-edit-na"><strong>{device.personRole === "manager" ? "Hồ sơ Cán bộ quản lý" : "Hồ sơ Học viên"}</strong><span>Không có quyền xin hoặc sửa nội dung bài giảng.</span></div>}{device.personRole === "manager" ? <section className="personal-edit-control"><div><span>Quyền điều phối đào tạo</span><h3>{device.managementConfigured ? "Đã được Owner cấp quyền" : "Chưa cấp quyền điều phối"}</h3><p>Quản lý lịch, lớp, phòng và phân công nhân sự; quyền học tập/thanh toán được giữ riêng.</p></div>{canDelete ? <button disabled={managementBusy || (!device.managementConfigured && (!device.registrationComplete || device.status !== "approved" || device.accessExpired))} onClick={() => { if (window.confirm(`${device.managementConfigured ? "Thu hồi" : "Cấp"} quyền điều phối toàn bộ lớp/phòng cho ${device.learnerName || device.deviceCode}?`)) void action("manager-access", device.managementConfigured ? "Đã thu hồi quyền điều phối." : "Đã cấp và xác minh quyền điều phối.", { enabled: !device.managementConfigured }); }}>{managementBusy ? "Đang xác minh…" : device.managementConfigured ? "Thu hồi quyền điều phối" : "Cấp quyền điều phối"}</button> : <span>Chỉ Owner được thay đổi.</span>}</section> : null}<div className="drawer-actions"><button className="button" onClick={() => void action("profile", "Đã lưu hồ sơ và thời hạn thiết bị.", profile)}>Lưu hồ sơ & thời hạn</button>{device.registrationComplete && accessFinalized ? <button className="button primary" onClick={() => void action("renew-access", "Đã duyệt lại và gia hạn thiết bị theo thời hạn mặc định.")}>Duyệt lại · gia hạn</button> : null}{canGrantFree ? <button className="button primary" onClick={() => void action("grant-free", "Đã mở tài khoản miễn phí và đưa vào nhóm Miễn phí.")}>Duyệt miễn phí</button> : null}{device.registrationComplete && device.accessGroup === "unassigned" && device.paymentStatus === "unassigned" ? <button className="button accent" onClick={() => void action("require-payment", "Đã gửi QR và yêu cầu thanh toán 50.000đ tới thiết bị.")}>Yêu cầu trả phí</button> : null}{device.paymentStatus === "proof_submitted" ? <button className="button danger" onClick={() => void action("reject-payment", "Đã từ chối ảnh và gửi lý do để người học nộp lại.", { note: paymentReviewNote })}>Yêu cầu gửi lại ảnh</button> : null}{device.paymentStatus === "proof_submitted" ? <button className="button primary" onClick={() => { if (window.confirm("Đã đối chiếu đúng giao dịch và mở tài khoản này?")) void action("verify-payment", "Đã xác minh chuyển khoản, mở tài khoản và đưa vào nhóm Trả phí."); }}>Xác minh & mở tài khoản</button> : null}{device.status === "blocked" ? <button className="button primary" onClick={() => void action("unblock", "Đã mở khóa thiết bị theo trạng thái tài khoản hiện tại.")}>Mở khóa thiết bị</button> : <button className="button danger" onClick={() => { if (window.confirm(`Khóa thiết bị ${device.deviceCode}?`)) void action("block", "Đã khóa thiết bị."); }}>Khóa thiết bị</button>}<button className="button danger" onClick={() => { if (window.confirm(`Đặt lại toàn bộ tiến độ của ${device.learnerName || device.deviceCode}?`)) void action("reset-progress", "Đã đặt lại tiến độ học."); }}>Đặt lại tiến độ</button></div></> : null}
        {canDelete ? <section className="device-danger-zone"><div><span>Quyền Chủ hệ thống</span><h3>Xóa thiết bị rác khỏi Bơi ếch</h3><p>Thao tác này xóa đăng ký, tiến độ, phiên học và dữ liệu AI của thiết bị Bơi ếch. Nhật ký xóa vẫn được giữ tại client. Tài khoản đã xác minh thanh toán hoặc đã có chứng chỉ sẽ được bảo vệ và không thể xóa.</p></div><label><span>Lý do xóa</span><select value={deleteReason} onChange={(event) => setDeleteReason(event.target.value)}><option value="spam">Thiết bị rác / spam</option><option value="duplicate">Đăng ký trùng</option><option value="test">Thiết bị thử nghiệm</option><option value="other">Lý do khác</option></select></label><label><span>Nhập đúng mã <b>{device.deviceCode}</b></span><input value={deleteConfirmation} onChange={(event) => setDeleteConfirmation(event.target.value.toUpperCase())} placeholder={device.deviceCode} autoComplete="off" /></label><button className="button danger permanent-delete" disabled={deleteSubmitting || deleteConfirmation.trim().toUpperCase() !== device.deviceCode} onClick={async () => { setDeleteSubmitting(true); const ok = await action("delete-spam-device", `Đã xóa thiết bị ${device.deviceCode} và dữ liệu rác liên quan.`, { confirmDeviceCode: deleteConfirmation, deleteReason }); if (!ok) setDeleteSubmitting(false); }}>{deleteSubmitting ? "Đang xóa…" : "Xóa vĩnh viễn thiết bị"}</button></section> : null}
      </aside>
    </div>
  );
}

export default function BoiEchControlCenter({ user }: { user: { displayName: string; email: string } }) {
  const [credential, setCredential] = useState<Credential | null>(null);
  const [access, setAccess] = useState<Access | null>(null);
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [checking, setChecking] = useState(true);
  const {count:manualSyncCount,ids:manualSyncIds,acknowledge:ackManualSync}=useBoiSyncNotices("owner");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [boiOnline, setBoiOnline] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const [tab, setTab] = useState<"overview" | "accounts" | "oversight" | "roles" | "policies" | "devices" | "reports" | "ai" | "content">("overview");
  const [filter, setFilter] = useState<"all" | "active" | "pending" | "incomplete" | "payment" | "paid" | "free" | "expired" | "blocked">("all");
  const [search, setSearch] = useState("");
  const [registrySearch,setRegistrySearch]=useState("");
  const [registryFilter,setRegistryFilter]=useState<"all"|"approved"|"pending"|"blocked">("all");
 const [registrySelected,setRegistrySelected]=useState<string[]>([]);
 const [registryBulkBusy,setRegistryBulkBusy]=useState(false);
 const [registryBulkError,setRegistryBulkError]=useState("");
 const [registryBulkSuccess,setRegistryBulkSuccess]=useState("");
 const [registryBulkReason,setRegistryBulkReason]=useState("Owner thanh lọc liên kết trình duyệt cũ không còn sử dụng");
  const [bindingId,setBindingId]=useState<string|null>(null);
  const [bindingDetail,setBindingDetail]=useState<OwnerBindingDetail|null>(null);
  const [bindingLoading,setBindingLoading]=useState(false);
  const [bindingBusy,setBindingBusy]=useState(false);
  const [bindingError,setBindingError]=useState("");
  const [bindingNotice,setBindingNotice]=useState("");
  const [bindingReason,setBindingReason]=useState("Liên kết thiết bị cũ không còn sử dụng");
  const [bindingConfirm,setBindingConfirm]=useState("");
  const bindingRequest=useRef(0);
  const [selected, setSelected] = useState<LearningDevice | null>(null);
  const [selectedActivityLoading, setSelectedActivityLoading] = useState(false);
  const [online, setOnline] = useState(true);
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  // Compact shell keeps rare work in task dialogs, not permanent navigation.
  const [accountMenuOpen,setAccountMenuOpen]=useState(false);
   const accountModalRef=useRef<HTMLElement|null>(null);
   const accountTriggerRef=useRef<HTMLButtonElement|null>(null);
  const [authAutoCheck,setAuthAutoCheck]=useState(false);
  const [authConnection,setAuthConnection]=useState<"unchecked"|"verified"|"unavailable">("unchecked");
  const [clockNow,setClockNow]=useState(0); // Hydration-safe placeholder; locale/timezone is device-specific.
  const [lastAuthCheck,setLastAuthCheck]=useState<string|null>(null);
  const [appearanceOpen, setAppearanceOpen] = useState(false);
  const [appearanceReady, setAppearanceReady] = useState(false);
  const [appearance, setAppearance] = useState<AdminAppearance>(defaultAdminAppearance);
  const refreshRunning = useRef(false);
  const dashboardRef = useRef<Dashboard | null>(null);
  const automationWriteRef = useRef(false);
  const managerWriteRef = useRef(false);
  const [managementBusy, setManagementBusy] = useState(false);
  const [managementAuth, setManagementAuth] = useState(false);
  const managementAuthRef = useRef<((verified: boolean) => void) | null>(null);
  useEffect(() => () => { managementAuthRef.current?.(false); }, []);
  // Main operational destinations remain in the sidebar; only secondary reference tools use a dialog.
  const utilityOpen=["roles","reports","content"].includes(tab);
  const taskTitle:Record<string,string>={
    accounts:"Tài khoản & Duyệt cán bộ",oversight:"Giám sát GV / học viên",
    roles:"Vai trò & Quyền",policies:"Thời hạn & Chính sách",reports:"Báo cáo & Thống kê",
    ai:"Điều hành AI",content:"Duyệt nội dung"
  };
  useEffect(()=>{
    const initial=window.setTimeout(()=>setClockNow(Date.now()),0);
    const timer=window.setInterval(()=>setClockNow(Date.now()),60_000);
    return ()=>{window.clearTimeout(initial);window.clearInterval(timer);};
  },[]);
  useEffect(()=>{
    if(!authAutoCheck)return;
    let alive=true;
    const check=async()=>{
      if(document.hidden||!navigator.onLine)return;
      try{
        const response=await fetch("/api/center",{credentials:"same-origin",cache:"no-store",redirect:"error"});
        if(!alive)return;
        setAuthConnection(response.ok?"verified":"unavailable");
        setLastAuthCheck(new Date().toLocaleTimeString("vi-VN",{hour:"2-digit",minute:"2-digit"}));
      }catch{
        if(alive)setAuthConnection("unavailable");
      }
    };
    const onResume=()=>{if(!document.hidden)void check();};
    void check();
    window.addEventListener("focus",onResume);
    window.addEventListener("online",onResume);
    return()=>{alive=false;window.removeEventListener("focus",onResume);window.removeEventListener("online",onResume);};
  },[authAutoCheck]);
  useEffect(()=>{
    if(!utilityOpen)return;
    const previous=document.activeElement instanceof HTMLElement?document.activeElement:null;
    const dialog=document.getElementById("boi-owner-task-dialog");
    const onKey=(event:KeyboardEvent)=>{
      if(event.key==="Escape"){event.preventDefault();setTab("overview");return;}
      if(event.key!=="Tab"||!dialog)return;
      const items=[...dialog.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]')]
        .filter(item=>item.getClientRects().length>0);
      if(!items.length){event.preventDefault();dialog.focus();return;}
      const first=items[0],last=items[items.length-1];
      if(event.shiftKey&&(document.activeElement===first||document.activeElement===dialog)){
        event.preventDefault();last.focus();
      } else if(!event.shiftKey&&(document.activeElement===last||document.activeElement===dialog)){
        event.preventDefault();first.focus();
      }
    };
    window.addEventListener("keydown",onKey);
    const focus=window.setTimeout(()=>dialog?.focus(),0);
    return()=>{
      window.removeEventListener("keydown",onKey);window.clearTimeout(focus);
      if(previous?.isConnected)previous.focus({preventScroll:true});
    };
  },[utilityOpen,tab]);
  useEffect(()=>{
    if(!accountMenuOpen)return;
    const previousOverflow=document.body.style.overflow;
    const previousFocus=document.activeElement instanceof HTMLElement?document.activeElement:null;
    document.body.style.overflow="hidden";
    const onKey=(event:KeyboardEvent)=>{
      if(event.key==="Escape"){event.preventDefault();setAccountMenuOpen(false);return;}
      if(event.key!=="Tab"||!accountModalRef.current)return;
      const focusable=[...accountModalRef.current.querySelectorAll<HTMLElement>(
        'a[href],button:not(:disabled),input:not(:disabled),[tabindex]:not([tabindex="-1"])')]
        .filter(el=>el.getClientRects().length>0);
      if(!focusable.length){event.preventDefault();accountModalRef.current.focus();return;}
      const first=focusable[0],last=focusable[focusable.length-1];
      if(event.shiftKey&&(document.activeElement===first||document.activeElement===accountModalRef.current)){
        event.preventDefault();last.focus();
      }else if(!event.shiftKey&&(document.activeElement===last||document.activeElement===accountModalRef.current)){
        event.preventDefault();first.focus();
      }
    };
    const timer=window.setTimeout(()=>accountModalRef.current?.focus(),0);
    document.addEventListener("keydown",onKey);
    return()=>{
      window.clearTimeout(timer);document.removeEventListener("keydown",onKey);
      document.body.style.overflow=previousOverflow;
      if(accountTriggerRef.current?.isConnected)accountTriggerRef.current.focus({preventScroll:true});
      else if(previousFocus?.isConnected)previousFocus.focus({preventScroll:true});
    };
  },[accountMenuOpen]);
  function authenticateManagement() { setManagementAuth(true); return new Promise<boolean>(resolve => { managementAuthRef.current = resolve; }); }
  function finishManagementAuth(verified: boolean) { setManagementAuth(false); managementAuthRef.current?.(verified); managementAuthRef.current = null; }

  const detailRequest = useRef(0);
  async function inspectBinding(id:string){
    if(!credential||!access||access.role!=="owner")return;
    const request=++bindingRequest.current;
    setBindingId(id);setBindingLoading(true);setBindingDetail(null);
    setBindingError("");setBindingNotice("");setBindingConfirm("");
    try{
      const response=await boundedBindingApi(credential,access,{
        action:"inspect",bindingId:id}) as unknown as OwnerBindingDetail;
      if(bindingRequest.current!==request)return;
      if(response.verified!==true||response.bindingId!==id||response.contract!=="boi-owner-device-binding.v1")
        throw new Error("Không xác minh được chi tiết liên kết.");
      setBindingDetail(response);
    }catch(caught){
      if(bindingRequest.current===request)setBindingError(caught instanceof Error?caught.message:"Không thể xem thiết bị.");
    }finally{if(bindingRequest.current===request)setBindingLoading(false);}
  }
  function closeBinding(){
    if(bindingBusy)return;
    bindingRequest.current+=1;
    setBindingId(null);setBindingDetail(null);setBindingError("");
    setBindingConfirm("");setBindingNotice("");
  }
  async function changeBinding(action:"revoke"|"purge"|"ban"){
    if(!credential||!access||access.role!=="owner"||!bindingDetail||bindingBusy)return;
    if(bindingConfirm.trim()!==bindingDetail.bindingId.slice(-6)||bindingReason.trim().length<10){
      setBindingError("Nhập đúng 6 ký tự cuối mã liên kết và lý do ít nhất 10 ký tự.");return;
    }
    const original=bindingDetail;setBindingBusy(true);setBindingError("");setBindingNotice("");
    const call=()=>boundedBindingApi(credential,access,{
      action,bindingId:original.bindingId,confirmation:original.bindingId,
      typedSuffix:bindingConfirm.trim(),reason:bindingReason.trim(),
      expectedStatus:original.status,expectedCreatedAt:original.createdAt});
    try{
      let reply:ApiData;
      try{reply=await call();}
      catch(caught){
        if(!(caught instanceof ApiError)||caught.data.code!=="STEP_UP_REQUIRED"||caught.data.applied!==false)throw caught;
        if(!await authenticateManagement())throw new Error("Đã hủy xác minh Owner.");
        reply=await call();
      }
      if(reply.ok!==true||reply.verified!==true)throw new Error("Máy chủ chưa xác nhận thao tác.");
      setBindingConfirm("");
      if(action==="revoke"||action==="ban"){
        const detail=reply.detail as unknown as OwnerBindingDetail|undefined;
        if(!detail||detail.bindingId!==original.bindingId||detail.status!=="blocked")
          throw new Error("Chưa đọc lại được trạng thái đã thu hồi.");
        setBindingDetail(detail);
        setBindingNotice(action==="ban"?"Đã chặn vĩnh viễn khóa thiết bị và thu hồi phiên. Khóa P-256 này không thể đăng ký hoặc đăng nhập lại.":"Đã thu hồi quyền. Có thể xóa vĩnh viễn bản ghi liên kết này.");
      }else{
        if(reply.deleted!==true||reply.bindingId!==original.bindingId)
          throw new Error("Chưa đọc lại được trạng thái đã xóa.");
        bindingRequest.current+=1;setBindingDetail(null);setBindingId(null);
        setNotice("Đã xóa vĩnh viễn liên kết thiết bị và bản ghi phiên/đồng bộ liên quan. Hồ sơ và tiến độ tài khoản được giữ nguyên.");
      }
      // A successful mutation must re-read the canonical registry, not hide a
      // card optimistically or fake new counts.
      await refresh(credential,access,{discoverNew:true});
    }catch(caught){setBindingError(caught instanceof Error?caught.message:"Không thể xử lý liên kết thiết bị.");}
    finally{setBindingBusy(false);}
  }
  /** Bulk purge never trusts the card status alone: inspect and CAS each binding.
   * Owner TOTP is required by the existing gateway on every destructive write;
   * only a proven unapplied STEP_UP_REQUIRED can be retried after authentication.
   * A failed/unknown write stops the batch without resending that request. */
  async function purgeRegistrySelection(ids:string[]){
    if(registryBulkBusy||bindingBusy||!credential||!access||access.role!=="owner")return;
    const verified=dashboardRef.current?.deviceRegistry?.devices??[];
    const allowed=ids.filter(id=>verified.some(r=>r.deviceId===id&&
      (r.status==="pending"||r.status==="blocked"))).slice(0,10);
    if(!allowed.length)return;
    if(registryBulkReason.trim().length<10){setRegistryBulkError("Nhập lý do xử lý tối thiểu 10 ký tự.");return;}
    if(window.prompt("Xóa vĩnh viễn "+allowed.length+" liên kết đã chọn? Nhập XOA LIEN KET để xác nhận.","")!=="XOA LIEN KET")return;
    if(!window.confirm("Xác nhận xóa "+allowed.length+" khóa trình duyệt khỏi D1? "+
      "Tiến độ và tài khoản chính vẫn được giữ; không hoàn tác được."))return;
    setRegistryBulkBusy(true);setRegistryBulkError("");setRegistryBulkSuccess("");
    let completed=0;
    try{
      for(const id of allowed){
        const details=(await boundedBindingApi(credential,access,{action:"inspect",bindingId:id})) as unknown as OwnerBindingDetail;
        if(details.contract!=="boi-owner-device-binding.v1"||details.verified!==true||
          details.bindingId!==id||!details.purgeAllowed||
          (details.status!=="blocked"&&details.status!=="pending"))
          throw new Error("Máy chủ chưa xác minh liên kết đủ điều kiện; đã dừng.");
        const call=()=>boundedBindingApi(credential,access,{
          action:"purge",bindingId:id,confirmation:id,typedSuffix:id.slice(-6),
          reason:registryBulkReason.trim(),expectedStatus:details.status,expectedCreatedAt:details.createdAt
        });
        let reply:ApiData;
        try{reply=await call();}
        catch(e){
          if(!(e instanceof ApiError)||e.data.code!=="STEP_UP_REQUIRED"||e.data.applied!==false)throw e;
          if(!await authenticateManagement())throw new Error("Đã hủy xác minh Authenticator.");
          reply=await call();
        }
        if(reply.ok!==true||reply.verified!==true||reply.deleted!==true||reply.bindingId!==id)
          throw new Error("Chưa xác minh được khóa đã xóa; dừng và đọc lại.");
        completed++;
      }
      setRegistryBulkSuccess("Đã xác minh xóa "+completed+" liên kết. Không xóa tài khoản hoặc tiến độ học.");
    }catch(error){
      setRegistryBulkError("Đã xác minh "+completed+"/"+allowed.length+
        ". Đã dừng tại lỗi tiếp theo; không gửi lại lệnh xóa: "+
        (error instanceof Error?error.message:"Chưa xác minh được D1."));
    }finally{
      setRegistryBulkBusy(false);setRegistrySelected([]);
      await refresh(credential,access,{discoverNew:true}).catch(()=>{
        setRegistryBulkError("Chưa đọc lại được danh sách liên kết; hãy đồng bộ lại D1.");});
    }
  }
  useEffect(()=>{
    if(!bindingId)return;
    const before=document.activeElement instanceof HTMLElement?document.activeElement:null;
    const dialog=document.getElementById("boi-owner-binding-dialog");
    const key=(event:KeyboardEvent)=>{
      if(managementAuth)return; // Never steal focus/Tab/Escape from Authenticator step-up.
      if(event.key==="Escape"){event.preventDefault();event.stopImmediatePropagation();if(!bindingBusy)closeBinding();return;}
      if(event.key!=="Tab"||!dialog)return;
      const items=[...dialog.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),textarea:not(:disabled)')]
        .filter(el=>el.getClientRects().length>0);
      if(!items.length)return;
      const first=items[0],last=items[items.length-1];
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
    };
    const focus=window.setTimeout(()=>dialog?.focus(),0);
    window.addEventListener("keydown",key,true);
    return()=>{window.clearTimeout(focus);window.removeEventListener("keydown",key,true);
      if(before?.isConnected)before.focus({preventScroll:true});};
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[bindingId,bindingBusy,managementAuth]);

  function commitDashboard(next: Dashboard) {
    dashboardRef.current = next;
    setDashboard(next);
  }

  async function loadBoi(currentDashboard: Dashboard, credential: Credential, access: Access, discoverNew: boolean, quiet = false) {
    try {
      if (access.role === "owner") {
        try {
          const result = await secureApi("/api/apps/boi-ech/access", credential, access, { action: "device-registry" });
          const deviceRegistry = parseBoiDeviceRegistry(result);
          if (!deviceRegistry) throw new Error("Chưa xác minh được danh sách thiết bị Account-first.");
          commitDashboard({ ...currentDashboard, deviceRegistry, learningDevices: [], deletedDevices: [], upstreamError: null });
          setSelected(null);
          setBoiOnline(true);
          if (!quiet) setError("");
          return true;
        } catch (error) {
          const code = error instanceof ApiError ? error.data.code : null;
          if (code !== "ACCOUNT_V2_REQUIRED" && code !== "BOI_DEVICE_REGISTRY_NOT_IMPLEMENTED") throw error;
        }
      }
      const currentDevices = dashboardRef.current?.learningDevices ?? currentDashboard.learningDevices;
      // Empty local registry is not proof that the owning Bơi Ếch Control API is online.
      // Revalidate even with zero devices; a missing upstream array is not verified zero.
      const statusQuery = discoverNew || currentDevices.length === 0
        ? "?activityDays=0"
        : `?deviceCodes=${encodeURIComponent(currentDevices.map((device) => device.deviceCode).join(","))}&activityDays=0`;
      const upstream = await boiApi(currentDashboard.boiBridge, "/api/control/overview", { query: statusQuery });
      if (!Array.isArray(upstream.devices)) {
        throw new Error("Control API chưa trả về danh sách thiết bị được xác minh.");
      }
      const incomingDevices = upstream.devices;
      const devices = mergeLearningDevices(currentDevices, incomingDevices, discoverNew, !discoverNew);
      const knownIds = new Set(currentDevices.map((device) => device.deviceId));
      const added = discoverNew ? incomingDevices.filter((device) => !knownIds.has(device.deviceId)) : [];
      const addedPending = added.filter((device) => device.status === "pending" && device.registrationComplete).map(pendingLearnerLabel);
      if (addedPending.length > 0) setNotice(`Có thiết bị mới chờ duyệt: ${addedPending.join(", ")}`);
      commitDashboard({
        ...currentDashboard,
        application: upstream.application ?? currentDashboard.application,
        learningDevices: devices,
        automation: upstream.automation ?? currentDashboard.automation,
        deletedDevices: upstream.deletedDevices ?? currentDashboard.deletedDevices,
        deviceRegistry: undefined,
        upstreamError: null,
      });
      setSelected((current) => current ? devices.find((item) => item.deviceId === current.deviceId) ?? current : null);
      setBoiOnline(true);
      if (!quiet) setError("");
      return true;
    } catch (caught) {
      setBoiOnline(false);
      const message = caught instanceof Error ? caught.message : "Chưa thể đồng bộ Site Bơi ếch.";
      const previous = dashboardRef.current;
      commitDashboard({
        ...currentDashboard,
        learningDevices: previous?.learningDevices ?? [],
        automation: previous?.automation ?? currentDashboard.automation,
        deletedDevices: previous?.deletedDevices ?? currentDashboard.deletedDevices,
        upstreamError: message,
      });
      if (!quiet) setError(message);
      return false;
    }
  }

  async function refresh(currentCredential = credential, currentAccess = access, options: { discoverNew?: boolean; quiet?: boolean } = {}): Promise<boolean> {
    if (!currentCredential || !currentAccess || currentAccess.status !== "approved" || refreshRunning.current) return false;
    const discoverNew = options.discoverNew ?? true;
    const quiet = options.quiet ?? false;
    refreshRunning.current = true;
    setBoiOnline(false);
    if (!quiet) setChecking(true);
    try {
      const data = await secureApi("/api/dashboard", currentCredential, currentAccess, { action: "bootstrap" });
      if (!data.actor || !data.application || !data.boiBridge) throw new ApiError("Dashboard Bơi ếch chưa trả đủ bridge quản trị.", data);
      const fetched: Dashboard = {
        actor: data.actor,
        application: data.application,
        learningDevices: data.learningDevices ?? [],
        upstreamError: data.upstreamError ?? null,
        boiBridge: data.boiBridge,
        automation: data.automation,
        deletedDevices: data.deletedDevices,
      };
      const previous = dashboardRef.current;
      const next = {
        ...fetched,
        learningDevices: previous?.learningDevices ?? fetched.learningDevices,
        deletedDevices: previous?.deletedDevices ?? fetched.deletedDevices,
        deviceRegistry: previous?.deviceRegistry,
      };
      commitDashboard(next);
      return await loadBoi(next, currentCredential, currentAccess, discoverNew, quiet);
    } catch (caught) {
      const message=caught instanceof Error ? caught.message : "Không thể tải khu quản trị Bơi ếch.";
      setBoiOnline(false);setError(message);
      if(dashboardRef.current)commitDashboard({...dashboardRef.current,upstreamError:message});
      return false;
    }
    finally { refreshRunning.current = false; if (!quiet) setChecking(false); }
  }

  async function manualSync(){
    if(checking||refreshRunning.current)return;
    const observed=[...manualSyncIds];
    const verified=await refresh(credential,access,{discoverNew:true});
    if(verified)ackManualSync(observed); // only acknowledge notices after actual server readback
  }

  async function initialize() {
    setChecking(true);
    setError("");
    try {
      const key = await credentialForDevice();
      setCredential(key);
      const state = await register(key);
      setAccess(state);
      if (state.status === "approved") await refresh(key, state, { discoverNew: true });
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Không thể đăng ký thiết bị quản trị."); }
    finally { setChecking(false); }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void initialize(), 0);
    return () => window.clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const startupTimer = window.setTimeout(() => setOnline(navigator.onLine), 0);
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    const handleInstall = (event: Event) => { event.preventDefault(); setInstallPrompt(event as InstallPromptEvent); };
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("beforeinstallprompt", handleInstall);
    return () => {
      window.clearTimeout(startupTimer);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("beforeinstallprompt", handleInstall);
    };
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const saved = window.localStorage.getItem("learning-control-appearance-v1");
        if (saved) setAppearance({ ...defaultAdminAppearance, ...JSON.parse(saved) });
      } catch {
        setAppearance(defaultAdminAppearance);
      } finally {
        setAppearanceReady(true);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!appearanceReady) return;
    window.localStorage.setItem("learning-control-appearance-v1", JSON.stringify(appearance));
  }, [appearance, appearanceReady]);

  useEffect(() => {
    if (!appearanceOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setAppearanceOpen(false); };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [appearanceOpen]);

  async function installWebApp() {
    if (!installPrompt) return;
    await installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
  }

  function downloadReport(name: string, content: string, type: string) {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const link = document.createElement("a");
    link.href = url;
    link.download = name;
    link.click();
    URL.revokeObjectURL(url);
  }

  function exportDevices() {
    if (!boiOnline || !dashboard || dashboard.upstreamError) return;
    if (dashboard.deviceRegistry) {
      const rows = dashboard.deviceRegistry.devices.map(({ deviceId, status }) => [deviceId, status].map(csvCell).join(","));
      downloadReport("boi-ech-lien-ket-thiet-bi.csv", "\ufeffdeviceId,status\n" + rows.join("\n"), "text/csv;charset=utf-8");
      return;
    }
    const rows = visibleDevices.map((device, index) => [
      index + 1,
      device.learnerName ?? "",
      device.personRole === "teacher" ? "Giảng viên" : device.personRole === "manager" ? "Cán bộ quản lý" : device.personRole === "learner" ? "Học viên" : "",
      device.personCode ?? "",
      device.className ?? "",
      device.phone ?? "",
      device.deviceCode,
      device.active ? "Online" : "Offline",
      paymentStatusLabels[device.paymentStatus],
      device.completionPercent,
      device.masteryPercent,
      device.completedLessons,
      device.totalActiveSeconds,
      device.lastPresenceAt,
      device.accessExpiresAt ?? "",
      device.personalEditConfigured ? "Đang bật" : "Đang tắt",
      device.autoConfirmedAt ?? "",
    ]);
    const escape = csvCell;
    const header = ["STT", "Họ và tên", "Vai trò", "Mã số HV/Số hiệu SQ-QNCN", "Lớp/đơn vị", "SĐT", "Mã thiết bị", "Kết nối", "Thanh toán", "Tiến độ %", "Nắm vững %", "Bài đạt", "Giây học", "Tín hiệu cuối", "Hết hạn", "Sửa bản riêng", "Tự xác nhận lúc"];
    downloadReport(`bao-cao-thiet-bi-${new Date().toISOString().slice(0, 10)}.csv`, `\uFEFF${[header, ...rows].map((row) => row.map(escape).join(",")).join("\n")}`, "text/csv;charset=utf-8");
  }

  useEffect(() => {
    if (!credential || access?.status !== "pending") return;
    let active=true, inFlight=false;
    const validate=()=>{
      if(!active||document.hidden||!navigator.onLine||inFlight)return;
      inFlight=true;
      void register(credential).then(state=>{
        if(!active)return;
        setAccess(state);
        if(state.status==="approved")void refresh(credential,state,{discoverNew:true});
      }).catch(()=>undefined).finally(()=>{inFlight=false;});
    };
    const onVisible=()=>{if(!document.hidden)validate();};
    const onMessage=(event:MessageEvent)=>{if(event.data?.type==="boi-owner-access-changed")validate();};
    window.addEventListener("focus",validate);
    window.addEventListener("pageshow",validate);
    window.addEventListener("online",validate);
    document.addEventListener("visibilitychange",onVisible);
    navigator.serviceWorker?.addEventListener("message",onMessage);
    return()=>{
      active=false;
      window.removeEventListener("focus",validate);
      window.removeEventListener("pageshow",validate);
      window.removeEventListener("online",validate);
      document.removeEventListener("visibilitychange",onVisible);
      navigator.serviceWorker?.removeEventListener("message",onMessage);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [access?.status, credential]);
  // Approved devices never poll the owner dashboard. An incoming notice only
  // increments the button badge. Manual user click performs the server read.

  async function dashboardAction(body: Record<string, unknown>, success: string) {
    if (!dashboard?.boiBridge) return false;
    const automationUpdate = body.action === "manage-learning-device" && body.operation === "update-automation";
    const managementUpdate = body.operation === "manager-access";
    if (managementUpdate && managerWriteRef.current) return false;
    if (managementUpdate) { managerWriteRef.current = true; setManagementBusy(true); }
    if (automationUpdate && automationWriteRef.current) return false;
    if (automationUpdate) automationWriteRef.current = true;
    setNotice("");
    try {
      if (body.action !== "manage-learning-device") throw new Error("Khu Bơi ếch chỉ chấp nhận thao tác nghiệp vụ của client.");
      async function managerUpdate(): Promise<ApiData> {
        if (!credential || !access || access.role !== "owner") throw new Error("Chỉ Owner được cấp quyền điều phối.");
        const target = dashboard!.learningDevices.find(device => device.deviceId === body.targetDeviceId);
        if (!target) throw new Error("Không tìm thấy hồ sơ. Hãy đồng bộ lại.");
        const run = () => secureApi("/api/apps/boi-ech/access", credential!, access!, { action: "manage-access", operation: "manager-access", deviceId: target.deviceId, enabled: body.enabled, expectedPersonCode: target.personCode, expectedStatus: target.status, expectedPaymentStatus: target.paymentStatus, expectedAccessGroup: target.accessGroup });
        let reply: ApiData;
        try { reply = await run(); }
        catch (error) {
          if (!(error instanceof ApiError) || error.data.code !== "STEP_UP_REQUIRED") throw error;
          if (!await authenticateManagement()) throw new Error("Đã hủy xác minh; quyền điều phối được giữ nguyên.");
          reply = await run();
        }
        const readback = reply.device as unknown as Partial<LearningDevice> | undefined;
        if (!readback || readback.deviceId !== target.deviceId || readback.managementConfigured !== body.enabled) throw new Error("Chưa đọc lại được đúng quyền điều phối.");
        return { devices: [{ ...target, ...readback }] };
      }
      const data = managementUpdate ? await managerUpdate() : await boiApi(dashboard.boiBridge, "/api/control/overview", { method: "POST", body: {
        action: body.operation,
        deviceId: body.targetDeviceId,
        learnerName: body.learnerName,
        learnerFamilyName: body.learnerFamilyName,
        learnerGivenName: body.learnerGivenName,
        label: body.label,
        accessExpiresAt: body.accessExpiresAt,
        note: body.note,
        enabled: body.enabled,
        defaultAccessDays: body.defaultAccessDays,
        defaultDeviceLimit: body.defaultDeviceLimit,
        confirmDeviceCode: body.confirmDeviceCode,
        deleteReason: body.deleteReason,
      } });
      if (body.operation === "update-automation" && (
        !data.automation || data.automation.enabled !== body.enabled
        || data.automation.defaultAccessDays !== body.defaultAccessDays
        || data.automation.defaultDeviceLimit !== body.defaultDeviceLimit
      )) throw new Error("Máy chủ chưa xác nhận đúng quy tắc tự động duyệt; chưa thể báo đã lưu.");
      if (data.deletedDeviceId) {
        const devices = dashboard.learningDevices.filter((device) => device.deviceId !== data.deletedDeviceId);
        commitDashboard({ ...dashboard, learningDevices: devices });
        setSelected(null);
      } else if (data.devices) {
        const devices = mergeLearningDevices(dashboard.learningDevices, data.devices, false);
        const next = { ...dashboard, learningDevices: devices };
        commitDashboard(next);
        setSelected((current) => current ? devices.find((item) => item.deviceId === current.deviceId) ?? current : null);
      }
      if (data.deletedDevices) {
        const currentDashboard = dashboardRef.current ?? dashboard;
        commitDashboard({ ...currentDashboard, deletedDevices: data.deletedDevices });
      }
      if (data.automation) commitDashboard({ ...(dashboardRef.current ?? dashboard), automation: data.automation });
      setNotice(success);
      // Notify other open administration tabs only after verified mutation.
      if(access?.role==="owner")broadcastBoiChange("owner");
      return true;
    } catch (caught) { setNotice(caught instanceof Error ? caught.message : "Không thể thực hiện thao tác."); return false; }
    finally { if (automationUpdate) automationWriteRef.current = false; if (managementUpdate) { managerWriteRef.current = false; setManagementBusy(false); } }
  }

  async function locateManualCode() {
    const normalized = manualCode.trim().toUpperCase();
    setNotice("");
    if (normalized.startsWith("QT-")) {
      setNotice("Mã QT thuộc thiết bị quản trị Application Management. Hãy quay lại Trung tâm để quản lý quyền thiết bị này.");
      return;
    }
    if (!/^BE-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}$/.test(normalized)) {
      setNotice("Mã chưa đúng định dạng. Khu Bơi ếch chỉ tra cứu thiết bị học có mã BE-…");
      return;
    }
    let found = dashboard?.learningDevices.find((item) => item.deviceCode === normalized);
    if (!found && dashboard?.boiBridge) {
      try {
        const result = await boiApi(dashboard.boiBridge, "/api/control/overview", { query: `?deviceCode=${encodeURIComponent(normalized)}&activityDays=30` });
        found = result.devices?.[0];
        if (found) commitDashboard({ ...dashboard, learningDevices: [...dashboard.learningDevices, found] });
      } catch (caught) {
        setNotice(caught instanceof Error ? caught.message : "Không thể tra cứu mã thiết bị.");
        return;
      }
    }
    if (!found) {
      setFilter("all");
      setSearch(normalized);
      setNotice(boiOnline ? "Mã chưa có trong dữ liệu Bơi ếch. Hãy kiểm tra lại mã rồi bấm Cập nhật." : "Chưa thể kiểm tra mã vì kết nối Bơi ếch đang gián đoạn.");
      return;
    }
    setFilter("all");
    setSearch(normalized);
    void openDetail(found);
    setNotice(`Đã tìm thấy ${normalized}.`);
  }

  async function openDetail(device: LearningDevice) {
    const requestNumber = ++detailRequest.current;
    setSelected(device);
    setSelectedActivityLoading(false);
    if (device.activityTimeline.length >= 30 || !dashboard?.boiBridge || !online) return;
    setSelectedActivityLoading(true);
    try {
      const result = await boiApi(dashboard.boiBridge, "/api/control/overview", { query: `?deviceCode=${encodeURIComponent(device.deviceCode)}&activityDays=30` });
      if (requestNumber !== detailRequest.current) return;
      const detailed = result.devices?.[0];
      if (!detailed) return;
      const currentDashboard = dashboardRef.current ?? dashboard;
      const devices = mergeLearningDevices(currentDashboard.learningDevices, [detailed], false);
      commitDashboard({ ...currentDashboard, learningDevices: devices });
      setSelected(detailed);
    } catch (caught) {
      setNotice(caught instanceof Error ? caught.message : "Chưa thể tải biểu đồ của thiết bị.");
    } finally {
      if (requestNumber === detailRequest.current) setSelectedActivityLoading(false);
    }
  }

  function closeDetail() {
    detailRequest.current += 1;
    setSelectedActivityLoading(false);
    setSelected(null);
  }

  const visibleDevices = useMemo(() => {
    const source = dashboard?.learningDevices ?? [];
    return source.filter((device) => {
      const matchesFilter = filter === "all"
        || (filter === "active" ? device.active
          : filter === "incomplete" ? !device.registrationComplete
          : filter === "payment" ? device.paymentStatus === "proof_submitted"
          : filter === "expired" ? device.accessExpired
            : filter === "paid" || filter === "free" ? device.accessGroup === filter
              : device.status === filter);
      const haystack = `${device.learnerName ?? ""} ${device.personCode ?? ""} ${device.className ?? ""} ${device.phone ?? ""} ${device.label ?? ""} ${device.deviceCode}`.toLowerCase();
      return matchesFilter && haystack.includes(search.trim().toLowerCase());
    });
  }, [dashboard?.learningDevices, filter, search]);

  if (!access || access.status !== "approved") return <DeviceGate access={access} checking={checking} error={error} retry={() => void initialize()} />;

  const counts = {
    total: dashboard?.learningDevices.length ?? 0,
    active: dashboard?.learningDevices.filter((item) => item.active).length ?? 0,
    pending: dashboard?.learningDevices.filter((item) => item.status === "pending").length ?? 0,
    paid: dashboard?.learningDevices.filter((item) => item.accessGroup === "paid").length ?? 0,
    free: dashboard?.learningDevices.filter((item) => item.accessGroup === "free").length ?? 0,
    blocked: dashboard?.learningDevices.filter((item) => item.status === "blocked").length ?? 0,
    expired: dashboard?.learningDevices.filter((item) => item.accessExpired).length ?? 0,
    expiring: dashboard?.learningDevices.filter((item) => item.accessExpiringSoon).length ?? 0,
    paymentReview: dashboard?.learningDevices.filter((item) => item.paymentStatus === "proof_submitted").length ?? 0,
    personalEdit: dashboard?.learningDevices.filter((item) => item.personalEditConfigured).length ?? 0,
    incomplete: dashboard?.learningDevices.filter((item) => !item.registrationComplete).length ?? 0,
    deleted: dashboard?.deletedDevices?.length ?? 0,
  };
  // Registry BE measures devices, not Account-first V2 user identities.
  const devicesVerified = Boolean(online && boiOnline && dashboard && !dashboard.upstreamError);
  const deviceMetric = (n:number) => devicesVerified ? n.toLocaleString("vi-VN") : "—";
  const deviceRegistry = dashboard?.deviceRegistry;
  const registryCounts={
    approved:deviceRegistry?.devices.filter(device=>device.status==="approved").length??0,
    pending:deviceRegistry?.devices.filter(device=>device.status==="pending").length??0,
    blocked:deviceRegistry?.devices.filter(device=>device.status==="blocked").length??0
  };
  const visibleRegistryDevices=deviceRegistry?.devices.filter(device=>
    (registryFilter==="all"||device.status===registryFilter)
    && [device.deviceId,device.account?.accountId,device.account?.name,device.account?.role,device.browserLabel]
      .some(value=>(value??"").toLocaleLowerCase("vi").includes(registrySearch.trim().toLocaleLowerCase("vi"))))??[];
  const canReviewContent = ["reviewer","publisher","owner"].includes(access.role);
  const activeTheme = adminThemes.find((item) => item.id === appearance.theme) ?? adminThemes[0];
  const activeFont = adminFonts.find((item) => item.id === appearance.font) ?? adminFonts[0];

  return (
    <><main
      inert={managementAuth}
      aria-hidden={managementAuth || undefined}
      className="control-shell"
      data-text-size={appearance.textSize}
      style={{
        "--paper": activeTheme.paper,
        "--panel": activeTheme.panel,
        "--ink": activeTheme.ink,
        "--muted": activeTheme.muted,
        "--admin-ui-font": activeFont.ui,
        "--admin-heading-font": activeFont.heading,
      } as React.CSSProperties}
    >
      <aside className="control-sidebar">
        <Link className="control-back-link" href="/"><span>←</span><div><small>SERVER</small><strong>Application Management</strong></div></Link>
        <div className="control-brand"><div className="brand-seal">BE</div><div><span>CLIENT CẤP 1</span><strong>Quản trị Bơi ếch</strong></div></div>

        <div className="boi-nav-caption">ĐIỀU HÀNH ỨNG DỤNG</div>
        <nav aria-label="Quản trị Bơi ếch — điều hướng chính">
          <button type="button" aria-current={tab==="overview"?"page":undefined} className={tab==="overview"?"active":""} onClick={()=>setTab("overview")}><i aria-hidden="true">⌂</i><span><strong>Tổng quan</strong></span></button>
          <button type="button" aria-current={tab==="devices"?"page":undefined} className={tab==="devices"?"active":""} onClick={()=>setTab("devices")}><i aria-hidden="true">▣</i><span><strong>Thiết bị & Tiến độ</strong></span></button>
          {access.role==="owner"?<>
          <button type="button" aria-current={tab==="accounts"?"page":undefined} className={tab==="accounts"?"active":""} onClick={()=>setTab("accounts")}><i aria-hidden="true">♙</i><span><strong>Tài khoản & Duyệt cán bộ</strong></span></button>
          <button type="button" aria-current={tab==="oversight"?"page":undefined} className={tab==="oversight"?"active":""} onClick={()=>setTab("oversight")}><i aria-hidden="true">◎</i><span><strong>Giảng viên & Học viên</strong></span></button>
          <button type="button" aria-current={tab==="policies"?"page":undefined} className={tab==="policies"?"active":""} onClick={()=>setTab("policies")}><i aria-hidden="true">◷</i><span><strong>Thời hạn & Chính sách</strong></span></button>
          </>:null}
          {access.role!=="viewer"?<button type="button" aria-current={tab==="ai"?"page":undefined} className={tab==="ai"?"active":""} onClick={()=>setTab("ai")}><i aria-hidden="true">✦</i><span><strong>Điều hành AI</strong></span></button>:null}
        </nav>
        <div className="boi-side-clock" aria-label="Đồng hồ tại thiết bị">
          <strong>{clockNow ? new Date(clockNow).toLocaleTimeString("vi-VN",{hour:"2-digit",minute:"2-digit"}) : "--:--"}</strong>
          <span>{clockNow ? new Date(clockNow).toLocaleDateString("vi-VN",{weekday:"long",day:"2-digit",month:"2-digit",year:"numeric"}) : "Giờ địa phương"}</span>
          <small>Giờ trên thiết bị hiện tại</small>
        </div>
      </aside>

      <section className="control-main">

        <header className="topbar">
          <div><span className="boi-heading-kicker">ỨNG DỤNG &nbsp; › &nbsp; BƠI ẾCH (BOIECH_AI)</span>
            <h1>{tab==="overview"?"Quản trị Bơi Ếch":tab==="accounts"?"Tài khoản & Duyệt cán bộ":tab==="oversight"?"Giám sát giảng viên & học viên":tab==="roles"?"Vai trò & Quyền":tab==="policies"?"Thời hạn & Chính sách":tab==="devices"?"Thiết bị & Tiến độ":tab==="reports"?"Báo cáo & Thống kê":tab==="ai"?"Điều hành AI":"Duyệt nội dung"}</h1>
            <p>{tab==="overview"?"Quản lý tài khoản, phân quyền và vận hành ứng dụng Bơi Ếch trong hệ sinh thái Application-Management.":tab==="accounts"?"Owner chỉ xét duyệt cán bộ quản lý; không phê duyệt giảng viên hoặc học viên tại đây.":tab==="oversight"?"Theo dõi trạng thái giảng viên, học viên; toàn bộ quyết định cấp quyền thuộc cán bộ quản lý được phân công.":tab==="policies"?"Quản lý thời hạn cán bộ và chính sách mặc định có CAS, nhật ký, đọc lại.":tab==="devices"?"Registry thiết bị và tiến độ học, tách khỏi danh tính tài khoản.":"Theo dõi dữ liệu thật, giữ nguyên quyền quản trị hiện hành."}</p>
          </div>
          <div className="topbar-actions"><span className={`sync-state ${devicesVerified&&online?"boi-confirmed":"sync-warning"}`} role="status"><i/> {!online?"Trình duyệt không có mạng":devicesVerified?"Control API đã xác minh":"Chưa xác minh kết nối"}</span>
          <button type="button" className="button appearance-control" onClick={()=>setAppearanceOpen(true)} aria-expanded={appearanceOpen} aria-controls="admin-appearance-panel"><b>Aa</b> Giao diện</button>
          <button type="button" className="button boi-sync-button boi-manual-sync-control"
            onClick={()=>void manualSync()} disabled={checking||!online}
            aria-label={manualSyncCount>0?`Đồng bộ thủ công, ${manualSyncCount} thông báo thay đổi đang chờ`:"Đồng bộ thủ công"}>
            {checking?"Đang cập nhật…":"↻ Đồng bộ"}
            {manualSyncCount>0?<span className="boi-manual-sync-badge" aria-hidden="true">{manualSyncCount>99?"99+":manualSyncCount}</span>:null}
          </button>
          <div className="boi-top-account">
            <button type="button" ref={accountTriggerRef} className="boi-account-trigger" aria-haspopup="dialog" aria-expanded={accountMenuOpen} aria-controls="boi-account-menu" onClick={()=>setAccountMenuOpen(!accountMenuOpen)}>
              <span className="boi-account-avatar" aria-hidden="true">{user.displayName.slice(0,1).toUpperCase()}</span>
              <span><strong>{user.displayName}</strong><small>{roleLabels[access.role]}</small></span><b aria-hidden="true">⌄</b>
            </button>
            {accountMenuOpen && typeof document!=="undefined"?createPortal(
              <div className="boi-owner-account-modal-backdrop" role="presentation"
                onMouseDown={event=>{if(event.target===event.currentTarget)setAccountMenuOpen(false);}}>
                <section ref={accountModalRef} id="boi-account-menu" tabIndex={-1}
                 className="boi-owner-account-modal" role="dialog" aria-modal="true"
                 aria-labelledby="boi-owner-account-heading">
                 <header className="boi-owner-account-modal-heading">
                   <div><small>TÀI KHOẢN & XÁC THỰC</small>
                     <h2 id="boi-owner-account-heading">Không gian tài khoản</h2>
                     <p>{user.displayName} · {roleLabels[access.role]}</p>
                   </div>
                   <button type="button" aria-label="Đóng cửa sổ tài khoản"
                     onClick={()=>setAccountMenuOpen(false)}>✕</button>
                 </header>
                 <nav className="boi-owner-account-modal-actions" aria-label="Tác vụ tài khoản">
                   <Link href="/__account" onClick={()=>setAccountMenuOpen(false)}>Hồ sơ · Đổi mật khẩu · Bảo mật</Link>
                   <Link href="/__account" onClick={()=>setAccountMenuOpen(false)}>Thiết lập / xác minh Authenticator</Link>
                   <div className="boi-account-space-title">CÔNG CỤ BỔ TRỢ · MỞ KHI CẦN</div>
                   <button type="button" onClick={()=>{setTab("reports");setAccountMenuOpen(false);}}><span aria-hidden="true">▥</span> Báo cáo & Thống kê</button>
                   <button type="button" onClick={()=>{setTab("roles");setAccountMenuOpen(false);}}><span aria-hidden="true">⚿</span> Vai trò & Quyền</button>
                   {canReviewContent?<button type="button" onClick={()=>{setTab("content");setAccountMenuOpen(false);}}><span aria-hidden="true">☷</span> Duyệt nội dung</button>:null}
                   {access.role==="owner"?<Link href="/apps/boi-ech/cloudflare-preview" onClick={()=>setAccountMenuOpen(false)}><span aria-hidden="true">☁</span> Cloudflare Preview</Link>:null}
                 </nav>
                 <label className="boi-owner-account-modal-toggle">
                   <input type="checkbox" checked={authAutoCheck}
                     onChange={event=>{setAuthAutoCheck(event.target.checked);setAuthConnection("unchecked");}}/>
                   <span>Tự động kiểm tra kết nối Authentication</span>
                 </label>
                 <p className="boi-owner-account-modal-status" role="status">
                   {!authAutoCheck?"Tắt kiểm tra nền; xác thực bắt buộc vẫn hoạt động.":authConnection==="verified"?"Phiên Application-Management đã xác minh · "+(lastAuthCheck??"vừa xong"):authConnection==="unavailable"?"Chưa xác minh được phiên, không bỏ qua bảo mật.":"Đang kiểm tra phiên..."}
                 </p>
                 <a href="/signout-with-chatgpt?return_to=/" className="boi-owner-account-modal-signout">Đăng xuất</a>
                </section>
              </div>,document.body):null}
          </div></div>
        </header>
        {appearanceOpen ? <><button className="admin-appearance-scrim" aria-label="Đóng bảng Giao diện" onClick={() => setAppearanceOpen(false)} /><aside id="admin-appearance-panel" className="admin-appearance-panel" role="dialog" aria-modal="true" aria-labelledby="admin-appearance-title"><header><div><span>Tùy chỉnh hiển thị</span><h2 id="admin-appearance-title">Giao diện quản trị</h2></div><button onClick={() => setAppearanceOpen(false)} aria-label="Đóng">×</button></header><section><label>Màu nền</label><p>Chỉ lưu trên máy quản trị hiện tại.</p><div className="admin-theme-options">{adminThemes.map((item) => <button key={item.id} className={appearance.theme === item.id ? "active" : ""} onClick={() => setAppearance((current) => ({ ...current, theme: item.id }))}><i style={{ background: item.paper }} /><span>{item.name}</span></button>)}</div></section><section><label>Font tiếng Việt</label><div className="admin-font-options">{adminFonts.map((item) => <button key={item.id} className={appearance.font === item.id ? "active" : ""} style={{ fontFamily: item.ui }} onClick={() => setAppearance((current) => ({ ...current, font: item.id }))}><strong>{item.name}</strong><span>{item.sample}</span></button>)}</div></section><section><label>Cỡ giao diện</label><div className="admin-size-options">{([{ id: "normal", label: "Tiêu chuẩn" }, { id: "large", label: "Lớn" }, { id: "xlarge", label: "Rất lớn" }] as const).map((item) => <button key={item.id} className={appearance.textSize === item.id ? "active" : ""} onClick={() => setAppearance((current) => ({ ...current, textSize: item.id }))}>{item.label}</button>)}</div></section><footer><button onClick={() => setAppearance(defaultAdminAppearance)}>Khôi phục mặc định</button><span>Tự lưu trên thiết bị</span></footer></aside></> : null}
        {error || dashboard?.upstreamError ? <div className="alert warning" role="alert"><strong>Chưa xác minh kết nối:</strong> {error || dashboard?.upstreamError}</div> : null}
        {notice ? <div className="notice" role="status">{notice}</div> : null}


        {(tab==="overview"||utilityOpen) ? (access.role==="owner"
          ? <BoiOwnerOverview onNavigate={setTab}/>
          : <div className="boi-basic-overview">
              <section className="boi-account-metrics">
                <article><span className="boi-metric-icon blue">▣</span><div><small>Thiết bị BE</small><strong>{deviceMetric(counts.total)}</strong><span>Đã xác minh từ backend</span></div></article>
                <article><span className="boi-metric-icon green">●</span><div><small>Đang hoạt động</small><strong>{deviceMetric(counts.active)}</strong><span>Thiết bị đã đọc lại</span></div></article>
                <article><span className="boi-metric-icon amber">◷</span><div><small>Đang chờ</small><strong>{deviceMetric(counts.pending)}</strong><span>Trạng thái thiết bị</span></div></article>
              </section>
              <section className="boi-console-card"><h2>Không gian điều hành Bơi Ếch</h2><p>Học viên/giảng viên được phê duyệt bởi cán bộ quản lý theo phạm vi. Khu quản trị này không thay thế luồng duyệt đó.</p><button type="button" onClick={()=>setTab("devices")}>Theo dõi thiết bị và tiến độ →</button></section>
            </div>) : null}

        {utilityOpen?<button type="button" className="boi-task-scrim" aria-label="Đóng cửa sổ nghiệp vụ" onClick={()=>setTab("overview")}/>:null}
        <div className={utilityOpen?"boi-task-dialog":"boi-main-contents"} role={utilityOpen?"dialog":undefined}
          aria-modal={utilityOpen?true:undefined} aria-label={utilityOpen?taskTitle[tab]:undefined}
          id={utilityOpen?"boi-owner-task-dialog":undefined} tabIndex={utilityOpen?-1:undefined}>
          {utilityOpen?<header className="boi-task-header"><div><small>QUẢN TRỊ BƠI ẾCH · TÁC VỤ CHUYÊN BIỆT</small><h2>{taskTitle[tab]}</h2></div><button type="button" aria-label="Đóng cửa sổ nghiệp vụ" onClick={()=>setTab("overview")}>✕</button></header>:null}
        {tab==="accounts" && access.role==="owner" ? <div className="boi-owner-workspace"><AccountExpiryPanel section="accounts"/></div> : null}
        {tab==="oversight" && access.role==="owner" ? <div className="boi-owner-workspace"><AccountExpiryPanel section="oversight"/></div> : null}
        {tab==="policies" && access.role==="owner" ? <div className="boi-owner-workspace"><AccountExpiryPanel section="policies"/></div> : null}
        {tab==="roles" ? <section className="boi-console-card boi-rbac-panel" aria-label="Ma trận phân quyền đọc-only"><header><div><span>GIẢI THÍCH QUYỀN, KHÔNG PHẢI MÀN HÌNH CẤP QUYỀN</span><h2>Phân tách quyền theo vai trò</h2></div></header>
          <p>Quyền thực tế luôn do API Bơi Ếch kiểm tra. Bảng này chỉ giải thích phạm vi; không chứa nút cấp quyền.</p>
          <div className="boi-owner-table-scroll"><table className="boi-owner-table"><thead><tr><th>Chức năng</th><th>Owner</th><th>Cán bộ</th><th>Giảng viên</th><th>Học viên</th></tr></thead><tbody>
          <tr><td>Mời, duyệt cán bộ quản lý</td><td>✓</td><td>—</td><td>—</td><td>—</td></tr>
          <tr><td>Duyệt giảng viên và học viên</td><td>Giám sát</td><td>Theo phạm vi được cấp</td><td>—</td><td>—</td></tr>
          <tr><td>Giám sát trạng thái đăng ký</td><td>✓</td><td>Theo phạm vi</td><td>—</td><td>—</td></tr>
          <tr><td>Giảng dạy, quản lý lớp</td><td>—</td><td>Điều phối</td><td>Được giao</td><td>—</td></tr>
          <tr><td>Học tập, theo dõi cá nhân</td><td>—</td><td>—</td><td>—</td><td>✓</td></tr>
          </tbody></table></div></section> : null}

        {deviceRegistry && (tab === "devices" || tab === "reports") ? <section className="boi-console-card boi-reports-workspace" aria-label="Trung tâm kiểm soát thiết bị Account-first">
          <header className="boi-registry-heading"><div><span>ACCOUNT-FIRST V2 · LIÊN KẾT PHIÊN ĐÃ XÁC MINH</span>
            <h2>Tài khoản & Khóa trình duyệt</h2>
            <p>Mỗi liên kết thuộc đúng một tài khoản. Đây là khóa phiên trình duyệt/P-256, không phải mã định danh phần cứng. Không suy diễn trạng thái Online hoặc tiến độ nếu chưa có dữ liệu xác minh.</p>
          </div><button type="button" onClick={exportDevices} disabled={!devicesVerified}>Xuất CSV liên kết</button></header>
          {devicesVerified ? <>
            <div className="boi-registry-metrics" aria-label="Thống kê trạng thái thiết bị">
              <article><span>Tổng liên kết</span><strong>{deviceRegistry.counts.total}</strong></article>
              <article><span>Đã tin cậy</span><strong>{registryCounts.approved}</strong></article>
              <article><span>Chờ xác nhận</span><strong>{registryCounts.pending}</strong></article>
              <article><span>Đã thu hồi</span><strong>{registryCounts.blocked}</strong></article>
            </div>
            <div className="boi-registry-toolbar">
              <div className="boi-registry-filters" role="group" aria-label="Lọc trạng thái thiết bị">
                {([["all","Tất cả"],["approved","Đã tin cậy"],["pending","Chờ xác nhận"],["blocked","Đã thu hồi"]] as const)
                  .map(([key,title])=><button key={key} type="button" aria-pressed={registryFilter===key}
                  onClick={()=>setRegistryFilter(key)}>{title}</button>)}
              </div>
              <label>Tìm tài khoản hoặc mã liên kết
                <input type="search" value={registrySearch} onChange={e=>setRegistrySearch(e.target.value)}
                  placeholder="Tên tài khoản, vai trò, trình duyệt, mã…" aria-label="Tìm tài khoản hoặc liên kết"/>
              </label>
            </div>
            <div className={bindingUi.bulkToolbar} role="group" aria-label="Chọn và xóa liên kết trình duyệt">
              <span><strong>{registrySelected.length}</strong> đã chọn ·
                Có thể xóa trực tiếp trạng thái Chờ xác nhận hoặc Đã thu hồi</span>
              <button type="button" disabled={registryBulkBusy||bindingBusy||
                !visibleRegistryDevices.some(d=>d.status==="pending"||d.status==="blocked")}
                onClick={()=>setRegistrySelected(visibleRegistryDevices.filter(d=>d.status==="pending"||d.status==="blocked")
                  .slice(0,10).map(d=>d.deviceId))}>☑ Chọn tất cả đủ điều kiện (tối đa 10)</button>
              <button type="button" disabled={registryBulkBusy||!registrySelected.length}
                onClick={()=>setRegistrySelected([])}>Bỏ chọn</button>
              <button type="button" className={bindingUi.danger} disabled={registryBulkBusy||!registrySelected.length}
                onClick={()=>void purgeRegistrySelection(registrySelected)}>⌫ Xóa đã chọn</button>
              <button type="button" className={bindingUi.danger} disabled={registryBulkBusy||
                !visibleRegistryDevices.some(d=>d.status==="blocked")}
                onClick={()=>void purgeRegistrySelection(visibleRegistryDevices.filter(d=>d.status==="blocked")
                  .slice(0,10).map(d=>d.deviceId))}>Xóa đã thu hồi (tối đa 10/lượt)</button>
            </div>
            <label className={bindingUi.reason}>Lý do xử lý và nhật ký Owner
              <input value={registryBulkReason} maxLength={300} disabled={registryBulkBusy}
                onChange={event=>setRegistryBulkReason(event.target.value)}/>
            </label>
            {registryBulkError?<p role="alert" className={bindingUi.error}>{registryBulkError}</p>:null}
            {registryBulkSuccess?<p role="status" className={bindingUi.success}>{registryBulkSuccess}</p>:null}
            <div className="boi-registry-grid" aria-live="polite">
              {visibleRegistryDevices.map((device,index)=><article key={device.deviceId}
                className={bindingUi.card} data-status={device.status}>
                <div className={bindingUi.cardCheck}>
                  <input type="checkbox" aria-label={`Chọn xóa liên kết của ${device.account?.name||"tài khoản"}`}
                    checked={registrySelected.includes(device.deviceId)}
                    disabled={registryBulkBusy||bindingBusy||device.status==="approved"||
                      (!registrySelected.includes(device.deviceId)&&registrySelected.length>=10)}
                    onChange={event=>setRegistrySelected(current=>event.target.checked
                      ? [...current.filter(id=>id!==device.deviceId),device.deviceId].slice(0,10)
                      : current.filter(id=>id!==device.deviceId))}/>
                  <button type="button" className={bindingUi.openDetails}
                    onClick={()=>void inspectBinding(device.deviceId)}
                    aria-label={`Xem liên kết trình duyệt của ${device.account?.name||"tài khoản chưa khai báo"} ${device.deviceId.slice(0,12)}`}>
                    <Laptop active={false} status={device.status}/>
                  </button>
                </div>
                <button type="button" className="boi-registry-card" data-status={device.status}
                  onClick={()=>void inspectBinding(device.deviceId)}
                  aria-label={`Chi tiết liên kết của ${device.account?.name||"tài khoản chưa khai báo"}`}>
                <span className="boi-registry-card-copy">
                  <strong>{device.account?.name||"Tài khoản chưa có tên"}</strong>
                  <small>{device.account?.role==="manager"?"Cán bộ quản lý":
                    device.account?.role==="teacher"?"Giảng viên":
                    device.account?.role==="learner"?"Học viên":"Vai trò chưa xác minh"}
                    {" · "}{device.clientClass==="phone"?"Điện thoại":
                    device.clientClass==="tablet"?"Máy tính bảng":"Máy tính"}</small>
                  {device.account?.role==="learner"?<small>Tiến độ tài khoản: {device.progress
                    ? `${device.progress.completed}/${device.progress.total} bài được ghi nhận`
                    : "Chưa có dữ liệu xác minh"} · Không phải tiến độ riêng của trình duyệt</small>:null}
                  <small>{device.browserLabel||"Chưa cập nhật tên trình duyệt"}
                    {" · "}{device.status==="approved"?"Đã tin cậy":
                      device.status==="pending"?"Chờ xác nhận":"Đã thu hồi"}</small>
                  <code title={device.deviceId}>Liên kết #{index+1} · {device.deviceId.slice(0,12)}…</code>
                  <small>Xem chi tiết · Quản lý / Thu hồi</small>
                </span>
                </button>
                {device.status!=="approved"?<button type="button" className={bindingUi.quickDelete}
                  disabled={registryBulkBusy||bindingBusy}
                  onClick={()=>void purgeRegistrySelection([device.deviceId])}>⌫ Xóa liên kết</button>:null}
              </article>)}
            </div>
            {!visibleRegistryDevices.length?<p role="status" className="boi-no-data">
              {deviceRegistry.counts.total===0?"Chưa có thiết bị nào được liên kết.":"Không có thiết bị phù hợp bộ lọc."}
            </p>:null}
          </> : <p role="status">Chưa xác minh lại được registry thiết bị. Hãy đồng bộ để thử lại, không hiển thị số lượng giả.</p>}
        </section> : null}

        {bindingId ? <div className="boi-binding-backdrop" role="presentation" onMouseDown={event=>{
          if(event.target===event.currentTarget&&!bindingBusy)closeBinding();
        }}>
          <section id="boi-owner-binding-dialog" className="boi-binding-dialog" role="dialog" aria-modal="true"
            aria-label="Chi tiết và xử lý liên kết thiết bị" tabIndex={-1}>
            <header><div><span>OWNER · QUẢN LÝ LIÊN KẾT ACCOUNT-FIRST</span>
              <h2>Chi tiết thiết bị</h2></div>
              <button type="button" disabled={bindingBusy} onClick={closeBinding} aria-label="Đóng chi tiết">✕</button></header>
            {bindingLoading?<p role="status">Đang xác minh dữ liệu trực tiếp từ Bơi Ếch…</p>:null}
            {bindingError?<p className="boi-binding-error" role="alert">{bindingError}</p>:null}
            {bindingNotice?<p className="boi-binding-success" role="status">{bindingNotice}</p>:null}
            {bindingDetail?<div className="boi-binding-body">
              <div className="boi-binding-identity">
                <strong>{bindingDetail.account.name||"Tài khoản chưa khai báo tên"}</strong>
                <span>{bindingDetail.account.role==="manager"?"Cán bộ quản lý":
                  bindingDetail.account.role==="teacher"?"Giảng viên":
                  bindingDetail.account.role==="learner"?"Học viên":"Chưa phân loại"} ·
                  {bindingDetail.status==="approved"?" Đã tin cậy":bindingDetail.status==="pending"?" Chờ xác nhận":" Đã thu hồi"}</span>
                <code>Mã liên kết: {bindingDetail.bindingId}</code>
              </div>
              <dl className="boi-binding-facts">
                <div><dt>Ngày liên kết</dt><dd>{formatDate(bindingDetail.createdAt)}</dd></div>
                <div><dt>Ngày đăng ký tài khoản</dt><dd>{formatDate(bindingDetail.account.createdAt)}</dd></div>
                <div><dt>Đăng nhập</dt><dd>{bindingDetail.account.login||"Chưa có"}</dd></div>
                <div><dt>Trạng thái tài khoản</dt><dd>{bindingDetail.account.status}</dd></div>
                <div><dt>Quy trình đăng ký</dt><dd>{bindingDetail.account.onboardingStage||"Chưa có"}</dd></div>
                <div><dt>Phiên hợp lệ hiện tại</dt><dd>{bindingDetail.dependencies.activeSessions}</dd></div>
                <div><dt>Phiên lưu trong D1</dt><dd>{bindingDetail.dependencies.sessions}</dd></div>
                <div><dt>Liên kết khác đã tin cậy</dt><dd>{bindingDetail.dependencies.otherTrustedDevices}</dd></div>
                <div><dt>Quyền đồng bộ thiết bị</dt><dd>{bindingDetail.dependencies.syncGrants}</dd></div>
                <div><dt>Sự kiện đồng bộ thiết bị</dt><dd>{bindingDetail.dependencies.syncEvents}</dd></div>
              </dl>
              <p className="boi-binding-disclaimer">
                <strong>Phạm vi xóa:</strong> Thu hồi quyền trước, sau đó xóa vĩnh viễn liên kết, phiên đăng nhập và
                dữ liệu đồng bộ riêng của thiết bị. <strong>Không xóa hồ sơ tài khoản, kết quả học tập
                hay nhật ký kiểm toán.</strong> Nếu đây là thiết bị tin cậy cuối cùng, tài khoản sẽ cần
                quy trình khôi phục thiết bị để truy cập lại.
              </p>
              <div className="boi-binding-danger">
                <h3>{bindingDetail.status==="blocked"?"Xóa sạch bản ghi liên kết":"Thu hồi quyền thiết bị"}</h3>
                <label>Lý do xử lý (ít nhất 10 ký tự)
                  <textarea value={bindingReason} maxLength={300} rows={2}
                    onChange={event=>setBindingReason(event.target.value)} disabled={bindingBusy}/></label>
                <label>Nhập 6 ký tự cuối của mã liên kết: <strong>{bindingDetail.bindingId.slice(-6)}</strong>
                  <input value={bindingConfirm} maxLength={6} autoComplete="off"
                    onChange={event=>setBindingConfirm(event.target.value.trim().toLowerCase())}
                    disabled={bindingBusy} placeholder="6 ký tự cuối"/></label>
                <button type="button" className="boi-binding-delete" disabled={bindingBusy||
                  bindingConfirm!==bindingDetail.bindingId.slice(-6)||bindingReason.trim().length<10}
                  onClick={()=>void changeBinding(bindingDetail.status==="blocked"?"purge":"revoke")}>
                  {bindingBusy?"Đang xác minh…":bindingDetail.status==="blocked"?
                    "Xóa vĩnh viễn liên kết khỏi D1":"Thu hồi quyền và phiên của thiết bị"}
                </button>
                <button type="button" className="boi-binding-delete"
                  disabled={bindingBusy||bindingConfirm!==bindingDetail.bindingId.slice(-6)
                    ||bindingReason.trim().length<10}
                  onClick={()=>void changeBinding("ban")}>
                  Chặn vĩnh viễn khóa thiết bị · Owner MFA
                </button>
                <small>Owner xác nhận thủ công từng liên kết. Không tự động xóa hàng loạt.</small>
              </div>
            </div>:null}
            <footer><button type="button" onClick={closeBinding} disabled={bindingBusy}>Đóng</button></footer>
          </section>
        </div>:null}

        {tab==="reports" && !deviceRegistry ? <section className="boi-console-card boi-reports-workspace"><header><div><span>BÁO CÁO DỮ LIỆU THẬT</span><h2>Thiết bị và tiến độ</h2></div></header>
          <p>Đây là thống kê thiết bị BE; không lấy số thiết bị để thay thế tổng tài khoản hoặc số yêu cầu chờ duyệt.</p>
          <section className="boi-account-metrics">
            <article><div><small>Tổng thiết bị</small><strong>{deviceMetric(counts.total)}</strong></div></article>
            <article><div><small>Đang hoạt động</small><strong>{deviceMetric(counts.active)}</strong></div></article>
            <article><div><small>Chờ xử lý</small><strong>{deviceMetric(counts.pending)}</strong></div></article>
            <article><div><small>Đã khóa</small><strong>{deviceMetric(counts.blocked)}</strong></div></article>
          </section>
          <div className="boi-report-actions"><button type="button" onClick={exportDevices} disabled={!devicesVerified}>Xuất CSV đã xác minh</button><button type="button" onClick={()=>setTab("devices")}>Xem danh sách thiết bị →</button></div>
          {!devicesVerified?<p role="status">Chưa xác minh kết nối Bơi Ếch; không xuất báo cáo 0 giả.</p>:null}
        </section> : null}

        {tab === "devices" && !deviceRegistry ? <>
          <section className="summary-grid"><article><span>Tổng thiết bị</span><strong>{deviceMetric(counts.total)}</strong><small>Bơi ếch</small></article><article><span>Online</span><strong>{deviceMetric(counts.active)}</strong><small>Tín hiệu ký số mỗi 60 giây</small></article><article><span>Chờ xử lý</span><strong>{deviceMetric(counts.pending)}</strong><small>Hồ sơ hoặc thanh toán</small></article><article><span>Nhóm trả phí</span><strong>{deviceMetric(counts.paid)}</strong><small>Tài khoản 50.000đ</small></article><article><span>Nhóm miễn phí</span><strong>{deviceMetric(counts.free)}</strong><small>Đã sàng lọc</small></article><article><span>Sửa bản riêng</span><strong>{deviceMetric(counts.personalEdit)}</strong><small>Không cập nhật máy chủ</small></article><article><span>Sắp/đã hết hạn</span><strong>{deviceMetric(counts.expiring + counts.expired)}</strong><small>{deviceMetric(counts.expired)} đã hết hạn</small></article><article><span>Đã khóa</span><strong>{deviceMetric(counts.blocked)}</strong><small>Không thể truy cập</small></article><article><span>Đã loại bỏ</span><strong>{deviceMetric(counts.deleted)}</strong><small>Không thể tự đăng ký lại</small></article></section>
          <section className="operations-inbox"><div><span>Hộp việc cần xử lý</span><strong>Ưu tiên những tài khoản đang chờ quyết định</strong></div><button onClick={() => setFilter("incomplete")}><span>Hồ sơ chưa đủ</span><strong>{deviceMetric(counts.incomplete)}</strong></button><button onClick={() => setFilter("payment")}><span>Ảnh chuyển khoản</span><strong>{deviceMetric(counts.paymentReview)}</strong></button><button onClick={() => setFilter("expired")}><span>Tài khoản hết hạn</span><strong>{deviceMetric(counts.expired)}</strong></button>{["reviewer", "publisher", "owner"].includes(access.role) ? <button onClick={() => setTab("content")}><span>Duyệt nội dung</span><strong>→</strong></button> : null}</section>
          <section className="manual-device-card"><div><span>Nhập mã dự phòng</span><strong>Thiết bị mới được quét khi bấm “Cập nhật thiết bị”; danh sách đang có luôn được giữ cố định.</strong><small><b>BE-…</b> là thiết bị học của Bơi ếch. <b>QT-…</b> thuộc Application Management và không được quản trị tại đây.</small></div><label><input value={manualCode} onChange={(event) => setManualCode(event.target.value.toUpperCase())} onKeyDown={(event) => { if (event.key === "Enter") void locateManualCode(); }} placeholder="BE-1234-5678-9ABC-DEF0" aria-label="Mã thiết bị cần tìm" /><button className="button primary" onClick={() => void locateManualCode()}>Tìm thiết bị</button></label></section>
          <section className="device-toolbar"><div className="filter-pills">{(["all", "active", "pending", "incomplete", "paid", "free", "expired", "blocked"] as const).map((item) => <button key={item} className={filter === item ? "active" : ""} onClick={() => setFilter(item)}>{item === "all" ? "Tất cả" : item === "active" ? "Đang hoạt động" : item === "pending" ? "Chờ xử lý" : item === "incomplete" ? "Chưa nhập thông tin" : item === "paid" ? "Trả phí" : item === "free" ? "Miễn phí" : item === "expired" ? "Hết hạn" : "Đã khóa"}</button>)}</div><div className="report-actions"><button className="button" onClick={exportDevices} disabled={!devicesVerified}>Xuất CSV</button><label><span>⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm tên, mã số, lớp, SĐT hoặc thiết bị" /></label></div></section>
          <section className="laptop-grid">
            {visibleDevices.map((device) => <button key={device.deviceId} className={`account-card ${device.active ? "active" : "idle"} ${device.status} ${device.accessExpired ? "expired" : device.accessExpiringSoon ? "expiring" : ""}`} onClick={() => void openDetail(device)}><Laptop active={device.active} status={device.status} /><div className="account-copy"><span>{device.status === "pending" ? "Hồ sơ mới chờ duyệt" : device.learnerName || device.label || "Chưa gửi hồ sơ"}</span><strong className={device.status === "pending" ? "learner-identity" : undefined}>{device.status === "pending" ? pendingLearnerLabel(device) : device.deviceCode}</strong><small>{device.personRole === "teacher" ? "Giảng viên" : device.personRole === "manager" ? "Cán bộ quản lý" : device.personRole === "learner" ? "Học viên" : "Chưa chọn vai trò"}{device.status !== "pending" && device.personCode ? ` · ${device.personCode}` : ""}</small><small>{device.className ? `${device.className} · ` : ""}{device.accessExpired ? "Đã hết hạn" : device.accessExpiringSoon ? `Sắp hết hạn · ${formatDate(device.accessExpiresAt)}` : device.active ? "Online" : `Offline từ ${formatDate(device.offlineSinceAt)}`}</small>{!device.registrationComplete ? <em className="profile-warning">Chưa nhập đủ thông tin</em> : device.personalEditConfigured ? <em>Bản sửa riêng</em> : null}</div><span className={`group-chip ${device.accessGroup}`}>{paymentStatusLabels[device.paymentStatus]}</span><div className="account-progress"><span><i style={{ width: `${device.completionPercent}%` }} /></span><strong>{device.completionPercent}%</strong></div></button>)}
            {visibleDevices.length === 0 ? <div className="empty-state"><Laptop active={false} status="pending" /><h3>{devicesVerified?"Chưa có thiết bị phù hợp":"Chưa xác minh danh sách thiết bị"}</h3><p>{devicesVerified?"Thay đổi bộ lọc hoặc chờ hồ sơ mới.":"Kết nối chưa được xác minh. Đọc lại dữ liệu trước khi kết luận danh sách trống."}</p></div> : null}
          </section>
          {access.role === "owner" ? <DeletedDevicesPanel readOnly devices={dashboard?.deletedDevices ?? []} restore={(device, confirmation) => dashboardAction({ action: "manage-learning-device", operation: "restore-deleted-device", targetDeviceId: device.deviceId, confirmDeviceCode: confirmation }, `Đã cho phép ${device.deviceCode} đăng ký lại. Thiết bị sẽ xuất hiện như hồ sơ mới khi mở Site Bơi ếch.`)} /> : null}
        </> : null}

        {tab === "ai" && dashboard?.boiBridge ? <AiControlCenter role={access.role} api={(init) => boiApi<AiControlData>(dashboard.boiBridge, "/api/control/ai", init)} onNotice={setNotice} /> : null}

        {tab === "content" && dashboard?.boiBridge ? <ContentReviewCenter bridge={dashboard.boiBridge} access={access} automation={dashboard.automation} saveAutomation={(enabled, defaultAccessDays, defaultDeviceLimit) => dashboardAction({ action: "manage-learning-device", operation: "update-automation", enabled, defaultAccessDays, defaultDeviceLimit }, `Đã ${enabled ? "bật" : "tắt"} tự động duyệt; mặc định ${defaultAccessDays} ngày cho tối đa ${defaultDeviceLimit} thiết bị.`)} /> : null}
        </div>
      </section>

      {installPrompt ? <button className="install-fab" onClick={() => void installWebApp()} aria-label="Cài khu quản trị Bơi ếch" title="Cài ứng dụng"><span aria-hidden="true">⇩</span><b>Cài ứng dụng</b></button> : null}
      {selected && dashboard?.boiBridge ? <DeviceDrawer key={selected.deviceId} device={selected} bridge={dashboard.boiBridge} canManage={false} canDelete={false} managementBusy={managementBusy} activityLoading={selectedActivityLoading} close={closeDetail} action={(operation, success, extra = {}) => dashboardAction({ action: "manage-learning-device", operation, targetDeviceId: selected.deviceId, ...extra }, success)} /> : null}
    </main>{managementAuth ? <AuthenticatorStepUp finish={finishManagementAuth}/> : null}</>
  );
}
