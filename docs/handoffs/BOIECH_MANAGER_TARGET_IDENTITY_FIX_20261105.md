# Bơi Ếch — repair manager-grant target identity

Date: 2026-11-05 (Europe/Moscow). Task: `BOI-MANAGER-TARGET-IDENTITY-20261105`.

**SOURCE FIX VERIFIED LOCALLY; NOT DEPLOYED. REVIEW BLOCKED · CI PENDING · global D1 10/10 BLOCKED. Account-first flag remains OFF.**

## Trigger and observed failure

The existing App-Manager Bơi Ếch device drawer exposes “Cấp quyền điều phối”. The live page displayed “Thiết bị Bơi ếch không còn trong registry.” while the selected manager remained visible. The same page displayed “Yêu cầu bridge không hợp lệ.” and retained stale registry data. Bơi Ếch still displayed its management-permission-required message. No live grant/revoke was submitted by this repair task.

The repaired branch starts at current App-Manager main `f347bd0ccd5e7f7e4e4bca4a31168e1219c18370`. BOIECH main was read at `b511255063a7637167f6d7ac5f8fd86f013f74b9`. This is a separate main-based hotfix, not an account-first rollout.

## Root cause and resulting behavior

1. The Bơi Ếch control-center's private `proof()` returned the administrator's identifier as `deviceId`. `secureApi()` merged that proof after the command body, overwriting the selected manager's `deviceId`. The access handler therefore looked up the administrator's QT identity in the Bơi Ếch registry. The proof now uses the verifier's existing `proofDeviceId` field. The selected manager target survives unchanged, and the actual administrator still proves possession of the signing key.
2. Quiet registry refresh encodes all known display codes. A legitimate 75-device registry exceeds the proxy's old 1,000-character query limit. The proxy now accepts a bounded 16,000-character query, sufficient for the owning overview endpoint's supported 500 codes (approximately 12.5k encoded characters). The configured-origin, allowed-path, query-key, body-size, token-shape, response-size and image checks are unchanged.

No Owner authorization, step-up, audit, independent readback, payment, expiry or role checks were removed. No direct database update, automatic manager approval or read-all grant was introduced. No application data or credentials are included in this evidence.

## Verification performed

- Before modifying production code, the new signed manager-grant regression failed with `DEVICE_NOT_FOUND`; the new 75-code proxy regression failed with HTTP 400. The other two cases passed (2 pass / 2 fail).
- After repair, 22 focused cases passed: actual P-256 signing/verifying and the real access handler with a synthetic owning-app transport, grant/revoke readback, bootstrap, denied publisher, payment/expiry preservation, stale state, proof forgery/replay and proxy boundaries.
- Full `npm test`: exit 0. Includes `tsc --noEmit`, verified build/artifact checks, and **819 Node tests passed, zero failed/skipped/cancelled** under Node `v24.22.1`.
- ESLint on the four changed code/test files: exit 0, no errors or warnings. `git diff --check`: exit 0. Generated `tsconfig.tsbuildinfo` was restored and is excluded.
- Separate-context, read-only review of this bounded change found no Critical/Important/Minor findings and independently ran 11 relevant tests. It is advisory code review, not independent product acceptance or release authority.

Evidence: `docs/evidence/boi-manager-target-identity-20261105/verification.json`, `npm-test.log`, `changed-eslint.log`. The log includes ordinary proxy/Node experimental notices; they are not failed checks. Only trailing horizontal whitespace was removed from the committed log; its original and normalized hashes are recorded.

## Remaining release boundary

The live application has not received this repair. No GitHub-hosted Actions, PR, merge, approval, ratification, Cloudflare deploy, live grant/revoke or D1 write was performed. The existing executor connection gate remains unresolved; browser sign-in is not an executor credential.

An authorized release executor and independent acceptance must confirm the exact hotfix source, the signed target identity and the manager permission readback before publication. This hotfix requires only App-Manager code deployment and **no D1 migration**; do not run a generic workflow that applies unrelated pending migrations. Do not deploy either account-first candidate as a shortcut.

After a reviewed deployment, the Owner must confirm the specific manager grant. Verify the persisted permission independently and recheck Bơi Ếch access, registry synchronization above 75 codes and unchanged payment/expiry state. Do not report live QA PASS from these synthetic tests.

## Preserved account-first candidates and fallback

- BOIECH candidate remains `8c2b4710cb4c2802affe7d433ab0450d030a944a`.
- App-Manager account-first candidate remains `49a3f85fc42e564460732110974fd951ad8d117e`.
- The real SQL backup/restore task remains incomplete and is not replaced by this code repair.
- Fallback: retain the running applications, existing data/permissions and account-first flag OFF until an authorized release is accepted.
