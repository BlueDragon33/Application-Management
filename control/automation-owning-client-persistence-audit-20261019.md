# P0 Owning-client automation persistence audit — 2026-10-19

Blueprint OS 1.3.0. Status: SOURCE INSPECTED / WINDOWS LIVE ACCEPTANCE BLOCKED. This file is not a release certificate.

## Source ownership (independently inspected repository source)

| Client | Draft PR source inspected | Database source of truth | Supported fields | Readback and concurrency |
|---|---|---|---|---|
| Bauman-master-ai-system | #366 HEAD `a67e049440900e00672e55a17b0baf133b79d7b6` | `control-service/src/automation-contract.ts`, D1 `bm_automation_policy` | `autoApproveDevices` only | `readAutomation` SELECT; revision conditional update, commandId+nonce, replay protection and D1 readback |
| PriceReport_Tunggiabao | #133 HEAD `d6e910e6c0c7b0cdb1a395381f2be0d65eb7ca3d` | `control-service/src/automation-store.ts`, D1 `kt_automation_policy` | `autoApproveDevices`, `autoBlockPendingDevices`, `pendingBlockAfterHours` | `readPriceReportAutomationPolicy` SELECT; revision conditional update, commandId+nonce, replay protection and D1 readback |
| Application-Management | candidate/device-auth-settings-recovery-20261019 | `app/automation-policy-changes.server.ts` central *intent ledger only*; browser `app/device-automation-draft.mjs` pending UI values only | Orchestrates only fields supported by owning client contract | After mutations, *new authenticated* `connectOperationsDashboard` fetch; requires live policy and per-field equality; fails closed on missing independent GET |

## Diagnostic outcome

A blanket App-Manager-side default/constant override is not an acceptable persistence mechanism. Both first clients already include client-owned D1 writes and readbacks in source, but that is **not** evidence that their deployed / local Worker's endpoint, credentials, migrations and storage are working.

App-Manager had two source-level defects:
1. Treated the mutation-response merged settings as if they independently proved persistence; now independent authenticated GET is required before returning an applied receipt.
2. In draft reconciliation, an unsupported field set to `false` could leave a supported app's otherwise verified write indefinitely pending. A requested unsupported `true` must stay pending. Boi free-access limits now compare to actual current form values even if the user had not explicitly saved the local draft.

A third failure path was concurrent multi-app POST rejection with `STEP_UP_REQUIRED`: the `Promise.allSettled` wrapper previously hid the dedicated 2FA action; the UI now records the step-up requirement explicitly and continues to withhold applied status.

## Minimum live acceptance matrix — not yet passed

Per target, on **disposable D1** only:
1. Check exact Worker SHA, origin and existing migration; permission scope and real role; do not use Production data as fixture.
2. GET pre-state from target; record revision, affected field and storage key.
3. Issue approved, revision-bound commandId write; test duplicate and stale expected revision.
4. Read GET separately from target. Compare exact field and revision, with no fallback or local browser draft substituted.
5. Close and reopen the *same disposable* Worker/storage; GET again; prove value retained and no constant overwrote it.
6. Simulate absent contract, malformed value, denied authentication, bad 2FA, timeout, partial multi-target failure and pending retry. Never claim PASS when a client responds LAST_KNOWN/UNAVAILABLE.
7. Update App-Manager UI only after actual independent GET and owner approval. Test keyboard/focus/readback then browser reload.

No merge, ratify, publish, auto-restart, privilege escalation, GitHub-hosted Actions or modification of live devices. PR #360/#366/#133 remain Draft; CI=PENDING; 10/10 local-ops D1 adapters BLOCKED, 0 READY.

## Handoff

**Single next task:** Audit/correct exact-source regression conflicts for the new independent-GET and per-field pending semantics; obtain one Windows source/typecheck QA receipt at the new SHA, then isolated Bauman/PriceReport D1 restart-readback pilot. No repeat of unrelated prior PASS.

## PriceReport disposable D1 source-pilot checkpoint

A separate, unmerged PriceReport branch `candidate/automation-persisted-readback-pilot-20261019` now extends `control-service/scripts/real-worker-wrangler-gate-smoke.mjs` to submit a real owner-role `set-device-automation` command against a temporary D1 database, compare all 3 fields and revision via a separate authenticated GET, then query D1 through a separate subprocess after the disposable Worker child exits. `control-service/tests/automation-persisted-readback-qa.test.mjs` guards these steps and preserves disposable storage if the Worker process exit is unverified.

**Current proof:** JavaScript parse plus 7/7 source assertion cases in V8, not Windows, not runtime/physical device acceptance. This branch has not modified PriceReport PR #133 or Production. CLI SIGTERM used solely for disposable QA teardown is not a graceful ACK and does not advance global D1 quiescence.

Bauman already has source Worker + disposable D1 policy write/independent readback QA for autoApprove. Neither owner's production policy may be certified from these source checks alone.
