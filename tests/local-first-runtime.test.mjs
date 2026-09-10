import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const auth = fs.readFileSync("app/chatgpt-auth.ts", "utf8");
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
  assert.ok(auth.indexOf("if (userId && email)") < auth.indexOf("return localDevelopmentUser(requestHeaders)"));
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

test("Cloudflare track never inherits the local auth bypass", () => {
  assert.equal(/"LOCAL_DEV_AUTH"\s*:/.test(cloudflareTemplate), false);
  assert.ok(cloudflareTemplate.includes("CF_ACCESS_TEAM_DOMAIN"));
  assert.ok(cloudflareTemplate.includes("CF_ACCESS_AUD"));
  assert.ok(gitignore.split(/\r?\n/).includes("wrangler.cloudflare.jsonc"));
  assert.ok(cloudflareTrack.includes("Cloudflare Access"));
  assert.ok(cloudflareTrack.includes("Cf-Access-Jwt-Assertion"));
});

test("release standard is GitHub -> local -> hosted, not publish-driven development", () => {
  for (const token of ["GitHub", "Local PC", "GitHub Desktop", "RUN_LOCAL.bat", "Gate trước khi publish", "Cloudflare track"]) {
    assert.ok(standard.includes(token), `missing release-standard token: ${token}`);
  }
});
