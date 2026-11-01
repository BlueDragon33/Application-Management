# Russian Daily · Application-Management · Candidate 0.3 (ZERO-SPEND)

Status: **CANDIDATE / USER TEST SCOPE APPROVED BY USER / NOT DEPLOYED**. User approval permits local preparation and product feedback, **not** policy override. P0 review and RU03 remain BLOCKED. No authority elevation, ratification, merge, Production or Quality Gate PASS.

## Source and routing

- iPhone-first static app: `public/russian-daily/index.html` served at `/russian-daily/index.html` if and only if this candidate is deployed through a separately authorized preview process.
- App Management integration route: `/tools/russian-daily`, using existing `requireChatGPTUser` gate. The public static UI holds no secrets; personal state stays on-device only.
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
- This branch contains no deployed website. The existing Preview deploy workflow is dormant and must not be reactivated automatically.

## Tests and safe next step

1. Validate client JavaScript syntax, manifest, routes, static asset references, ICS shape and no hidden background calls, without GitHub Actions or paid services.
2. **Offline publication hold is an explicit policy blocker:** `tests/governance/offline-publication-hold.test.mjs` demands `deploy-preview` stays `if: ${{ false }}`. Do NOT remove this guard or dispatch the dormant workflow for this User Test scope. Seek a separate reviewed Preview-only policy exception or an independently authorized **existing** hosting path (no new Production site) before any online delivery.
3. Verify billing/account plan and projected usage. Cloudflare's advertised free allowances do not prove this account has zero billable usage; no authenticated billing/account readback is available here. Do not provision D1, secrets, deployment, Pages project or other cloud assets without explicit cost evidence and approval.
4. After separate authority and ZERO-SPEND checks, publish the exact candidate to an existing Preview target, validate HTTPS origin, responsive iPhone Safari navigation, service worker, storage persistence, SSO/isolation, 0 duplicate import by default and real version/readback; then invite owner feedback.
5. Keep Production and native WidgetKit blocked until their independent gates PASS.

## Universal Next Action contract

Central candidate: `Software-Blueprint-Hub`, `feat/unified-project-next-action`, `control/unified-next-action.candidate.v1.json`, **not ratified**. Here we implement only its user-visible one-button + truthful guidance invariant; there is no trusted Work-host link, authenticated canonical project executor, or action-grant issuance.

## User guidance

Open Russian Daily → inspect lessons → correct lesson times/rooms → export `.ics` (7 STANKIN seed events excluded unless deliberately opted back in) → open in Apple Calendar. In iPhone Settings, enable the linked Google calendar if using Google sync separately. To install as a Home Screen app, HTTPS Preview must first exist and be verified.
