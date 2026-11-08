# ADR — Academic Workspaces: boundary-first architecture (P0)

**Status:** ACCEPTED FOR DRAFT IMPLEMENTATION, NOT AUTHORITATIVE PRODUCTION APPROVAL  
**Date:** 2026-11-08  
**Scope:** BlueDragon33/Application-Management PR #383, Issue #382  
**Constitutional authority:** Software-Blueprint-Hub `main`, `control/universal-constitution-version.json` = **1.3.0**, `docs/UNIVERSAL-CONSTITUTION.md`; local adoption `.blueprint/constitution-adoption.json` = B4/enforced. Draft 1.4 and AUTH-TIER are **NOT ratified**.

## Decision

Use two bounded academic contexts on the **existing** Application-Management origin, without a shared academic core:

1. **Thesis Planner** — internal tool at `/tools/thesis-planner`; owner of dissertation plan, semester milestones, evidence references and next step. Schema authority: `app/tools/thesis-planner/thesis-domain.mjs`; UI: `thesis-planner.tsx`.
2. **Coursework Workbench** — independent feature/application at `/apps/coursework-workbench` with separate project records and per-project workflow; schema authority: `app/apps/coursework-workbench/coursework-domain.mjs`; UI: `coursework-workbench.tsx`.
3. **Application-Management** continues to own authenticated entry, page shell, launcher, app roles and Production release gate. It **does not** own the academic truth, automatically review scientific work, or convert the coursework view into a managed remote client.
4. Existing `/tools/study-plan` and Bauman Hub own their current curricula/learning resources; two new workspaces use **links** only. No brittle direct database/contract coupling.

The planned academic core is **deferred**. Reassess after real user workflows, fully restored backups, data-model compatibility evidence and explicit cross-app reuse requirements. Premature abstraction would couple independent academic policies.

## Independent coursework app: target architecture and present limitation

The original product request explicitly calls Coursework an **app riêng biệt**, whereas this PR currently provides an isolated route and domain *inside* the management deployment. This does NOT satisfy independent code ownership, build artifacts, deploy lifecycle, or runtime isolation. It is an extraction-ready **P0 prototype**, not the final independent app.

**Target after prototype acceptance:** a dedicated Coursework repository/application owning its UI, academic records, build, tests, PWA/offline policy and release lifecycle. Application-Management should retain **only launcher metadata + an opt-in, documented management contract**, never its coursework source, user records, or scientific approval authority. Do not register a fake live client/device/SSO handshake.

**Migration gate:** source repository creation and security architecture must be explicitly reviewed; establish a stable public/preview origin without new paid dependencies; export v1 backup from the prototype and restore it in independent runtime; verify ownership, auth/standalone mode, offline cold-start, storage, link/redirect and rollback **on real devices**. Only after that may the Coursework item move from a system-tool/prototype launcher entry into the independent application registry. No release without approval.

**No shared academic core yet:** thesis remains an internal Application-Management tool; Coursework becomes an independent client when the above criteria are met. The future core must not depend on forcing Coursework back into the control-plane deployment.

## Required conceptual structure (P0)

```text
Application Management [auth + launcher] ────────────────┐
  /tools/study-plan (unchanged)                          │
  /tools/thesis-planner                                  │
    page.tsx -> auth gate                                │
    thesis-planner.tsx -> user flow & local persistence  │
    thesis-domain.mjs / .d.mts -> pure schema/recovery  │
    thesis-planner.module.css -> scoped display          │
  /apps/coursework-workbench                             │
    page.tsx -> auth gate                                │
    coursework-workbench.tsx -> user flow & persistence  │
    coursework-domain.mjs / .d.mts -> pure schema/recovery│
    coursework-workbench.module.css -> scoped display    │
  README/ADR/tests -> source, evidence, decisions        │
```

The domain modules have no browser, network, database or AI dependencies. Each validates imports independently and returns **fresh normalized copies**; neither imports from the other. Shared analytics/AI/storage frameworks are prohibited at this stage unless justified by an adopted ADR.

## Data & trust boundaries

