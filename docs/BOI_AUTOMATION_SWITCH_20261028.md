# Bơi Ếch automation switch repair · 2026-10-28

Scope: prevent the management switch from presenting an unconfirmed policy as applied.

Native Site: appgprj_6a7d772bf04c8191bffb836da6518b59; baseline v58 / ab7f723d917fa55a5f3781b3d62237f67373375d.
Canonical Application-Management baseline: 93906a7fff0f3925139ab63dc01312e8d18caf17.

## Evidence and change

The deployed AutomationCenter called setEnabled before its asynchronous save and never restored that state on failure. dashboardAction also accepted an absent or mismatched automation response as success.

The switch now displays the server-confirmed policy, waits while saving, and prevents repeated writes. A dashboard-owned lock survives content-tab remounts. A write response must match enabled, duration and device limit before commit/success. Existing authentication, roles, payment checks and policy limits are retained; no dependencies or routes added.

Native adoption metadata is aligned to the canonical project's effective 1.3.0 declaration and seventh inherited pillar. This is adoption, not an overall compliance attestation.

## Verification

- Seven initial regression cases failed on the original behavior; a separate remount race case failed before the dashboard lock.
- All nine new behavioral cases pass against both native and canonical component sources.
- Native npm test: strict typecheck, production build and 422/422 tests passed.
- Browser QA used the real React component with synthetic save responses: pending kept pressed=false and disabled; failure kept off; confirmed readback changed it to on. This was not an authenticated production policy write.
- Independent review found no remaining critical/important issue after the remount fix.
- Canonical full CI and hosted release status must be checked separately.

## Incident boundary and next action

The Bơi Ếch Site database contains BE-C516-2612-6AAD-DBDF with registration submitted, pending/unassigned, no additional-account label. Its stored global auto_confirm_new_devices was 0. The native management Site points to that Site; its last policy audit also records disabled. The user's reported enabled UI was not directly observed.

The separate boi-ech.boiech-ai.workers.dev device-service interruption remains unresolved. The available Site error logs show canceled requests without an underlying exception; they do not establish that failure's cause.

No production policy or device approval was changed by this repair. Next: use an existing authenticated owner session to save the intended policy and verify readback at the correct origin. Pending registration re-evaluation and the workers.dev authentication failure require their own evidence; do not claim them fixed from this UI change.
