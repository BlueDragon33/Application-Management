# APP Owner Bơi Ếch — offline R5 integration checkpoint

Status: **candidate for offline Owner review; no release approval implied**.
The exact candidate commit is recorded in APP Issue #379 and the delivered ZIP's `OWNER_REVIEW_SOURCE.json`.

## Source and live comparison

- APP base/main read twice: `aa60c4426c36ac1a786e5bc4e7fc514d00d26111`.
- #387 is merged (`e11d01ebd54a3cf027209a37eb456656a41a7339`); #388 is also merged. Neither is treated as an outstanding integration PR.
- Authenticated read-only Production metadata reported `64e18347de92e3caafd3fb409cd7db46806cfd6d`, 65 commits behind this base. Source features therefore cannot be inferred to exist online.
- Online still displayed the older device-oriented navigation and second-approval duration copy. This work changes APP source only. No BOIECH_AI files, Production state, schema, secrets or real accounts were modified.
- Writer branch: `feat/boi-owner-console-offline-379-20261111`. No PR/merge/workflow dispatch or paid resources.

## Files and resulting behavior

| Files | Change |
| --- | --- |
| `app/apps/boi-ech/boi-owner-overview.tsx` | One-review language, requested-only approval count, metrics become unknown while reloading, legacy rows require reconciliation. |
| `app/apps/boi-ech/account-expiry-panel.tsx` | Existing Owner panel reuses inline Authenticator, serializes writes, retries only a denied MFA request once with unchanged CAS arguments. No second-approval action or premature activation. |
| `app/boi-access-client.ts` | Preserve server MFA/CAS/applied/readback metadata in errors. Success still requires verified server readback. |
| `app/apps/boi-ech/boi-ech-control-center.tsx` | Device drawer/history are observation-only. Bootstrap/refresh failure invalidates verified counters and CSV, including after a prior successful load. |
| `app/apps/boi-ech/boi-ech-shell.module.css` | Retain blue/violet identity and readable forms; refine scoped navigation/cards and narrow-screen rules. Visual acceptance pending. |
| `qa/boi-owner-offline.tsx`, `owner-offline-transport.ts`, `owner-offline-link.tsx`, `owner-offline.css` | Export actual Root and panels, synthetic accounts/transport/MFA/CAS/audit, separate identity database, strict offline labeling. Never use this adapter in Production. |
| `scripts/build-boi-owner-offline.mjs` | One inline HTML, CSP forbids network/workers/forms, temporary bundle cleaned outside repository. |
| `scripts/windows/START_APP_OWNER_OFFLINE.mjs`, `HUONG_DAN_APP_OWNER.md` | Exact-SHA APP-only isolated worktree, localhost3006, dependency repair/local D1 backup and migration, reject foreign runtime env files. |
| Owner tests plus updated `boi-manager-inbox-p0`/`boi-manager-invitation-l1` assertions | Behavioral and emitted-file DOM regressions; retire obsolete two-review copy expectations while retaining server MFA/authorization tests. |

## API contract — unchanged backend

All account operations use the existing signed `POST /api/apps/boi-ech/account-entitlements`; Owner authorization and upstream account identity verification remain authoritative.

| Action | Request/response expectation |
| --- | --- |
| `manager-inbox` | Optional cursor, verified manager records and nextCursor. Failure is unverified, never a verified empty queue. |
| `manager-policy`, `issue-manager-invite` | Existing policy revision/CAS and one-use 24-hour invitation. Recipient chooses their own password and key at Bơi Ếch. |
| `manager-review-first` | Requested manager + accountId + onboarding expectedRevision; verified readback. Profile remains mandatory before activation. No UI call to `manager-review-final` or `manager-review-changes`. |
| `list`, `policy` | Both collections must be verified before rendering account metrics. Teacher/learner observation does not authorize Owner business approvals. |
| `set-account` | Manager entitlement revision, operation, optional expiresAt and reason; server enforces CAS/audit/readback. |
| `set-policy` | Role, defaultDays, revision and reason. Default remains 30 days; changing default does not retroactively renew existing accounts. |
| MFA | Existing `POST /__account/mfa/step-up`, enrolled factor, current session, 30-minute freshness, existing CSRF checks. |

`STEP_UP_REQUIRED` may retry once only after inline authentication and only when the prior response is not applied/uncertain. MFA cancel/unmount does not replay. CAS409, applied=true/null and unverified readback remain failures and require manual inspection/readback.

The authoritative single-review environment flag remains unchanged. When absent, this UI is read-only for invitations/approvals rather than offering the obsolete two-step flow. Legacy `profile_review` rows are **BLOCKED for automatic activation** and require Work/backend reconciliation; no privilege bypass.

## Verification and independent review

Guarded Node **22.16.0**, locked dependency install; final `npm test` **913/913 PASS, 0 failures, 0 skipped**, including TypeScript and verified build. `npm run lint` exits 0 with 25 pre-existing warnings and no errors. Local Constitution1.3 dependency-sovereignty workflow assertions also pass. Full logs are in the ZIP. Initial full run found only two obsolete static copy assertions; updated to the one-review contract without weakening backend assertions. Generated bundle initially entered lint; fixed by using a cleaned OS temporary directory.

One fresh independent code review found no Critical issues and three Important issues: inherited ignored environment files, stale device verification after bootstrap failure, and QA access to the real identity namespace. Each was reproduced by a failing regression and fixed; the corresponding focused suite passed 9/9. Demo fault-reset was also treated as acceptance-affecting and fixed RED→GREEN. No findings remain deferred from that review.

DOM execution covers the emitted actual Root, one-review navigation, inline MFA cancellation, no external resource loads, separate identity namespace and loss of registry verification on failed refresh. It is **not browser layout or real-backend acceptance**.

## Remaining gates and Work integration

- **BLOCKED — browser visual/screenshots/responsive acceptance.** Local Chromium launch failed with `socket() EPERM`; cloud browser denied `file:` protocol. No policy workaround or fabricated screenshots. Check HTML on desktop/mobile widths and keyboard focus before UI approval.
- **NOT_RUN — Windows launcher E2E.** Unit checks do not prove Windows process/startup behavior. APP-only source review has no automatic BOI bridge; the Work writer must provide its separately authorized runtime to exercise real APIs.
- **NOT_RUN — HTTPS Preview with authorized manager and real MFA/CAS/audit/readback.** Synthetic success is never release evidence. No new Preview URL was created.
- **NOT_RUN — hosted GitHub CI.** Full checks run locally under Node22; new feature branch is outside configured push filters and no PR was opened.

Work may integrate this APP-only candidate after the Owner checks the ZIP and ownership is coordinated. Keep BOI source under its existing writer. Preserve exact SHA, release hold and all existing backend gates; no Production publication follows from offline UI approval.
