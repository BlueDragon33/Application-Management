import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { createRequire } from "node:module";
import { createHash, webcrypto } from "node:crypto";
import { assessHubGraphContract } from "../app/blueprint-hub-graph-contract.mjs";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const SOURCE = fs.readFileSync(new URL("../app/api/tools/blueprint-compass/hub-contract/route.ts", import.meta.url), "utf8");
const HUB = "BlueDragon33/Software-Blueprint-Hub";
const HEAD = "a".repeat(40);
const gitBlobSha = bytes => createHash("sha1").update(`blob ${bytes.length}\0`).update(bytes).digest("hex");
const API_URL = "https://api.github.com/repos/" + HUB;

function contract() {
  return {
    schema: "application-management.contract/v1",
    protocol: "blueprint-os-compass-metadata-v1",
    contractVersion: 1,
    application: { repository: HUB },
    endpoints: {},
    policy: {
      metadataOnly: true,
      applicationManagementMayMutateCanonicalBlueprintState: false,
      applicationManagementMayPassQualityGates: false,
      applicationManagementMayAuthorizeProductionRelease: false,
    },
  };
}

function setup({ authenticated = true, remoteContract = contract(), head = HEAD, blob, outcome = "ok", encoded } = {}) {
  const reads = [];
  const fetchStub = async (url, options) => {
    reads.push({ url, method: options.method, redirect: options.redirect, hasAuthorization: Boolean(options.headers?.Authorization) });
    if (outcome !== "ok") return Response.json({ message: "GitHub refused" }, { status: outcome === "forbidden" ? 403 : 503 });
    if (url === API_URL + "/commits/main") return Response.json({ sha: head });
    if (url === API_URL + "/contents/control/application-management.contract.json?ref=" + HEAD) {
      const content = encoded ?? Buffer.from(JSON.stringify(remoteContract), "utf8").toString("base64");
      const decoded = Buffer.from(content, "base64");
      return Response.json({
        type: "file", path: "control/application-management.contract.json",
        encoding: "base64", content,
        sha: blob ?? gitBlobSha(decoded),
      });
    }
    throw new Error("Unexpected outbound read: " + url);
  };
  const transpiled = ts.transpileModule(SOURCE, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, strict: true },
    reportDiagnostics: true,
  });
  const errors = (transpiled.diagnostics || []).filter(d => d.category === ts.DiagnosticCategory.Error);
  assert.equal(errors.length, 0);
  const exports = {};
  vm.runInNewContext(transpiled.outputText, {
    exports, Request, Response, Date, Uint8Array, TextEncoder, TextDecoder, atob, crypto: webcrypto, AbortSignal, fetch: fetchStub, Error,
    require(name) {
      if (name === "../../../../chatgpt-auth") return { getChatGPTUser: async () => authenticated ? { userId: "test" } : null };
      if (name === "../../../../blueprint-hub-graph-contract.mjs") return { assessHubGraphContract };
      throw new Error("Unexpected import " + name);
    },
  });
  return { GET: exports.GET, reads };
}

test("Hub contract route denies unauthenticated request without network IO", async () => {
  const { GET, reads } = setup({ authenticated: false });
  const response = await GET();
  const body = await response.json();
  assert.equal(response.status, 401);
  assert.equal(body.canReadGraph, false);
  assert.equal(reads.length, 0);
});

test("Hub metadata-only real schema is source-pinned and Graph read stays denied", async () => {
  const { GET, reads } = setup();
  const response = await GET();
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.status, "HUB_GRAPH_NOT_EXPOSED");
  assert.equal(body.hubHead, HEAD);
  assert.equal(body.contractBlobSha, gitBlobSha(Buffer.from(JSON.stringify(contract()), "utf8")));
  assert.equal(body.canReadGraph, false);
  assert.equal(body.qaPassed, false);
  assert.equal(reads.length, 2);
  assert.equal(reads[1].url, API_URL + "/contents/control/application-management.contract.json?ref=" + HEAD);
  assert.ok(reads.every(x => x.method === "GET" && x.redirect === "manual" && !x.hasAuthorization));
});

test("contract Graph URL injection never causes a third-party request", async () => {
  const c = contract();
  c.endpoints.graph = "https://attacker.example/private-data";
  const { GET, reads } = setup({ remoteContract: c });
  const response = await GET();
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.status, "HUB_GRAPH_AUTH_NOT_ESTABLISHED");
  assert.equal(body.canReadGraph, false);
  assert.equal(reads.length, 2);
});

test("GitHub outage fails closed and never displays a connected graph", async () => {
  const { GET } = setup({ outcome: "forbidden" });
  const response = await GET();
  const body = await response.json();
  assert.equal(response.status, 502);
  assert.equal(body.status, "UNVERIFIED");
  assert.equal(body.canReadGraph, false);
});

test("invalid SHA, blob, policy and encoded content fail closed", async () => {
  for (const settings of [
    { head: "main" }, { blob: "g".repeat(40) }, { blob: "b".repeat(40) },
    { remoteContract: { ...contract(), policy: { ...contract().policy, applicationManagementMayPassQualityGates: true } } },
    { encoded: "garbage?" },
  ]) {
    const { GET } = setup(settings);
    const response = await GET();
    const body = await response.json();
    assert.equal(response.status, 502);
    assert.equal(body.status, "UNVERIFIED");
    assert.equal(body.canReadGraph, false);
    assert.equal(body.productionAuthorized, false);
  }
});

test("valid-format forged Git blob SHA is rejected even when JSON is well formed", async () => {
  const { GET, reads } = setup({ blob: "b".repeat(40) });
  const response = await GET();
  const body = await response.json();
  assert.equal(reads.length, 2);
  assert.equal(response.status, 502);
  assert.equal(body.status, "UNVERIFIED");
  assert.equal(body.canReadGraph, false);
  assert.equal(body.productionAuthorized, false);
});

test("GitHub base64 with line breaks still verifies the exact original Git blob", async () => {
  const original = Buffer.from(JSON.stringify(contract()), "utf8");
  const wrapped = original.toString("base64").match(/.{1,56}/g).join("\n");
  const { GET, reads } = setup({ encoded: wrapped });
  const response = await GET();
  const body = await response.json();
  assert.equal(reads.length, 2);
  assert.equal(response.status, 200);
  assert.equal(body.status, "HUB_GRAPH_NOT_EXPOSED");
  assert.equal(body.contractBlobSha, gitBlobSha(original));
  assert.equal(body.canReadGraph, false);
});
