# Russian Daily · Application-Management · Candidate 0.3 (ZERO-SPEND)

Status: **CANDIDATE / USER TEST / NOT DEPLOYED**. P0 review and RU03 remain BLOCKED. No authority elevation, ratification, merge, Production or Quality Gate PASS.

## Source and routing

- iPhone-first static app: `public/russian-daily/index.html` served at `/russian-daily/index.html` if and only if this candidate is deployed through a separately authorized preview process.
- App Management integration route: `/tools/russian-daily`, using existing `requireChatGPTUser` gate. The public static UI holds no secrets; personal state stays on-device only.
- Discoverability in the Dashboard system tools list (candidate only). Do not add as a connected Dynamic Catalog app without contract/credential/readback.
- No changes to existing production slug, sealed Constitution, repo identity, or authentication contract.

## Actual user capabilities

- Moscow local schedule, edit/add/delete, duplicate guard.
- Telegram text lines parsed into preview and confirmed manually. Image upload is **visual reference only**, NO automatic OCR; no server upload.
- ICS export with stable event UIDs, 60/15-minute per-lesson reminders, **one 21:00 reminder event per school day**; importing ICS is not 2-way sync and may duplicate previously imported Calendar events.
- Russian-first sample vocabulary, 5 words/day default, browser speech synthesis if present, on-device storage and JSON backup.
- Single main `HƯỚNG DẪN / NEXT ACTION` button links to a concrete verification and ICS export workflow; it is a navigation aid, NOT a privileged command.
- Offline service worker scoped to `/russian-daily/` only. Requires HTTPS to register.

## Explicitly not implemented

- Google OAuth/Calendar API, event-ID/ETag authoritative readback, real bidirectional sync, Apple EventKit, iOS WidgetKit, real push/haptics, OCR from Telegram screenshots, RU03-approved vocabulary dataset, iPhone physical-device QA.
- This branch contains no deployed website. The existing Preview deploy workflow is dormant and must not be reactivated automatically.

## Tests and safe next step

1. Validate client JavaScript syntax, manifest, routes, static asset references, ICS shape and no hidden background calls, without GitHub Actions or paid services.
2. Obtain independent reviewer-controlled preview deployment authorization and environment with zero-spend evidence; only then run a bounded **preview-only** deployment and Safari QA.
3. Keep Production and native WidgetKit blocked until their independent gates PASS.

## Universal Next Action contract

Central candidate: `Software-Blueprint-Hub`, `feat/unified-project-next-action`, `control/unified-next-action.candidate.v1.json`, **not ratified**. Here we implement only its user-visible one-button + truthful guidance invariant; there is no trusted Work-host link, authenticated canonical project executor, or action-grant issuance.

## User guidance

Open Russian Daily → inspect lessons → correct lesson times/rooms → export `.ics` **only if not previously imported into Calendar** → open in Apple Calendar. In iPhone Settings, enable the linked Google calendar if using Google sync separately. To install as a Home Screen app, HTTPS Preview must first exist and be verified.
