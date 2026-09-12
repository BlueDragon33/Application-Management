import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const auth = fs.readFileSync("app/chatgpt-auth.ts", "utf8");
const previewGate = fs.readFileSync("worker/preview-access.ts", "utf8");
const worker = fs.readFileSync("worker/index.ts", "utf8");
const vite = fs.readFileSync("vite.config.ts", "utf8");
const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
const gitignore = fs.readFileSync(".gitignore", "utf8");
const localConfig = fs.readFileSync("wrangler.local.jsonc", "utf8");
const localExample = fs.readFileSync(".dev.vars.example", "utf8");
const cloudflareTemplate = fs.readFileSync("wrangler.cloudflare.example.jsonc", "utf8");
const standard = fs.readFileSync("docs/LOCAL_FIRST_RELEASE_STANDARD.md", "utf8");
const cloudflareTrack = fs.readFileSync("docs/CLOUDFLARE_DEPLOYMENT_TRACK.md", "utf8");
const launcher = fs.readFileSync("scripts/run-local.mjs", "utf8");
const bat = fs.readFileSync("RUN_LOCAL.bat", "utf8");

test("local auth is explicit and loopback-only", () => {
  assert.ok(auth.includes('runtime.LOCAL_DEV_AUTH !== "1"'));
  assert.ok(auth.includes("LOOPBACK_HOST.test(host)"));
  assert.match(auth, /localhost\|127\\\.0\\\.0\\\.1\|\\\[::1\\\]/);
  assert.equal(auth.includes("0.0.0.0"), false);
  assert.equal(auth.includes("terminal.local"), false);
  const chat = auth.indexOf("if (userId && email)");
  const local = auth.indexOf("const localUser = localDevelopmentUser");
  const failClosed = auth.indexOf("return null", local);
  assert.ok(chat >= 0 && local > chat && failClosed > local);
  assert.equal(auth.includes("getCloudflareAccessUser"), false);
});

test("local launcher uses isolated D1 and does not require Work", () => {
  assert.equal(pkg.scripts.dev, "vite");
  assert.equal(pkg.scripts.local, "node scripts/run-local.mjs");
  assert.ok(pkg.scripts["local:db"].includes("--local"));
  assert.ok(localConfig.includes('"migrations_dir": "drizzle"'));
  assert.ok(launcher.includes('"--local"'));
  assert.ok(launcher.includes('"127.0.0.1"'));
  assert.ok(bat.includes("scripts\\run-local.mjs"));
});

test("local secrets remain untracked and dev bindings are serve-only", () => {
  assert.ok(gitignore.split(/\r?\n/).includes(".dev.vars"));
  assert.ok(localExample.includes("LOCAL_DEV_AUTH=1"));
  assert.ok(localExample.includes("CONTROL_OWNER_EMAILS=local.owner@example.test"));
  assert.ok(vite.includes('if (command !== "serve") return undefined'));
  assert.ok(vite.includes('"LOCAL_DEV_AUTH"'));
});

test("Cloudflare preview never inherits the local auth bypass or Zero Trust dependency", () => {
  assert.equal(/"LOCAL_DEV_AUTH"\s*:/.test(cloudflareTemplate), false);
  assert.equal(cloudflareTemplate.includes("CF_ACCESS_TEAM_DOMAIN"), false);
  assert.equal(cloudflareTemplate.includes("CF_ACCESS_AUD"), false);
  assert.equal(cloudflareTemplate.includes("APPLICATION_MANAGEMENT_PREVIEW_ACCESS_SECRET"), false);
  assert.ok(gitignore.split(/\r?\n/).includes("wrangler.cloudflare.jsonc"));
  assert.ok(previewGate.includes("Authorization: Bearer <preview-secret>"));
  assert.ok(previewGate.includes("secretNeverInUrl"));
  assert.ok(worker.includes("APPLICATION_MANAGEMENT_PREVIEW_ACCESS_SECRET?: string"));
  assert.ok(cloudflareTrack.includes("application-level preview secret"));
  assert.ok(cloudflareTrack.includes("không phụ thuộc Cloudflare Zero Trust"));
});

test("release standard is GitHub -> local -> hosted, not publish-driven development", () => {
  for (const token of ["GitHub", "Local PC", "GitHub Desktop", "RUN_LOCAL.bat", "Gate trước khi publish", "Cloudflare track"]) {
    assert.ok(standard.includes(token), `missing release-standard token: ${token}`);
  }
});
