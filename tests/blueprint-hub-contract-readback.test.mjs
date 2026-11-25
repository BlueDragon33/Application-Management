import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { validateHubContractReadback } from "../app/blueprint-hub-contract-readback.mjs";

const SHA = "a".repeat(40), BLOB = "b".repeat(40);
const base = () => ({
  ok: true, status: "HUB_GRAPH_NOT_EXPOSED",
  repository: "BlueDragon33/Software-Blueprint-Hub",
  source: "github-public-rest-pinned-contract",
  hubHead: SHA, contractBlobSha: BLOB,
  contractSchema: "application-management.contract/v1", contractVersion: 1,
  checkedAt: "2026-11-22T20:15:22.000Z",
  canReadGraph: false, canWriteWorkPackages: false,
  qaPassed: false, productionAuthorized: false,
});

test("genuine source metadata renders non-connected Graph and immutable status", () => {
  const value = validateHubContractReadback(base(), 200);
  assert.equal(value.ok, true);
  assert.equal(value.status, "HUB_GRAPH_NOT_EXPOSED");
  assert.equal(value.canReadGraph, false);
  assert.equal(value.hubHead, SHA);
  assert.equal(Object.isFrozen(value), true);
});

test("changed contract never grants live Graph without versioned scoped authorization", () => {
  const input = { ...base(), status: "HUB_GRAPH_AUTH_NOT_ESTABLISHED" };
  const result = validateHubContractReadback(input, 200);
  assert.equal(result.ok, true);
  assert.equal(result.canReadGraph, false);
});

test("fake CONNECTED, RUNNING, and PASS statuses fail closed even with valid SHA", () => {
  for (const status of ["CONNECTED", "LIVE", "PASS", "RUNNING", "PRODUCTION", "Graph ready", "", null]) {
    const result = validateHubContractReadback({ ...base(), status }, 200);
    assert.equal(result.status, "UNVERIFIED");
    assert.equal(result.canReadGraph, false);
  }
});

test("invalid HTTP/body status pairs become UNVERIFIED", () => {
  for (const code of [204, 301, 403, 429, 500]) {
    const result = validateHubContractReadback(base(), code);
    assert.equal(result.status, "UNVERIFIED");
  }
  assert.equal(validateHubContractReadback({ ...base(), ok: false }, 200).status, "UNVERIFIED");
});

test("401 is treated as an unauthenticated session without exposing Graph", () => {
  const value = validateHubContractReadback({ ok: false, status: "UNAUTHORIZED", canReadGraph: false }, 401);
  assert.equal(value.status, "UNAUTHORIZED");
  assert.equal(value.canReadGraph, false);
  assert.equal(value.ok, false);
  assert.equal(validateHubContractReadback(base(), 401).status, "UNVERIFIED");
});

test("502, GitHub failure and malformed reply become UNVERIFIED", () => {
  const value = validateHubContractReadback({ ok: false, status: "UNVERIFIED", canReadGraph: false }, 502);
  assert.equal(value.status, "UNVERIFIED");
  for (const raw of [null, undefined, [], {}, "connected", 0]) {
    assert.equal(validateHubContractReadback(raw, 200).status, "UNVERIFIED");
  }
});

test("a forged positive authority flag cannot be laundered through the client", () => {
  for (const [key, value] of [
    ["canReadGraph", true], ["canWriteWorkPackages", true],
    ["qaPassed", true], ["productionAuthorized", true],
  ]) {
    const checked = validateHubContractReadback({ ...base(), [key]: value }, 200);
    assert.equal(checked.ok, false);
    assert.equal(checked.canReadGraph, false);
  }
});

test("SHA, contract repository, schema, and source must match exactly", () => {
  for (const [key, value] of [
    ["hubHead", "main"], ["contractBlobSha", "invalid"],
    ["repository", "OtherOwner/OtherRepo"], ["contractSchema", "graph/v2"],
    ["contractVersion", 2], ["source", "unverified-remote-url"],
  ]) {
    assert.equal(validateHubContractReadback({ ...base(), [key]: value }, 200).status, "UNVERIFIED");
  }
});

test("timestamp cannot be omitted or arbitrarily spoofed as a label", () => {
  for (const value of [null, undefined, "now", "", "0000-99-99T99:99:99Z", "x".repeat(120)]) {
    assert.equal(validateHubContractReadback({ ...base(), checkedAt: value }, 200).status, "UNVERIFIED");
  }
});

test("rendered note is fixed and does not display arbitrary third-party HTML", () => {
  const input = { ...base(), note: "<script>spoofed</script>" };
  const result = validateHubContractReadback(input, 200);
  assert.equal(result.ok, true);
  assert.doesNotMatch(result.note, /script|spoofed/);
});

test("Hub Graph Tool UI must consume the strict readback guard, not raw status", () => {
  const ui = fs.readFileSync(new URL("../app/tools/blueprint-compass/hub-graph-contract-admission.tsx", import.meta.url), "utf8");
  assert.match(ui, /validateHubContractReadback\(data, response\.status\)/);
  assert.match(ui, /controller\.signal\.aborted/);
  assert.match(ui, /↻ Đối chiếu contract/);
});
