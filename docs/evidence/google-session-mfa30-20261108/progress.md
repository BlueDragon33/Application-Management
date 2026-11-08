# Execution ledger — plan: docs/superpowers/plans/2026-11-08-google-session-mfa30.md

Baseline: merge4086fc69bf4ce04d492a6f0010b0e7e2a105fdb1, tree identical to Owner-approved d4e1b27. Existing linked worktree reused on feat/google-persistent-session-mfa30-20261108; original branches preserved. Dependencies cached and unchanged. Approved hotfix source suite855/855; fresh release-boundary37/37.

Pre-flight: Task1 produces the existing ProductionIdentity and current-session SQL used by Task2. No interface change is needed for step-up timestamps. Task2 must not extend confirmation when Task1 refreshes a cookie.

Ruling: execute directly under Owner's standing instruction to handle routine steps autonomously; prepare a separate reviewable auth package because exact approval covered PR378 only.

Ruling: use the already isolated worktree and a repository checkpoint ledger; cloud-packaged execution helper scripts are not mounted in this workspace. No additional worktree or dependency install.

Production hotfix: code54bd947c, metadata-only versionb2e8ebbc, revisiond4e1b27cb7ff78d9de74292a29ad0fcbc997eb48. Actual active-version editor readback at2026-11-08T07:38:15Z matched approved index LF SHA25646d56833e71a130d9733d399bb91ba8c21a2331d76dc9b569e05c6fcb9becb48. Google login remains enforced. Signed smoke/Vault cutover waits for Owner device confirmation; no authentication bypass.

Task1: Google persistence RED5/8 (expiry, cleanup, promotion, missing renewal); Worker integration RED1/1. Implemented and GREEN9/9; linked auth/SSO/security26/26.
Task2: MFA RED4/4 (16-minute rejection, future timestamp accepted, renewal/window and 15-minute message). Implemented strict1800-second window, nonnegative age and matching account messages; combined runtime GREEN13/13.

Ruling: keep a single source commit for the two changes in the shared authentication module, retaining separate red/green logs. Final full suite/lint and independent review remain pending. No follow-up Production deployment.

Full first run:866/868; failures were two stale source-shape/copy assertions (old15-minute label and direct unwrapped cache-return spelling). Lint:1 error from the test loader variable named module,25 existing warnings. Corrected expected30-minute label/name, retained the cache-call guard with actual Worker API no-store assertion, and renamed the test variable; production behavior was not changed to satisfy obsolete copy.

Independent review found document-style Accept could renew API/static cookies. New regressions RED2/2 reproduced it. Renewal now excludes API paths, requires an actual HTML response or eligible navigation redirect, and leaves the static asset branch untouched. Canonical asset redirects are covered; focused GREEN14/14.

Final validation: full npm test869/869, typecheck/build exit0; strengthened fixture assertions then complete Node sweep869/869. Final lint exit0,0 errors/25 existing warnings. Independent final review has no outstanding findings and reproduced the prepared artifact ab177a34/canonical2bd38a91. The actual compiled fetch body is in the virtual Worker-entry region; the initial wrong-region draft failed equivalence and was rejected without deployment. Final prepared candidate preserves all other Production bytes and client assets.

Source and evidence are ready for a separate Draft PR. Live Google/cookie/30-minute browser acceptance, human review and new exact-artifact Production approval remain pending. PR378 approval applies only to its already deployed artifact. Current postrelease authenticated smoke and Production Vault cutover are blocked by normal Owner Google login; expired device challenge was not retriggered or bypassed.
