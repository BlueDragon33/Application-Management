"use client";

import { connectAdminCenter, type AdminAccess } from "./admin-device-client";

type Credential = { version: 1; privateKey: CryptoKey | null; publicKey: JsonWebKey };

export type BoiAccessDevice = {
  deviceId: string;
  deviceCode: string;
  learnerName: string;
  personCode: string | null;
  registrationComplete: boolean;
  status: "pending" | "approved" | "blocked";
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
  active: boolean;
  lastSeenAt: string | null;
};

export type BoiAccessBootstrap = {
  ok: true;
  application: "boi-ech";
  role: AdminAccess["role"];
  devices: BoiAccessDevice[];
  counts: {
    total: number;
    paid: number;
    free: number;
    awaitingPayment: number;
    proofSubmitted: number;
    expired: number;
    expiringSoon: number;
  } | null;
  /** Only populated when the V2 aggregate contract has been verified by the server. */
  contract?: "boi-account-summary.v2";
  verified?: boolean;
  summary?: {
    totalAccounts: number;
    pending: number;
    active: number;
    suspended: number;
    expired: number;
    unverified: number;
  };
  generatedAt: string;
};

export type BoiAccessOperation = "grant-free" | "require-payment" | "renew-access" | "verify-payment" | "reject-payment" | "block" | "unblock";
type ErrorPayload = { error?: string; code?: string; [key: string]: unknown };

function base64Url(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function openDb() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open("learning-control-device", 1);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function readCredential() {
  const db = await openDb();
  return await new Promise<Credential | undefined>((resolve, reject) => {
    const request = db.transaction("credential", "readonly").objectStore("credential").get("primary");
    request.onsuccess = () => resolve(request.result as Credential | undefined);
    request.onerror = () => reject(request.error);
  });
}

async function challenge(access: AdminAccess) {
  const response = await fetch("/api/device", {
    method: "POST",
    credentials: "same-origin",
    cache: "no-store",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action: "challenge", deviceId: access.deviceId }),
  });
  const payload = await response.json().catch(() => ({})) as ErrorPayload;
  if (!response.ok || typeof payload.challenge !== "string") throw new Error(payload.error || "Không tạo được thử thách thiết bị quản trị.");
  return payload.challenge;
}

async function proof(access: AdminAccess) {
  if (access.deviceId.startsWith("production-session:")) {
    return { controlDeviceId: access.deviceId };
  }
  const credential = await readCredential();
  if (!credential?.privateKey) throw new Error("Không đọc được khóa P-256 của thiết bị quản trị.");
  const nonce = await challenge(access);
  const message = new TextEncoder().encode(`learning-control:${access.deviceId}:${nonce}`);
  const signature = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, credential.privateKey, message);
  return { controlDeviceId: access.deviceId, challenge: nonce, signature: base64Url(new Uint8Array(signature)) };
}

async function approvedSession() {
  const session = await connectAdminCenter();
  if (session.access.status !== "approved") throw new Error("Thiết bị quản trị chưa được cấp quyền.");
  return session;
}

async function call(body: Record<string, unknown>, sessionOverride?: Awaited<ReturnType<typeof approvedSession>>) {
  const session = sessionOverride ?? await approvedSession();
  const response = await fetch("/api/apps/boi-ech/access", {
    method: "POST",
    credentials: "same-origin",
    cache: "no-store",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...body, ...await proof(session.access) }),
  });
  const payload = await response.json().catch(() => ({ error: "Phản hồi thanh toán/quyền Bơi ếch không hợp lệ." })) as ErrorPayload;
  if (!response.ok) throw new Error(payload.error || "Không thể tải thanh toán/quyền Bơi ếch.");
  return payload;
}

export async function connectBoiAccessManagement() {
  const session = await approvedSession();
  const payload = await call({ action: "bootstrap" }, session) as unknown as Omit<BoiAccessBootstrap, "role">;
  return { ...payload, role: session.access.role } as BoiAccessBootstrap;
}

