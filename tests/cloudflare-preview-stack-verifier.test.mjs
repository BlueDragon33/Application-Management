import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { normalizePreviewOrigin, verifyPreviewStack } from "../scripts/verify-cloudflare-preview-stack.mjs";

const origins = {
  central: "https://application-management-preview.example.workers.dev",
  boi: "https://boi-ech-preview.example.workers.dev",
  health: "https://health-care-preview.example.workers.dev",
  ru: "https://ru-life-preview.example.workers.dev",
  baumanControl: "https://bauman-control-preview.example.workers.dev",
  baumanRuntime: "https://bauman-runtime-preview.example.workers.dev",
};

const secret = "x".repeat(48);

function envFor(mode) {
  return {
    APPLICATION_MANAGEMENT_PREVIEW_ORIGIN: origins.central,
    CF_ACCESS_CLIENT_ID: "client_" + "i".repeat(40),
    CF_ACCESS_CLIENT_SECRET: "access_" + "s".repeat(40),
    BOI_ECH_PREVIEW_ORIGIN: mode === "full-stack" ? origins.boi : "",
    HEALTH_CARE_PREVIEW_ORIGIN: mode === "full-stack" ? origins.health : "",
    RU_LIFE_PREVIEW_ORIGIN: mode === "full-stack" ? origins.ru : "",
    BAUMAN_CONTROL_PREVIEW_ORIGIN: mode === "full-stack" ? origins.baumanControl : "",
    BAUMAN_RUNTIME_PREVIEW_ORIGIN: mode === "full-stack" ? origins.baumanRuntime : "",
    CONTROL_SERVICE_SECRET: secret,
    HEALTH_CONTROL_SERVICE_SECRET: secret,
    RU_LIFE_CONTROL_SERVICE_SECRET: secret,
    BAUMAN_CONTROL_SERVICE_SECRET: secret,
  };
}

function json(value, status = 200, headers = {}) {
  return Response.json(value, { status, headers });
}

function centralDeployment(fullStack) {
  return {
    ok: true,
    application: "application-management",
    runtime: "control-plane",
    channel: "cloudflare-preview",
    revision: "fixture-central-revision",
    databaseReady: true,
    accessConfigured: true,
    ownerPolicyConfigured: true,
    networkMode: "production",
    clients: {
      boiEch: fullStack,
      healthCare: fullStack,
      ruLife: fullStack,
      baumanControl: fullStack,
      baumanRuntime: fullStack,
      growUp: false,
    },
  };
}

function createFixtureFetch({ fullStack }) {
  const calls = [];
  const fetchImpl = async (input, init = {}) => {
    const url = new URL(String(input));
    const method = String(init.method ?? "GET").toUpperCase();
    const headers = new Headers(init.headers);
    calls.push({ method, url: url.href, headers });

    if (url.origin === origins.central && url.pathname === "/__deployment") {
      if (!headers.get("cf-access-client-id")) return new Response(null, { status: 302, headers: { location: "https://access.example.test" } });
      return json(centralDeployment(fullStack));
    }

    if (method === "OPTIONS" && url.pathname === "/api/control/status") {
      return new Response(null, { status: 204, headers: { "access-control-allow-origin": origins.central } });
    }

    if (url.pathname === "/") return new Response("<!doctype html><title>runtime</title>", { status: 200, headers: { "content-type": "text/html" } });

    const cors = { "access-control-allow-origin": origins.central };
    if (url.origin === origins.boi && url.pathname === "/api/control/status") {
      return json({
        ok: true,
        application: "boi-ech",
        protocol: "boi-ech-control-v1",
        deployment: { channel: "cloudflare-preview", revision: "fixture-boi", paymentStorageReady: true },
        ownership: { centralRole: "policy-and-remote-admin-only" },
      }, 200, cors);
    }
    if (url.origin === origins.health && url.pathname === "/api/control/status") {
      return json({
        ok: true,
        buildRevision: "fixture-health",
        controlAuth: { secretScope: "health" },
        capabilities: ["device-access", "app-scoped-secret-v1"],
      }, 200, cors);
    }
    if (url.origin === origins.health && url.pathname === "/api/control/contract") {
      return json({
        application: "health-care",
        canonicalApplication: "health-care",
        siteOrigin: origins.health,
        boundary: { healthDataInControlPlane: false, profileDataInControlPlane: false },
      });
    }
    if (url.origin === origins.ru && url.pathname === "/api/control/status") {
      return json({
        ok: true,
        application: "ru-life",
        appId: "hoa-nhap-nga",
        protocol: "ru-life-control-v2",
        deployment: { channel: "cloudflare-preview", revision: "fixture-ru" },
        ownership: { centralRole: "policy-and-remote-admin-only" },
      }, 200, cors);
    }
    if (url.origin === origins.baumanControl && url.pathname === "/api/control/status") {
      return json({
        ok: true,
        application: "bauman-master-ai",
        protocol: "bauman-control-v4",
        deployment: {
          channel: "cloudflare-preview",
          revision: "fixture-bauman-control",
          databaseReady: true,
          applicationManagementOriginConfigured: true,
          appOriginConfigured: true,
        },
        readiness: { accessGate: "available" },
        capabilities: { learningAccessGate: true },
      }, 200, cors);
    }
    if (url.origin === origins.baumanRuntime && url.pathname === "/__deployment") {
      return json({
        ok: true,
        application: "bauman-master-ai",
        runtime: "learning-runtime",
        channel: "cloudflare-preview",
        revision: "fixture-bauman-runtime",
        controlOriginConfigured: true,
      });
    }

    return new Response("not found", { status: 404 });
  };
  return { fetchImpl, calls };
}

