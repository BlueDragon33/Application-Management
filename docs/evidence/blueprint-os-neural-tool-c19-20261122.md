# C19 — Blueprint OS Tool R0 + Registry Neural L0/L1 + Permanent Constitution Guidance

**Date:** 2026-11-22. **Implementation status:** candidate SOURCE_ONLY; **NOT QA PASS, NOT MERGED, NOT PRODUCTION**.
**Authority:** Software-Blueprint-Hub ACTIVE Constitution 1.3.0 (main `control/universal-constitution-version.json`, blob `aa7986feeb6027fa52b88751a078c2ba5e8cd0fa`). ZERO-SPEND, fail-closed, app-owned control plane and Hub-owned canonical WorkPackage/QualityGate.
**Source branch:** `work/blueprint-os-neural-tool-c19-main-20261122` based on current Application-Management `main@89a89ce2d3d8ed634ee9562c52744a99223a2b2a`.
**Provenance:** Reused the tested-in-historical-scope, now **203 commits behind** App Draft [#376](https://github.com/BlueDragon33/Application-Management/pull/376) rather than merging its obsolete ancestor. Implements C18 scope [Hub checkpoint](https://github.com/BlueDragon33/Software-Blueprint-Hub/blob/cdfd71df47fe2863c1c5d9e097e4907a1fd3fe72/docs/evidence/master-system-atlas/candidate-checkpoint-c18-video-fidelity-app-management-mvp-20261122.md). This is an integration candidate **for one existing Tool route**, not another site, second ledger, separate application runtime or second project registry.

## What is actually coded

1. **Authenticated Tool:** `/tools/blueprint-compass` uses `requireChatGPTUser` and the existing `projectRepositories`. Exact APP #376 allowlisted read-only GitHub route `/api/tools/blueprint-compass` retained with bounded 20 PR/Issue entries, HEAD/PR head separation, no credential forwarding, explicit `UNSIGNED_GITHUB_METADATA_ONLY` and `qaPassed=false, productionAuthorized=false`. Stale cross-project data cannot be shown.
2. **Permanent Hướng dẫn button:** header always shows `❔ Hướng dẫn`, `aria-expanded` and a mounted region `#blueprint-tool-guide` with `hidden` state; accessible in every Tool state including unreadable upstream data. Guidance explains source, projects, statuses, Next Action, no simulated Agent, independent Reviewer and human Constitution/Production gates. Opens actual ACTIVE law file at the Hub. Its header is sticky; mobile and reduced-motion CSS included. This is a user-required invariant and has its own regression test.
3. **Semantic Neural Atlas L0/L1:** source-only visual graph of existing APP canonical project directory, with three columns **domain group → registered project → registry lifecycle status**, two classifying edges per real project. Actual curved luminous SVG paths, focus highlighting based on selected project, horizontal scroll and reduced-motion handling. These links are honest *classification edges*, **NOT** actual Hub dependency/provenance/AI event evidence. The Tool explicitly declares this in the graph caption and help. Current dataset is the app registry, not dynamic 24/7 worker telemetry. The visually dense L0/L1 layout is just a starter slice; R1 fidelity to original high-density reference videos is not yet accepted.
4. **Single entrypoint with back-compat:** both APP dashboards show one `tool-blueprint-compass` and remove `software-blueprint-hub` **from their display-only application rows**; existing backend `applicationRegistry` remains unchanged and authoritative for admin contract/security logic. Existing `/apps/software-blueprint-hub` bookmark stays authenticated, then redirects to Tool; `app/project-registry.ts` project `managementHref` points at it. No new deployment slug.
5. **Source checks:** original #376 focused core/API/stale-render tests ported, plus original App management/catalog tests updated to the actual redirected path and a new `tests/blueprint-neural-tool-guide.test.mjs`. The React client test now exercises guide open/close and stale cross-project response protection. **A connector readback of 11 production/test files and 37 source-pattern predicates passed at branch commit, not test execution.**

## R0 limitations and release acceptance

- No authenticated live browser session, real Cloudflare/ChatGPT Sites QA, real APP-to-Hub Graph API contract, ProjectProfile/QualityGate runtime readback, or mobile physical QA has been executed this turn.
- NO atomic project-wide Prompt source revision CAS in Hub #173; C15-ANA-CAS-01 remains OPEN. No WorkPackage writes in this Tool and no AI dispatch.
- APP #414 R0.2 clean 10/50/200 instrumented synthetic performance remains BLOCKED/NOT_MEASURED; no latency, FPS, full computed WCAG 2.2 AA or load stress claims.
- No signed independent Reviewer B, 8 protected bridge tests or P9-019/020 human acceptance for this C19 draft.
- Historical #376 verification (e.g., 847/847 test suite) was on its own older source SHA and **is not transferable to this branch**. All C19 runtime gates remain **PENDING**.

**Necessary gates before any R0 release** (single candidate exact SHA): `npm run typecheck`, validated build, `node --test tests/blueprint-compass-*.test.mjs tests/blueprint-neural-tool-guide.test.mjs`, complete regression against current main, accessible guide open/close with keyboard and phone viewport, public GitHub failure/403/429→UNVERIFIED, authenticated redirects and unauthorized requests, cross-project abort/stale cases, no second app launcher, rollback, performance readback, correct account-specific permissions, and Owner release approval. No workflow triggered or paid provider used by this source checkpoint.

**Next dependency slices:** S1 stop at source/real QA blockers and fix only demonstrated defects; S2 versioned authenticated read-only Hub Graph adapter with proper access; S3 L0→L3 true dependency/algorithm/evidence provenance, densely layered video fidelity; S4 observed Worker/Reviewer orchestration, then CAS-gated writes after proven transaction authority. Always retain the Hướng dẫn button at the primary Tool shell and preserve existing canonical records.

**Stop policy:** keep the integration PR **DRAFT** until actual runtime tests, independent technical review and required owner authority are recorded. No merge, ratification or publish is authorized by this checkpoint.

## C20 — Exact-source targeted QA and corrected source regression (2026-11-22)

**Scope and methodology:** The actual GitHub UTF-8 bytes were read at exact candidate SHA `c700fe86b852073add80341a09e4b802f16477bc`. Six original `node:test` files were evaluated as their **actual source test callback bodies** in an isolated V8 JS harness, with only the Node module import and read-only filesystem lookup replaced by explicit in-memory file reads from the exact same candidate commit; `assert` equivalents were provided. This is a genuine executed subset of the source assertions, **NOT** Node's test runner, full TypeScript typecheck, Vinext/Next build, React/JSDOM, browser or Production QA, and does not reuse historic #376 QA.

**Executed at corrected C20 HEAD — 41/41 source test callbacks PASS:**

| Test file | Execution count | Outcome |
| --- | ---: | --- |
| `tests/blueprint-compass-core.test.mjs` | 11 | 11 PASS |
| `tests/blueprint-compass-integration-hardening.test.mjs` | 8 | 8 PASS |
| `tests/blueprint-compass-tool.test.mjs` | 5 | 5 PASS |
| `tests/blueprint-neural-tool-guide.test.mjs` | 5 | 5 PASS |
| `tests/software-blueprint-managed-app.test.mjs` | 5 | 5 PASS |
| `tests/project-repository-catalog-current.test.mjs` | 7 | 7 PASS |

Additional initial C19 20/20 direct core behavioral scenarios passed at `1500389db38dc862bcc37b3a235230bcdde0937f`, core blob `f176900399ecbea202282e1bb44288c25846230e`, unchanged at C20. These overlap with the 41 and are **not** added as unique project pass counts.

**Actual defect, not a simulated failing test:** The first execution of the current-main catalog test at earlier C19 HEAD exposed an **unparsable regular expression** in `tests/project-repository-catalog-current.test.mjs`: `assert.match(block, /managementHref: "\/tools\/blueprint-compass");` (missing the closing slash before `);`). This resulted from the previous migration assertion. Fixed only that line via commit `c700fe86b852073add80341a09e4b802f16477bc`; re-read and parsed the entire corrected test, then executed all seven callbacks PASS. Previous first harness attempts also had a missing mock file, explicitly an **evaluation-harness fixture gap**, not a product defect; fixed by loading `app/tools/blueprint-compass/page.tsx` at exact HEAD.

**Real source/UX enhancement:** At commit `b1b53191bb6253e5bfadf22738260cccb508914e`, the Tool now initially focuses registered `software-blueprint-hub` when available (otherwise the first project) and offers a real, separately authenticated Hub website link with `target="_blank" rel="noopener noreferrer"`. A guide regression guards these paths. Existing `Hướng dẫn` remains a visible interactive button in a sticky header with a mounted aria-labelled disclosure region; test callback PASS is **not equivalent to a real click on a deployed browser**.

**Independent observed Production evidence:** a read-only browser tab inspection of the user's already-open `https://application-management.boiech-ai.workers.dev/?view=applications` showed Blueprint OS still as an application, **not** the new Tool. This is evidence only for the inspected Production page at the observation time, **not** browser QA on the undeployed draft. No Production mutation performed.

**R0 release blockers at C20:** No validated full Node/React/TypeScript build/worktree accessible in this session and no GitHub Actions workflow runs/check-runs at the candidate commit. No authenticated real browser smoke on the candidate URL, Windows E:\BaumanWeb or mobile Chromium, no performance/per-project authorization E2E. Hub read-only Graph projection requires a versioned authenticated adapter and cannot truthfully be claimed connected. C15-ANA-CAS-01 WorkPackage global CAS remains OPEN; protected Reviewer A/B bridge cases 0/8. APP #414 R0.2 synthetic 10/50/200 runtime measurements still BLOCKED. Candidate stays DRAFT; no merge, ratify, publish, paid resources, or fabricated QA PASS.

**Distinct controls (must not conflate):** The user-requested permanent **Hướng dẫn** button is a *real Tool UI component* inside Application Management. **Active Next Action in ChatGPT** is a *conversational continuation action* intended to submit a next task turn and reduce typing; it must not be mistaken for an Application Management Agent executor or turned into a decorative text label. A ChatGPT conversational button does not grant backend execution, approval, cross-session persistence, merge or Production rights.

**Next evidence-gated action:** exact-head `npm run typecheck`, `npm run build`, `node --test tests/*.test.mjs` in a clean authorized checkout; fix only true failures. Then inspect actual candidate UI/guide with authenticated desktop+phone Chromium and role isolation; only when those pass begin Hub read-only Graph adapter, high-density neural fidelity and Owner release decision for R0/R0.1. No standalone PowerShell snippets requested.
