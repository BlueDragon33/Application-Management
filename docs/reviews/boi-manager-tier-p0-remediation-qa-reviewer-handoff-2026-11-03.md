# Blueprint OS 1.3.0 — P0-S1 / P0-S2 Remediation and Independent QA Handoff

**Date:** 2026-11-03. **Evidence class:** code changes and limited local QA; **NOT** authorized Cloudflare D1 QA, TypeScript build PASS, human reviewer approval, merge, release, or Constitution ratification.

## Immutable source under review

- Application-Management: `candidate/boi-manager-tier-20261102` source commit `114bdb28f1bee8a5016cbfcd52e16734af6dc26b`.
- BOIECH_AI: `candidate/manager-tier-device-approval-20261102` source commit `64e5d47d33a7e45bd6cde77420a0a04c50341b0a`.
- Historical blocker intake: https://github.com/BlueDragon33/Application-Management/blob/ea637a5c4445e83ec6ffa679f814997de15312dd/docs/reviews/boi-manager-tier-p0-independent-reviewer-handoff-2026-11-03.md
- This packet supersedes that handoff for remediation disposition. Historical documents remain unchanged as provenance.

## Implemented fixes — no claim of end-to-end QA

### P0-S1 — corrected stale test assertion (App-Manager owner)

- Test at https://github.com/BlueDragon33/Application-Management/blob/114bdb28f1bee8a5016cbfcd52e16734af6dc26b/tests/boi-manager-tier-bridge-contract.test.mjs no longer demands the obsolete CAS expression `expectedManagementEnabled!==bool(row.managementEnabled)`.
- It expects the current persisted bit CAS: `expectedManagementEnabled!==row.managementConfigured`, and checks for missing raw D1 readback.
- Owner handler: https://github.com/BlueDragon33/Application-Management/blob/114bdb28f1bee8a5016cbfcd52e16734af6dc26b/app/api/operations/route.ts#L992-L1091

### P0-S2 — persisted raw D1 revoke readback (BOIECH owner + App-Manager bridge)

- BOIECH `get-manager-grant` remains Owner-authenticated and uses a fresh scoped `SELECT management_enabled,status,access_expires_at FROM device_access` filtered by `deviceId`, `person_role='manager'`, `expectedPersonCode`, and registration state. Response now exposes BOTH `managementConfigured` (raw D1 bit) and `managementEnabled` (effective active permission), rejecting invalid raw values.
- After grant/revoke, BOIECH checks CAS and audit in its D1 batch, then executes an additional independent raw D1 `SELECT` and requires it to match the requested bit before returning success. Effective readback is still checked separately.
- App-Manager issues a separate authenticated `get-manager-grant` request after mutation and validates both raw `managementConfigured` and effective `managementEnabled` against the requested state. Owner account approval also requires raw grant true.
- BOIECH source: https://github.com/BlueDragon33/BOIECH_AI/blob/64e5d47d33a7e45bd6cde77420a0a04c50341b0a/boi-ech/app/api/control/management-access/route.ts
- App source: https://github.com/BlueDragon33/Application-Management/blob/114bdb28f1bee8a5016cbfcd52e16734af6dc26b/app/api/operations/route.ts#L1047-L1091
- This closes the code-path ambiguity where a blocked/expired manager's *effective* permission reads false before and after revocation, even though the raw D1 bit could remain true. Actual D1 persistence in authorized QA is **not verified**.

## Regression artifacts and results (separate evidence classes)

| Evidence | Observed result | Interpretation |
|---|---|---|
| Source contract inspection | 24/24 selected checks matched source | static consistency only, not build |
| Regex source assertions mirrored in an isolated V8 evaluator | App 39/39; BOIECH 69/69; App index sanity true | 108/108 pattern checks, **not** executing Node suites |
| SQLite isolated behavioral exercise via Python sqlite3 (manual reproduction of source SQL shape) | 6/6 expected: blocked revoke, expired revoke, active revoke, active grant, stale CAS, blocked grant denial; reopen readbacks and audit assertions | actual local SQLite execution, not Cloudflare D1 or live endpoint |
| App-Manager Node test suite | 7 test blocks; not executed here | execution PENDING |
| BOIECH existing Node source/contract suite | 12 test blocks; not executed here | execution PENDING |
| BOIECH reproducible source-linked SQLite test | 6 cases, matches actual SQL regex captures for source UPDATE, audit and readback; Node execution NOT DONE | QA-ready test file only |
| TypeScript and production-shaped build for BOTH repos | no build logs on these source SHAs | PENDING |
| Owner/Viewer signed QA, live D1, reopen, concurrency/50/5 | no authorized QA environment/grants or logs supplied | BLOCKED |

### Reproducible local behavioral test file

https://github.com/BlueDragon33/BOIECH_AI/blob/64e5d47d33a7e45bd6cde77420a0a04c50341b0a/boi-ech/tests/manager-tier-raw-grant-sqlite-regression.test.mjs

- Uses Node 22 `node:sqlite` and `node:test`, creates temporary isolated SQLite and deletes it after each case.
- Extracts owning SQL strings directly from the route to avoid a separately re-implemented UPDATE.
- Checks `changes()` audit, persisted `management_enabled`, and independent read after database reopen.
- Must be executed on an authorized QA runner and captured with source SHA and exit code before any Node PASS claim. It does not replace Cloudflare D1 integration.

## Independent reviewer / QA acceptance requirements

