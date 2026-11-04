# Bơi Ếch account permissions — Central source candidate

Latest owning source: `8c2b4710cb4c2802affe7d433ab0450d030a944a`. It hardens only the offline snapshot CLI and adds eight real CLI regressions; owning full Node is now 582/582, with verified build, typecheck and changed-file lint. Its application/DDL/config bytes remain identical to `040898b77b7ede9541e5f0c616656a5aa3ef20a4`, which corrected the earlier legacy authority/privacy findings. The explicit two-repo fixture is repinned and its 11 local integration checks pass against the new owning commit. Central application code below remains unchanged at `b50878d2878bf51444d033064ce9d9cb4e56a3e0`. [Current integration evidence](../evidence/account-migration-cli-20261104/source-integration.json). These source-only results do not establish real backup/restore, browser/target-runtime or independent product acceptance; release remains BLOCKED.
Blueprint OS 1.3.0. Branch `candidate/boi-account-permissions-p0-20261104`. Original base `4671ee60945229e0f35fc7faec662b1cea9a98bd`; consumer repair starts at `3cf2f7d703d762f38dcfdcbbf9ac90acf3c39bf0`. Owning implementation pinned at BOIECH `fbf70057a232e3c1f6115311afc0385e80e6dbb6` on `candidate/account-first-p0-20261104`. The commit containing this handoff is the new Central evidence anchor.

**REVIEW BLOCKED; CI PENDING; global D1 10/10 BLOCKED.** No release authority, Actions, PR event, deployment or production writes. `BOI_ECH_ACCOUNT_FIRST` remains OFF by default.

The authenticated `boi-account-permissions` operation resolves the actual Owner through existing server proof; Publisher is denied before issuing the signed bridge. Central reads owning account revision, sends CAS command and performs a separate raw readback. It verifies identity, next revision, persisted capability bits, expiry and manager approval status. A mutation response alone is never persistence evidence. Explicitly whitelisted responses exclude credentials, sessions, recovery material, phone/profile dumps and unrelated fields.

Manager approval and `registrants.read.all` remain separate. The Owner panel uses an explicit expiry for broad grants; the owning BOIECH service stores the grant and audit. The account flow remains behind the owning default-OFF flag. The existing manager tier view is retained.

The candidate lacked inline MFA already present on main. Selected Authenticator UI/server code was recovered from pinned main `f347bd0ccd5e7f7e4e4bca4a31168e1219c18370`, without merging/rebasing or restoring weaker freshness checks. Only an explicit `STEP_UP_REQUIRED` response can initiate verification and resume the exact pending command once. Failed code, cancel, network failure and navigation cannot apply/replay a command. The enabled-factor check also prevents pending enrollment from elevating a session. Both manager and account permission mutations are classified as sensitive by the actual server gate.

Local consumer repair also removes owned-source lint errors using render state, bounded cancellable initialization and correct function names. Licensed `public/vendor/**` is excluded without editing vendor code. Independent engineering review found two lifecycle regressions: deferred font preference persistence and late MFA after unmount; both are fixed and behaviorally verified. This is source review, not Reviewer A/B authority acceptance.

| Actual local check | Result |
|---|---|
| `npm test` (typecheck + verified build + Node) | Exit 0; 832/832 |
| Final full Node after one additional production-gate test | Exit 0; 833/833; no skipped/cancelled |
| Full lint | Exit 0; 0 errors, 38 warnings |
| Two-repo source integration, all 21 owning migrations | Exit 0; signed tickets, Owner/Publisher boundaries, CAS, independent read, multidevice approval reuse, account quota, audit/redaction and revoke |
| Actual React Owner dialog | JSDOM only; correct code, wrong code, cancel, same revision-bound command |
| Independent review follow-up | 3/3 focused tests; no remaining actionable Critical/Important finding in reviewed changes |

The former 14 failures were stale source-pattern expectations against current manager-only routing, Local/Online/Hybrid behavior, independent GET, drafts and promise cleanup. They were updated to assert the current contracts; they are not presented as 14 reproduced runtime bug fixes. Historical evidence remains in `docs/evidence/account-first-p0-20261104/`. Current exact logs, limitations and file digests are in [consumer repair evidence](../evidence/account-first-consumer-repair-20261104/verification.json). The explicit two-checkout fixture is `scripts/boi-account-source-integration.mjs`; it uses in-process HTTP, synthetic bindings/identity probes and local SQLite. It is not live D1 evidence.

Real browser/Safari/iPhone, target workerd date 2026-08-26/CPU budget, authorized real legacy-snapshot migration, live D1 readback/rollback and independent authority admission remain NOT_RUN/BLOCKED. Installed Chromium/WebKit binaries are absent; JSDOM does not satisfy those gates. No enablement or release is justified by these local results.

**One next action:** submit this exact source pair and evidence to independent reviewers for the remaining authorized acceptance gates. **Fallback:** retain candidate branches and keep the account flag OFF until those gates can be exercised within ZERO-SPEND and explicit access constraints.
