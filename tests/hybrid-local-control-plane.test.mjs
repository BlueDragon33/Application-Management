import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

function source(path) {
  return fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

const resolver = source("app/client-origin.server.ts");
const runtimeLauncher = source("scripts/run-local-system.mjs");
const offlineBootstrap = source("scripts/run-local-offline-v2.mjs");
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
  assert.match(runtimeLauncher, /baumanRuntimeOrigin = "http:\/\/127\.0\.0\.1:3005"/);
  assert.match(runtimeLauncher, /BAUMAN_APP_LOCAL_ORIGIN: baumanRuntimeOrigin/);
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

test("offline bootstrap keeps repos independent and migrates isolated local databases before runtime launch", () => {
  for (const token of ["Health_Care", "RU_LIFE", "Bauman-master-ai-system", "BOIECH_AI", "Application Management"]) {
    assert.ok(offlineBootstrap.includes(token), `missing bootstrap repo token: ${token}`);
  }
  assert.match(offlineBootstrap, /wrangler\.local\.jsonc/);
  assert.match(offlineBootstrap, /Migration D1 local · Application Management/);
  assert.match(offlineBootstrap, /Migration D1 local · Sức khỏe Y tế/);
  assert.match(offlineBootstrap, /Migration D1 local · Hòa nhập Nga/);
  assert.match(offlineBootstrap, /Migration D1 local · Bauman Control/);
  assert.match(offlineBootstrap, /Migration D1 local · Bơi ếch/);
  assert.match(offlineBootstrap, /"bauman-control-local", "--local", "--config", "wrangler\.local\.jsonc"/);
  assert.match(offlineBootstrap, /run-local-system\.mjs/);
  assert.match(offlineBootstrap, /"--local", "--skip-install", "--skip-migrate"/);
  assert.doesNotMatch(offlineBootstrap, /"--remote"/);
  assert.doesNotMatch(offlineBootstrap, /workers\.dev/);
});

test("runtime launcher keeps six loopback services isolated and issues ephemeral secrets", () => {
  for (const port of [3000, 3001, 3002, 3003, 3004, 3005]) {
    assert.ok(runtimeLauncher.includes(String(port)), `missing local port ${port}`);
  }
  assert.match(runtimeLauncher, /randomBytes\(48\)\.toString\("base64url"\)/);
  assert.match(runtimeLauncher, /wrangler\.local\.jsonc/);
  assert.match(runtimeLauncher, /BAUMAN_APP_ORIGIN/);
  assert.match(runtimeLauncher, /BAUMAN_APP_LOCAL_ORIGIN/);
  assert.doesNotMatch(runtimeLauncher, /"--remote"/);
  assert.doesNotMatch(runtimeLauncher, /workers\.dev/);
});

test("launcher uses the existing loopback-only development auth instead of creating a second auth bypass", () => {
  assert.match(runtimeLauncher, /LOCAL_DEV_AUTH/);
  assert.match(auth, /runtime\.LOCAL_DEV_AUTH !== "1"/);
  assert.match(auth, /LOOPBACK_HOST\.test\(host\)/);
  assert.doesNotMatch(runtimeLauncher, /LOCAL_ADMIN_PASSWORD|passwordHash|bcrypt|PBKDF2/i);
  assert.doesNotMatch(offlineBootstrap, /LOCAL_ADMIN_PASSWORD|passwordHash|bcrypt|PBKDF2/i);
});

test("package exposes central-only, offline full-system and hybrid launch paths separately", () => {
  assert.equal(pkg.scripts.local, "node scripts/run-local.mjs");
  assert.equal(pkg.scripts["local:system"], "node scripts/run-local-offline-v2.mjs");
  assert.equal(pkg.scripts["local:system:hybrid"], "node scripts/run-local-system.mjs --hybrid");
});
