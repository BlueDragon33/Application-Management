import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { generateKeyPairSync } from "node:crypto";
import { execFileSync } from "node:child_process";

const api = await import("../scripts/encrypted-cutover-backup.mjs").catch(() => ({}));
const keys = generateKeyPairSync("rsa", { modulusLength: 3072, publicKeyEncoding: { type: "spki", format: "pem" }, privateKeyEncoding: { type: "pkcs8", format: "pem" } });
async function temporary(t) { const dir = await fs.mkdtemp(path.join(os.tmpdir(), "backup-test-")); t.after(() => fs.rm(dir, { recursive: true, force: true })); return dir; }
function requireApi(name) { assert.equal(typeof api[name], "function", `${name}: encrypted backup is not implemented`); }

test("authenticated backup roundtrip preserves bytes while hiding private SQL", async t => {
  requireApi("sealBackup"); const dir = await temporary(t);
  const original = Buffer.from("CREATE TABLE people(phone TEXT); INSERT INTO people VALUES ('PRIVATE-PHONE');\n");
  await fs.writeFile(path.join(dir, "input"), original);
  await api.sealBackup(path.join(dir, "input"), path.join(dir, "sealed"), keys.publicKey);
  const ciphertext = await fs.readFile(path.join(dir, "sealed"));
  assert.equal(ciphertext.includes(Buffer.from("PRIVATE-PHONE")), false);
  await api.openBackup(path.join(dir, "sealed"), path.join(dir, "restored"), keys.privateKey);
  assert.deepEqual(await fs.readFile(path.join(dir, "restored")), original);
  assert.equal((await fs.stat(path.join(dir, "sealed"))).mode & 0o777, 0o600);
  await assert.rejects(api.sealBackup(path.join(dir, "input"), path.join(dir, "sealed"), keys.publicKey));
});

test("tampered ciphertext or wrong recipient cannot leave decrypted output", async t => {
  requireApi("sealBackup"); const dir = await temporary(t); await fs.writeFile(path.join(dir, "input"), "PRIVATE-PROGRESS");
  await api.sealBackup(path.join(dir, "input"), path.join(dir, "sealed"), keys.publicKey);
  const bytes = await fs.readFile(path.join(dir, "sealed")); bytes[bytes.length - 17] ^= 1; await fs.writeFile(path.join(dir, "broken"), bytes);
  await assert.rejects(api.openBackup(path.join(dir, "broken"), path.join(dir, "restored"), keys.privateKey));
  assert.equal(await fs.stat(path.join(dir, "restored")).then(() => true, () => false), false);
  const other = generateKeyPairSync("rsa", { modulusLength: 3072 });
  await assert.rejects(api.openBackup(path.join(dir, "sealed"), path.join(dir, "restored"), other.privateKey));
  assert.equal(await fs.stat(path.join(dir, "restored")).then(() => true, () => false), false);
});

const env = { CUTOVER_BACKUP_CONFIRM: "EXPORT_ENCRYPTED_BACKUP", CLOUDFLARE_ACCOUNT_ID: "a".repeat(32), CLOUDFLARE_API_TOKEN: "private-test-token-".repeat(2), GITHUB_SHA: "b".repeat(40), GITHUB_ACTOR: "BlueDragon33" };
function provider({ wrongBinding = false } = {}) {
  return async (url, options) => {
    assert.equal(options.method, "GET");
    const central = url.endsWith("/application-management/settings");
    const db = central ? "8a626342-21fd-46a7-bfbd-1c3c4866c999" : "7816425d-ce8a-4b3c-b303-7697fd4a529c";
    return new Response(JSON.stringify({ success: true, result: { bindings: [{ name: "DB", type: "d1", id: wrongBinding ? "00000000-0000-0000-0000-000000000000" : db }, ...central ? [] : [{ name: "BUCKET", type: "r2_bucket", bucket_name: "boi-payment-test" }]] } }), { status: 200 });
  };
}
function exporter({ missingObject = false, unsafeKey = false, referenceKey } = {}) {
  return async args => {
    if (args[0] === "d1" && args[1] === "export") {
      assert.ok(args.includes("--remote"));
      assert.equal(args.some(x => ["--table", "--no-data", "--no-schema"].includes(x)), false);
      const boi = args[2] === "boi-ech-db";
      const sql = boi ? `CREATE TABLE device_access(device_id TEXT, payment_proof_key TEXT, phone TEXT); INSERT INTO device_access VALUES ('private-device','${referenceKey ?? (unsafeKey ? "../escape" : "payment-proofs/private-device/proof.jpg")}','PRIVATE-PHONE'); CREATE TABLE device_profiles(device_id TEXT, completed_json TEXT); INSERT INTO device_profiles VALUES ('private-device','["01"]');` : "CREATE TABLE control_accounts(email TEXT,role TEXT,status TEXT); INSERT INTO control_accounts VALUES ('PRIVATE-EMAIL','owner','active'); CREATE TABLE control_sessions(id TEXT); CREATE TABLE control_members(id TEXT); CREATE TABLE control_devices(id TEXT); CREATE TABLE control_audit_log(id TEXT); CREATE TABLE managed_app_catalog(id TEXT);";
      await fs.writeFile(args[args.indexOf("--output") + 1], sql); return;
    }
    if (args[0] === "r2" && args[1] === "object" && args[2] === "get") {
      if (missingObject) throw new Error("PRIVATE-RAW-PROVIDER-ERROR");
      await fs.writeFile(args[args.indexOf("--file") + 1], Buffer.from([255, 216, 255, 23])); return;
    }
    assert.fail("unexpected CLI operation; only exports and object GET are permitted");
  };
}

