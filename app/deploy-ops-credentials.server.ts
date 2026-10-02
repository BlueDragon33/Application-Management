import { getControlDatabase, type ControlDeviceState } from "./control-device.server";

export type DeployOpsProvider = "vercel" | "neon" | "tinyfish";
export type DeployOpsCredentialSource = "worker" | "vault" | "missing";

type CredentialRow = {
  provider: DeployOpsProvider;
  credential_ciphertext: string;
  credential_iv: string;
  fingerprint: string;
  created_by: string;
  created_at: string;
  updated_at: string;
};

const ENV_BY_PROVIDER: Record<DeployOpsProvider, string> = {
  vercel: "VERCEL_TOKEN",
  neon: "NEON_API_KEY",
  tinyfish: "TINYFISH_API_KEY",
};

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function deployOpsProvider(value: unknown): DeployOpsProvider {
  const provider = text(value).toLowerCase();
  if (provider === "vercel" || provider === "neon" || provider === "tinyfish") return provider;
  throw new Error("INVALID_PROVIDER");
}

async function runtimeEnv() {
  try {
    const workers = await import("cloudflare:workers");
    return workers.env as unknown as Record<string, unknown>;
  } catch {
    return process.env as unknown as Record<string, unknown>;
  }
}

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function base64UrlToBytes(value: string) {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error("INVALID_ENCRYPTED_CREDENTIAL");
  const padded = value.replaceAll("-", "+").replaceAll("_", "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
}

async function credentialKey() {
  const env = await runtimeEnv();
  const encoded = text(env.MANAGED_APP_CREDENTIAL_ENCRYPTION_KEY);
  if (!encoded) return null;
  const bytes = base64UrlToBytes(encoded);
  if (bytes.byteLength !== 32) throw new Error("INVALID_CREDENTIAL_ENCRYPTION_KEY");
  return crypto.subtle.importKey("raw", bytes, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

export async function deployOpsCredentialEncryptionReady() {
  try { return Boolean(await credentialKey()); }
  catch { return false; }
}

async function encryptCredential(value: string) {
  const key = await credentialKey();
  if (!key) throw new Error("CREDENTIAL_ENCRYPTION_KEY_MISSING");
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(value),
  );
  return {
    ciphertext: bytesToBase64Url(new Uint8Array(encrypted)),
    iv: bytesToBase64Url(iv),
  };
}

async function decryptCredential(row: CredentialRow) {
  const key = await credentialKey();
  if (!key) return "";
  try {
    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: base64UrlToBytes(row.credential_iv) },
      key,
      base64UrlToBytes(row.credential_ciphertext),
    );
    return new TextDecoder().decode(decrypted);
  } catch {
    return "";
  }
}

function fingerprint(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const tail = trimmed.slice(-4);
  return `••••${tail}`;
}

function validCredential(value: string) {
  return value.length >= 8
    && value.length <= 8192
    && !/[\u0000-\u001f\u007f]/.test(value);
}

async function vaultRow(provider: DeployOpsProvider) {
  const database = await getControlDatabase();
  return await database.prepare(
    `SELECT provider, credential_ciphertext, credential_iv, fingerprint, created_by, created_at, updated_at
       FROM deploy_ops_credentials WHERE provider=? LIMIT 1`,
  ).bind(provider).first<CredentialRow>();
}

export async function loadDeployOpsCredential(provider: DeployOpsProvider) {
  const env = await runtimeEnv();
  const envName = ENV_BY_PROVIDER[provider];
  const workerValue = text(env[envName]);
  if (workerValue) {
    return {
      value: workerValue,
      configured: true,
      source: "worker" as const,
      fingerprint: "Worker secret",
      encryptionReady: await deployOpsCredentialEncryptionReady(),
    };
  }

  const row = await vaultRow(provider);
  if (!row) {
    return {
      value: "",
      configured: false,
      source: "missing" as const,
      fingerprint: "",
      encryptionReady: await deployOpsCredentialEncryptionReady(),
    };
  }

  const value = await decryptCredential(row);
  return {
    value,
    configured: Boolean(value),
    source: value ? "vault" as const : "missing" as const,
    fingerprint: row.fingerprint,
    encryptionReady: await deployOpsCredentialEncryptionReady(),
  };
}

export async function deployOpsCredentialStatus() {
  const entries = await Promise.all(
    (["vercel", "neon", "tinyfish"] as const).map(async (provider) => {
      const credential = await loadDeployOpsCredential(provider);
      return [provider, {
        configured: credential.configured,
        source: credential.source,
        fingerprint: credential.source === "vault" ? credential.fingerprint : credential.source === "worker" ? "Worker secret" : "",
      }] as const;
    }),
  );
  return {
    encryptionReady: await deployOpsCredentialEncryptionReady(),
    providers: Object.fromEntries(entries) as Record<DeployOpsProvider, {
      configured: boolean;
      source: DeployOpsCredentialSource;
      fingerprint: string;
    }>,
  };
}

export async function saveDeployOpsCredential(
  providerValue: unknown,
  credentialValue: unknown,
  actor: ControlDeviceState,
) {
  if (actor.role !== "owner") throw new Error("OWNER_REQUIRED");
  const provider = deployOpsProvider(providerValue);
  const credential = text(credentialValue);
  if (!validCredential(credential)) throw new Error("INVALID_PROVIDER_CREDENTIAL");

  const encrypted = await encryptCredential(credential);
  const database = await getControlDatabase();
  await database.prepare(
    `INSERT INTO deploy_ops_credentials
      (provider, credential_ciphertext, credential_iv, fingerprint, created_by, updated_at)
     VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(provider) DO UPDATE SET
       credential_ciphertext=excluded.credential_ciphertext,
       credential_iv=excluded.credential_iv,
       fingerprint=excluded.fingerprint,
       created_by=excluded.created_by,
       updated_at=CURRENT_TIMESTAMP`,
  ).bind(
    provider,
    encrypted.ciphertext,
    encrypted.iv,
    fingerprint(credential),
    actor.email,
  ).run();

  await database.prepare(
    "INSERT INTO control_audit_log (actor, action, target, detail_json) VALUES (?, ?, ?, ?)",
  ).bind(
    actor.email,
    "deploy_ops_credential_saved",
    provider,
    JSON.stringify({ provider, storage: "encrypted-d1-vault", fingerprint: fingerprint(credential) }),
  ).run();

  return {
    provider,
    configured: true,
    source: "vault" as const,
    fingerprint: fingerprint(credential),
  };
}

export async function removeDeployOpsCredential(providerValue: unknown, actor: ControlDeviceState) {
  if (actor.role !== "owner") throw new Error("OWNER_REQUIRED");
  const provider = deployOpsProvider(providerValue);
  const database = await getControlDatabase();
  await database.prepare("DELETE FROM deploy_ops_credentials WHERE provider=?").bind(provider).run();
  await database.prepare(
    "INSERT INTO control_audit_log (actor, action, target, detail_json) VALUES (?, ?, ?, ?)",
  ).bind(
    actor.email,
    "deploy_ops_credential_removed",
    provider,
    JSON.stringify({ provider, storage: "encrypted-d1-vault" }),
  ).run();
  const effective = await loadDeployOpsCredential(provider);
  return {
    provider,
    configured: effective.configured,
    source: effective.source,
    fingerprint: effective.source === "worker" ? "Worker secret" : "",
  };
}
