import fs from "node:fs/promises";
import { createReadStream, createWriteStream } from "node:fs";
import path from "node:path";
import os from "node:os";
import { pipeline } from "node:stream/promises";
import { createCipheriv, createDecipheriv, createHash, createPublicKey, publicEncrypt, privateDecrypt, randomBytes, constants } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { pathToFileURL } from "node:url";
import { DatabaseSync } from "node:sqlite";

const execute = promisify(execFile);
const magic = Buffer.from("AMBACK1\n");
const apps = [
  { appId: "application-management", databaseName: "application-management-production-db", databaseId: "8a626342-21fd-46a7-bfbd-1c3c4866c999", required: ["control_accounts", "control_sessions", "control_members", "control_devices", "control_audit_log", "managed_app_catalog"] },
  { appId: "boi-ech", databaseName: "boi-ech-db", databaseId: "7816425d-ce8a-4b3c-b303-7697fd4a529c", required: ["device_access", "device_profiles"] },
];
const digest = data => createHash("sha256").update(data).digest("hex");
function recipient(pem) {
  if (typeof pem !== "string" || !pem.trim().startsWith("-----BEGIN PUBLIC KEY-----") || pem.includes("PRIVATE KEY")) throw new Error("RECIPIENT_PUBLIC_KEY_REQUIRED");
  let key;
  try { key = createPublicKey(pem); } catch { throw new Error("RECIPIENT_PUBLIC_KEY_INVALID"); }
  const bits = key.asymmetricKeyDetails?.modulusLength;
  if (key.asymmetricKeyType !== "rsa" || !Number.isInteger(bits) || bits < 3072 || bits > 8192) throw new Error("RECIPIENT_RSA3072_REQUIRED");
  return key;
}

export async function sealBackup(input, output, pem) {
  const key = recipient(pem), secret = randomBytes(32), iv = randomBytes(12);
  const wrapped = publicEncrypt({ key, oaepHash: "sha256", padding: constants.RSA_PKCS1_OAEP_PADDING }, secret);
  const header = Buffer.from(JSON.stringify({ version: 1, cipher: "aes-256-gcm", keyAlgorithm: "RSA-OAEP-SHA256", wrappedKey: wrapped.toString("base64"), iv: iv.toString("base64"), recipientSha256: digest(key.export({ type: "spki", format: "der" })) }));
  const size = Buffer.alloc(4); size.writeUInt32BE(header.length);
  const aad = Buffer.concat([magic, size, header]);
  const cipher = createCipheriv("aes-256-gcm", secret, iv); cipher.setAAD(aad);
  const handle = await fs.open(output, "wx", 0o600);
  try {
    await handle.writeFile(aad); await handle.close();
    await pipeline(createReadStream(input), cipher, createWriteStream(output, { flags: "a", mode: 0o600 }));
    await fs.appendFile(output, cipher.getAuthTag());
  } catch {
    await handle.close().catch(() => {}); await fs.rm(output, { force: true }); throw new Error("BACKUP_ENCRYPTION_FAILED");
  } finally { secret.fill(0); }
}

// Restore is local-only. Authentication must succeed before the final path appears.
export async function openBackup(input, output, privateKey) {
  const handle = await fs.open(input, "r"); let secret;
  const temp = `${output}.${randomBytes(12).toString("hex")}.partial`;
  try {
    const prefix = Buffer.alloc(12); if ((await handle.read(prefix, 0, 12, 0)).bytesRead !== 12 || !prefix.subarray(0, 8).equals(magic)) throw new Error("BACKUP_FORMAT_INVALID");
    const length = prefix.readUInt32BE(8), stat = await handle.stat();
    if (length < 1 || length > 16_384 || stat.size <= 12 + length + 16) throw new Error("BACKUP_FORMAT_INVALID");
    const headerBytes = Buffer.alloc(length); if ((await handle.read(headerBytes, 0, length, 12)).bytesRead !== length) throw new Error("BACKUP_FORMAT_INVALID");
    const header = JSON.parse(headerBytes.toString("utf8"));
    if (header.version !== 1 || header.cipher !== "aes-256-gcm" || header.keyAlgorithm !== "RSA-OAEP-SHA256") throw new Error("BACKUP_FORMAT_INVALID");
    const iv = Buffer.from(header.iv, "base64"); if (iv.length !== 12) throw new Error("BACKUP_FORMAT_INVALID");
    secret = privateDecrypt({ key: privateKey, oaepHash: "sha256", padding: constants.RSA_PKCS1_OAEP_PADDING }, Buffer.from(header.wrappedKey, "base64"));
    if (secret.length !== 32) throw new Error("BACKUP_FORMAT_INVALID");
    const tag = Buffer.alloc(16); await handle.read(tag, 0, 16, stat.size - 16);
    const decipher = createDecipheriv("aes-256-gcm", secret, iv); decipher.setAAD(Buffer.concat([prefix, headerBytes])); decipher.setAuthTag(tag);
    await pipeline(createReadStream(input, { start: 12 + length, end: stat.size - 17 }), decipher, createWriteStream(temp, { flags: "wx", mode: 0o600 }));
    await fs.link(temp, output); // exclusive, never overwrite an existing recovery file
    await fs.rm(temp);
  } catch { await fs.rm(temp, { force: true }); throw new Error("BACKUP_RESTORE_FAILED"); }
  finally { secret?.fill(0); await handle.close(); }
}

