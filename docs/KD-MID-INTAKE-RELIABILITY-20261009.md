# KD-MID Intake Runtime Reliability — recovery 2026-10-10

Status: CODED → STATIC-TESTED → INTEGRATION-VERIFIED locally. REAL-UX-VERIFIED remains open. Production release remains closed. Exact candidate SHA, subsequent CI and Preview workflow/readback evidence are recorded in PR #335 metadata; this document does not declare protected Quality Gate PASS.

## Revisions and authority

- Repository: `BlueDragon33/Application-Management`; draft PR #335, branch `fix/kd-mid-intake-runtime-reliability-20261009`.
- Historical PR base: `d510e2b75af64ab75f8e857bcd3b007343586ac6`.
- Rechecked recovery start head: `9b20d5a92f818b600187e8748716a9a2cd01f10e`.
- Integrated current main: `bce13c90ead46b9a2feaab610700e9db96615529` (no direct main commit).
- Constitutional authority main: `6b66e0cf7fdc63f6a790b2cdd2db3102caf271bc` in `BlueDragon33/Software-Blueprint-Hub`.
- Authority `docs/UNIVERSAL-CONSTITUTION.md`, `control/universal-constitution-version.json`, `control/universal-constitution.contract.json`, and application `.blueprint/constitution-adoption.json` identify ACTIVE 1.2.0. Hub PR #98 is open/draft at `1b2cc9af2dccaca6b738210ad42660541786f7a0`; no valid 1.3.0 ratification/publication was observed. The ecosystem propagation snapshot is historical, not evidence for this candidate revision.
- Blueprint OS has no verified live authority surface in the inspected project registry. Its repository contract metadata does not authorize publication or Production. Adoption stays 1.2.0; 1.3 reliability principles are engineering procedure only. No authority/version/gate manifest was advanced.

## Reproduced root causes and minimal corrections

| Failure | Root cause and owning correction | Regression evidence |
| --- | --- | --- |
| Entire public form runtime fails | Template literal cooked regex escapes away; actual emitted page contains invalid JavaScript. `worker/visa-intake-public.ts` uses `String.raw`. | Execute complete rendered HTML in DOM; startup previously failed with SyntaxError. |
| Vietnamese IME/caret damaged | Autosave normalized composing values; replacing `.value` reset selection. Existing delegated normalizer shares IME guard and maps selection through normalization. Bootstrap waits for active composition; status readback rechecks composition after awaiting network. | Input/composition events, caret readback, delayed bootstrap/reload while composing. |
| Save fails silently/restore changes user data | Storage getter could throw outside writer; blank edits were treated as missing defaults; conditional required flags were stale. Storage resolved inside try; defaults fill absent keys; restore synchronizes existing validators. | Denied getter shows error and usable form; explicit-empty/false values and conditional requirements; draft reopen. |
| Dates saved before widget finishes | Capture blur autosave ran before target blur padded/synchronized the hidden date. | Microtask autosave readback matches padded date. Manual expiry survives issue-date editing. |
| Returned corrections overwritten | Initialization replaced locally corrected applicant or same-revision edits made while rejection was loading. | Same id/revision retains correction; delayed rejection cannot replace DA NANG with HA NOI. |
| Repeated submit/request races | No client in-flight ownership; confirmation toggles reenabled submit; edits accepted while POST snapshot pending; new receipt did not start polling. | Existing submit state locks POST and enabled form controls, starts one status timer after success, blocks pre-initialization submit. |
| Server rejects valid first submit | INSERT had 12 values for 11 columns. | Real SQLite executes production route; POST and independent GET readback succeed. |
| Concurrent first submits duplicate rows | SELECT-before-INSERT race. Existing route uses atomic conditional INSERT and existing device recovery query. | Two initial reads race; one durable row, same receipt id/queue. No migration. |
| Concurrent/stale resubmit overwrites correction | UPDATE did not compare original validation; stale tabs lacked expected revision; polling could promote receipt revision while keeping an old applicant. | Atomic status/validation CAS plus integer client expectedRevision; simultaneous resubmit yields 200/409, stale/missing revision yields 409. Newer polling revision preserves old draft/revision until explicit labeled reload replaces it. Both Worker/React carry revision. |
| Server defaults replace deliberate empties | Server treated explicit-empty applicant fields as absent. | Own-property fallback; optional invitation stays empty after POST/GET, cleared required Telex is rejected. |
| Preview tests another implementation | Authorized Preview served React while Production used standalone Worker. | `worker/index.ts` routes Preview GET /visa-intake to same renderer after existing authorization. Supplementary order test; live UX requires login. |

