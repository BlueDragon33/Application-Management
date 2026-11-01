# Russian Daily · Application-Management · Candidate 0.3 (ZERO-SPEND)

Status: **CANDIDATE / USER TEST APPROVED / SAME-ORIGIN INTEGRATION PROPOSED / NOT DEPLOYED**. The user requested attachment to the existing ZERO-SPEND Application-Management host, not a new Worker, database or website. This is authorization to prepare and review the addition, NOT evidence of CI PASS, Production release or ratification. P0/RU03 remain BLOCKED.

## Source and routing

- iPhone-first local static utility: `public/russian-daily/index.html`, intended to be served at `/russian-daily/index.html` by the **existing** Application-Management Worker after an authorized release. No separate Cloudflare Worker, Pages project, D1 schema, OAuth app or hosting slug.
- App Management integration route: `/tools/russian-daily`, using existing `requireChatGPTUser` gate. The static UI holds no secrets; personal state stays on-device only.
- Candidate `worker/index.ts` stages same-origin HTML serving on **both** `cloudflare-preview` and `cloudflare-production`, strictly **after** the existing Preview session or Production identity checks. Related scoped manifest, icons and SW are not on the global unauthenticated allow-list. Production remains NOT DEPLOYED until its separate release gate passes. This is an optional stand-alone local-first tool, not a transfer of the Bauman Russian iOS learning-runtime ownership or canonical linguistic data into the control plane.
- Discoverability in the Dashboard system tools list (candidate only). Do not add as a connected Dynamic Catalog app without contract/credential/readback.
- No changes to existing production slug, sealed Constitution, repo identity, or authentication contract.

## Actual user capabilities

- Moscow local schedule, edit/add/delete, duplicate guard.
- Telegram text lines parsed into preview and confirmed manually. Image upload is **visual reference only**, NO automatic OCR; no server upload.
- ICS export with stable event UIDs, 60/15-minute per-lesson reminders, **one 21:00 reminder event per school day**. **By default the seven seed STANKIN events previously created on Google Calendar are excluded**, preventing inadvertent reimport. Users must explicitly opt in to export seeded lessons, and all imports still require checking for duplicates; ICS is not two-way sync.
- Russian-first sample vocabulary, 5 words/day default, browser speech synthesis if present, on-device storage and JSON backup.
- Single main `HƯỚNG DẪN / NEXT ACTION` button links to a concrete verification and ICS export workflow; it is a navigation aid, NOT a privileged command.
- Offline service worker scoped to `/russian-daily/` only, with network-first navigation and cache fallback. Requires HTTPS to register.
- Only new lesson export by default; date/time input from Telegram is validated; JSON restore rejects malformed records and duplicate IDs. The 5-tab mobile navigation uses non-overflowing flex widths.

## Explicitly not implemented

- Google OAuth/Calendar API, event-ID/ETag authoritative readback, real bidirectional sync, Apple EventKit, iOS WidgetKit, real push/haptics, OCR from Telegram screenshots, RU03-approved vocabulary dataset, iPhone physical-device QA.
- This branch contains no deployed website. Existing Preview/Live workflows remain dormant; no workflow was changed to bypass `if: ${{ false }}`. The existing authenticated Application-Management origin is the requested **future** target, but must be updated by its own authorized release procedure.
- OWNER USER TEST approval in chat on 2026-11-01 was acknowledged on Issue #372. The checklist was reconciled to unchecked status for unverified technical gates. Owner subsequently clarified that only the existing ZERO-SPEND Application-Management host should be used, with no new deployment resource.
- Local V8 mock interaction checks confirmed JavaScript syntax, seven seeded events, one persistent Next Action, opt-in-only ICS export, Telegram validation, newly added ICS only, five-word daily cap, and **Preview + Production login-before-HTML ordering**. The four candidate source tests passed under a V8 shim. **This is not `npm test`, hosted readback or Safari iPhone acceptance.**

## Tests and safe next step

1. Run the candidate regression through the existing GitHub PR CI. GitHub documentation states standard GitHub-hosted runners are free on public repositories; the repo is currently public. **No deployment workflow is enabled by this PR;** do not assume cost-free Cloudflare from GitHub pricing.
2. Review UI, runtime separation and authenticated Worker routes. Do not merge without passing required CI and authorized review.
3. Keep the mandatory offline-publication-hold invariant: `deploy-preview.if: ${{ false }}`. The PR does not change or bypass this hold. Existing production release still requires its specific approval/commit SHA and Cloudflare environment. Do not trigger deployments until eligible.
4. Do not create any Worker, Pages project, database, D1 migration, secret or other cloud resource. Confirm whether publishing the new static assets within the **existing** Worker stays inside the owner's ZERO-SPEND budget; no billing/account usage readback is currently available.
5. After an independently authorized merge and existing-host deployment, verify login boundary, live HTTPS path `/russian-daily/index.html`, manifest/SW, icon, offline cache, storage and Safari add-to-home-screen. Provide the actual URL only after a successful live readback.
6. Keep Bauman-Russian-iOS P0/RU03, native WidgetKit and Production release gates blocked until their own required PASS. This module's local-first tool review is not a substitute for any of them.

## Universal Next Action contract

Central candidate: `Software-Blueprint-Hub`, `feat/unified-project-next-action`, `control/unified-next-action.candidate.v1.json`, **not ratified**. Here we implement only its user-visible one-button + truthful guidance invariant; there is no trusted Work-host link, authenticated canonical project executor, or action-grant issuance.

## User guidance

Open Russian Daily → inspect lessons → correct lesson times/rooms → export `.ics` (7 STANKIN seed events excluded unless deliberately opted back in) → open in Apple Calendar. In iPhone Settings, enable the linked Google calendar if using Google sync separately. To install as a Home Screen app, the **existing Application-Management host** must first be updated by the authorized release and the resulting HTTPS URL read back successfully.
