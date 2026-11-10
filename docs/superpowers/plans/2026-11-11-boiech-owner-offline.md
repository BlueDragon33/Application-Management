# Bơi Ếch Owner Console offline implementation plan

**Goal:** deliver a new downloadable offline review package built from the current APP source, with a clear one-review Owner flow and no Production or BOI source mutation.

**Architecture:** retain existing APP account/invitation/entitlement APIs and their Owner, MFA 30-minute, CAS, audit and verified-readback boundaries. Improve the existing Owner components and export those same components into a standalone, network-blocked HTML review with synthetic data. Include a Windows APP-only launcher for the exact candidate using an isolated worktree, plus clear real-runtime vs simulated-review status.

**Baseline:** APP main `aa60c4426c36ac1a786e5bc4e7fc514d00d26111`; PR #387 merged as `e11d01e…`, #388 subsequently merged. Online authenticated metadata reports `64e18347de92e3caafd3fb409cd7db46806cfd6d`; comparison is 65 commits ahead. The supplied R4 ZIP is a Windows paired-source launcher, not a self-contained UI.

## Constraints

- Sole writer on this APP branch; no BOIECH_AI file writes, main updates, merge, Production publication, secret rotation, account deletion, remote D1 or paid service.
- Owner manages invited managers and account policy. Teachers/learners remain observation-only in APP; their reviewer is the scoped Bơi Ếch manager.
- No obsolete second-approval call-to-action. Legacy stages remain visible as records requiring reconciliation, never automatically activated.
- Existing server gate must remain authoritative. Preserve explicit failure/unknown state rather than fabricated zero counts.
- Synthetic offline interactions do not prove real MFA, CAS, API or Windows acceptance; label them and retain real-runtime test results separately.
- Preserve the liked blue/violet visual language, readable contrast, responsive 320/375/430/768/1280 layouts and keyboard behavior.

## Tasks

- [x] Add behavioral regressions for single-review labels/counts, failed refresh, inline MFA cancellation/retry and immutable read-only oversight. Existing cursor/server regressions retained.
- [x] Repair `boi-owner-overview.tsx`, `account-expiry-panel.tsx` and client error propagation; reuse the existing Authenticator component and existing server authorization.
- [x] Remove duplicated legacy manager-account write controls from the device registry and refine the existing scoped Owner styling.
- [x] Add `qa/boi-owner-offline.*` and a build script: same production content components, synthetic client adapter, inline assets, strict no-network CSP, locally persisted mock state and error/CAS simulation.
- [x] Add an APP-only Windows launcher with exact SHA/source checks, no automatic BOI updates or migrations, no destructive Git operations and no remote deployment commands. Keep direct HTML review usable without Node/Git/network.
- [ ] Run guarded Node22 tests, typecheck, lint, build and browser review of the actual standalone file at responsive sizes. Windows E2E remains NOT_RUN unless actually exercised on Windows.
- [ ] Freeze APP candidate, save screenshots/evidence and API contract, post the requested checkpoint to APP Issue #379, and deliver one ZIP. No source/release status is inferred from a screenshot or successful mock action.

## Review focus

Unverified refresh must hide stale numerical claims; pagination failure must not become an empty queue; double-click/MFA cancellation must not replay writes; 409/readback uncertainty must not announce success or auto-retry; a standalone file must make zero real network calls and never import Production credentials.

## Execution ledger

Binding specification: the Owner handoff in this conversation; this plan is implementation guidance.

- Isolation: linked APP worktree at the pinned base, original main preserved. No BOI worktree or file changes.
- RED→GREEN: actual Owner component tests 2/8 → 8/8; canonical device wiring tests failed twice before the fix, then combined focus 14/14.
- Fresh independent whole-branch code review: no Critical, 3 Important findings. Environment-file inheritance, stale bootstrap verification and real identity-namespace access all received failing regressions and fixes. Focus 9/9; final full suite 913/913.
- Ruling: demo fault-reset is acceptance-affecting, so fix its armed flags rather than defer — otherwise the Owner's fresh review could report a false connection/CAS failure. Regression failed409→passed200 after reset.
- Ruling: browser layout/screenshots remain BLOCKED after Chromium socket EPERM and cloud `file:` policy rejection. Execute the generated HTML only as a DOM unit test, never claim visual PASS. Cost: human/browser responsive acceptance remains required.
- Ruling: preserve the APP-only branch and checkpoint rather than open a PR — the user requires separate writer ownership and ZERO-SPEND; opening a PR would trigger hosted CI. Cost: integration and Windows/Preview/backend verification remain pending.
- Final local commands: guarded Node22.16 `npm test` PASS913/913 incl TypeScript/build, lint exit0/25 existing warnings, Constitution1.3 dependency budget workflow assertions PASS. Browser/Windows/real upstream acceptance are not inferred from these checks.
- Final delivery: exact SHA in Issue379 and generated ZIP manifest; self-contained HTML plus APP-only Windows launcher, full test/lint logs, scope and remaining gates. No screenshots fabricated; no release authority implied.