export async function loadBoiPaymentProof(device: BoiAccessDevice) {
  const session = await approvedSession();
  const response = await fetch("/api/apps/boi-ech/access", {
    method: "POST",
    credentials: "same-origin",
    cache: "no-store",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action: "payment-proof", deviceId: device.deviceId, ...await proof(session.access) }),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({})) as ErrorPayload;
    throw new Error(payload.error || "Không thể tải chứng từ thanh toán Bơi ếch.");
  }
  const contentType = (response.headers.get("content-type") ?? "").split(";", 1)[0].trim().toLowerCase();
  if (!["image/jpeg", "image/png", "image/webp"].includes(contentType)) throw new Error("Chứng từ thanh toán không có định dạng ảnh hợp lệ.");
  return await response.blob();
}

const pendingDeviceWrites = new Map<string, Promise<ErrorPayload>>();

export async function manageBoiAccess(device: BoiAccessDevice, operation: BoiAccessOperation, note = "", paidAccessDays = 60) {
  if (pendingDeviceWrites.has(device.deviceId)) throw new Error("Thiết bị đang được xử lý. Hãy chờ kết quả và đồng bộ lại.");
  const task = call({
    action: "manage-access",
    operation,
    deviceId: device.deviceId,
    expectedStatus: device.status,
    expectedPaymentStatus: device.paymentStatus,
    expectedAccessGroup: device.accessGroup,
    ...(operation === "reject-payment" ? { note: note.trim().slice(0, 500) } : {}),
    ...(operation === "verify-payment" ? { paidAccessDays } : {}),
  });
  pendingDeviceWrites.set(device.deviceId, task);
  try { return await task; }
  finally { if (pendingDeviceWrites.get(device.deviceId) === task) pendingDeviceWrites.delete(device.deviceId); }
}


/** Owner-only, read-only canonical Bơi Ếch manager intake; no local account registry. */
export type BoiManagerInboxRecord = {accountId:string;name:string|null;status:string;
  accountRevision:number;onboardingStage:string;onboardingRevision:number;
  createdAt:string;lastSeenAt:string|null;activeSessions:number};
export type BoiManagerInboxPage = {managers:BoiManagerInboxRecord[];nextCursor:string|null};
export async function loadBoiManagerInbox(after=""):Promise<BoiManagerInboxPage>{
  const result=await accountDurationCall({action:"manager-inbox",after}) as BoiAccountDurationResponse & {
    managers?: BoiManagerInboxRecord[];nextCursor?:string|null;
  };
  if(result.verified!==true||!Array.isArray(result.managers) || result.nextCursor===undefined)
    throw new Error("Hàng chờ Cán bộ quản lý chưa được Bơi ếch xác minh.");
  return {managers:result.managers,nextCursor:result.nextCursor??null};
}
export async function issueBoiManagerInvitation(){
  const policy=await accountDurationCall({action:"manager-policy"}) as BoiAccountDurationResponse & {
    policy?:{revision:number;accountLimit:number;used:number};
  };
  if(policy.verified!==true||!Number.isSafeInteger(policy.policy?.revision))
    throw new Error("Chưa xác minh chính sách cấp thư mời Owner.");
  const result=await accountDurationCall({action:"issue-manager-invite",
    expectedRevision:policy.policy?.revision}) as BoiAccountDurationResponse & {
    inviteUrl?:string;expiresAt?:string;
  };
  if(result.verified!==true||!result.inviteUrl||!result.expiresAt)
    throw new Error("Chưa xác minh được mã mời quản lý.");
  return {inviteUrl:result.inviteUrl,expiresAt:result.expiresAt};
}
export async function reviewBoiManagerAccount(
  action:"manager-review-first",accountId:string,expectedRevision:number){
  const result=await accountDurationCall({action,accountId,expectedRevision}) as
    BoiAccountDurationResponse & {account?:{accountId:string;status:string;onboardingStage:string}};
  if(result.verified!==true||result.account?.accountId!==accountId)
    throw new Error("Bơi ếch chưa đọc lại xác nhận duyệt.");
  return result.account;
}

/** Verified soft archive with full-ID consent and server-side Owner CAS/audit/readback.
 * Does not hard-delete D1 identity, learning data or audit records. */