No migration, second draft store, external paid service or Production data write was introduced. Existing draft, receipt, server validation and queue owners remain in use.

## Executed checks

- Baseline historical PR head: fresh `npm test` completed typecheck/build and 674/674 tests.
- Candidate integrated with current main: fresh `npm test` completed typecheck/build and 708/708 tests; zero failed, skipped or cancelled.
- Focused suite: 72/72 (existing intake checks, 16 emitted DOM behavior tests, 6 real SQLite API tests).
- Root-cause tests ran failing before fixes. Additional review regressions included 5 failures before correction, then a separate failing revision-promotion/late-IME case; all pass after minimal corrections.
- Focused Worker/API/new-test lint has no errors. React intake lint retains two existing react-hooks/set-state-in-effect errors and one existing dependency warning; current-main stdin lint reproduces them. React change is only the required revision payload field. No rule/test was suppressed.
- Existing Constitution workflow dependency-sovereignty assertions pass locally at 1.2.0. Canonical shared workflow result must come from exact-revision GitHub CI.
- One independent read-only review identified recovery defects and rechecked focused corrections. This is local code/DOM/SQLite evidence, not browser acceptance.

Test budget: exact jsdom@26.1.0, dev-only, free/local DOM/event/selection execution. No user data export or runtime service. Budget includes degraded behavior, export/replacement paths and removal when equivalent browser CI replaces it. API tests use local Node SQLite with existing migrations; synthetic fixtures cannot demonstrate live server receipt.

## Deployment and acceptance gates

Production remains on main; observed run `37867827602` succeeded independently of candidate. Previous Preview run `37801891259` deployed historical `b1a0a14d0d5e25f062eb95e78bbc39595bbec0a8`; this is not candidate evidence.

Use existing Preview workflow on this branch. Environment: https://application-management-preview.boiech-ai.workers.dev. Browser reached Preview access-secret sign-in wall; no credential/session is available to the agent. Production browser reached its own sign-in screen. Deployment/readback/browser evidence acquired after publication belongs in PR #335 with tested head SHA.

Open real acceptance: desktop/mobile input/paste with IME; save/F5/tab reopening; invalid→corrected save; one live submit/readback; Admin return/correct/resubmit preserving id/queue/revision; PDF if supported; links/queue/Companion/backup/selective-delete/Admin-Public regression. Use isolated Preview test records and safe cleanup. No REAL-UX-VERIFIED, Production DEPLOYED or OBSERVED claim is made.

Unrelated scheduled failure: Project Repository Watch run `38036203797` reports CAE_Simulation, ECAD_Design, pc-manager-desktop absent from catalog. Recorded without expanding scope.

## Five metrics — observations, no protected PASS

| Metric | Baseline/sample/source/revision | Status |
| --- | --- | --- |
| K1 new regressions | Historical head 674/674 and candidate 708/708 local tests; review regressions fixed. No real product/browser cohort yet. | INSUFFICIENT DATA for whole-product acceptance. |
| K2 first-fix success | RED→GREEN records, no established incident denominator/first-attempt baseline. | INSUFFICIENT DATA. |
| K3 duplicate source of truth | Diff removes per-field normalization listeners, retains draft/receipt owners. No quantitative ecosystem baseline. | INSUFFICIENT DATA for metric PASS. |
| K4 load/interaction | DOM test duration is not browser load/IME/mobile performance; no Preview sample yet. | INSUFFICIENT DATA. |
| K5 reopened root causes | No candidate post-release observation interval or incident cohort. | INSUFFICIENT DATA. |

Next safe action: publish PR branch, verify exact-SHA CI/Preview readback, obtain Preview authentication and complete real journeys. Keep constitutional approval and independent Production authority closed until their own evidence and authorized decisions exist.
