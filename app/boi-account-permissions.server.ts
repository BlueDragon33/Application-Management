type RecordValue = Record<string, unknown>;
type Invoke = (body: RecordValue) => Promise<RecordValue>;
const ACCOUNT = /^acc_[a-f0-9]{64}$/;
const scopes = ["manager.approve.registration", "manager.manage.assigned", "registrants.read.all"];
export type AccountControlRow = { accountId: string; name: string; personCode: string; role: "manager"; status: string;
  revision: number; permissions: { scope: string; configured: boolean; effective: boolean; expiresAt: number | null }[] };
function row(value: RecordValue): AccountControlRow {
  if (typeof value.accountId !== "string" || !ACCOUNT.test(value.accountId) || value.role !== "manager" ||
    !Number.isSafeInteger(value.revision) || Number(value.revision) < 0 ||
    !["pending", "approved", "blocked"].includes(String(value.status)) || !Array.isArray(value.permissions)) throw new Error("ACCOUNT_SOURCE_CONTRACT_INVALID");
  const permissions = value.permissions.map((raw: unknown) => {
    if (!raw || typeof raw !== "object") throw new Error("ACCOUNT_SOURCE_CONTRACT_INVALID");
    const p = raw as RecordValue;
    if (!scopes.includes(String(p.scope)) || typeof p.configured !== "boolean" || typeof p.effective !== "boolean" ||
      (p.expiresAt !== null && !Number.isSafeInteger(p.expiresAt))) throw new Error("ACCOUNT_SOURCE_CONTRACT_INVALID");
    return { scope: String(p.scope), configured: p.configured, effective: p.effective, expiresAt: p.expiresAt === null ? null : Number(p.expiresAt) };
  });
  if (new Set(permissions.map(p => p.scope)).size !== permissions.length) throw new Error("ACCOUNT_SOURCE_CONTRACT_INVALID");
  // Control plane receives only explicitly named administration fields, never a source profile/credential dump.
  return { accountId: value.accountId, role: "manager", revision: Number(value.revision), status: String(value.status),
    name: typeof value.name === "string" ? value.name : "", personCode: typeof value.personCode === "string" ? value.personCode : "", permissions };
}
export async function accountPermissionOperation(role: string, input: RecordValue, invoke: Invoke) {
  if (role !== "owner") throw new Error("OWNER_REQUIRED");
  if (input.operation === "list") {
    const data = await invoke({ action: "list" });
    if (!Array.isArray(data.accounts) || data.accounts.length > 100) throw new Error("ACCOUNT_SOURCE_CONTRACT_INVALID");
    return { ok: true, accounts: data.accounts.map((r: unknown) => row(r as RecordValue)) };
  }
  if (typeof input.accountId !== "string" || !ACCOUNT.test(input.accountId) || !Number.isSafeInteger(input.expectedRevision)) throw new Error("ACCOUNT_INPUT_INVALID");
  if (!["approve-manager", "management", "read-all"].includes(String(input.operation))) throw new Error("ACCOUNT_INPUT_INVALID");
  const current = row(await invoke({ action: "read", accountId: input.accountId }));
  if (current.accountId !== input.accountId || current.revision !== input.expectedRevision) throw new Error("ACCOUNT_CAS_CONFLICT");
  const enabled = input.operation === "approve-manager" ? true : input.enabled;
  if (typeof enabled !== "boolean") throw new Error("ACCOUNT_INPUT_INVALID");
  const expiresAt = input.expiresAt ?? null;
  if (expiresAt !== null && (!Number.isSafeInteger(expiresAt) || Number(expiresAt) <= Date.now())) throw new Error("ACCOUNT_INPUT_INVALID");
  await invoke({ action: "command", operation: input.operation, accountId: input.accountId, expectedRevision: input.expectedRevision, enabled, expiresAt });
  // A mutation response is not persistence evidence. Issue a fresh owning-D1 read.
  const confirmed = row(await invoke({ action: "read", accountId: input.accountId }));
  const required = input.operation === "read-all" ? ["registrants.read.all"] : ["manager.approve.registration", "manager.manage.assigned"];
  if (confirmed.accountId !== input.accountId || confirmed.revision !== current.revision + 1 ||
    (input.operation === "approve-manager" && confirmed.status !== "approved") ||
    required.some(scope => { const p = confirmed.permissions.find(p => p.scope === scope); return p?.configured !== enabled || p.expiresAt !== expiresAt; })) throw new Error("ACCOUNT_READBACK_FAILED");
  return { ok: true, account: confirmed };
}