export async function archiveBoiManagerAccount(accountId:string,expectedRevision:number,reason:string) {
 if(!/^acc_[a-f0-9]{64}$/.test(accountId)||!Number.isSafeInteger(expectedRevision)
   ||reason.trim().length<10)throw new Error("Thiếu ID, revision hoặc lý do lưu trữ.");
 const result=await accountDurationCall({action:"manager-archive",accountId,expectedRevision,
   confirmation:accountId,reason:reason.trim()}) as BoiAccountDurationResponse
   & {accountId?:string;status?:string;archived?:boolean;retainedHistory?:boolean;revision?:number};
 if(result.verified!==true||result.accountId!==accountId||result.status!=="blocked"
   ||result.archived!==true||result.retainedHistory!==true||result.revision!==expectedRevision+1)
   throw new Error("Không xác minh được việc gỡ quyền/lưu trữ cán bộ.");
 return result;
}

/** Local-only Owner test intake cleanup. No Production delete command exists. */
export async function cancelBoiLocalTestManager(accountId:string,expectedRevision:number){
 if(!/^acc_[a-f0-9]{64}$/.test(accountId)||!Number.isSafeInteger(expectedRevision))
   throw new Error("Mã hồ sơ hoặc revision không hợp lệ.");
 const result=await accountDurationCall({action:"manager-delete-local",accountId,expectedRevision,
   confirmation:accountId}) as BoiAccountDurationResponse & {deletedAccountId?:string;auditId?:number};
 if(result.verified!==true||result.deletedAccountId!==accountId||!Number.isSafeInteger(result.auditId))
   throw new Error("Bơi Ếch chưa xác minh được việc hủy hồ sơ thử nghiệm.");
 return result;
}

/** Account-level V2 entitlement, independent from free/paid access and per-device expiry. */
export type BoiAccountDurationPolicy = { role:"manager"|"teacher"|"learner"; defaultDays:number;revision:number;updatedAt:string };
export type BoiAccountDurationRecord = { accountId:string;accountRevision:number;name:string;role:string;deviceStatus:string;onboardingStage:string|null;
  deviceAccessExpiresAt?:string|null;deviceAccessExpired?:boolean;paymentStatus?:string;
  entitlement:{state:"active"|"suspended";expiresAt:string;activatedAt:string;revision:number;active:boolean}|null };
type BoiAccountDurationResponse = {ok:true;verified?:boolean;accounts?:BoiAccountDurationRecord[];
  policies?:BoiAccountDurationPolicy[];policy?:BoiAccountDurationPolicy;
  entitlement?:BoiAccountDurationRecord["entitlement"];code?:string;error?:string};

async function accountDurationCall(body: Record<string,unknown>): Promise<BoiAccountDurationResponse> {
  const session=await approvedSession();
  if(session.access.role!=="owner") throw new Error("Chỉ Owner được quản lý hạn tài khoản.");
  const response=await fetch("/api/apps/boi-ech/account-entitlements",{
    method:"POST",credentials:"same-origin",cache:"no-store",
    headers:{"content-type":"application/json"},
    body:JSON.stringify({...body,...await proof(session.access)})
  });
  const result=await response.json().catch(()=>({})) as BoiAccountDurationResponse;
  if(!response.ok || !result.ok) {
    // Preserve the server's MFA/CAS/uncertain-write classification. Callers may
    // only repeat a denied, non-applied step-up request after real Owner MFA.
    const error=new Error(result.error || (result.code==="STEP_UP_REQUIRED"?"Hãy xác minh Authenticator rồi thử lại.":"Không kết nối được quản lý thời hạn tài khoản."));
    throw Object.assign(error,{data:{...result,status:response.status}});
  }
  return result;
}
export async function loadBoiAccountDurations() {
  const [accounts,policies]=await Promise.all([accountDurationCall({action:"list"}),accountDurationCall({action:"policy"})]);
  if(accounts.verified!==true || !Array.isArray(accounts.accounts)
    || policies.verified!==true || !Array.isArray(policies.policies))
    throw new Error("Bơi ếch chưa xác minh danh sách tài khoản và chính sách; không thể suy diễn kết quả bằng 0.");
  return {accounts:accounts.accounts,policies:policies.policies};
}
export async function changeBoiAccountDuration(input:{accountId:string;expectedRevision:number;operation:"set-expiry"|"suspend"|"resume";expiresAt?:string;reason:string}) {
  const response=await accountDurationCall({action:"set-account",...input});
  if(response.verified!==true) throw new Error("Chưa đọc lại được thời hạn tài khoản.");
  return response.entitlement;
}
export type BoiRegistrationQuota={role:"manager"|"teacher"|"learner";
  accountLimit:number;used:number;remaining:number;overLimit:boolean;revision:number;
 rejectedAttempts?:number;lastRejectedAt?:string|null};
