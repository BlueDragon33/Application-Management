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
