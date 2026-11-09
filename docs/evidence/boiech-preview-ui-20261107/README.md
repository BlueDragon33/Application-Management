# Bơi ếch UI and Cloudflare publish checkpoint — 2026-11-07

**Local code gates are verified. The new application UI is NOT deployed. Live HTTPS manager acceptance and Production release remain BLOCKED.**

## Exact source

- Application Management base: `f347bd0ccd5e7f7e4e4bca4a31168e1219c18370`.
- Verified code candidate: `b1fcc158a60b0836102b015eb74abf1a30fcab20` (GitHub code commit).
- Code root tree: `fe1d4b3b56a08f32431397f0e0ec76bd790e2293`; application subtree: `c8e702ad4fd1faf06e8caf853dc6ce8b4cac7b3d`.
- Feature branch: `feat/boiech-preview-ui-lifecycle-20261106`. Evidence-only commits preserve the verified executable inputs.
- Bơi ếch candidate remains `385893b86d2586712f974153ca84e999c4e515ce`; its application/test subtree is `4b28907e8c901e6dc72c232dabcff1ad8b35fb3f`.

The Owner clarified that both Cloudflare token lifetime and manager access should start at **30 days**, with subsequent operations through Application Management UI, and then explicitly requested continuing and publishing the latest version. This checkpoint records completed work and real blockers; source synchronization is not a website deployment.

## Implemented UI

New authenticated route: `/apps/boi-ech/cloudflare-preview`, linked only for Owner from the existing Bơi ếch control screen. It provides encrypted credential connection/replacement, actual provider expiration readback, a 30-day preset/date editor, typed-name revocation, safe vault disconnection/recovery, and the existing inline MFA flow. Credentials are never returned to the browser after storage or included in audit details.

The existing manager detail screen already has **Ngày hết hạn**, **Lưu hồ sơ & thời hạn**, and Owner-only management grant/revoke controls. Their presence was verified read-only in the actual signed-in browser. No Production date, manager role, audit record, or grant was edited. Production approval does not authenticate a Preview manager.

Manager operations continue to use the existing Bơi ếch backend. A manager is not an App-Management admin. Missing Cloudflare lifecycle authority is explicitly BLOCKED; the UI never manufactures backend authority.

## Actual verification — guarded Node v22.16.0

| Check | Actual result | Evidence |
| --- | --- | --- |
| App-Management full `npm test` (TypeScript + verified build + regressions) | **848/848 passed**, 0 failed/skipped, exit 0 | `app-management-node22-tests.txt.gz` |
| Bơi ếch complete regressions, serialized to obtain an unambiguous final TAP summary | **564/564 passed**, 0 failed/skipped, exit 0 | `boi-node22-tests.txt.gz` |
| App-Management lint | **0 errors / 25 existing warnings**, exit 0 | `lint.txt` |
| App-Management source Preview validator | Exit 0 | `preview-validator.txt` |
| Local ESM/hosting artifact validator | Exit 0 | `artifact.txt` |
| Dedicated lifecycle/auth/UI regressions | **21/21 passed** | `focused-security.txt` |
| Actual workflow-shell + real Worker metadata regressions | **4/4 passed** | `preview-guards.txt` |
| Independent scheduler/storage/lifecycle verification | **28/28 passed** with explicitly guarded Node 22.16.0 | Review below |
| Independent new workflow/validator verification | **4/4 passed** with explicitly guarded Node 22.16.0 | Review below |

The old npx-cache Node executable vanished during this long session, causing unguarded commands to fall back to Node 24. Those runtime labels are superseded, not relied upon. A pinned runtime was installed in task scratch; the final commands assert `process.version === "v22.16.0"` before executing. Raw logs and integrity hashes are retained here. The first redirected Bơi full run lacked a final TAP summary despite a zero exit; it was not accepted as a completed result and was replaced by the complete serialized run above.

Local artifact and source-validator success do **not** prove a generated Cloudflare-bound artifact, signed live manager behavior, responsive browser acceptance or Production readiness. The Production validator currently reports **CLOUDFLARE_PRODUCTION_NOT_CONFIGURED**; its zero exit is not relabeled as a configured deployment. Before publishing, rebuild the approved exact SHA using the real isolated Cloudflare configuration and run its generated-artifact guard.

