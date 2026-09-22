import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

function source(path) {
  return fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

const resolver = source("app/client-origin.server.ts");
const launcher = source("scripts/run-local-system.mjs");
const auth = source("app/chatgpt-auth.ts");
const pkg = JSON.parse(source("package.json"));

test("hybrid resolver supports production, local and hybrid without allowing public HTTP production", () => {
  assert.match(resolver, /"production" \| "local" \| "hybrid"/);
  assert.match(resolver, /url\.protocol === "https:"/);
  assert.match(resolver, /allowPrivateHttp && url\.protocol === "http:" && isPrivateHostname/);
  assert.match(resolver, /await reachable\(local, spec\.probePath\)/);
  assert.match(resolver, /source: "local"/);
  assert.match(resolver, /source: "production"/);
  assert.match(resolver, /values\.LOCAL_DEV_AUTH === "1" \? "hybrid" : "production"/);
});

test("local port convention keeps Bauman control and learning runtime physically separate", () => {
  assert.match(resolver, /health-care[\s\S]*127\.0\.0\.1:3001/);
  assert.match(resolver, /ru-life[\s\S]*127\.0\.0\.1:3002/);
  assert.match(resolver, /bauman-master-ai[\s\S]*127\.0\.0\.1:3003/);
  assert.match(resolver, /bauman-runtime[\s\S]*BAUMAN_APP_ORIGIN[\s\S]*BAUMAN_APP_LOCAL_ORIGIN[\s\S]*127\.0\.0\.1:3005/);
  assert.match(resolver, /boi-ech[\s\S]*127\.0\.0\.1:3004/);
  assert.match(launcher, /baumanRuntimeOrigin = "http:\/\/127\.0\.0\.1:3005"/);
  assert.match(launcher, /BAUMAN_APP_LOCAL_ORIGIN: baumanRuntimeOrigin/);
});

test("all managed client bridges use the shared resolver and no chatgpt.site fallback", () => {
  for (const path of ["app/health-care.server.ts", "app/ru-life.server.ts", "app/boi-ech.server.ts", "app/bauman.server.ts"]) {
    const bridge = source(path);
    assert.match(bridge, /resolveClientOrigin/);
    assert.doesNotMatch(bridge, /dinhnam3391\.chatgpt\.site/);
  }
  const bauman = source("app/bauman.server.ts");
  assert.match(bauman, /resolveClientOrigin\("bauman-runtime"\)/);
  assert.match(bauman, /runtimeBaseUrl: runtimeOrigin\?\.baseUrl \?\? null/);
});

test("full local launcher keeps repos independent and local databases isolated", () => {
  for (const token of ["Health_Care", "RU_LIFE", "Bauman-master-ai-system", "BOIECH_AI", "Application Management"]) {
    assert.ok(launcher.includes(token), `missing launcher repo token: ${token}`);
  }
  for (const port of [3000, 3001, 3002, 3003, 3004, 3005]) {
    assert.ok(launcher.includes(String(port)), `missing local port ${port}`);
  }
  assert.match(launcher, /randomBytes\(48\)\.toString\("base64url"\)/);
  assert.match(launcher, /"--local"/);
  assert.match(launcher, /wrangler\.local\.jsonc/);
  assert.match(launcher, /Health_Care\/wrangler\.local\.jsonc/);
  assert.match(launcher, /RU_LIFE\/wrangler\.local\.jsonc/);
  assert.match(launcher, /health-care-local-db/);
  assert.match(launcher, /ru-life-local/);
  assert.match(launcher, /Migration D1 local · Bauman Control/);
  assert.match(launcher, /"bauman-control-local", "--local", "--config", "wrangler\.local\.jsonc"/);
  assert.match(launcher, /Bauman control-service\/wrangler\.local\.jsonc/);
  assert.match(launcher, /"wrangler", "dev", "--local", "--config", "wrangler\.local\.jsonc"/);
  assert.match(launcher, /BAUMAN_APP_ORIGIN/);
  assert.match(launcher, /BAUMAN_APP_LOCAL_ORIGIN/);
  assert.match(launcher, /scripts\/serve-local-runtime\.mjs/);
  assert.match(launcher, /BAUMAN-RUNTIME/);
  assert.match(launcher, /_local\/health/);
  assert.doesNotMatch(launcher, /"--remote"/);
  assert.doesNotMatch(launcher, /workers\.dev/);
});

test("launcher uses the existing loopback-only development auth instead of creating a second auth bypass", () => {
  assert.match(launcher, /LOCAL_DEV_AUTH/);
  assert.match(auth, /runtime\.LOCAL_DEV_AUTH !== "1"/);
  assert.match(auth, /LOOPBACK_HOST\.test\(host\)/);
  assert.doesNotMatch(launcher, /LOCAL_ADMIN_PASSWORD|passwordHash|bcrypt|PBKDF2/i);
});

test("package exposes central-only and full-system launch paths separately", () => {
  assert.equal(pkg.scripts.local, "node scripts/run-local.mjs");
  assert.equal(pkg.scripts["local:system"], "node scripts/run-local-offline-v2.mjs");
  assert.equal(pkg.scripts["local:system:hybrid"], "node scripts/run-local-system.mjs --hybrid");
});
