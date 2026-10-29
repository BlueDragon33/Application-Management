# Central Admin Release Readiness

Owner direction: continue the accepted shared device administration plan under the Constitution. Code PR365 and owning Boi PR105 are merged. App Management's publication hold is a separate release gate.

Goal: finish every permitted release prerequisite and leave an exact, reviewable release decision. Use the existing protected environments and Cloudflare runtime. No implicit production authorization or legacy data migration.

1. [x] Verify exact-head CI and merge the already reviewed feature without enabling automatic publication.
2. [x] Deploy the owning Boi change using its existing confirmed manual workflow, then verify the contract and signed device smoke.
3. [ ] Add a manual INSPECT_PRODUCTION path to App Management's existing production workflow. Keep deploy-production `if: false`. The new job may only read deployment identity, existing schema/migration metadata, a current D1 Time Travel bookmark and Worker deployment metadata. Do not log secret values or individual account/device records. Tests must exercise actual inspection behavior with controlled network/CLI boundaries.
4. [ ] Independently review the diagnostic change, verify CI, and dispatch inspection on the pinned branch using the same protected production environment.
5. [ ] Record the observed readiness/rollback evidence and remaining exact blockers. Prepare a separately reviewable manual release reactivation proposal only when its prerequisites are established; retain confirmation and environment protections.
6. [ ] Complete authenticated live shared-admin acceptance when a legitimate owner session is available. No fabricated login, grants, compliance or PASS.

Production reactivation and live owner acceptance are distinct from CODE COMPLETE / TEST VERIFIED / MERGED / DEPLOYED. The native Sites cutover/migration remains separate and unexecuted.

Read-only inspection review: three Important findings fixed RED→GREEN (case-insensitive D1 collisions/legacy IDs; exact health booleans and finite owner counts; complete validated rollback identifiers/timestamps). Unknown data fails closed and arbitrary upstream strings are not copied into artifacts. Seven behavioral tests and five publication-hold checks pass; the new script/tests lint and syntax checks pass. No deployment job or production policy has been enabled.

Boi release evidence: run 40854662673 PASS, release 3984beadf0c13df0ca0c9a9f4a2e65b01098c008, Worker e53729e4-ef98-427f-9e01-1916d4435e55. Universal Contract and two signed-identity smoke checks passed; no pending migrations.

Reference for the currently documented bookmark representation: https://developers.cloudflare.com/api/resources/d1/subresources/database/subresources/time_travel/methods/get_bookmark/ . Unknown formats block readiness instead of being copied into logs. A Time Travel bookmark is rollback metadata; it is not a completed private legacy-to-Cloudflare data export/reconciliation.

Final local validation of the inspection candidate: npm test (typecheck, verified build, 776 tests) PASS. Full suite includes the existing device administration regressions; separate offline-publication hold tests 5/5 PASS. No new lint errors in the inspection files. Exact-head GitHub CI and protected inspection remain next.

Protected inspection run 40856613428 stopped before creating a report (deploy-production skipped); no readiness PASS was produced. Add whitelisted configuration error codes to distinguish the missing/invalid prerequisite without leaking raw errors or values. Entry-point regression was observed RED→GREEN. Full npm test now passes 777 tests; publication hold remains intact. Environment secret names were read in GitHub UI only; presence does not prove usable values.

Second protected inspection run 40857687689 stopped at CLOUDFLARE_READ_ACCESS_NOT_CONFIGURED, before any authorization test or D1 read; deploy-production skipped. GitHub UI confirms the two Cloudflare secret names and canonical Production origin are declared, which does not validate their values. Added safe boolean presence/shape evidence (no credential values) to distinguish whitespace/format checks from missing credentials. New entry-point regression RED→GREEN; full npm test 778 PASS. Next: run the updated diagnostic on its exact CI-verified head. Do not claim provider authorization has failed until an actual provider request is made.

Third protected inspection run 40859097555 established the exact cause without exposing values: accountPresent=true, accountTagShapeValid=false, trimmedAccountTagShapeValid=true, apiTokenPresent=true, apiTokenLengthGatePasses=true, authorizationTestPerformed=false. The gate was rejecting surrounding whitespace in the existing Account ID; no credential replacement is justified by this evidence. Normalize only the consumed Account ID for validation, provider GET URLs and Wrangler child environment. This does not alter GitHub/Cloudflare secrets or access. Regression observed RED→GREEN; full npm test 779 PASS, added files lint clean. Next: verify exact-head CI and repeat protected inspection to obtain real provider/database evidence.
