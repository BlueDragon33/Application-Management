# Cloudflare Canonical Cutover Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Keep one active package and checkpoint evidence before resuming.

**Goal:** Make Cloudflare the single official runtime for Boi Ech and its management connection, preserving existing users, entitlements, payments and learning evidence before retiring the legacy Sites entry points.

**Architecture:** Reuse the existing Boi Ech Worker/D1 and Application-Management control plane. Preserve each application's data ownership. Reconcile source/target data and verify the existing protected release path before changing entry points; retain a reversible legacy endpoint until acceptance.

**Tech Stack:** Existing Cloudflare Workers, D1, R2 where required, GitHub Actions and the current application contracts. No new hosting provider, registry or management application.

**Spec:** User instruction, 2026-10-28: “một bản đang chạy trên chatgpt.site, một bản chạy trên cloudflare, tôi cần thống nhất chạy trên cloudflare”. This changes the deployment target; it does not waive data, security or release gates.

## Global Constraints

- Effective Constitution 1.3.0; record CODE COMPLETE, TEST VERIFIED, MERGED and DEPLOYED independently.
- Keep legacy data and access available until verified target backups/import/readback and critical journeys pass. Never overwrite conflicting target grants or delete a Site as a shortcut.
- Do not put credentials, private user records or unencrypted database exports in Git or public CI artifacts. Browser signing keys remain client-owned and origin-bound.
- Preserve owner authentication, app-scoped approval, payment classification, revocation and expiry. Device enrollment is not administrative authority.
- Reuse reviewed fixes in Boi PR #102 and management PR #364; do not fork duplicate implementations.

## Review Focus

- A saved policy/UI from a legacy origin must not be treated as a current Cloudflare policy.
- Conflicting person/device/payment records must produce an explicit reconciliation result, not a silent overwrite or approval.
- A new origin cannot be assumed to possess existing browser signing keys or local progress.
- Owner access must survive migration without enabling anonymous production access or reusing Preview credentials/D1.
- Payment proof storage, new-device enrollment, learning-state readback and video-return cancellation require target-runtime evidence.

## Pinned State

- Boi main: `636ad79262993feaba9ecfd94814b262198c6bc9`; PR #102 candidate: `c889bc05a2dbb5b74b967b5bc214fbdffad5f61f`.
- Management main: `93906a7fff0f3925139ab63dc01312e8d18caf17`; PR #364 candidate: `c86780c4b836a3077f693a3372aa483f195a96a3`.
- Last observed legacy Sites: Boi `appgprj_6a748e2b7ac48191bccf06eada38f2af` v39; management `appgprj_6a7d772bf04c8191bffb836da6518b59` v59. They have not been stopped by this work; no cutover has been executed.
- Cloudflare target URLs are recorded by successful production job `112283961236` / run `37468042034`: `https://application-management.boiech-ai.workers.dev` and `https://boi-ech.boiech-ai.workers.dev`.
- Boi checked-in production D1: `boi-ech-db`, UUID `7816425d-ce8a-4b3c-b303-7697fd4a529c`. This is configuration evidence, not confirmation of the live binding.
- Management production job is currently `if: ${{ false }}`. Its offline-publication hold test explicitly prohibits even manual publication. Do not silently remove this hold.
- Boi live-development workflow can publish on main pushes; assess that path before merging a cutover candidate, so merge cannot unexpectedly replace production ahead of migration.
- CLI is unauthenticated. No installable Cloudflare plugin was found. Browser Google sign-in returned “Unable to sign in. Try again or use your email and password.” Automated retries stopped; authenticated provider access remains BLOCKED.
- Anonymous CLI health requests returned HTTP 403; the sampled response was `server: envoy`, body `error code: 1010`. This is a rejected request, not evidence of an application exception or successful readiness. Do not change security controls or client fingerprints to work around it.

## Task 1: Establish the cutover contract and access boundary

**Files:** this plan; `docs/CLOUDFLARE_DEPLOYMENT_TRACK.md`; Boi PR #102 description restart pointer (no runtime source delta).

- [x] Record the accepted target, exact existing candidate SHAs, origins and current publication holds.
- [x] Check provider tooling and attempt the supported secure login flow; do not collect credentials in chat.
- [ ] Obtain authenticated Cloudflare access and inspect actual Worker versions, bindings, target D1 schemas, policy/audit and device-service exception logs.
- [ ] Obtain complete, private source/target backups and a reconciliation inventory with provenance, counts and hashes. A bounded/truncated table view or source version is not a database backup.

Completion: provider access and both data inventories are verified. **Current active package; BLOCKED on authentication.**

## Task 2: Reconcile data and prepare the existing release path

**Files to inspect:** management `.github/workflows/deploy-application-management-production.yml`, `tests/governance/offline-publication-hold.test.mjs`, `scripts/prepare-cloudflare-production.mjs`; Boi `.github/workflows/deploy-cloudflare.yml`, `.github/workflows/live-development-deploy.yml`, `boi-ech/wrangler.d1.jsonc`, `boi-ech/vite.config.ts`, device/payment schema owners.

- [ ] From Task 1 evidence, define exact table/record reconciliation and rollback; stop before importing unresolved identity/payment conflicts.
- [ ] Inspect existing portability/handoff support for origin-bound identity and local progress; test a representative existing user before promising preservation.
- [ ] If source/config repairs are required, reproduce each defect first, apply one bounded fix and run the owning regression tests. Verify actual R2 bucket/binding before asserting payment uploads work.
- [ ] Prepare an owner-authorized reactivation PR for the manual production workflow only after its exit/readiness criteria are evidenced. Keep automatic production publication disabled and preserve `DEPLOY_PRODUCTION` confirmation and protected environments.
- [ ] Run the existing production boundary/artifact checks at the exact candidates. Existing successful generic CI does not prove live target D1/auth readiness.

Completion: reconciliation/rollback and exact release candidates are reviewable and verified, with no unresolved cutover-blocking defect.

## Task 3: Deploy, verify, then switch entry points

- [ ] Use the existing protected manual deployment path and record exact deployed revisions and D1 identities. Do not recreate the Workers or replace their databases.
- [ ] Read back owner login/session protection, management-to-Boi origin/bridge, effective automation and quota; verify an eligible new-device journey and a representative existing account's preserved grant/progress.
- [ ] Verify payment-proof storage and video analysis cancellation/return on the target runtime where applicable.
- [ ] Point official links and management connection to the verified Cloudflare origins. Only then make the legacy entry point read-only/redirected using the accepted identity/progress transition; retain rollback evidence.

Completion: one official Cloudflare path per application, consistent policy/device readback and preserved data/access; no parallel writable legacy path. Until then status remains **CUTOVER NOT EXECUTED**.

## Next Safe Action

Complete provider authentication in the existing Cloudflare browser handoff. Resume at Task 1 with live bindings/data/errors; do not repeat repository discovery or treat these target URLs/config values as proof of a completed migration.