1. **Reviewer authority:** obtain true reviewer GitHub identity, independent authority scope/appointment, and a recorded technical review referencing both immutable source commits. Neither assistant nor source-pattern tests may self-approve.
2. **Build/type:** use locked dependencies and documented Node version; capture complete App-Manager TypeScript typecheck, production-shaped build, and BOIECH equivalent logs, commands/scripts, exit codes and source+lockfile provenance.
3. **Node:** execute the pinned test suites including the new SQLite source-linked fixture, report counts and failures with immutable artifacts; do not infer results from the 108 static regex checks.
4. **Authenticated live QA:** Owner permitted; Viewer, forged, expired, wrong-issuer or invalid-role tickets rejected; log correlation without secrets; no production side effects.
5. **Cloudflare D1 QA:** prove independent source WRITE and authenticated read via separate request, verify raw `management_enabled` after reopen for blocked and expired revoke, valid grant, CAS stale/parallel conflict, audit durability and 50/5 **shared** quota across multiple managers. Fail closed on readback mismatch.
6. **UI/demo:** protected Owner access, safe double-click lock/reload and read-only demo with no live mutations.
7. **Separate release gate:** technical review and QA are not authorization to approve PR, merge, ratify, publish or deploy.

## Current exact governance posture

- Source remediation for P0-S1 / P0-S2: **IMPLEMENTED, static and SQLite-isolated checks recorded**.
- **QA_NOT_RATIFIED / REVIEWER_NOT_VERIFIED / REVIEW_BLOCKED / CI_PENDING / GLOBAL_D1_10_OF_10_BLOCKED.**
- No GitHub-hosted Actions triggered, no CMD/Work/Codex, no changes to Constitution 1.3.0, no rerun of previously PASS pilot, no merge or Production.
- Both candidate branches still have no matching PR; creating a PR can trigger hosted CI and was intentionally not done.

## One Next Action and fallback

**Next Action:** authorized QA issuer provides approved isolated Cloudflare D1/Owner/Viewer environment with scope-bound credentials and a designated independent reviewer; execute pinned build/type, Node SQLite and live QA, attach logs, then have reviewer issue a **non-release** technical disposition for BOTH immutable source commits.

**Fallback:** if QA permission or reviewer authority is unavailable, preserve candidate heads and this handoff; do not run live mutations, infer PASS, create PR/Actions, approve, merge, ratify, publish or deploy.

## QA / reviewer intake verification — 2026-11-04 (READ ONLY)

**Scope pinned to source commits, not this documentation commit:**
- Application-Management SOURCE: `114bdb28f1bee8a5016cbfcd52e16734af6dc26b` (documentation parent HEAD `695fb057792c953975caf689c25169ac6dcf3e69`).
- BOIECH_AI SOURCE: `64e5d47d33a7e45bd6cde77420a0a04c50341b0a`.

**Evidence intake results, verified via GitHub connector (no execution):**
- Both candidate branch HEADs matched the previously pinned commits; no matching open candidate PRs found in either repository.
- REST GitHub Check Runs for each exact pinned candidate HEAD: **0**. REST GitHub workflow runs filtered by exact head SHA: **0**. Commit combined statuses: no statuses. This is absence of available GitHub-hosted evidence, not proof that external QA was never performed.
- No supplied or discoverable signed, scoped QA environment authorization, Owner/Viewer test identities, target QA D1 database identity, approved runtime receipts, exit-code logs, or durable read-after-reopen record tied to these source SHA pins.
- Software-Blueprint-QA-Worker repo README at `main` explicitly states **foundation only / NOT DEPLOYED / NOT CONSTITUTIONALLY ATTESTED**. Its open Draft PR #5 concerns advisory signed-PR v2 QA; it has **0 review submissions**, no requested reviewer, and its historical CI is for **other Hub/QA-worker SHAs**, not the two application source pins. Read: https://github.com/BlueDragon33/Software-Blueprint-QA-Worker and https://github.com/BlueDragon33/Software-Blueprint-QA-Worker/pull/5
- Hub Draft PR #154 is a separate governance identity candidate and has **0 review submissions** in the checked record; it is not an issuer grant or independent review decision for this application P0: https://github.com/BlueDragon33/Software-Blueprint-Hub/pull/154
- No independent reviewer appointment, specific authorized identity, review signature/submission, or disposition linked to both candidate source pins could be verified from the checked GitHub records. This does not rule out authority evidence not accessible to the connector.

**Evidence admission outcome:** `QA_EVIDENCE_NOT_ADMITTED / REVIEWER_NOT_VERIFIED / TECHNICAL_DISPOSITION_NOT_ISSUED`. No authorized TypeScript build, Node tests, Cloudflare D1 persisted-raw revoke QA, or runtime Owner/Viewer test was run in this session. Historic 24/24 static assertions, 108/108 regex matches, and isolated SQLite scenarios remain **limited source/fixture evidence**, never a substitute for exact-SHA runtime PASS.

**Only next action:** the authorized QA issuer/reviewer coordinator supplies one verifiable, scoped QA grant and independently authorized reviewer identity for both exact source pins (with permitted isolated runtime, QA D1 identity, log provenance and a non-production scope). On verification, an authorized QA operator may run build/type, Node including source-linked SQLite, Owner/Viewer deny/allow, and D1 independent raw readback; independently attach signed technical disposition. **Fallback:** with no verifiable grant and reviewer, retain all gates: `REVIEW_BLOCKED / CI_PENDING / GLOBAL_D1_10_OF_10_BLOCKED`, no CMD/Work/Codex/GitHub Actions, approval, merge, ratify, publish or Production.