function inspectSql(sql, app) {
  const db = new DatabaseSync(":memory:");
  try {
    db.exec(sql);
    const integrity = db.prepare("PRAGMA integrity_check").all();
    if (integrity.length !== 1 || Object.values(integrity[0])[0] !== "ok") throw new Error("SQL_INTEGRITY_FAILED");
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map(x => x.name);
    if (app.required.some(name => !tables.includes(name))) throw new Error("BACKUP_REQUIRED_SCHEMA_MISSING");
    const quote = value => '"' + value.replaceAll('"', '""') + '"';
    const counts = Object.fromEntries(tables.map(name => [name, db.prepare(`SELECT COUNT(*) AS n FROM ${quote(name)}`).get().n]));
    const objects = new Set();
    if (app.appId === "boi-ech") {
      for (const [table, column] of [["device_access", "payment_proof_key"], ["payment_reviews", "proof_key"]]) {
        if (!tables.includes(table)) continue;
        const columns = db.prepare(`PRAGMA table_info(${quote(table)})`).all();
        if (!columns.some(row => row.name === column)) continue;
        for (const row of db.prepare(`SELECT DISTINCT ${quote(column)} AS key FROM ${quote(table)} WHERE ${quote(column)} IS NOT NULL AND ${quote(column)} <> ''`).all()) objects.add(row.key);
      }
    }
    return { counts, objects: [...objects].sort() };
  } finally { db.close(); }
}

