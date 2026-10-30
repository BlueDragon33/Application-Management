# Boi policy save repair

User reports duration/device-limit edits do not reach the source; screenshot shows the modal's old 30-day/25-device policy and a pending save. Base main 018c6e2f55dcb46a9e8c62924b0599e0fc488ff3 (deployed equivalent 7ae87ba).

Read-only production diagnostic run 40998978415, job 123878679766: owning Boi policy remains enabled, 30 days / 25 devices; updated_at and the latest sole access_automation_updated audit are 2026-10-02 02:41:25. No policy or learner record was changed by diagnosis. This does not identify the user's failed HTTP response or prove their session requires MFA.

Reproductions observed RED before fixes:

- A real Central route/reader/ledger transaction writes 90 days / 80 devices to the isolated SQLite-backed HTTP boundary, then falsely fails because independent readback unnecessarily requests the full inventory. Narrow policy GET remains healthy.
- The real dashboard Save handler returns old settings as a successful result on rejected writes or cancelled confirmation. The modal then discards the edited draft.
- An actual production Step-Up gate rejects a stale MFA-enabled session; its failure is only reported behind the modal, without the existing account verification action. No security gate is removed.

Bounded repair: read back Boi policy through its existing narrow automation GET; preserve draft on failed/cancelled Save; display the result and Authenticator recovery link in the sticky modal footer. A verified retry keeps the requested values. No dependency, service, schema, origin, secret, role, device grant/expiry/payment or production policy change.

Validation: actual Central route/SQLite ledger and real React modal regressions, including 90-day/80-device success, unavailable full inventory, cancellation, real Step-Up rejection and successful authenticated retry. Full regression, changed-file lint and exact-head CI required. Independent review before merge; use the existing pinned manual release, refresh rollback/readiness, and verify deployed revision and Central/Boi reads. Do not claim a real human Owner save was performed, silently choose a device limit, or call the user's exact production cause proven without their response/session evidence.

Local verification: full npm test PASS (typecheck, verified build, 791 tests). Targeted regression 10/10 PASS. Added scripts/tests and edited small TS files lint clean; dashboard lint diagnostic summaries/counts equal base (6 existing errors, 5 warnings; source-location excerpts shift with added lines). Diff whitespace check clean. No production policy values changed.
