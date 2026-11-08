# Issue #379 — Owner account duration management, source checkpoint
Date: 2026-11-08. **SOURCE-ONLY, NOT TEST-ACCEPTED, NOT DEPLOYED.**

## Added in this branch
- Existing App-Management Bơi Ếch Owner overview mounts `AccountExpiryPanel`: per-role default 30 days, per-account date, suspend, resume, audit reason and Moscow-time presentation. Never equates account entitlement with device/payment or Cloudflare token TTL.
- `app/api/apps/boi-ech/account-entitlements/route.ts` requires signed Control proof and Owner role. It uses the existing Bơi Ếch signed control bridge, with bounded command body and read-after-write verification. No user-provided upstream base URL or API secrets exposed.
- `app/boi-access-client.ts`: typed client for accounts/default policy.
- `worker/production-auth.ts`: sensitive account entitlement writes added to MFA step-up gate, user-requested step-up lifetime now 30 minutes instead of 15. Google login/cookie persistence otherwise unchanged.
- Contract tests added and existing TOTP test expectation adapted.

## Verification
15/15 source invariants PASS across both GitHub branches. **NO full npm test, lint, typecheck, build, browser, real Preview or Production deployment has run for these new changes.** Feature will return an explicit error until Account First V2 and new account control endpoint are correctly enabled on an isolated Bơi Ếch Preview.

## Dependencies
- BOIECH_AI branch `feat/boi-account-entitlement-108-20261108` and Issue #108.
- PR #107 manager console and PR #377 permission fix still Draft/open; must reconcile carefully.
- PR #378 was merged into feature branch `feat/boiech-preview-ui-lifecycle-20261106`, not directly main, with no proven Production publish.
- No Cloudflare token update/revoke or price change occurred. Current recorded token expiry remains Dec 7 until provider readback.
- Authenticated Cloudflare production, real devices, D1 migration, FREE CPU profile, legacy backup, independent review and exact-SHA Owner release gates remain pending.

**Next action:** source QA on exact branch head; then browser/isolated Preview with credentialed session. No hosted Actions, merge or Production mutations without required gates.

## UPDATE 2026-11-08 — Draft PR #381 and UI fixes

- Open draft PR #381 targets `feat/boiech-preview-ui-lifecycle-20261106`, not main.
- Fixed account expiration date-time picker to round-trip Moscow wall clock (+03:00), without accidentally interpreting local device timezone.
- Owner UI now separately displays account expiration, historical device-access expiration and payment state; explicitly warns that account renewal does not rewrite a separate device/payment policy.
- Integrated PR #377 focused manager target identity and 16k bounded overview query fixes, copied regression tests. PR #377 itself remains separate.
- MFA step-up on sensitive Owner duration mutations is 30 min in proposed source; still requires authenticated session in live Worker.
- No full Node22 npm tests/tsc/lint/build, Preview deployment, release or Production mutation was performed. TinyFish paid browser automation is unavailable; no payment was made and no attempt to buy service should be requested. Public repositories may use standard GitHub Actions free runners via an authorized no-deploy dispatch; the app connector lacks dispatch capability in this chat.
- Verify active PR #381 head for latest SHA; checkpoint old SHA is superseded.

## VERIFIED QA UPDATE — 2026-11-08 (supersedes older NOT_RUN claims)

- Latest tested HEAD before this evidence-only update: `04a8e4b90238e07584daa6fc17a4925441cc96c2`, [development fast CI #42488393535](https://github.com/BlueDragon33/Application-Management/actions/runs/42488393535) PASS and [Constitution #42488398578](https://github.com/BlueDragon33/Application-Management/actions/runs/42488398578) PASS.
- Companion [CI #42483400371](https://github.com/BlueDragon33/Application-Management/actions/runs/42483400371) on same UI/API source code: **861/861** regression PASS and **9/9** authenticated Playwright browser-fixture checks PASS on real local App Manager backend/D1 and synthetic upstream app clients. No host Preview was tested.
- Fixed rejected readback UI: form now restores verified policy rather than leaving optimistic draft; test includes 27->26 rollback and scoped mismatch notice. Real Owner/MFA on actual Cloudflare Workers is still NOT VERIFIED.
- Protected `cloudflare-preview-ci.yml` restored to **manual-only workflow_dispatch** after an auto-trigger was rejected by source gate. `deploy-application-management-preview.yml` remains intentionally **dormant (`if: false`)** and was NOT activated.
- [BOIECH_AI #109](https://github.com/BlueDragon33/BOIECH_AI/pull/109) has 595/595 source regressions and 26/26 LOCAL Wrangler D1 migrations PASS. App-BOIECH cross-Worker HTTPS/D1 Owner proof, MFA and CAS/readback still require real isolated remote Preview.
- Pending: legacy data snapshot preservation, 3-device browser/offline progress, independent reviewer, and exact SHA release authority. No Production change, merge or paid service.

**Next action:** authorized FREE Preview of two real Workers (when permitted), signed Owner E2E, D1 readback, MFA role/device QA, and independent release gate.
