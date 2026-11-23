# App Builder PRO — real prompt composer + review pilot (2026-11-23)

Scoped candidate: Application-Management branch \`candidate/app-builder-support-shared-shell-20261123\`; based on Draft PR #419 source \`2136c51081173213b1bd38318d5f312a3a40aaca\`. The canonical ledger remains PR #414. Do not merge, publish or ratify.

## Corrected user request
Click **🛠 Hỗ trợ lập trình PRO** in the authenticated Bauman or PriceReport Owner shared shell. This immediately generates a *real, populated* next-work prompt from the app's read-only control-plane UI readiness and active tab. The user can edit the suggested work item and add 2,000 characters of personal requirements, review the full generated prompt, and an **Owner** can approve it for copying/exporting. Re-edits, regeneration or changes in the originating UI snapshot revoke the local approved state. Copy and Markdown export are available only while the Owner's approved prompt remains fresh. A manual ChatGPT link opens only after copy-only approval and never transmits text or private data automatically.

## Authority & privacy
- The generated text is a **derived candidate**, not the canonical Hub P6-007 PromptProjectionSnapshot or automatically acquired WorkPackage. It visibly requires a live Constitution/HEAD/ledger check before code changes. No false SHA or reviewer evidence.
- Reviewer and publisher can draft but not approve; viewer sees read-only proposal; pending and blocked admin devices do not enter the parent workspaces at all. This is a UI gate, not a server authority grant. Owner approval for *copy-only* never authorizes protected mutations.
- Source notes are non-secret readiness labels. No customer records, device codes, tokens, third-party data, server AI execution, shadow database or new dashboard. Common prompt generation rejects overt secrets and unrecognized app IDs. No direct ChatGPT API or prompt transmission.
- Shared shell component remains opt-in to two pilot clients; other managed apps unaffected until exact-source TS/build/regression plus real authenticated browser/role/accessibility validation.
- UI: dialog drawer, focus-on-open, Escape/return-focus, Tab trap, disabled buttons, explicit DRAFT/STALE/APPROVED_FOR_COPY_ONLY. Manual clipboard fallback and Markdown download.

## QA & blockers
The pure .mjs prompt builder runs in Node with tests under \`tests/client-developer-prompt.test.mjs\`. Existing shell regression under \`tests/client-developer-support.test.mjs\` updated, not skipped. Required to complete: exact-head full Next/React typecheck/build, 1440/800/390 screenshots, owner/reviewer/publisher/viewer/pending/blocked authenticated browser paths, clipboard denied behavior, prompt regeneration after source drift and protected-backend no mutation. Until then: SOURCE_CANDIDATE, BROWSER_QA_NOT_RUN, NOT_APPROVED.


## Executed focused QA (exact source, 2026-11-23)
- Core module Git blob \`app/components/client-developer-prompt.mjs\` = \`6cc17ceb5d806ee6b167acb436f30df2d8418052\`. Local \`git hash-object\` matched that GitHub blob **exactly**, syntax \`node --check\` PASS.
- Actual Node **v22.16.0** execution of 3 targeted tests against that identical code: **3 PASS / 0 FAIL / 0 SKIP**. Cases: distinct per-client populated next prompt + personal requirements + Constitution guardrails; different Bauman/PriceReport prompt and source fingerprint; reject invalid role/app/connection, overlong text, blank task and overt secret patterns.
- V8 evaluation of exact-HEAD GitHub source + scoped structural probes: **26 PASS / 0 FAIL**, including owner-only approval, edit invalidation, stale fingerprint guard, source-only gating, upstream approved-device gate, no privileged backend writes.
- Exact candidate source SHA at this checkpoint \`06be48050bb1696c3c84094a16c8bb080fe07f94\`.
- **NOT_RUN:** full Node repo tests, TypeScript/Next build, authenticated React behavior at 1440/800/390, clipboard permission negative path, real browser focus/voiceover, role matrix (Owner/reviewer/publisher/viewer/pending/blocked). These must PASS before adding this candidate to Draft PR #419 or distributing to any other client.
- Production/main/PR #419 unchanged. No GitHub Actions, merge, review approval, publish or ratify.


## QA acceptance protocol — B4 / STRUCTURED / R7–R9, R14, R17, R20

**Protocol revision:** 2026-11-23; candidate code SHA observed before documentation-only update:
\`cfb9da448c576bf1eae54504afffab9bb3b0ac9f\`.
No canonical WorkPackage or new authority source is created here. This is a **candidate QA execution specification**. Never treat a new documentation commit as a fresh build/UX PASS.

### Gate 0 — authority/source freeze (mandatory, fail closed)
- Read Hub LIVE Constitution \`control/universal-constitution-version.json\`, normative document and Application-Management \`.blueprint/constitution-adoption.json\`: currently 1.3.0 ACTIVE, B4 enforced, ZERO-SPEND.
- Read GitHub LIVE: candidate SHA, Draft PR #419 HEAD, Draft PR #414 canonical ledger and main HEAD **before each candidate mutation**. Record exact tree and per-file blob SHA.
- Confirm no stale or mismatched branch; no reviewer self-assignment, no PR merge, no Production, no GitHub-hosted Actions, no new website/backend/device approval.
- Read current single canonical ledger on PR #414; existing R0.2 measurements and G05 status are not App Builder PRO QA evidence and must not be overwritten.

### Gate 1 — immutable test fixture + local environment
- Authorized exact candidate **full checkout** on the same QA machine as the browser and isolated local runtime, Node >=22.13, locked dependencies, TypeScript, Next/Vite, local-only D1 fixtures.
- Run owned HTTP loopback preflight first, require Chromium \`page.goto\` HTTP 200, record browser version, PID, port, clock and cleanup. Only use synthetic device roles and metadata; never use Production credentials or real customer data.
- If the exact source checkout or browser navigation is unavailable, stop browser/build work and classify **BLOCKED_RUNTIME**, rather than using a Production tab or proxy screenshot.
- Browser acceptance must be on a server whose exact running build SHA matches Git HEAD, not a separate source-only read or an older preview.

### Gate 2 — source, typecheck, regression
- \`node --check app/components/client-developer-prompt.mjs\`; \`node --test tests/client-developer-prompt.test.mjs tests/client-developer-support.test.mjs tests/client-admin-shell-pilot.test.mjs\`.
- \`npm run typecheck\`, \`npm run build\` and **full** \`node --test tests/*.test.mjs\` with strict TAP exit/summary and no silent skipped/failed cases.
- Verify "bauman-master-ai" and "price-report-tunggiabao" only, type declarations, CSS module selectors, no unauthorized \`fetch\`, device-control or deployment path in the prompt component. Existing client commands must stay unaffected.
- On a failure, capture file/line/log, root-cause hypothesis, smallest owner-only patch, rerun focused + directly affected regressions. Never mutate source based on a guessed UI condition.

### Gate 3 — authenticated role matrix
| Device session | Role | Prompt proposal | Modify/add custom requirement | Approve for copy | Copy/export | Protected mutations |
|---|---|---|---|---|---|---|
| Approved | Owner | Present | Yes | Yes, only after review and fresh source | Only after approval | Existing backend only; approval of prompt grants none |
| Approved | Reviewer | Present | Yes | **Denied** | **Denied** | No new rights |
| Approved | Publisher | Present | Yes | **Denied** | **Denied** | No new rights |
| Approved | Viewer | Present, read-only | **Denied** | **Denied** | **Denied** | No new rights |
| Pending | Any | **Not mounted / access gate** | Denied | Denied | Denied | Denied |
| Blocked | Any | **Not mounted / access gate** | Denied | Denied | Denied | Denied |

Perform separate real authorized/synthetic browser cases for **both Bauman and PriceReport**. Screen visibility is not proof of backend authority; assert forbidden network mutations, and check session revoke/role change.

### Gate 4 — critical user journeys (both clients)
1. Open "Hỗ trợ lập trình PRO": one concrete readiness-derived task, correct app and view, explicit UNVERIFIED HEAD/WorkPackage. No generic label-only prompt.
2. Revise proposed task and add custom requirements; live preview reflects both; no source/secret/user data uploaded.
3. Owner reviews then approves: \`APPROVED_FOR_COPY_ONLY\`; clipboard copy and Markdown download contain the exact preview and omit sensitive material.
4. Any content edit, regenerate, role change or source-snapshot change revokes approved copy; stale source displays \`STALE\`; new generation must precede new approval.
5. Reviewer/publisher/viewer/pending/blocked negatives above; denied clipboard permission has manual selection fallback without invented success.
6. Escape and backdrop close, return focus to trigger, Tab/Shift-Tab stay inside drawer, all labels and status changes announced correctly.
7. Verify browser reload, navigation, new app/role and multiple tabs do not preserve a stale copy-only approval or leak task data.
8. No service-worker/cache inference of current live approval. No automatic ChatGPT submission; external link is voluntary only.

### Gate 5 — responsive/performance/security evidence
- Viewports **1440×900, 800×900, 390×844**, desktop/tablet/mobile, keyboard, touch and dark-mode if supported. Capture real screenshots at initial, expanded, edited, approved, stale and denied states.
- Check dialog never clips behind scrollable sidebar; computed final text/background contrast WCAG 2.2 AA, focus visibility, hit targets, no horizontal overflow/overlap, screen-reader labels.
- Instrument click→visible prompt, input→preview and approval→copy states, request count and console errors. Targets must be defined against baseline, not fabricated.
- Inspect network: prompt creation/edit/review has no secret/device/customer data transmitted, no backend mutation, no new Production or billing workflow.
- Negative tests: missing/invalid content, changing role mid-flow, revoked device, clipboard denial, cancelled download, stale source, unauthorized cross-client route.

### Gate 6 — acceptance and rollout
- Record exact tested HEAD, tree/blob hashes, browser and Node versions, focused + full TAP output, typecheck/build, screenshots/computed states, real role and negative evidence, defect list, rollback plan and independent QA review.
- Gate PASS **only** with source, full regression, React/browser, role/security, responsive/accessibility evidence on the *same code revision*. Any omitted mandatory case is NOT_RUN/BLOCKED, not PASS.
- Do not add this branch to Draft PR #419, distribute to another client or merge until the authorized reviewer and Owner acceptance are separate and recorded; Production release additionally requires its own authority.
- Once accepted, pilot dependencies to Health/RU_LIFE then PC/CAD/NC03 then GrowUP/Blueprint one compatible client boundary at a time, without inventing new websites or control planes.

### Actual evidence on this protocol (2026-11-23)
- **PASS:** current live Hub policy version and Application-Management adoption readback; candidate source SHA frozen; exact module Git blob \`6cc17ceb5d806ee6b167acb436f30df2d8418052\` matched locally by \`git hash-object\`; Node 22.16.0 \`node --check\` PASS, **5/5 focused Node tests PASS** (separate local QA harness); **34/34 exact-source static/contract checks PASS**. These are *not* full repo regression.
- **BLOCKED browser preflight:** Chromium **144.0.7559.96** navigating owned local HTTP 200 test server on a dynamic loopback port returned \`net::ERR_BLOCKED_BY_ADMINISTRATOR\`. No candidate UI was rendered; no browser role matrix, screenshot or computed contrast exists.
- **BLOCKED exact checkout:** this isolated tool shell cannot resolve \`github.com\` for \`git ls-remote\` and does not mount the Application-Management checkout. Repository authenticated read operations work, but cannot substitute for a full instrumented build.
- **NOT_RUN:** whole repo Node suite, TypeScript \`npm run typecheck\`, Next/Vite \`npm run build\`, authorized React browser interaction, clipboard/accessibility and independent reviewer sign-off.
- **Unchanged:** Draft PR #419, PR #414 canonical execution JSON, reviewer A/B, \`main\`, Production. **CURRENT GATE = BLOCKED_RUNTIME / NOT_ACCEPTED.**
