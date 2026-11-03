# Russian Daily standalone · Application-Management enrollment candidate

Status: **SOURCE-ONLY / PENDING / NOT HOSTED / NOT DEPLOYED**.

- Child application id: `russian-daily`.
- Standalone source: `BlueDragon33/Bauman-Russian-iOS` / `web/russian-daily`, candidate dd9481042167f6fd7d60e3249f449439058580fa; tested functional/test source 1445b9e437799b1840d3b5a4723ea7dc68e960dd.
- Planned cloud host: **Vercel Hobby Preview**, ChatGPT Sites fallback, **not yet provisioned**. Read-only Vercel account plan confirmed active Hobby; exact remaining quota is not verified. No `publicUrl` until real HTTPS readback.
- Vercel source-ready commit: `a0d7e1ef53f96e0bc736f8d77ffc33748f5fabb6` with root `web/russian-daily`, output directory `public`, framework `Other`, build command `null`. Static test suite staged in `tests/source-contract.test.mjs`, not executed on a real runtime.
- Vercel Preview protection is required. Vercel's 2026-09-09 announcement says Vercel Authentication with All Deployments protection, including production, is free on all plans: https://vercel.com/changelog/protect-production-deployments-for-free-on-every-plan . Verify it in the actual account settings; provider protection does not waive human review or Production authority. Do not create production deployment or blindly import a default branch still missing the web app.
- Vercel connector is now authenticated and read-only verified on active Hobby. Russian Daily project/URL is absent; exact usage/quota and scoped Preview authority remain unverified.
- New Application-Management catalog/management route: `/apps/russian-daily` (source candidate only), while existing legacy `/tools/russian-daily` and `/russian-daily/` continue untouched until a reviewed transition.
- Do not infer SSO/control API from the catalog entry. `status=planned`, `contractState=pending`.
- User data cannot be transparently copied across origins. Require backup on the old app, confirmation and restore on the new Site, then verify Safari.
- After a genuine ChatGPT Site URL exists, change only this registry's `publicUrl` once in an independently reviewed source PR. Later Russian Daily app releases belong to its standalone host, not App-Management.
- For native iOS/WidgetKit: continue separate P0/B4/RU03 and device QA gates; web PWA does not satisfy them.
- No GitHub Actions, server, database, release, merge, approval, credential, or Site was created by this candidate.

## Current scope correction (2026-11-03)
- Latest standalone candidate SHA: ba9f38d967e47195e74ff5e776c656d81fbe81a6. The source/test behavior changed at 0e35819f1036e28386383038a596f56979fe382e to address localStorage partial-write rollback and JSON-restore failure. Scope remains learning-only, not project task orchestration.
- Active Next Action has been removed from both Russian Daily PWA and this app catalog candidate; project-task buttons belong to the ChatGPT Project conversation only.
- The route /apps/russian-daily remains authenticated metadata-only, and Vercel Hobby account is authenticated and active (read-only check 2026-11-03); quota/billing readback and scoped Preview authorization remain unverified.
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

## Latest independent source readback (2026-11-03, supersedes earlier status lines)

- GitHub candidate at `ba9f38d967e47195e74ff5e776c656d81fbe81a6`; functional JS/test source pin `0e35819f1036e28386383038a596f56979fe382e`.
- A local V8 **simulated DOM/localStorage harness**, using exact GitHub HTML and Node-style test source at the pinned SHA, completed **7/7 scenarios**: original three + four new JSON restore and settings rollback cases. This is **not Node execution on an actual checkout, real Safari/device QA or hosted Vercel readback**.
- Evidence: `Bauman-Russian-iOS/web/russian-daily/docs/SOURCE_RESTORE_REGRESSION_EVIDENCE_20261103.md` on the source candidate.
- No app-local Active Next Action controls were restored. They remain in the ChatGPT Project conversation only. The Application-Management catalog remains `planned/pending` with no fabricated `publicUrl`.
- Vercel: only the `software-blueprint-hub` project appears in the connected Hobby team's read-only project list. No Russian Daily project or authorized protected Preview was created; quota and issuer scope remain unverified.
- Reviewer, authorization for Preview, Safari device QA, merge, and Production remain `BLOCKED`. Candidate commits include `[skip ci]`; no GitHub-hosted Actions were manually dispatched.

## Latest read-only recovery and gate checkpoint (2026-11-03)

**Canonical Bauman candidate HEAD:** `dd9481042167f6fd7d60e3249f449439058580fa`; behavior/test exact QA SHA `1445b9e437799b1840d3b5a4723ea7dc68e960dd` and PWA HTML fix commit `b4d733e78ec16fc1ca2257c805e9048640750104`.

- On older source `ba9f38d`, deliberately malformed Safari storage `progress=null` or `events=[null]` reproduced startup exceptions in a **V8-simulated environment**.
- New learning-app safe mode retains raw corrupt localStorage values, shows an explicit blocked notice, prohibits ordinary overwrites, exports a diagnostic raw rescue JSON and allows only explicit validated restore to clear the block. It does not install ChatGPT Project Active Next Action in app UI.
- Exact-source **13/13 simulated DOM/localStorage** regression cases and **6/6 V8-adapted static source contracts** passed at the noted functional/test pins. Not an actual Node test process, on-device Safari, service-worker network acceptance, independent review or hosted QA.
- Supporting evidence: Bauman candidate `web/russian-daily/docs/SOURCE_RESTORE_REGRESSION_EVIDENCE_20261103.md`.
- Read-only Vercel `get_git_deployment_context` confirmed the connected team's `hobby` plan, and project listing still showed only `software-blueprint-hub`. Billing `list_billing_charges` from 2026-11-01 to 2026-11-04 returned `404 costs_not_found`, **not proof of zero spend or available quota**. No verified scoped Russian Daily Preview issuer grant, protected preview deployment, or independent reviewer approval.
- Registry remains `planned/pending`, no invented `publicUrl`, runtime SSO, iOS WidgetKit acceptance, merge or Production. Do not create a project or deploy until all required gates pass. If quota or Preview protection cannot be verified, keep `PROVIDER_AUTH_BLOCKED` and perform only standalone safe source QA.
