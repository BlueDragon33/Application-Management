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
