import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { compassAssessment, normalizeGitHubListing } from "../app/blueprint-compass-core.mjs";
const H = "a".repeat(40), B = "b".repeat(40);
const repo = "BlueDragon33/Application-Management";
const url = (kind, number, name = repo) => `https://github.com/${name}/${kind}/${number}`;
const pr = (number, extras = {}) => ({ number, title: `Fix #${number}`, html_url: url("pull", number), draft: true, head: { sha: B }, ...extras });
const issue = (number, extras = {}) => ({ number, title: `Issue #${number}`, html_url: url("issues", number), labels: [], ...extras });
const file = p => fs.readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

test("GitHub PR source HEAD is retained separately from default HEAD", () => {
  const [row] = normalizeGitHubListing([pr(7)], "pull", 20, repo);
  assert.equal(row.headSha, B);
  const verdict = compassAssessment({ head: H, pullRequests: [row] });
  assert.equal(verdict.status, "DRAFT_REVIEW");
  assert.match(verdict.nextStep, new RegExp(B));
  assert.equal(verdict.qaPassed, false);
});
test("missing/malformed PR HEAD yields UNVERIFIED not the main branch", () => {
  for (const head of [undefined, null, "main", "g".repeat(40)]) {
    const [row] = normalizeGitHubListing([pr(8, { head: head === undefined ? undefined : { sha: head } })], "pull", 20, repo);
    assert.equal(row.headSha, null);
    assert.match(compassAssessment({ head: H, pullRequests: [row] }).nextStep, /PR_HEAD_UNVERIFIED/);
  }
});
test("GitHub row from another repository cannot masquerade as selected project", () => {
  const spoof = pr(9, { html_url: url("pull", 9, "BlueDragon33/BOIECH_AI") });
  assert.equal(normalizeGitHubListing([spoof], "pull", 20, repo).length, 0);
  assert.equal(normalizeGitHubListing([spoof], "pull", 20, "BadOwner/repo").length, 0);
});
test("untrusted issue label is an advisory signal not a canonical REVIEW_BLOCKED gate", () => {
  const row = normalizeGitHubListing([issue(3,{labels:[{name:"needs-human"}]})],"issue",20,repo)[0];
  const verdict = compassAssessment({head:H,issues:[row]});
  assert.equal(verdict.status,"BLOCKER_SIGNAL_UNVERIFIED");
  assert.match(verdict.description, /không chứng minh/);
  assert.equal(verdict.qaPassed,false);
});
test("a private repository or GitHub failure cannot silently produce QA approval", () => {
  const verdict = compassAssessment({head:""});
  assert.equal(verdict.status,"UNVERIFIED");
  assert.equal(verdict.productionAuthorized,false);
});
test("API binds link normalization to selected repository and declares unsigned metadata", () => {
  const api=file("app/api/tools/blueprint-compass/route.ts");
  assert.match(api,/normalizeGitHubListing\(pulls, "pull", 20, entry\.repository\)/);
  assert.match(api,/normalizeGitHubListing\(issues, "issue", 20, entry\.repository\)/);
  assert.match(api,/evidenceClass: "UNSIGNED_GITHUB_METADATA_ONLY"/);
  assert.match(api,/canonicalGateVerified: false, humanReviewVerified: false/);
  assert.match(api,/getChatGPTUser\(\)/);
  assert.doesNotMatch(api,/method: "(?:POST|PUT|PATCH|DELETE)"/);
});
test("Tool displays PR head and abort-guards completed stale responses", () => {
  const ui=file("app/tools/blueprint-compass/blueprint-compass.tsx");
  assert.match(ui,/HEAD \{pr\.headSha\?\.slice\(0, 12\)/);
  assert.match(ui,/if \(controller\.signal\.aborted\) return;/);
  assert.match(ui,/GỢI Ý XỬ LÝ · KHÔNG PHẢI QA APPROVAL/);
});
test("legacy app registry/SSO metadata remains preserved until cutover QA", () => {
  const registry=file("app/application-registry.ts");
  const start=registry.indexOf('id: "software-blueprint-hub"');
  assert.ok(start >= 0);
  const entry=registry.slice(start,registry.indexOf("\n  },",start));
  for (const field of ["publicUrl", "previewUrl", "ssoStartUrl"])
    assert.match(entry,new RegExp(`${field}: "https://`));
  assert.match(entry,/contractSource: "repository"/);
  assert.match(file("app/management-dashboard-v2.tsx"),/staticApps\.filter\(app => app\.id !== "software-blueprint-hub"\)/);
  assert.match(file("app/apps/software-blueprint-hub/page.tsx"),/redirect\(\"\/tools\/blueprint-compass\"\)/);
});
