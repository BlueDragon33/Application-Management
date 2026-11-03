# Russian Daily — Next Action end-to-end pilot (Blueprint OS 1.3.0)

**Status: SOURCE CANDIDATE / REVIEW BLOCKED. No production deployment or site URL.**

## Actual clickable button
App-Management route `/apps/russian-daily` mounts `next-action-controls.tsx`.
The button `KÍCH HOẠT NEXT ACTION — CHẠY LIÊN TỤC` invokes the authenticated
`runRussianDailyNextAction` server action. It **does not merely redirect** to
Vercel or generate a prompt. One click executes each available read-only
preflight check in sequence, renders a result receipt and stops at the first
external authority dependency.

## Scope of execution
1. Verify actual App-Management session (server-side on each invocation).
2. Verify current registry identity, repo and route.
3. Verify fail-closed local catalog status and absent public/preview URL.
4. Check ability to verify live private GitHub SHA: **BLOCKED** because this
   App-Management runtime has no authorized GitHub private-repo reader.
5–8. Vercel account/quota, Preview/device QA, independent reviewer and
Production are all **NOT_RUN** until exact external evidence/grants exist.

A BLOCKED result is not task completion. No timer/poll loop, no fake
server-side automation, no hidden background job and no caller-supplied
success flags. If future issuer/executor capability is added, it must
validate a signed scoped grant, durable idempotent journal and exact HEAD,
and run only authorized stages without repeated user prompts. The UI must
not claim continuous privileged execution before that integration exists.

## Why owner cannot see it yet
The App-Management `main` is unchanged. This button exists only in
`candidate/register-russian-daily-standalone-20261103`. Russian Daily
standalone web-app similarly exists only on its source candidate branch.
Deploying either requires separate review and release authority and an
actual Vercel/ChatGPT Sites hosting project.

## Acceptance (still not verified in runtime)
- Click **once**; server authenticates and performs all allowed checks without
  interstitial navigation, prompt copying or CMD.
- All 8 steps render with evidence/state; genuine stop on external grants.
- Re-click is safe, read-only and does not mutate GitHub, Vercel, Neon or app data.
- Signout, missing registry, changed URL/contract, errors fail closed.
- Responsive on iPhone/iPad, aria-live outcome; no fake PASS, no Production.
- Run source tests locally with explicit QA evidence, and separately run
  authenticated Next.js runtime browser tests before declaring UI PASS.

No GitHub-hosted Actions, paid services, auto-approval, merge or Production.
