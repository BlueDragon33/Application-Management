# Account-first consumer admission repair

Blueprint OS 1.3.0. Starting heads: BOIECH `fbf70057a232e3c1f6115311afc0385e80e6dbb6`; Central `3cf2f7d703d762f38dcfdcbbf9ac90acf3c39bf0`. Both were read back from GitHub and local worktrees were clean. Owning handoff remains authoritative. No rebase/merge, Actions, deployment or production access. Flag OFF; REVIEW BLOCKED, CI PENDING, global D1 10/10 BLOCKED.

Plan:
1. Classify the 14 prior failing source-pattern tests against the current manager-only boundary, Local/Online/Hybrid rules, draft semantics and independent GET receipt. Update stale contracts without restoring old authority/cache bypasses.
2. Recover the existing inline Authenticator implementation from pinned main `f347bd0ccd5e7f7e4e4bca4a31168e1219c18370` only where absent, preserving the candidate's stricter MFA freshness/configuration checks. Reuse it for account grants. Test actual session SQL/TOTP and UI interaction, including cancellation and no general network-error retry.
3. Fix owned-source lint errors through bounded client initialization, render-safe state and correct non-hook function names. Preserve cleanup, account fences and third-party vendor source.
4. Run full local Node/type/build/lint and focused integration, capture exact evidence, publish source with expected-SHA only and prepare reviewer. No product authority acceptance is inferred.

Initial diagnosis: the 14 failures are mostly stale regex expectations, not 14 reproduced runtime defects. Examples: tests still request BoiAccessView instead of the Owner-only manager panel, forced network from Local mode, mutation-response acceptance instead of independent GET, and exact old promise syntax. Inline MFA is genuinely absent in this candidate despite already existing on main; restore that code, not old authorization behavior. Exact browser/Safari/runtime-D1 acceptance remains a separate gate.

## Completed source-only result

All four plan stages are complete locally. The 14 prior failures were stale contract expectations; no authority bypass was reinstated. Actual runtime defects corrected include missing inline MFA, use of a pending factor for step-up, a font hydration/persistence ordering issue and an unresolved late authentication promise after navigation. Review corrections were reproduced red, fixed and verified green. The independent review follow-up found no additional actionable Critical/Important issue in the inspected changes.

`npm test`: typecheck + verified build + 832/832 Node, exit 0. A final full Node run after adding the actual production grant-gate test passed 833/833. Full lint: 0 errors / 38 warnings. The explicit two-repository fixture applied all 21 owning SQL migrations and used the actual signed bridge, verifier, account route, service, consumer contract and SQL with synthetic platform bindings, runtime identity responses and in-process HTTP. It proved approval reuse on another key/device, one shared quota slot, Owner/Publisher separation, CAS, independent read, per-target audit, redaction and immediate revoke. This is local SQLite evidence only.

Current evidence: `docs/evidence/account-first-consumer-repair-20261104/verification.json`. Previous evidence is retained as historical, not overwritten. Both candidate refs were re-read before source upload; their heads remained the starting heads above. No main synchronization occurred.

**One next action:** independent review of the exact source pair for the remaining authorized browser/runtime/snapshot/D1 acceptance gates. **Fallback:** keep the flag OFF and retain source candidates; no production access or authority bypass.
