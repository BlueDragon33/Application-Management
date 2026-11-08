# App-Management Production hotfix — 08/11/2026

PR378 has been merged and the approved hotfix is deployed to the existing [Production](https://application-management.boiech-ai.workers.dev), keeping its URL, assets, bindings and Free plan. This release does not include the later Google-session/MFA30 request or Account-first V2.

| Evidence | Result |
|---|---|
| Owner-reviewed/approved PR head | `d4e1b27cb7ff78d9de74292a29ad0fcbc997eb48`, explicit human-review/release attestation supplied in Chat |
| Merge | `4086fc69bf4ce04d492a6f0010b0e7e2a105fdb1`; tree identical to approved head |
| Code version | `54bd947c`, deployed 08/11 at10:26 Moscow |
| Current version after revision metadata | `b2e8ebbc`, Ready |
| Build revision variable readback | `d4e1b27cb7ff78d9de74292a29ad0fcbc997eb48` |
| Actual active-version index readback | SHA256 LF `46d56833e71a130d9733d399bb91ba8c21a2331d76dc9b569e05c6fcb9becb48`, exactly approved, at `2026-11-08T07:38:15Z` |
| Validation | Existing full855/855, focused22/22; fresh release-boundary37/37; independent source/artifact/evidence review |
| Rollback baseline | Existing Worker version268c3b94 and sourceb2e36758d8dab5c953e71b3aa1f36490b55d770f |

The protected Production page still uses normal Google sign-in. Owner device confirmation was not completed, so authenticated `/__deployment`, Production Vault cutover and signed business smoke remain BLOCKED_OWNER_LOGIN. This is not reported PASS. No session was forged or injected into Production. The screenshot in `docs/evidence/app-management-hotfix-production-20261108/` shows the actual Ready versions.

Both replacement tokens remain verified in encrypted **Preview** Vault, expiry `2026-12-07T20:59:59Z` (07/12/2026 23:59:59 Moscow). Production replacement Vault slots are not yet saved. Old tokens are not revoked; manager/publish credential is unchanged. No schema migration, role/permission change, new Worker/site, paid plan/service, Vercel use or hosted workflow dispatch occurred.

The new authentication policy is a separate source/release package: Google server session persists until logout/revocation, with a rolling browser cookie; important changes reuse current-session Authenticator confirmation for30 minutes. Its local869/869 QA does not constitute live Google acceptance or release approval. Account-first V2 and training/certification remain outside this hotfix.