export async function runCutoverBackup({ env, recipientPublicKey, outputDirectory, fetch: http = fetch, runWrangler }) {
  if (env.CUTOVER_BACKUP_CONFIRM !== "EXPORT_ENCRYPTED_BACKUP" || env.GITHUB_ACTOR !== "BlueDragon33") throw new Error("BACKUP_NOT_AUTHORIZED");
  recipient(recipientPublicKey);
  const account = String(env.CLOUDFLARE_ACCOUNT_ID ?? "").trim();
  if (!/^[a-f0-9]{32}$/i.test(account) || String(env.CLOUDFLARE_API_TOKEN ?? "").length < 20 || !/^[a-f0-9]{40}$/i.test(env.GITHUB_SHA ?? "")) throw new Error("BACKUP_CONFIGURATION_INVALID");
  const bindings = new Map();
  for (const app of apps) {
    let body;
    try {
      const response = await http(`https://api.cloudflare.com/client/v4/accounts/${account}/workers/scripts/${app.appId}/settings`, { method: "GET", redirect: "error", signal: AbortSignal.timeout(20_000), headers: { authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}` } });
      if (!response.ok) throw new Error(); body = await response.json();
    } catch { throw new Error("LIVE_BINDING_READ_FAILED"); }
    const list = body?.result?.bindings;
    if (body?.success !== true || !Array.isArray(list) || list.filter(x => x.name === "DB").length !== 1 || !list.some(x => x.name === "DB" && x.type === "d1" && x.id?.toLowerCase() === app.databaseId)) throw new Error("LIVE_DATABASE_BINDING_MISMATCH");
    bindings.set(app.appId, list);
  }
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), "private-cutover-backup-")); await fs.chmod(temp, 0o700);
  try {
    const content = path.join(temp, "content"); await fs.mkdir(content, { mode: 0o700 });
    const config = path.join(temp, "wrangler.json");
    await fs.writeFile(config, JSON.stringify({ name: "read-only-cutover-export", compatibility_date: "2026-08-26", d1_databases: apps.map(a => ({ binding: a.appId.replaceAll("-", "_"), database_name: a.databaseName, database_id: a.databaseId })) }), { mode: 0o600 });
    const manifest = { format: "application-management.cutover-backup/v1", observedAt: new Date().toISOString(), revision: env.GITHUB_SHA, scope: "Cloudflare targets only; legacy Sites not exported", databases: [], objects: [] };
    let objectKeys = [];
    for (const app of apps) {
      const filename = `${app.appId}.sql`, output = path.join(content, filename);
      try { await runWrangler(["d1", "export", app.databaseName, "--remote", "--skip-confirmation", "--config", config, "--output", output]); } catch { throw new Error("DATABASE_EXPORT_FAILED"); }
      await fs.chmod(output, 0o600);
      const sql = await fs.readFile(output), inspected = inspectSql(sql.toString("utf8"), app);
      manifest.databases.push({ appId: app.appId, databaseId: app.databaseId, filename, bytes: sql.length, sha256: digest(sql), integrity: "ok", counts: inspected.counts });
      if (app.appId === "boi-ech") objectKeys = inspected.objects;
    }
    const buckets = bindings.get("boi-ech").filter(x => x.name === "BUCKET" && x.type === "r2_bucket");
    if (objectKeys.length && (buckets.length !== 1 || !/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(buckets[0].bucket_name ?? ""))) throw new Error("OBJECT_BUCKET_UNVERIFIED");
    for (const key of objectKeys) {
      if (typeof key !== "string" || !key.startsWith("payment-proofs/") || /[%\\?#\x00-\x1f\x7f]/.test(key) || Buffer.byteLength(key) > 1024 || key.split("/").some(p => p === ".." || p === ".")) throw new Error("OBJECT_REFERENCE_UNSAFE");
      const bucket = buckets[0], jurisdiction = bucket.jurisdiction;
      if (jurisdiction && !["eu", "fedramp"].includes(jurisdiction)) throw new Error("OBJECT_JURISDICTION_UNSUPPORTED");
      const filename = `object-${digest(key)}.bin`, output = path.join(content, filename);
      try { await runWrangler(["r2", "object", "get", `${bucket.bucket_name}/${key}`, "--remote", "--file", output, ...jurisdiction ? ["--jurisdiction", jurisdiction] : []]); } catch { throw new Error("OBJECT_EXPORT_FAILED"); }
      await fs.chmod(output, 0o600); const bytes = await fs.readFile(output);
      if (!bytes.length) throw new Error("OBJECT_EXPORT_EMPTY");
      manifest.objects.push({ key, filename, bytes: bytes.length, sha256: digest(bytes) });
    }
    await fs.writeFile(path.join(content, "manifest.json"), JSON.stringify(manifest), { mode: 0o600 });
    const archive = path.join(temp, "backup.tar.gz");
    try { await execute("tar", ["-czf", archive, "-C", content, "."], { timeout: 120_000, maxBuffer: 1024 * 1024 }); } catch { throw new Error("BACKUP_ARCHIVE_FAILED"); }
    await fs.mkdir(outputDirectory, { recursive: true, mode: 0o700 });
    const file = path.join(outputDirectory, "cutover-backup.enc");
    await sealBackup(archive, file, recipientPublicKey);
    return { complete: true, scope: "cloudflare-targets", file, sha256: digest(await fs.readFile(file)), objects: manifest.objects.length, databases: manifest.databases.map(x => ({ appId: x.appId, tables: Object.keys(x.counts).length, rows: Object.values(x.counts).reduce((a, b) => a + b, 0) })), legacySitesExported: false, productionMutations: 0 };
  } finally { await fs.rm(temp, { recursive: true, force: true }); }
}

export function privateWranglerRunner(environment, { cwd = process.cwd() } = {}) {
  // Disk debug logs otherwise retain signed SQL download URLs outside cleanup.
  const env = { ...environment, CLOUDFLARE_ACCOUNT_ID: String(environment.CLOUDFLARE_ACCOUNT_ID ?? "").trim(), WRANGLER_SEND_METRICS: "false", WRANGLER_WRITE_LOGS: "false" };
  return async args => {
    if (!(args[0] === "d1" && args[1] === "export") && !(args[0] === "r2" && args[1] === "object" && args[2] === "get")) throw new Error("BACKUP_COMMAND_FORBIDDEN");
    await execute(process.execPath, ["node_modules/wrangler/bin/wrangler.js", ...args], { env, cwd, timeout: 600_000, maxBuffer: 4 * 1024 * 1024 });
  };
}

async function main() {
  process.umask(0o077);
  const env = { ...process.env };
  const runWrangler = privateWranglerRunner(env);
  const pem = Buffer.from(env.CUTOVER_BACKUP_PUBLIC_KEY_B64 ?? "", "base64").toString("utf8");
  try {
    const result = await runCutoverBackup({ env, recipientPublicKey: pem, outputDirectory: path.resolve(".sites-runtime/encrypted-cutover-backup"), runWrangler });
    console.log(JSON.stringify(result));
  } catch (error) {
    const code = typeof error?.message === "string" && /^(?:BACKUP|RECIPIENT|LIVE|DATABASE|SQL|OBJECT)_[A-Z0-9_]+$/.test(error.message) ? error.message : "BACKUP_FAILED";
    console.error(code); process.exitCode = 1;
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) await main();
