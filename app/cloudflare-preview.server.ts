import { getControlDatabase, type ControlDeviceState } from "./control-device.server";
import { decryptCredential, encryptCredential, deployOpsCredentialEncryptionReady } from "./deploy-ops-credentials.server";

// Observed in the Owner's Cloudflare review. This adapter has no generic resource input.
const ACCOUNT = "f88a42260814230aa4a151abbfe5659d";
const SCRIPT = "277ab3dcacd540a0bd7a510788bdef8c";
const EDITOR = "7e79ec33834341f28dd431ab73884400";
const LIFECYCLE_WRITE = "5bc3f8b21c554832afc660159ab75fa4";
const WORKER = "boi-ech-preview";
const ORIGIN = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}`;
const DEPLOY_SLOT = "boi-ech-preview-deployment";
const LIFECYCLE_SLOT = "boi-ech-preview-lifecycle";
type Slot = typeof DEPLOY_SLOT | typeof LIFECYCLE_SLOT;
type Actor = Pick<ControlDeviceState, "role" | "email">;
type RecordValue = Record<string, unknown>;
type Token = { credential: string; id: string };
type Metadata = { id: string; name: string; expires_on: string; status: string; policies: unknown[]; condition?: unknown; not_before?: unknown };
export type CloudflarePreviewState = {
  worker: string;
  encryptionReady: boolean;
  deployment: { connected: boolean; scopeVerified: boolean; tokenId?: string; tokenName?: string; expiresOn?: string };
  lifecycle: { configured: boolean; ready: boolean };
  blocker: string | null;
  vaultPresent: boolean;
  verified?: boolean;
  revoked?: boolean;
};

export class PreviewConnectionError extends Error {
  providerValidationRejected = false;
  constructor(public code: string, message: string, public status = 409, public applied: boolean | null = false, public providerStatus?: number) { super(message); }
}
function fail(code: string, message: string, status = 409): never { throw new PreviewConnectionError(code, message, status); }
function object(value: unknown): RecordValue { return value && typeof value === "object" && !Array.isArray(value) ? value as RecordValue : {}; }
function credential(value: unknown) {
  if (typeof value !== "string" || value.trim().length < 8 || value.length > 8192 || /[\u0000-\u001f\u007f]/.test(value)) fail("INVALID_PREVIEW_CREDENTIAL", "Token không hợp lệ.", 400);
  return value.trim();
}
async function provider(path: string, key: string, method = "GET", body?: unknown) {
  let response: Response;
  try {
    response = await fetch(`${ORIGIN}${path}`, {
      method, headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      ...(body ? { body: JSON.stringify(body) } : {}), cache: "no-store", redirect: "manual", signal: AbortSignal.timeout(10000),
    });
  } catch { fail("CLOUDFLARE_UNAVAILABLE", "Không kết nối được Cloudflare. Hãy đọc lại trạng thái trước khi thử lại.", 502); }
  if (!response.ok) {
    // Keep provider diagnostics useful without forwarding its arbitrary error text.
    let detail = `HTTP ${response.status}`;
    let validationRejected = false;
    try {
      const payload = object(await response.json());
      const errors = Array.isArray(payload.errors) ? payload.errors.map(object) : [];
      const codes = [...new Set(errors.filter(error => Number.isSafeInteger(error.code)).map(error => String(error.code)))].slice(0, 3);
      const fields = ["not_before", "expires_on", "policies", "condition", "name"].filter(field => errors.some(error => typeof error.message === "string" && error.message.includes(field)));
      validationRejected = payload.success === false && codes.length > 0 && (response.status === 400 || response.status === 422);
      if (codes.length) detail += `; mã ${codes.join(", ")}`;
      if (fields.length) detail += `; trường ${fields.join(", ")}`;
    } catch { /* A non-JSON provider error is still safely identified by status. */ }
    const error = new PreviewConnectionError("CLOUDFLARE_ACCESS_BLOCKED", `Cloudflare chưa cho phép thao tác này (${detail}). Kiểm tra quyền và thời hạn token.`, 502, false, response.status);
    error.providerValidationRejected = validationRejected;
    throw error;
  }
  let data: RecordValue;
  try { data = object(await response.json()); } catch { fail("CLOUDFLARE_INVALID_RESPONSE", "Cloudflare trả dữ liệu không hợp lệ.", 502); }
  if (data.success !== true) fail("CLOUDFLARE_ACCESS_BLOCKED", "Cloudflare chưa xác nhận thao tác.", 502);
  return object(data.result);
}
async function read(slot: Slot) {
  const db = await getControlDatabase();
  const row = await db.prepare("SELECT credential_ciphertext,credential_iv FROM deploy_ops_credentials WHERE provider=? LIMIT 1").bind(slot).first<{ credential_ciphertext: string; credential_iv: string }>();
  if (!row) return "";
  const value = await decryptCredential(row);
  if (!value) fail("PREVIEW_VAULT_LOCKED", "Chưa mở được kho token đã mã hóa.", 503);
  return value;
}
async function audit(actor: Actor, action: string, detail: RecordValue = {}) {
  const db = await getControlDatabase();
  await db.prepare("INSERT INTO control_audit_log(actor,action,target,detail_json) VALUES(?,?,?,?)").bind(actor.email, action, WORKER, JSON.stringify(detail)).run();
}
async function write(slot: Slot, value: string, actor: Actor) {
  const encrypted = await encryptCredential(value);
  const db = await getControlDatabase();
  await db.prepare(`INSERT INTO deploy_ops_credentials(provider,credential_ciphertext,credential_iv,fingerprint,created_by,updated_at)
    VALUES(?,?,?,?,?,CURRENT_TIMESTAMP) ON CONFLICT(provider) DO UPDATE SET credential_ciphertext=excluded.credential_ciphertext,
    credential_iv=excluded.credential_iv,fingerprint=excluded.fingerprint,created_by=excluded.created_by,updated_at=CURRENT_TIMESTAMP`)
    .bind(slot, encrypted.ciphertext, encrypted.iv, "Cloudflare Preview", actor.email).run();
  await audit(actor, "cloudflare_preview_credential_saved", { slot });
}
async function clear(actor: Actor) {
  const db = await getControlDatabase();
  await db.prepare("DELETE FROM deploy_ops_credentials WHERE provider IN (?,?)").bind(DEPLOY_SLOT, LIFECYCLE_SLOT).run();
  await audit(actor, "cloudflare_preview_disconnected");
}
async function deployment(): Promise<Token | null> {
  const stored = await read(DEPLOY_SLOT);
  if (!stored) return null;
  try {
    const data = object(JSON.parse(stored));
    if (typeof data.id === "string" && /^[a-f0-9]{32}$/.test(data.id)) return { id: data.id, credential: credential(data.credential) };
  } catch { /* Fail closed on a malformed vault value. */ }
  return fail("PREVIEW_VAULT_LOCKED", "Thông tin kết nối đã lưu không hợp lệ.", 503);
}
async function verify(key: string) {
  const info = await provider("/tokens/verify", key);
  if (info.status !== "active" || typeof info.id !== "string" || !/^[a-f0-9]{32}$/.test(info.id)
    || typeof info.expires_on !== "string" || !Number.isFinite(Date.parse(info.expires_on)) || Date.parse(info.expires_on) <= Date.now()) {
    fail("PREVIEW_CREDENTIAL_INACTIVE", "Token cần còn hiệu lực và có ngày hết hạn.");
  }
  return info as { id: string; expires_on: string };
}
function scoped(meta: RecordValue, id: string): asserts meta is RecordValue & Metadata {
  const policies = Array.isArray(meta.policies) ? meta.policies : [];
  const policy = object(policies[0]);
  const groups = Array.isArray(policy.permission_groups) ? policy.permission_groups : [];
  const resources = object(policy.resources);
  const accountKey = `com.cloudflare.api.account.${ACCOUNT}`;
  const workerKey = `com.cloudflare.edge.worker.script.${SCRIPT}`;
  const workerResources = object(resources[accountKey]);
  if (meta.id !== id || typeof meta.name !== "string" || !meta.name || policies.length !== 1 || policy.effect !== "allow"
    || groups.length !== 1 || object(groups[0]).id !== EDITOR || Object.keys(resources).length !== 1
    || Object.keys(workerResources).length !== 1 || workerResources[workerKey] !== "*" || typeof meta.expires_on !== "string"
    || !Number.isFinite(Date.parse(meta.expires_on))) fail("PREVIEW_TOKEN_SCOPE_MISMATCH", "BLOCKED: token phải chỉ có quyền Editor của đúng Worker boi-ech-preview.");
}
async function metadata(token: Token, admin: string) {
  const meta = await provider(`/tokens/${token.id}`, admin);
  scoped(meta, token.id);
  return meta;
}
async function verifyLifecycle(key: string) {
  const info = await verify(key);
  const own = await provider(`/tokens/${info.id}`, key);
  const policies = Array.isArray(own.policies) ? own.policies : [];
  const policy = object(policies[0]);
  const groups = Array.isArray(policy.permission_groups) ? policy.permission_groups : [];
  const resources = object(policy.resources);
  if (own.id !== info.id || policies.length !== 1 || policy.effect !== "allow" || groups.length !== 1
    || object(groups[0]).id !== LIFECYCLE_WRITE || Object.keys(resources).length !== 1
    || resources[`com.cloudflare.api.account.${ACCOUNT}`] !== "*") {
    fail("LIFECYCLE_AUTHORITY_REQUIRED", "BLOCKED: cần token riêng chỉ có Account API Tokens Write trong đúng tài khoản Cloudflare.");
  }
}
async function state(): Promise<CloudflarePreviewState> {
  const db = await getControlDatabase();
  const present = await db.prepare("SELECT provider FROM deploy_ops_credentials WHERE provider IN (?,?) LIMIT 1").bind(DEPLOY_SLOT, LIFECYCLE_SLOT).first();
  const result: CloudflarePreviewState = { worker: WORKER, encryptionReady: await deployOpsCredentialEncryptionReady(), vaultPresent: Boolean(present), deployment: { connected: false, scopeVerified: false }, lifecycle: { configured: false, ready: false }, blocker: "Chưa kết nối token Cloudflare Preview." };
  try {
    const token = await deployment();
    const admin = await read(LIFECYCLE_SLOT);
    result.lifecycle.configured = Boolean(admin);
    if (!token) return result;
    const info = await verify(token.credential);
    if (info.id !== token.id) fail("PREVIEW_TOKEN_SCOPE_MISMATCH", "Token đã thay đổi định danh.");
    result.deployment = { connected: true, scopeVerified: false, tokenId: token.id, expiresOn: info.expires_on };
    result.blocker = "BLOCKED: chưa có quyền lifecycle (quản lý token) để đổi hạn hoặc thu hồi trên giao diện.";
    if (admin) {
      await verifyLifecycle(admin);
      const meta = await metadata(token, admin);
      result.deployment = { ...result.deployment, scopeVerified: true, tokenName: meta.name, expiresOn: meta.expires_on };
      result.lifecycle.ready = true;
      result.blocker = null;
    }
  } catch (error) {
    if (!(error instanceof PreviewConnectionError)) throw error;
    result.blocker = error.message;
  }
  return result;
}
async function requestMutation(token: Token, admin: string, method: "PUT" | "DELETE", body?: unknown): Promise<true | null> {
  try { await provider(`/tokens/${token.id}`, admin, method, body); return true; }
  catch (error) {
    // Explicit validation or authorization rejection is evidence of non-application.
    if (error instanceof PreviewConnectionError && (error.providerValidationRejected || error.providerStatus === 401 || error.providerStatus === 403)) throw error;
    // A lost or malformed response says nothing about whether the provider wrote.
    return null;
  }
}
function checkExpected(meta: Metadata, value: unknown) {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value)) || Date.parse(value) !== Date.parse(meta.expires_on)) fail("PREVIEW_TOKEN_CHANGED", "Token đã thay đổi. Đồng bộ lại trước khi lưu.");
}

export async function cloudflarePreviewAction(payload: RecordValue, actor: Actor): Promise<CloudflarePreviewState> {
  if (actor.role !== "owner") fail("OWNER_REQUIRED", "Chỉ Chủ hệ thống được quản lý kết nối Preview.", 403);
  const action = payload.action;
  if (action === "status") return state();
  if (action === "disconnect") { await clear(actor); return state(); }
  if (action === "connect") {
    const admin = await read(LIFECYCLE_SLOT);
    if (!admin) fail("LIFECYCLE_AUTHORITY_REQUIRED", "BLOCKED: kết nối quyền quản lý token trước để xác minh phạm vi Preview.");
    await verifyLifecycle(admin);
    const key = credential(payload.credential);
    const info = await verify(key);
    await provider(`/workers/scripts/${WORKER}/settings`, key);
    const token = { credential: key, id: info.id };
    await metadata(token, admin);
    await write(DEPLOY_SLOT, JSON.stringify(token), actor);
    return state();
  }
  if (action === "connect-lifecycle") {
    const token = await deployment();
    const key = credential(payload.credential);
    await verifyLifecycle(key);
    if (token) await metadata(token, key);
    await write(LIFECYCLE_SLOT, key, actor);
    return state();
  }
  if (action !== "update-expiry" && action !== "revoke") fail("INVALID_PREVIEW_ACTION", "Thao tác không hợp lệ.", 400);
  const token = await deployment();
  const admin = await read(LIFECYCLE_SLOT);
  if (!token || !admin) fail("LIFECYCLE_AUTHORITY_REQUIRED", "BLOCKED: cần quyền Cloudflare quản lý token đã được cấp riêng.");
  await verifyLifecycle(admin);
  const meta = await metadata(token, admin);
  if (action === "revoke" && payload.confirmation !== meta.name) fail("PREVIEW_CONFIRMATION_REQUIRED", "Nhập đúng tên token để xác nhận thu hồi.", 400);
  checkExpected(meta, payload.expectedExpiresOn);
  if (action === "update-expiry") {
    const expiry = typeof payload.expiresOn === "string" ? Date.parse(payload.expiresOn) : NaN;
    if (!Number.isFinite(expiry) || expiry <= Date.now() || expiry > Date.now() + 365 * 86400000) fail("INVALID_PREVIEW_EXPIRY", "Chọn thời hạn tương lai, tối đa 365 ngày.", 400);
    const expiresOn = new Date(expiry).toISOString().replace(/\.000Z$/, "Z");
    const acknowledged = await requestMutation(token, admin, "PUT", { name: meta.name, policies: [{ effect: "allow", permission_groups: [{ id: EDITOR }], resources: object(meta.policies[0]).resources }], condition: meta.condition ?? {}, ...(meta.not_before == null ? {} : { not_before: meta.not_before }), expires_on: expiresOn });
    try {
      const after = await metadata(token, admin);
      if (Date.parse(after.expires_on) !== expiry) throw new Error("unverified");
    } catch { throw new PreviewConnectionError("PREVIEW_READBACK_MISMATCH", "Đã gửi lệnh nhưng chưa xác minh được ngày hết hạn. Đồng bộ trước khi thử lại.", 502, acknowledged); }
    await audit(actor, "cloudflare_preview_expiry_updated", { tokenId: token.id, expiresOn });
    return { ...await state(), verified: true };
  }
  const acknowledged = await requestMutation(token, admin, "DELETE");
  let absent = false;
  try { await metadata(token, admin); } catch (error) { absent = error instanceof PreviewConnectionError && error.providerStatus === 404; }
  if (!absent) throw new PreviewConnectionError("PREVIEW_READBACK_MISMATCH", "Đã gửi lệnh thu hồi nhưng chưa xác minh được kết quả. Token được giữ trong Vault để kiểm tra lại.", 502, acknowledged);
  await clear(actor);
  await audit(actor, "cloudflare_preview_token_revoked", { tokenId: token.id });
  return { ...await state(), revoked: true, verified: true };
}
