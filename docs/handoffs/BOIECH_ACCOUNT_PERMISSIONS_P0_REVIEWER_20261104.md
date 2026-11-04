# Bơi Ếch account permissions — Central source candidate

Blueprint OS 1.3.0. Base `4671ee60945229e0f35fc7faec662b1cea9a98bd`.
Branch `candidate/boi-account-permissions-p0-20261104`.
Owning BOIECH source branch: `candidate/account-first-p0-20261104`, based on `f76e2d146636827952026ca206597a4416291110`.

**REVIEW BLOCKED; CI PENDING; global D1 10/10 BLOCKED.** No release authority, Actions, PR event, deployment or production writes.

The only account integration is an authenticated `boi-account-permissions` operation. Existing server proof resolves the actual Owner role; Publisher is denied before issuing the bridge. Central sends the existing authenticated signed bridge to BOIECH `/api/control/accounts`, reads account revision first, sends CAS command and performs a separate fresh raw readback. It verifies account ID, next revision, persisted capability bits, expiry and manager approval status. The mutation response alone is not acceptance evidence.

The new Owner panel distinguishes operational manager approval from separately selected `registrants.read.all`, with explicit expiry for UI broad grants. Every grant/revoke is stored/audited at owning BOIECH D1. Central's whitelisted response excludes passwords, password verifiers, recovery codes, sessions, public/private keys, phone/profile dumps and unrelated sensitive fields. It is not an identity database.

Existing manager-tier screen is retained; a separate detail panel loads account administration only when explicitly opened and requested. BOIECH flag remains OFF by default. In account mode, the legacy broad overview refuses profile export; this panel must use the new endpoint. Browser/Owner real-session acceptance is still pending.

Typecheck and build pass. Four new contract tests pass, including Publisher denial, stale CAS, failed readback and field filtering. Complete Central suite: 806/820, with 14 existing baseline failures; full lint has existing failures outside the changed source. These block consumer admission. See `docs/evidence/account-first-p0-20261104/verification.json` and failure list. No main synchronization/rebase/merge was attempted.

Owning implementation, migration rehearsal, engineering review findings and release gates are documented in BOIECH `docs/handoffs/BOIECH_ACCOUNT_FIRST_P0_REVIEWER_HANDOFF_20261104.md`.

**One next action:** resolve the pinned Central baseline regressions before isolated account integration admission. **Fallback:** keep both candidate branches and BOIECH account flag OFF.