- Academic records are **user-authored drafts**, not authoritative Bauman documents. Logged evidence is metadata/a reference, never a proof of scientific validity.
- P0 state: per-account **namespaced** `localStorage` on the same browser profile; ordinary `localStorage` is NOT encrypted and namespacing is **not security isolation** from someone sharing the device/profile. Never store credentials or sensitive/secret research datasets.
- The existing `requireChatGPTUser` protects the page within the current runtime policy, but does **not encrypt or protect localStorage** from another person who can access that browser profile.
- Explicit versioned **JSON backups**, independent for each app. Thesis supports its legacy P0 bare JSON export as an input; Coursework continues `coursework-workbench/v1`. Unknown future versions are rejected rather than silently imported.
- Runtime data storage remains in established v1 per-account keys. Save only **after same-account hydration**. Parse/read errors lock writes rather than overwrite preserved bytes. Another tab's storage event locks writes pending manual reconciliation.
- Course-work item IDs are stable and per-project milestones are isolated. Max 100 records in P0; imported dates must be real ISO calendar dates; evidence-complete requires a nonempty user-authored reference.
- JSON import requires schema validation and explicit overwrite confirmation. The full client JSON is not sent to remote AI/hosting services.
- Cross-account display must not present previous account's records during hydration; local browser isolation remains a known future concern.

## Architecture & capacity triggers

| Concern | P0 now | Trigger for expansion |
|---|---|---|
| Storage | Local namespaced drafts + backup | User-approved multi-device sync, large PDFs, storage quota incidents, or cross-tab editing |
| Attachment management | Evidence strings / filenames / DOI only | Secure document ingestion and permissions required by course or advisor |
| Academic templates | User-provided editable fields | Faculty-confirmed rubric and normative document variants |
| Thesis research | Milestone plan | Real citations, baselines, reproducibility data, reviewer feedback |
| Shared core | **None** | At least two mature flows need the same independently tested domain contract + migration |
| Managed remote client | Not registered | Real client identity, verified contract, device/access readback and explicit owner approval |
| Offline | Existing browser session local editing after load | Prove full offline cold-start/install/reload before saying offline-ready |

## Constitutional and quality gates (release-blocking where applicable)

1. **B4 structure:** one owner per state/contract, exact paths, safe extension path, no secret dependencies, source documentation and rollback plan.
2. **Security/data:** auth before route content; no secret in client; localStorage failure is visible; don't call account-key namespacing an authorization boundary; reject malformed backups.
3. **Durability:** validate dates/IDs, prevent completing a milestone with empty evidence, preserve old backups and corruption bytes, expose storage conflict/no-save states.
4. **User experience:** mobile/desktop navigation, compact Next Action, keyboard-accessible form controls, meaningful statuses not based on color alone. Check computed color contrast on a browser against WCAG 2.2 AA: static CSS is not a PASS.
5. **Dependency sovereignty:** reuse existing runtime/dependencies/site; no new Worker, database, Vercel, OAuth app, subscription or paid integration.
6. **Science/ethics:** user must verify research/source/experiments; AI use depends on confirmed departmental policy. No AI consensus = evidence, no invented citations, no fake faculty gate.
7. **QA:** Node 22 `npm ci`, strict typecheck, lint, unit tests of the **real** domain modules, full regression, build, browser behavior/restore/account separation, and independent human review. A green Node test does not replace mobile acceptance.
8. **Operations:** exact SHA + CI logs, explicit rollback to prior code, JSON backups survive route removal. Merge only after gates; release requires independent human authorization, artifact identity, post-deploy readback. Keep current Production unchanged.

## Explicit residual risks / non-claims

- LocalStorage and imported JSON do not constitute a secure research vault or a collaboration system.
- Cross-tab detection is conservative and **not a distributed transaction or atomic compare-and-swap**.
- P0 does not include browser offline cold-start, mobile device verification, citation validation, bibliography manager, supervisor collaboration, reliable local reminders or real file attachments.
- UI uses bespoke scoped CSS; human/automated contrast and responsive measurement remain required. Do not infer PASS from source-only review.
- Both products are in one current deployment. Coursework is a separate **application module**, not a separately hosted Worker/repository.

## Rollback / migration

Revert or close the PR without releasing; no database migration, Worker route change, identity update or secret change is performed. Existing `/tools/study-plan` remains intact. User-authored JSON backups are independent of the new route code. If new schemas must be introduced, create explicit migrators + round-trip evidence before deprecating v1.

## Acceptance ownership

- Developer: code, behavioral tests, source evidence and honest status.
- Independent technical reviewer: security, architecture, QA and regression findings.
- User/owner: iPhone/desktop workflows and scope approval.
- Bauman faculty: academic requirements, format, citations and final scientific acceptance.
- Release authority: explicit, separate production approval after all required checks.