test("verified owning exports produce a decryptable archive with SQL integrity and object hashes", async t => {
  requireApi("runCutoverBackup"); const dir = await temporary(t);
  const report = await api.runCutoverBackup({ env, recipientPublicKey: keys.publicKey, outputDirectory: dir, fetch: provider(), runWrangler: exporter() });
  assert.equal(report.complete, true); assert.equal(report.databases.length, 2); assert.equal(report.objects, 1);
  assert.equal(JSON.stringify(report).includes("PRIVATE"), false);
  await api.openBackup(report.file, path.join(dir, "restore.tar.gz"), keys.privateKey);
  const restored = path.join(dir, "restore"); await fs.mkdir(restored); execFileSync("tar", ["-xzf", path.join(dir, "restore.tar.gz"), "-C", restored]);
  const manifest = JSON.parse(await fs.readFile(path.join(restored, "manifest.json"), "utf8"));
  assert.equal(manifest.databases.find(x => x.appId === "boi-ech").counts.device_profiles, 1);
  assert.equal(manifest.objects[0].bytes, 4); assert.match(manifest.objects[0].sha256, /^[a-f0-9]{64}$/);
  assert.ok((await fs.readFile(path.join(restored, "boi-ech.sql"), "utf8")).includes("PRIVATE-PHONE"));
  assert.deepEqual((await fs.readdir(dir)).sort(), ["cutover-backup.enc", "restore", "restore.tar.gz"]);
});

test("wrong live binding fails before any SQL export", async t => {
  requireApi("runCutoverBackup"); const dir = await temporary(t); let exports = 0;
  await assert.rejects(api.runCutoverBackup({ env, recipientPublicKey: keys.publicKey, outputDirectory: dir, fetch: provider({ wrongBinding: true }), runWrangler: async () => { exports++; } }), /LIVE_DATABASE_BINDING_MISMATCH/);
  assert.equal(exports, 0); assert.deepEqual(await fs.readdir(dir), []);
});

test("missing proof or unsafe object reference cannot create a complete backup or expose raw errors", async t => {
  requireApi("runCutoverBackup");
  for (const scenario of [{ missingObject: true }, { unsafeKey: true }]) {
    const dir = await temporary(t);
    await assert.rejects(api.runCutoverBackup({ env, recipientPublicKey: keys.publicKey, outputDirectory: dir, fetch: provider(), runWrangler: exporter(scenario) }), error => !error.message.includes("PRIVATE") && /OBJECT/.test(error.message));
    assert.deepEqual(await fs.readdir(dir), []);
  }
});

test("weak or private recipient input and missing confirmation fail before provider access", async t => {
  requireApi("runCutoverBackup"); const dir = await temporary(t);
  const weak = generateKeyPairSync("rsa", { modulusLength: 2048, publicKeyEncoding: { type: "spki", format: "pem" } }).publicKey;
  for (const recipientPublicKey of [weak, keys.privateKey]) {
    await assert.rejects(api.runCutoverBackup({ env, recipientPublicKey, outputDirectory: dir, fetch: () => assert.fail("provider must not be called"), runWrangler: exporter() }), /RECIPIENT/);
  }
  await assert.rejects(api.runCutoverBackup({ env: { ...env, CUTOVER_BACKUP_CONFIRM: "" }, recipientPublicKey: keys.publicKey, outputDirectory: dir, fetch: () => assert.fail("provider must not be called"), runWrangler: exporter() }), /BACKUP_NOT_AUTHORIZED/);
});

test("URL-significant object references never escape the verified bucket", async t => {
  requireApi("runCutoverBackup");
  for (const referenceKey of ["payment-proofs/%2e%2e/%2e%2e/%2e%2e/other-bucket/objects/secret", "payment-proofs/a\\..\\..\\other-bucket\\secret", "payment-proofs/proof.jpg?other", "payment-proofs/proof.jpg#fragment"]) {
    const dir = await temporary(t);
    await assert.rejects(api.runCutoverBackup({ env, recipientPublicKey: keys.publicKey, outputDirectory: dir, fetch: provider(), runWrangler: exporter({ referenceKey }) }), /OBJECT_REFERENCE_UNSAFE/);
    assert.deepEqual(await fs.readdir(dir), []);
  }
});

test("every actual backup subprocess disables persistent Wrangler logs and telemetry", async t => {
  requireApi("privateWranglerRunner"); const dir = await temporary(t);
  await fs.mkdir(path.join(dir, "node_modules/wrangler/bin"), { recursive: true });
  await fs.writeFile(path.join(dir, "node_modules/wrangler/bin/wrangler.js"), "require('node:fs').writeFileSync(process.argv.at(-1),JSON.stringify({logs:process.env.WRANGLER_WRITE_LOGS,metrics:process.env.WRANGLER_SEND_METRICS,account:process.env.CLOUDFLARE_ACCOUNT_ID}));");
  const trace = path.join(dir, "child.json");
  const run = api.privateWranglerRunner({ ...process.env, CLOUDFLARE_ACCOUNT_ID: " "+"a".repeat(32)+" ", WRANGLER_WRITE_LOGS: "true", WRANGLER_SEND_METRICS: "true" }, { cwd: dir });
  await run(["d1", "export", "test-only", trace]);
  assert.deepEqual(JSON.parse(await fs.readFile(trace, "utf8")), { logs: "false", metrics: "false", account: "a".repeat(32) });
});
