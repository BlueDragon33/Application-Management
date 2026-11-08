import fs from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { createHmac } from "node:crypto";
import ts from "typescript";
import { loadTs } from "./load-ts.mjs";

// Real production auth/session SQL after an already-verified identity. This
// harness does not claim to run Google OIDC or a real browser authentication.
export function productionAuthFixture() {
  const sqlite = new DatabaseSync(":memory:");
  for (const migration of ["0004_production_accounts", "0012_google_auth_identities", "0013_totp_step_up"]) {
    sqlite.exec(fs.readFileSync(`drizzle/${migration}.sql`, "utf8"));
  }
  const email = "owner@example.test";
  sqlite.prepare("INSERT INTO control_accounts(email,display_name,password_salt,password_hash,password_iterations,must_change_password) VALUES (?,'Owner','test-salt','test-hash',100000,0)").run(email);
  sqlite.prepare("INSERT INTO control_auth_identities(provider,provider_subject,account_email,provider_email,email_verified) VALUES ('google','verified-fixture-subject',?,?,1)").run(email, email);
  let seconds = Math.floor(Date.now() / 1000);
  class ClockDate extends Date { static now() { return seconds * 1000; } }
  const env = { CONTROL_OWNER_EMAILS: email, DB: { prepare(sql) {
    return { bind(...values) {
      const statement = sqlite.prepare(sql);
      const parameters = Object.fromEntries(values.map((value, index) => [`?${index + 1}`, value]));
      return { first: async () => statement.get(parameters) ?? null, run: async () => statement.run(parameters) };
    } };
  } } };
  const dependencies = { "./google-oauth": loadTs("worker/google-oauth.ts"), "./totp": loadTs("worker/totp.ts") };
  // Expose private issuance only in this test's compiled module, never in the
  // production API. No session, cookie or crypto method is mocked.
  const source = fs.readFileSync("worker/production-auth.ts", "utf8") + "\nexport { createSession as fixtureCreateSession };\n";
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const loadedModule = { exports: {} };
  new Function("require", "module", "exports", "Date", output)(name => {
    if (!Object.hasOwn(dependencies, name)) throw new Error(`Unexpected auth dependency ${name}`);
    return dependencies[name];
  }, loadedModule, loadedModule.exports, ClockDate);
  const auth = loadedModule.exports;
  const totpSecret = "JBSWY3DPEHPK3PXP";
  const totpCode = () => {
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
    const bits = [...totpSecret].map(char => alphabet.indexOf(char).toString(2).padStart(5, "0")).join("");
    const key = Buffer.from(bits.match(/.{8}/g).map(byte => parseInt(byte, 2)));
    const bytes = Buffer.alloc(8); bytes.writeBigUInt64BE(BigInt(Math.floor(seconds / 30)));
    const digest = createHmac("sha1", key).update(bytes).digest();
    return String((digest.readUInt32BE(digest.at(-1) & 15) & 0x7fffffff) % 1000000).padStart(6, "0");
  };
  const enableTotp = async () => {
    const key = await crypto.subtle.importKey("raw", new Uint8Array(32), "AES-GCM", false, ["encrypt"]);
    const iv = new Uint8Array(12);
    const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(totpSecret));
    sqlite.prepare("INSERT INTO control_mfa_factors(account_email,secret_ciphertext,secret_iv,enabled,verified_at) VALUES (?,?,?,1,1)").run(email, Buffer.from(ciphertext).toString("base64url"), Buffer.from(iv).toString("base64url"));
    env.APPLICATION_MANAGEMENT_MFA_ENCRYPTION_KEY = "A".repeat(43);
  };
  const request = (session, path = "/", options = {}) => new Request(`https://management.test${path}`, {
    ...options, headers: { cookie: `__Host-am_prod_session=${session.token}`, ...options.headers },
  });
  return {
    auth, env, sqlite, email, request, enableTotp, totpCode,
    now: () => seconds,
    advance: amount => { seconds += amount; },
    issue: (method = "google") => auth.fixtureCreateSession(env, email, method),
    identity: session => auth.productionIdentity(request(session), env),
    row: session => sqlite.prepare("SELECT * FROM control_sessions WHERE session_id_hash=?").get(session.sessionHash),
    close: () => sqlite.close(),
  };
}