test("preview origin normalization rejects unsafe or legacy origins", () => {
  assert.equal(normalizePreviewOrigin("SAFE", origins.central), origins.central);
  assert.throws(() => normalizePreviewOrigin("LEGACY", "https://legacy.chatgpt.site"), /must not use ChatGPT Sites/);
  assert.throws(() => normalizePreviewOrigin("HTTP", "http://preview.example.test"), /bare HTTPS origin/);
  assert.throws(() => normalizePreviewOrigin("PATH", "https://preview.example.test/admin"), /bare HTTPS origin/);
});

test("phase-a verifier checks only the isolated central bootstrap", async () => {
  const fixture = createFixtureFetch({ fullStack: false });
  const result = await verifyPreviewStack({ mode: "phase-a", env: envFor("phase-a"), fetchImpl: fixture.fetchImpl });
  assert.equal(result.ok, true);
  assert.equal(result.mode, "phase-a");
  assert.deepEqual(result.clients, {});
  assert.equal(result.mutationMethodsUsed, false);
  assert.deepEqual(new Set(fixture.calls.map((call) => call.method)), new Set(["GET"]));
});

test("full-stack verifier checks every preview using GET and OPTIONS only", async () => {
  const fixture = createFixtureFetch({ fullStack: true });
  const result = await verifyPreviewStack({ mode: "full-stack", env: envFor("full-stack"), fetchImpl: fixture.fetchImpl });
  assert.equal(result.ok, true);
  assert.equal(result.mode, "full-stack");
  assert.equal(result.clients.healthCare, origins.health);
  assert.equal(result.clients.baumanRuntime, origins.baumanRuntime);
  assert.equal(result.mutationMethodsUsed, false);
  assert.ok(fixture.calls.some((call) => call.method === "OPTIONS"));
  for (const call of fixture.calls) assert.ok(call.method === "GET" || call.method === "OPTIONS", `Unexpected mutation method ${call.method}`);
});

test("full-stack verifier fails closed when central/client wiring is incomplete", async () => {
  const fixture = createFixtureFetch({ fullStack: false });
  await assert.rejects(
    verifyPreviewStack({ mode: "full-stack", env: envFor("full-stack"), fetchImpl: fixture.fetchImpl }),
    /requires boiEch origin to be configured/,
  );
});

test("manual verification workflow cannot deploy or mutate preview resources", async () => {
  const workflow = await readFile(new URL("../.github/workflows/verify-application-management-preview.yml", import.meta.url), "utf8");
  assert.match(workflow, /permissions:\s*\n\s*contents:\s*read/);
  assert.match(workflow, /VERIFY_PREVIEW/);
  assert.doesNotMatch(workflow, /CLOUDFLARE_API_TOKEN/);
  assert.doesNotMatch(workflow, /wrangler\s+(?:deploy|d1\s+migrations)/i);
  assert.doesNotMatch(workflow, /(?:POST|PUT|PATCH|DELETE)/);
});
