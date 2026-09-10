import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

const authSource = fs.readFileSync("app/cloudflare-access-auth.ts", "utf8");
const chatAuth = fs.readFileSync("app/chatgpt-auth.ts", "utf8");
const preflight = fs.readFileSync("scripts/validate-cloudflare-ready.mjs", "utf8");
const worker = fs.readFileSync("worker/index.ts", "utf8");
const cloudflareTemplate = fs.readFileSync("wrangler.cloudflare.example.jsonc", "utf8");

function base64UrlJson(value) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function loadAdapter() {
  const output = ts.transpileModule(authSource, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(output).toString("base64")}`);
}

async function signedToken({ teamDomain, audience, email = "admin@example.test", subject = "cf-user-1", mutatePayload = false }) {
  const pair = await crypto.subtle.generateKey(
    { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
    true,
    ["sign", "verify"],
  );
  const publicJwk = await crypto.subtle.exportKey("jwk", pair.publicKey);
  publicJwk.kid = "unit-key";
  publicJwk.alg = "RS256";
  publicJwk.use = "sig";

  const now = Math.floor(Date.now() / 1000);
  const header = base64UrlJson({ alg: "RS256", kid: "unit-key", typ: "JWT" });
  const payloadObject = { iss: teamDomain, aud: audience, email, sub: subject, iat: now, nbf: now - 1, exp: now + 300 };
  const payload = base64UrlJson(payloadObject);
  const signatureBytes = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", pair.privateKey, new TextEncoder().encode(`${header}.${payload}`));
  const signature = Buffer.from(signatureBytes).toString("base64url");
  const token = `${header}.${mutatePayload ? base64UrlJson({ ...payloadObject, email: "tampered@example.test" }) : payload}.${signature}`;
  return { token, publicJwk };
}

test("Cloudflare Access adapter is fail-closed and validates issuer audience signature and expiry", () => {
  for (const token of [
    'const ACCESS_HEADER = "cf-access-jwt-assertion"',
    'header.alg !== "RS256"',
    'issuer !== teamDomain',
    '!audienceMatches(payload.aud, audience)',
    'expiration === null || expiration < now - CLOCK_SKEW_SECONDS',
    'crypto.subtle.verify',
    '/cdn-cgi/access/certs',
    'ACCESS_TEAM_DOMAIN',
  ]) assert.ok(authSource.includes(token), `missing Access validation token: ${token}`);
  assert.equal(authSource.includes("LOCAL_DEV_AUTH"), false, "Cloudflare Access adapter must never use local bypass");
});

test("ChatGPT identity remains first, then loopback local, then Cloudflare Access", () => {
  const chat = chatAuth.indexOf("if (userId && email)");
  const local = chatAuth.indexOf("const localUser = localDevelopmentUser");
  const cloudflare = chatAuth.indexOf("return getCloudflareAccessUser");
  assert.ok(chat >= 0 && local > chat && cloudflare > local);
});

test("Cloudflare preflight and worker require Access deployment settings", () => {
  assert.ok(preflight.includes("app/cloudflare-access-auth.ts"));
  assert.ok(preflight.includes("CF_ACCESS_AUD"));
  assert.ok(preflight.includes("CF_ACCESS_TEAM_DOMAIN"));
  assert.ok(worker.includes("CF_ACCESS_AUD?: string"));
  assert.ok(worker.includes("CF_ACCESS_TEAM_DOMAIN?: string"));
});

test("Cloudflare template and preflight keep Bauman Control separate from the learning runtime", () => {
  assert.ok(cloudflareTemplate.includes('"BAUMAN_CONTROL_BASE_URL": ""'));
  assert.ok(cloudflareTemplate.includes('"BAUMAN_APP_ORIGIN": ""'));
  assert.ok(preflight.includes("CLOUDFLARE_BAUMAN_ORIGINS_INCOMPLETE"));
  assert.ok(preflight.includes("CLOUDFLARE_BAUMAN_HTTPS_REQUIRED"));
  assert.ok(preflight.includes("CLOUDFLARE_BAUMAN_ORIGINS_COLLIDE"));
  assert.ok(preflight.includes('stringVar(config, "BAUMAN_CONTROL_BASE_URL")'));
  assert.ok(preflight.includes('stringVar(config, "BAUMAN_APP_ORIGIN")'));
});

test("Access adapter cryptographically accepts a valid RS256 JWT and rejects a tampered JWT", async () => {
  const module = await loadAdapter();
  const teamDomain = "https://unit-test.cloudflareaccess.com";
  const audience = "unit-test-audience-12345678";
  const { token, publicJwk } = await signedToken({ teamDomain, audience });
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ keys: [publicJwk] }), { status: 200, headers: { "content-type": "application/json" } });
  try {
    const headers = new Headers({ "cf-access-jwt-assertion": token });
    const user = await module.getCloudflareAccessUser(headers, { CF_ACCESS_TEAM_DOMAIN: teamDomain, CF_ACCESS_AUD: audience });
    assert.equal(user?.email, "admin@example.test");
    assert.equal(user?.userId, "cf-access:cf-user-1");

    const tampered = await signedToken({ teamDomain, audience, mutatePayload: true });
    const tamperedHeaders = new Headers({ "cf-access-jwt-assertion": tampered.token });
    const rejected = await module.getCloudflareAccessUser(tamperedHeaders, { CF_ACCESS_TEAM_DOMAIN: teamDomain, CF_ACCESS_AUD: audience });
    assert.equal(rejected, null);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
