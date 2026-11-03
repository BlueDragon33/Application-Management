# Russian Daily standalone · Application-Management enrollment candidate

Status: **SOURCE-ONLY / PENDING / NOT HOSTED / NOT DEPLOYED**.

- Child application id: `russian-daily`.
- Standalone source: `BlueDragon33/Bauman-Russian-iOS` / `web/russian-daily`, candidate bdb5d50be3337a0094f3cf38566be2e59b0e8e61.
- Planned cloud host: **Vercel Hobby Preview**, ChatGPT Sites fallback, **not yet provisioned**. Free account quota/plan is not verified. No `publicUrl` until real HTTPS readback.
- Vercel source-ready commit: `a0d7e1ef53f96e0bc736f8d77ffc33748f5fabb6` with root `web/russian-daily`, output directory `public`, framework `Other`, build command `null`. Static test suite staged in `tests/source-contract.test.mjs`, not executed on a real runtime.
- Vercel Preview protection is required. Vercel's 2026-09-09 announcement says Vercel Authentication with All Deployments protection, including production, is free on all plans: https://vercel.com/changelog/protect-production-deployments-for-free-on-every-plan . Verify it in the actual account settings; provider protection does not waive human review or Production authority. Do not create production deployment or blindly import a default branch still missing the web app.
- Vercel plugin is available but not installed/connected; no account, project ID, deployment URL, usage or billing state was inspected.
- New Application-Management catalog/management route: `/apps/russian-daily` (source candidate only), while existing legacy `/tools/russian-daily` and `/russian-daily/` continue untouched until a reviewed transition.
- Do not infer SSO/control API from the catalog entry. `status=planned`, `contractState=pending`.
- User data cannot be transparently copied across origins. Require backup on the old app, confirmation and restore on the new Site, then verify Safari.
- After a genuine ChatGPT Site URL exists, change only this registry's `publicUrl` once in an independently reviewed source PR. Later Russian Daily app releases belong to its standalone host, not App-Management.
- For native iOS/WidgetKit: continue separate P0/B4/RU03 and device QA gates; web PWA does not satisfy them.
- No GitHub Actions, server, database, release, merge, approval, credential, or Site was created by this candidate.

## Current scope correction (2026-11-03)
- Latest corrected standalone source SHA: a88518d7d29e939e15b4363628572c80e9354d9a.
- Active Next Action has been removed from both Russian Daily PWA and this app catalog candidate; project-task buttons belong to the ChatGPT Project conversation only.
- The route /apps/russian-daily remains authenticated metadata-only, and Vercel Hobby still lacks verified account/Preview authorization.
- Original Next Action pilot and Active Next Action sections below are SUPERSEDED HISTORICAL EVIDENCE, not current product UI or deployment acceptance.

## SUPERSEDED HISTORICAL RECORD: Guided Next Action pilot (2026-11-03)
- App-Management route `/apps/russian-daily` now stages a client control with one primary Next Action and one toggleable `HƯỚNG DẪN`.
- The primary control uses a **server action** re-authenticating `requireChatGPTUser` on every invocation. It checks the metadata registration is still `pending` and returns only a safe, allowlisted `https://vercel.com/account` navigation. This is NOT a Vercel API check or a project-level PROJECT_READ grant.
- A contextual optional CMD QA section displays a source-test command and lets the operator paste local output; this evidence is **UNVERIFIED**, kept client-side and never forwarded as an approval.
- The guided-help contract remains a **Hub candidate**, not a ratified constitutional implementation. No automatic Work/Codex launch, privileged execution or human review impersonation.
- Candidate source pin: `ac15d64d1d9ba8f790de46d7889b4a24dd8dc9f6`; update only with verified readback when the web-app source moves.

## Active Next Action — bounded verification update (2026-11-03)

- Verified read-only candidate branch `candidate/register-russian-daily-standalone-20261103` initially at `7d15418a02da03310232c47671752de50d3c3099`; no GitHub-hosted Actions launched.
- Reviewed the actual `runRussianDailyActiveNextAction` server action and `next-action-controls.tsx`; the button makes **one authenticated server request** and returns all six admitted preflight stages in one terminal receipt. It does **not** deploy a site.
- Executed the action logic in a JavaScript V8 sandbox with stubbed authentication and application registry. **6/6 cases passed**: matching pending state; unexpectedly connected state; existing public URL; incorrect repo; missing registry; authentication rejection. This is *not* a deployed Next.js/Cloudflare runtime test.
- Added reusable Node VM runtime test source in `tests/russian-daily-active-action-runtime.test.mjs`, **not yet executed by Node**. No CI PASS is claimed.
- Exact Russian Daily source linked after functional tests: `1909ef964d4b518c8e8d9d319775f64744ab5b46`. Its source JS was executed through an in-memory DOM/localStorage harness: **17/17 simulated scenarios passed** at that exact SHA, including persistence failures, duplicate IDs, valid/invalid dates, Telegram confirmation, ICS and one-click execution. This is **not** Safari/iPhone acceptance.
- Vercel connector is available but `installed=false` and there is no authenticated Hobby quota/plan, Vercel project or scope-limited Preview grant. Thus Vercel Preview remains `NOT_DEPLOYED` and authority `BLOCKED_PROVIDER_AUTH`.
- Existing Bauman-Russian-iOS PR #1 is Draft, unmerged, and lists no requested reviewers. Neither source candidate has a separate PR. No independent review PASS, merge, Production or ratification.
- Keep management `status=planned`, `contractState=pending`, no `publicUrl`. The runtime and control plane remain independent.
