import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { assessHubGraphContract } from "../app/blueprint-hub-graph-contract.mjs";

const H = "a".repeat(40);
const B = "b".repeat(40);
const valid = () => ({
  schema: "application-management.contract/v1",
  protocol: "blueprint-os-compass-metadata-v1",
  contractVersion: 1,
  application: { repository: "BlueDragon33/Software-Blueprint-Hub" },
  endpoints: {},
  policy: {
    metadataOnly: true,
    applicationManagementMayMutateCanonicalBlueprintState: false,
    applicationManagementMayPassQualityGates: false,
    applicationManagementMayAuthorizeProductionRelease: false,
  },
});
const inspect = contract => assessHubGraphContract(contract, H, B, "2026-11-22T19:30:00Z");

test("Hub real current metadata-only contract never grants Graph, QA or release", () => {
  const value = inspect(valid());
  assert.equal(value.ok, true);
  assert.equal(value.status, "HUB_GRAPH_NOT_EXPOSED");
  assert.equal(value.canReadGraph, false);
  assert.equal(value.canWriteWorkPackages, false);
  assert.equal(value.qaPassed, false);
  assert.equal(value.productionAuthorized, false);
  assert.equal(value.hubHead, H);
  assert.equal(value.contractBlobSha, B);
});

test("arbitrary Graph endpoints do not authorize Hub Graph", () => {
  const c = valid();
  c.endpoints.graph = "https://untrusted.example/graph";
  const value = inspect(c);
  assert.equal(value.status, "HUB_GRAPH_AUTH_NOT_ESTABLISHED");
  assert.equal(value.canReadGraph, false);
});

test("metadataOnly=false never implies caller identity or private bridge", () => {
  const c = valid();
  c.policy.metadataOnly = false;
  const value = inspect(c);
  assert.equal(value.status, "HUB_GRAPH_AUTH_NOT_ESTABLISHED");
  assert.equal(value.canReadGraph, false);
});

test("contract schema and version mismatch fail closed", () => {
  for (const [key, value] of [["schema", "fake/v2"], ["protocol", "other"], ["contractVersion", 2]]) {
    const c = valid(); c[key] = value;
    assert.equal(inspect(c).status, "UNVERIFIED");
  }
});

test("foreign repository and malformed metadata fail closed", () => {
  for (const contract of [null, undefined, [], {}, "not-an-object"]) assert.equal(inspect(contract).ok, false);
  const c = valid(); c.application.repository = "OtherOwner/FakeHub";
  assert.equal(inspect(c).status, "UNVERIFIED");
});

test("invalid pinned commit or blob reference fails closed", () => {
  for (const bad of ["main", "", "g".repeat(40), "a".repeat(39)]) {
    assert.equal(assessHubGraphContract(valid(), bad, B, "").canReadGraph, false);
    assert.equal(assessHubGraphContract(valid(), H, bad, "").status, "UNVERIFIED");
  }
});

test("canonical authority flags never elevate without owner review", () => {
  for (const key of [
    "applicationManagementMayMutateCanonicalBlueprintState",
    "applicationManagementMayPassQualityGates",
    "applicationManagementMayAuthorizeProductionRelease",
  ]) {
    const c = valid(); c.policy[key] = true;
    const result = inspect(c);
    assert.equal(result.ok, false);
    assert.equal(result.productionAuthorized, false);
    assert.equal(result.canWriteWorkPackages, false);
  }
});

test("malformed endpoint types fail closed", () => {
  for (const endpoints of [null, [], "graph", 42]) {
    const c = valid(); c.endpoints = endpoints;
    assert.equal(inspect(c).status, "UNVERIFIED");
  }
});

test("Hub route authenticates before GitHub and pins public contract bytes", () => {
  const route = fs.readFileSync(new URL("../app/api/tools/blueprint-compass/hub-contract/route.ts", import.meta.url), "utf8");
  assert.match(route, /getChatGPTUser\(\)/);
  assert.match(route, /if \(!await getChatGPTUser\(\)\)/);
  assert.match(route, /contents\/control\/application-management\.contract\.json\?ref=/);
  assert.match(route, /assessHubGraphContract\(contract, commit\.sha, remote\.sha/);
  assert.match(route, /redirect: "manual"/);
  assert.doesNotMatch(route, /method: "(?:POST|PATCH|PUT|DELETE)"/);
});