export async function loadBoiRegistrationQuotas():Promise<BoiRegistrationQuota[]>{
 const response=await accountDurationCall({action:"capacity"}) as BoiAccountDurationResponse & {limits?:BoiRegistrationQuota[]};
 if(response.verified!==true||!Array.isArray(response.limits)||response.limits.length!==3)
   throw new Error("Hạn mức đăng ký chưa xác minh từ D1.");
 return response.limits;
}
export async function changeBoiRegistrationQuota(input:{
 role:BoiRegistrationQuota["role"];accountLimit:number;expectedRevision:number;
}):Promise<BoiRegistrationQuota[]>{
 const response=await accountDurationCall({action:"set-capacity",...input}) as BoiAccountDurationResponse & {limits?:BoiRegistrationQuota[]};
 if(response.verified!==true||!Array.isArray(response.limits)||response.limits.length!==3)
  throw new Error("Giới hạn đăng ký mới chưa được đọc lại từ máy chủ.");
 return response.limits;
}

export async function permanentlyBlockBoiAccount(input:{
 accountId:string;expectedRevision:number;reason:string;confirmation:string;
}){
 const response=await accountDurationCall({action:"ban-account",...input}) as
  BoiAccountDurationResponse&{blocked?:boolean;persistent?:boolean;accountId?:string;revision?:number};
 if(response.verified!==true||response.blocked!==true||response.persistent!==true||
  response.accountId!==input.accountId||response.revision!==input.expectedRevision+1)
  throw new Error("Máy chủ chưa xác minh việc chặn đăng nhập.");
 return response;
}

export async function changeBoiDefaultAccountDays(input:{role:BoiAccountDurationPolicy["role"];defaultDays:number;expectedRevision:number;reason:string}) {
  const response=await accountDurationCall({action:"set-policy",...input});
  if(response.verified!==true) throw new Error("Chưa đọc lại được chính sách thời hạn.");
  return response.policy;
}

/** Owner-only account retention cleanup: preview is read-only; purge is one
 * explicitly selected account at a time. Each request is bounded. */
export type BoiCleanupMode="pending"|"inactive"|"both";
export type BoiCleanupDays=3|5|7|8;
export type BoiCleanupRecord={
 accountId:string;name:string;role:string|null;category:"pending"|"inactive";
 createdAt:string;lastSeenAt:string|null;latestLoginAt:string|null;
 inactiveDays:number;stage:string|null;eligible:boolean;blockers:string[];snapshot:string;
};
export type BoiCleanupPreview={ok:true;verified:true;contract:"boi-owner-account-cleanup.v1";
 days:BoiCleanupDays;mode:BoiCleanupMode;records:BoiCleanupRecord[];
 hasMore:boolean;nextCursor:string|null;scanned:number;eligible:number;protected:number;warning:string};
