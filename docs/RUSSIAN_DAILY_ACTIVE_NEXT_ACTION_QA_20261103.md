> **SUPERSEDED / MIS-SCOPED FEATURE — HISTORICAL ONLY.** The owner clarified that Active Next Action belongs in the ChatGPT Project conversation, not Application-Management or Russian Daily runtime. The button and server action described below have been removed on the source candidate. Do not count these tests as current app acceptance. See RUSSIAN_DAILY_ACTIVE_NEXT_ACTION_SCOPE_CORRECTION_20261103.md. 

# Russian Daily Active Next Action — source-only QA evidence · 2026-11-03

**Status: REVIEW_BLOCKED / SOURCE-ONLY / VERCEL_PREVIEW_NOT_DEPLOYED / PRODUCTION_BLOCKED**

- Russian Daily source candidate: `BlueDragon33/Bauman-Russian-iOS`, SHA `1909ef964d4b518c8e8d9d319775f64744ab5b46`.
- App-Management candidate before this update: `7d15418a02da03310232c47671752de50d3c3099`. Actual final management SHA is the resulting commit containing this document.
- Source JavaScript directly loaded from the GitHub connector and executed in V8 with DOM, fixed Moscow clock, simulated localStorage, user confirmation, service stubs and download capture. **17 of 17** scenario assertions passed on exact tested web SHA: single-run 5-stage workflow, read-only pass, five-word personal study gate, missing lesson input, invalid stored hours, personal-only ICS export, Telegram pending + confirmed, storage failure/retry for Telegram/manual events/progress/delete, impossible date and clock input, valid date, duplicate ID/slot, malformed stored JSON fallback. This is mock runtime functional QA, not Safari/device QA or verified browser download.
- App-Management server-action core (TypeScript annotations/imports removed in memory, not repository source altered) executed in V8 with stubbed `requireChatGPTUser` and `getApplicationConfig`. **6 of 6** authority/registry branches correctly returned the safe terminal status or rejected authentication. Not a live server action/Cloudflare QA.
- `tests/russian-daily-active-action-runtime.test.mjs` added for repeatable local Node VM contract QA. It has **not** been run with Node; do not label Node or CI PASS.
- No authenticated Vercel connector (available, not installed); Hobby/quota/billing/project/Preview protection and provider readback not verified. No Vercel Preview was created.
- No GitHub-hosted Actions, merge, PR creation (may trigger CI), production deployment, self-approval, RU03 grant, published URL or signature created.

**Single Guided Next Action:** establish a connected and verified Vercel Hobby account and scoped Preview grant for `BlueDragon33/Bauman-Russian-iOS` at exact reviewed SHA, then use the authorized executor to run protected Preview and Safari readback. Until then maintain `BLOCKED_PROVIDER_AUTH` and `REVIEW_BLOCKED` and leave both candidates intact.
