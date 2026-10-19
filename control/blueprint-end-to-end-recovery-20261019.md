# Blueprint OS 1.3.0 — Application-Management end-to-end recovery

Status: **CANDIDATE / NOT ACCEPTED**. Owner: Application-Management. Baseline: candidate/device-auth-settings-recovery-20261019. No automatic Production, GitHub-hosted Actions, merge, ratify, or approval.

## User-visible product goal

One clean App-Manager manages every enrolled application, offline-first. A user can review a device, complete actual 2FA and approve with independent source readback; can choose Local, Online or Hybrid in one popup; can edit automation, persist desired changes and confirm after reopening that each owning application really retained the effective values. Unavailable contracts are visibly blocked rather than silently reverting to constants.

## Failure ownership and corrective sequence

| ID | Existing failure or requirement | Technical owner | Required proof |
|---|---|---|---|
| P0-01 | Approval demands Authenticator but hides verification | Production auth / dashboard | 2FA step-up entry reachable from device approval; authenticated retry; owner check; source device status transitions pending→approved; no bypass |
| P0-02 | Approval-disabled switch claims direct entry but server still gates | Operating mode / security | Single popup Local, Online, Hybrid; explicit backend origin; local only in authorized standalone; cloud never bypasses MFA; source status honest |
| P0-03 | New auto-policy values revert after Save / reinstall | Owning client contracts and App-Manager | capture desired→stage→authenticate→write client→durable persistence→independent readback→reload; exact field and app; no magic defaults |
| P0-04 | Mixed outcomes lose unsaved edits | Automation dialog and ledger | Per-app touched intents survive failed/cancelled/partial writes and reopen; local pending receipt is not applied |
| P0-05 | Non-live client freezes all controls | Automation dialog | Offline edit and browser-persisted pending intent allowed; remote Apply remains disabled until capability, role and readback are verified |
| P0-06 | Old fake Live/Online indicators | Connection state | Last-known, unavailable, source-reported recent and actually verified states visibly different; never infer global online from active=true |
| P1-01 | Device queue lacks time and identifiable user columns | Devices UI / source contract | createdAt and lastSeenAt honest display; repeated user labels flagged; no fabricated user ID; readable mobile layout |
| P1-02 | Activity column not useful | Devices UI / contract | distinguish recent/stale/missing/cached signals; source-proven timestamp; never claim online presence from a single local snapshot |
| P1-03 | One app launch/contract model across all apps | Registry + per-app adapters | open app content directly where authorized, contract metadata accurate and no code changes needed for compliant new registrations |
| P1-04 | Save UI slow, double-click lag, duplicated actions | Client + endpoint | synchronous click lock, idempotent command ID, bounded timeout, clear in-progress and retry states |
| P1-05 | Excessive clutter, low contrast, blinking on other modules | Cross-module UI | focus/accessibility, stable layout, contrast evidence and screenshot-based acceptance on key widths |
| P2-01 | Vite RSC startup failure during QA | Local QA runner | independent exact-SHA disposable workspace; full error log before changing dependency; safely verified child PID/port cleanup |
| P2-02 | Shared local/online data and admin | Architecture | one UI, separate source/mutation rights; Hybrid safe read-only fallback; explicit opt-in sync with version and conflicts; never silently sync D1 |
| P2-03 | Global D1 quiescence, restart, Wrangler CLI | Application-Management local-ops owner | maintain 10/10 BLOCKED and 0 READY until authoritative CLI runtime evidence exists; API stop cannot be recast as CLI ACK |
| P2-04 | Future product refinements | UX + QA | onboarding status, diagnostic error codes, safe recovery, source timestamps, alert deduplication and permanent smoke automation |

## Non-negotiable live policy acceptance

For each target application and each changed policy field:
1. Declare owning endpoint, feature capability, persistent storage key, schema version, actor role, and safe mutation boundary.
2. Before write: compare expected revision/status and authenticate caller, including real Production 2FA when required.
3. Record the desired intent with unique command ID. Never equate a staging ledger entry or browser localStorage draft with the application applied state.
4. Write to **owning** client, never edit a constant copy or an App-Manager cache.
5. Read through an **independent** client GET after the write, checking exact values and revision. Reload/restart test in an isolated QA runtime; prove persisted storage survives it.
6. On failure report target ID + field + reason. Keep the pending edit and prevent fake success or destructive retry. Read-only unsupported apps remain BLOCKED.
7. Verify cross-app regression on one specialized adapter (Bauman/PriceReport) and a generic contract adapter before broadening.

## Quality-evidence gates

- Existing historical Windows checks (previous SHAs) are **not** evidence that latest candidate passed. Do not rerun a test already PASS on unchanged source or SHA.
- Typecheck, focused logic regression and security regression must run at exact candidate SHA before any UI claim.
- Real Chromium interaction at exact SHA including modal, actual 2FA screen, readback, reload, tab persistence, 390/768/1440 viewports and Chrome console/network failures.
- Separate browser local draft PASS, device-side persistence PASS, Production authentication PASS and global D1 quiescence PASS; never collapse these states into a generic green badge.
- No Actions triggered just to manufacture CI. Retain mandatory CI=PENDING until approved runner evidence at exact SHA is available.
- No privilege escalation, no kill of existing runtime, no deployment, no merge or publish without explicit authorized gates.

## Handoff/UI action contract

Every implementation checkpoint must expose:
- One primary **Triển khai từ đầu tới cuối** control to continue the entire P0→P1→P2 sequence on the current candidate, stopping at genuine blockers with accurate receipts.
- One **Hướng dẫn / Next Action** control for the **same next task**, giving the minimal safe operator action when physical Windows/browser access is indispensable.
- Plain-text fallback if interactive controls cannot be rendered.
- Exact SHA, completed proofs, blocked causes, changed paths and **one next task**, not a scattering of unrelated next steps.

## Current boundary

This file is a delivery contract, not acceptance evidence. Browser-local pending-automation intent exists in candidate; actual owning-client persistence remains unverified. Production 2FA success and Chromium QA remain unverified. Application-Management PR #360, Bauman #366 and PriceReport #133 are Draft; no merge/publish. The D1 local-ops adapters remain 10/10 BLOCKED, 0 READY.

**Immediate next task:** Resolve latest-candidate automation intent partial-write invariants and existing regression contradictions; verify in isolated exact-SHA source QA, then implement the first owning-client persisted readback pilot without touching live devices.