## Independent review and repairs

The first independent review requested changes for two Important findings: uncertain provider writes reported non-application, and unreadable encrypted vaults disabled every recovery control. Both were reproduced with failing tests and repaired. Lost/malformed PUT or DELETE responses are reconciled using independent provider state; unresolved application is `applied: null`. Safe `vaultPresent` metadata keeps authenticated disconnect available after key/ciphertext corruption.

Initial unverified deployment-token staging was also removed: separately authorized lifecycle access must verify the exact single-Worker Editor policy before the deployment key enters the vault. Permission authority uses exact IDs read from the real Cloudflare review JSON, not optional display names.

The Owner's publish request exposed 23 pre-existing lint errors in the base. A separate implementer fixed them without business-rule/auth/schema changes, preserving synchronous draft persistence and event cleanup, and added seven behavioral scheduler/hydration tests. Only the third-party minified QRCode.js file is excluded from lint. An independent reviewer reported **no new actionable findings** in this delta; its guarded focused tests passed 28/28, including the repaired lifecycle paths.

The actual Preview validator then exposed a stale whitespace-dependent marker, missing exact manual confirmation, and absent CI dry-run. The marker now tolerates formatting while keeping the same boundary assertion; real Worker metadata tests prove anonymous 401 and authorized Preview mode. Actual shell tests prove confirmation safety and artifact failure stopping publication. The deployment job remains **DORMANT / `if: false`**. A separate review of this new delta found **no material findings**, with 4/4 guarded tests. No workflow was dispatched.

## Real connection established within already approved scope

Created the already approved `boiech-preview-work-20261106` token with **Individual Workers Editor only for `boi-ech-preview`**, expiring **2026-12-07 23:59:59 Moscow time** (`2026-12-07T20:59:59Z`). The one-time value was transferred into protected task runtime storage (0700 directory / 0600 file), never printed, checked in, or saved as an image. The one-time dialog was closed.

Actual Cloudflare API readback: token verification **200 / active**, Preview Worker settings **200**, Production `boi-ech` settings **403**. See `preview-connection-readback.json` and `preview-token-created.jpg`. This establishes usable isolated Preview API access, not authorization to publish the other Workers.

## Still blocked before publishing

1. The new UI is source-only. Existing `application-management` and `boi-ech` sites have not received these candidates. No Production deployment or merge occurred.
2. A prepared publication token is on Cloudflare's final review page: `boiech-manager-publish-ui-20261107`, **Individual Workers Editor** for exactly `application-management`, `application-management-preview`, `boi-ech`, and `boi-ech-preview`, expiration **2026-12-07 23:59:59 Moscow**. It is **not created**. See `publish-token-review.jpg`.
3. A separate prepared UI lifecycle token is on final review: `boiech-preview-lifecycle-ui-20261107`, sole permission **Account API Tokens Write** on the exact Cloudflare account, same expiration. It is **not created**. This is account-level token-management access at Cloudflare, broader than single-Worker deployment access. The application adapter restricts use to the precise Bơi Preview token, but does not pretend the provider credential itself is Worker-scoped. See `lifecycle-token-review.jpg`.
4. Bơi isolated D1 provisioning previously failed at the **10/10 database quota**. No database was deleted or borrowed. R2 activation requires a usage-billed subscription and acceptance of terms; it remains unactivated under ZERO-SPEND. These blockers are not resolved by a publication token.
5. Actual manager desktop/mobile/role acceptance on the deployed candidate, isolated bindings, and final exact-SHA release gate remain outstanding. Fixture/DOM tests are explicitly local evidence.

The original Preview token approval is not being requested again. The two new draft credentials expand access needed for publication and self-service lifecycle UI, and require direct confirmation before creation. No plan upgrade, billing activation, schema/grant bypass, hosted Actions, cross-project deployment, or Production mutation is included in the completed work.

## One Next Action

Confirm creation of the two prepared **30-day** credentials (four-Worker publication Editor plus the separate account-token lifecycle Writer). This unblocks the authorized deployment connection so actual Preview/website checks can continue; it does not waive isolation, ZERO-SPEND, remaining D1/R2 blockers or release gates.