async function ownerCleanupCall(body:Record<string,unknown>) {
 const operation=body.action==="purge"?"xóa":"xem trước";
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20_000);
 try{
  const session=await approvedSession();
  if(session.access.role!=="owner")throw new Error("Chỉ Owner được dọn hồ sơ.");
  const signature=await proof(session.access);
  if(controller.signal.aborted)throw new Error("Yêu cầu đã quá thời gian.");
  const response=await fetch("/api/apps/boi-ech/account-cleanup",{
   method:"POST",credentials:"same-origin",cache:"no-store",signal:controller.signal,
   headers:{"content-type":"application/json"},
   body:JSON.stringify({...body,...signature})
  });
  const result=await response.json().catch(()=>({})) as Record<string,unknown>;
  if(!response.ok||result.ok!==true){
   const error=new Error(typeof result.error==="string"?result.error:
    "Chưa xác minh được "+operation+" tài khoản.");
   throw Object.assign(error,{data:{...result,status:response.status}});
  }
  return result;
 }catch(error){
  if(controller.signal.aborted)throw new Error(
   "Hết thời gian xác minh. Kết quả chưa rõ; vui lòng xem trước lại, không tự lặp lệnh xóa.");
  throw error;
 }finally{clearTimeout(timer);}
}
export async function previewOwnerAgedAccounts(input:{mode:BoiCleanupMode;days:BoiCleanupDays;cursor?:string}){
 const result=await ownerCleanupCall({action:"preview",...input});
 if(result.verified!==true||result.contract!=="boi-owner-account-cleanup.v1"
  ||!Array.isArray(result.records))throw new Error("Danh sách D1 chưa được xác minh.");
 return result as BoiCleanupPreview;
}
export async function purgeOwnerAgedAccount(input:{
 mode:BoiCleanupMode;days:BoiCleanupDays;accountId:string;snapshot:string;reason:string;
}){
 const result=await ownerCleanupCall({action:"purge",...input,confirmation:"XOA TAI KHOAN"});
 if(result.verified!==true||result.deleted!==true||result.auditPreserved!==true)
  throw new Error("Bơi Ếch chưa xác nhận xóa tài khoản.");
 return result;
}

/** Strict historical cohort: original device older than five full days,
 * Owner-approval audit, no modern login or manager assignment. No PII. */
export type BoiLegacyFiveDayPreview={
 ok:true;verified:true;applied:false;
 contract:"boi-owner-legacy-five-day-purge.v1";
 rule:string;cutoff:string;totalMatched:number;eligible:number;protected:number;
 protectedByReason:{payment:number;certificate:number;training:number;authoredContent:number;sharedLegacyProfiles?:number};
 snapshot:string;batchSize:number;remainingAfterFirstBatch:number;
};
export type BoiLegacyFiveDayBatch={
 ok:true;verified:true;contract:"boi-owner-legacy-five-day-purge.v1";
 applied:boolean;deleted:number;remaining:number;protected:number;
 nextSnapshot?:string;auditPreserved?:boolean;
};
async function ownerLegacyCleanupCall(body:Record<string,unknown>){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),30_000);
 try{
  const session=await approvedSession();
  if(session.access.role!=="owner")throw new Error("Chỉ Owner có quyền xóa tài khoản cũ.");
  const signature=await proof(session.access);
  if(controller.signal.aborted)throw new Error("Quá thời gian xác minh.");
  const response=await fetch("/api/apps/boi-ech/legacy-bulk-purge",{
   method:"POST",credentials:"same-origin",cache:"no-store",signal:controller.signal,
   headers:{"content-type":"application/json"},body:JSON.stringify({...body,...signature})
  });
  const result=await response.json().catch(()=>({})) as Record<string,unknown>;
  if(!response.ok||result.ok!==true){
   const error=new Error(typeof result.error==="string"?result.error:
    "Chưa xác minh được thao tác dọn tài khoản cũ.");
   throw Object.assign(error,{data:{...result,status:response.status}});
  }
  return result;
 }catch(error){
  if(controller.signal.aborted)throw new Error(
   "Không xác minh được trạng thái xóa trong thời gian giới hạn. Không tự gửi lại; hãy quét D1.");
  throw error;
 }finally{clearTimeout(timer);}
}
export async function previewOwnerLegacyFiveDayPurge(){
 const result=await ownerLegacyCleanupCall({action:"preview"});
 if(result.verified!==true||result.contract!=="boi-owner-legacy-five-day-purge.v1"||
 result.applied!==false||typeof result.snapshot!=="string")
  throw new Error("Chưa xác minh được danh sách tài khoản cũ trên D1.");
 return result as BoiLegacyFiveDayPreview;
}
export async function purgeOwnerLegacyFiveDayBatch(input:{snapshot:string;reason:string}){
 const result=await ownerLegacyCleanupCall({action:"purge-batch",...input,
  confirmation:"XOA TAI KHOAN CU TREN 5 NGAY"});
 if(result.verified!==true||result.contract!=="boi-owner-legacy-five-day-purge.v1"||
  typeof result.applied!=="boolean"||!Number.isSafeInteger(result.deleted))
  throw new Error("Máy chủ chưa xác minh giao dịch xóa tài khoản cũ.");
 return result as BoiLegacyFiveDayBatch;
}


