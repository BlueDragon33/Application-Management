# Blueprint OS 1.3.0 — Device timestamps: source-only QA handoff
Date: 2026-11-04. **SOURCE ONLY / QA NOT RAN / REVIEW BLOCKED.**

## Pinned source candidates
- Application-Management: `candidate/boi-manager-tier-20261102` SHA **bb8a5edf63c7d1089fe50eb1ee1bd3f4c23c78cd**
- BOIECH_AI: `candidate/manager-tier-device-approval-20261102` SHA **480519c7745b52d38cf82abfb146a32f54ce698e**
- Existing P0 manager grant remediation stays separate; no pilot already PASS is rerun.

## User-facing requirement
In `Kiểm duyệt thiết bị`, expose truthful **đăng ký** (real registration submission when present; else explicitly labeled registry creation), **online gần nhất** (real last source presence or explicitly labeled generic last recorded activity), and **offline từ (ước tính)** (derived only from a real expired source presence timeout). An offline duration counts time since derived offline threshold, **not** time spent online or the precise duration of a network session. Missing timestamps must not be fabricated. Keep the existing seven columns, maintain management actions and small-screen usability.

## Source changes and confirmed defect
1. BOIECH_AI previously calculated `offlineSinceAt` whenever `active` was false. A newly blocked device with a recent heartbeat could therefore show `last_seen_at + 150 seconds` **in the future**. It also used timezone-ambiguous `Date.parse` on SQLite's offsetless UTC timestamp.
2. BOIECH_AI `boi-ech/app/api/control/overview/route.ts`: parse UTC D1 timestamps with an explicit UTC suffix, define `presenceExpired` by timestamp **not in the future** and timeout actually elapsed; return `offlineSinceAt` only if heartbeat is expired. Pending/approved/blocked statuses and device-permission gates were not changed.
3. App-Manager `app/management-dashboard-v2-final.css`: keep seven desktop columns and scrollable intermediate tablet view, but for <=700px convert each device row to a compact 2-column card, make time/activity/user/actions span both columns, keep action buttons within card. Desktop source layout remains 1250px minimum; mobile explicitly overrides to `min-width: 0`.
4. Regression source assertions updated in BOIECH_AI `boi-ech/tests/manager-tier-shared-quota-preview-contract.test.mjs` and App-Manager `tests/device-table-presentation.test.mjs`. App still shows the original source registration and presence fields from Bơi Ếch and optional Universal Contract clients; no synthetic total online duration.

## Source-only verification
- GitHub exact-HEAD read and comparison: Bơi Ếch change restricted to `boi-ech/app/api/control/overview/route.ts` and its existing source test; App change restricted to `app/management-dashboard-v2-final.css` and its existing source test.
- Isolated V8 read-only **pattern audit**, not executing the repository test suites: App 26/26 regex expectations matched; BOIECH_AI 79/79 matched; 6 additional source checks matched; **111/111 static checks**. This is a limited source consistency signal, **not** 111 runtime test cases.
- App test file contains 17 Node test blocks; BOIECH source suite 13 blocks. **None was executed here.**
- Small-screen responsiveness proven **only from CSS selectors**, not screenshot, browser layout/overflow or touch interaction. No real remote device or account data was read.

## Exact QA still missing
- **Build / type:** locked-install, Node/toolchain version, `tsc --noEmit`, production-shaped build for both exact source SHAs; capture logs/exit codes and lockfile digests. NO RUN / NO PASS.
- **Node regression:** execute existing test files including timestamp tests under authorized isolated QA, capture complete test names, counts, duration and exits. NO RUN / NO PASS.
- **D1/presence runtime:** isolated, authorized Bơi Ếch D1 with registration, heartbeat (UTC SQLite), blocked recent heartbeat, future/invalid timestamp, expired presence, and independent GET after D1 reopen. Ensure no future offline estimate, no invented online time, reviewer-controlled source SHA. NOT COLLECTED.
- **UX viewport:** real browser checks at 375, 700, 768, 1024 and desktop width: cards, scroll where expected, no clipped action buttons, keyboard focus, readable three timestamps. NOT VERIFIED.
- **Universal Contract:** authorized end-to-end source delivery of the three optional timestamp fields and fail-closed behavior on old clients without the fields. NOT VERIFIED.
- **Independent reviewer:** check appointed reviewer identity, scope, exact head pins and recorded disposition before any external PASS. NOT VERIFIED.

## Gate status
**REVIEW_BLOCKED / CI_PENDING / global D1 10/10 BLOCKED**. No Actions, CMD, Work/Codex, automatic PR, merge, approve, ratify, publish, Production, or repeat of a completed pilot. No runtime QA, release gate or Owner approval was inferred.

## Exactly one NEXT ACTION and fallback
**NEXT ACTION:** Verify authorized independent QA and reviewer scope for the two pinned code SHAs; then execute Node/type/build and responsive browser/D1 tests in the approved isolated environment and attach signed SHA-pinned evidence for independent technical review, without release authorization.

**Fallback:** If QA authorization or an actual independent reviewer remains unavailable, preserve the two HEADs, keep REVIEW_BLOCKED/CI_PENDING/D1 10/10 BLOCKED, and retain this source evidence without claiming PASS.
