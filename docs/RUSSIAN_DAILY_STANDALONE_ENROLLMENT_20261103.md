# Russian Daily standalone · Application-Management enrollment candidate

Status: **SOURCE-ONLY / PENDING / NOT HOSTED / NOT DEPLOYED**.

- Child application id: `russian-daily`.
- Standalone source: `BlueDragon33/Bauman-Russian-iOS` / `web/russian-daily`, candidate bdb5d50be3337a0094f3cf38566be2e59b0e8e61.
- Planned cloud host: **Vercel Hobby Preview**, ChatGPT Sites fallback, **not yet provisioned**. Free account quota/plan is not verified. No `publicUrl` until real HTTPS readback.
- Vercel source-ready commit: `a0d7e1ef53f96e0bc736f8d77ffc33748f5fabb6` with root `web/russian-daily`, output directory `public`, framework `Other`, build command `null`. Static test suite staged in `tests/source-contract.test.mjs`, not executed on a real runtime.
- Vercel Preview protection is required. Hobby Standard Protection can cover Preview but not the production domain. Do not create production deployment or blindly import a default branch still missing the web app.
- Vercel plugin is available but not installed/connected; no account, project ID, deployment URL, usage or billing state was inspected.
- New Application-Management catalog/management route: `/apps/russian-daily` (source candidate only), while existing legacy `/tools/russian-daily` and `/russian-daily/` continue untouched until a reviewed transition.
- Do not infer SSO/control API from the catalog entry. `status=planned`, `contractState=pending`.
- User data cannot be transparently copied across origins. Require backup on the old app, confirmation and restore on the new Site, then verify Safari.
- After a genuine ChatGPT Site URL exists, change only this registry's `publicUrl` once in an independently reviewed source PR. Later Russian Daily app releases belong to its standalone host, not App-Management.
- For native iOS/WidgetKit: continue separate P0/B4/RU03 and device QA gates; web PWA does not satisfy them.
- No GitHub Actions, server, database, release, merge, approval, credential, or Site was created by this candidate.

## Guided Next Action pilot (2026-11-03)
- App-Management route `/apps/russian-daily` now stages a client control with one primary Next Action and one toggleable `HƯỚNG DẪN`.
- The primary control uses a **server action** re-authenticating `requireChatGPTUser` on every invocation. It checks the metadata registration is still `pending` and returns only a safe, allowlisted `https://vercel.com/account` navigation. This is NOT a Vercel API check or a project-level PROJECT_READ grant.
- A contextual optional CMD QA section displays a source-test command and lets the operator paste local output; this evidence is **UNVERIFIED**, kept client-side and never forwarded as an approval.
- The guided-help contract remains a **Hub candidate**, not a ratified constitutional implementation. No automatic Work/Codex launch, privileged execution or human review impersonation.
- Candidate source pin: `b92a4d681d94e99434fc2f0c732da382fdae5dc1`; update only with verified readback when the web-app source moves.