export type BoiOnceRosterPreview={
 ok:true;verified:true;applied:false;contract:"boi-owner-once-roster-reset.v1";
 state:"not_started"|"running"|"completed"|"retention_review";
 cutoff:string;snapshot:string;protectedPeople:Array<{
  name:string;role:string;deviceId:string;accountId:string|null;
 }>;
 totalLearnersTeachers:number;candidates:number;eligible:number;retainedForReview:number;
 blockers:{payment:number;certificates:number;training:number;authoredContent:number;sharedLegacy:number};
 removedInSession:number;batchSize:number;
};
export type BoiOnceRosterResult={
 ok:true;verified:true;applied:true;readback:true;
 contract:"boi-owner-once-roster-reset.v1";
 state:string;deleted:number;totalDeleted:number;remaining:number;
 retainedForReview:number;protectedCount:number;snapshot:string;cutoff:string;
};
async function ownerOnceRosterCall(body:Record<string,unknown>){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),35_000);
 try{
  const session=await approvedSession();
  if(session.access.role!=="owner")throw new Error("Chỉ Owner được thực hiện đợt dọn tài khoản này.");
  const signature=await proof(session.access);
  if(controller.signal.aborted)throw new Error("Quá hạn xác thực Owner.");
  const response=await fetch("/api/apps/boi-ech/once-roster-reset",{
   method:"POST",credentials:"same-origin",cache:"no-store",signal:controller.signal,
   headers:{"content-type":"application/json"},body:JSON.stringify({...body,...signature})
  });
  const result=await response.json().catch(()=>({})) as Record<string,unknown>;
  if(!response.ok||result.ok!==true){
   const error=new Error(typeof result.error==="string"?result.error:
    "D1 chưa xác minh được yêu cầu dọn học viên/giảng viên.");
   throw Object.assign(error,{data:{...result,status:response.status}});
  }
  return result;
 }catch(error){
  if(controller.signal.aborted)
   throw new Error("Không xác minh được phản hồi. Lệnh xóa có thể đã áp dụng; quét lại D1, không gửi lặp.");
  throw error;
 }finally{clearTimeout(timer);}
}
export async function previewOwnerOnceRosterReset(){
 const result=await ownerOnceRosterCall({action:"preview"});
 if(result.verified!==true||result.applied!==false||
  result.contract!=="boi-owner-once-roster-reset.v1"||
  !Array.isArray(result.protectedPeople)||result.protectedPeople.length!==2)
  throw new Error("D1 chưa xác minh được hai tài khoản cần giữ.");
 return result as BoiOnceRosterPreview;
}
export async function executeOwnerOnceRosterBatch(input:{
 cutoff:string;snapshot:string;protectSon:string;protectNghi:string;protectQuynh:string;
 backupBookmark:string;reason:string;
}){
 const result=await ownerOnceRosterCall({action:"execute-batch",...input,
  confirmation:"XOA TAT CA TRU THIEN SON VA DONG NGHI"});
 if(result.verified!==true||result.readback!==true||result.applied!==true||
  result.contract!=="boi-owner-once-roster-reset.v1")
  throw new Error("Chưa xác minh được lô xóa trên D1; không tự lặp lại.");
 return result as BoiOnceRosterResult;
}
