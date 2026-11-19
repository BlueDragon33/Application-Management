# MASTER PLAN — Unified Application Management | UX · AI Decision Support · Performance

**Date:** 2026-11-19  
**Repository / baseline:** `BlueDragon33/Application-Management@720521a905ddb71ebd54ac8c80c94be705438928` (main; PR #413 merged).  
**Constitution:** `blueprint-os:universal-century-grade@1.3.0` ACTIVE (Software-Blueprint-Hub).  
**Control ledger:** `docs/superpowers/plans/2026-11-19-unified-admin-ai-performance.execution.json` (single source of task states/next action).  
**Authority:** Owner requests large modernization and a fixed work budget. Plan-only branch; runtime changes/merge/publish/Production require separate gates. ZERO-SPEND, local-first, fail-closed.

## Goal and scope

Make multi-app management coherent, fast, minimal and decision-ready. Use **the current Bơi ếch administration information architecture** as a *UX reference*, not as a component to copy wholesale. A shared shell serves all registered apps; specialized domain panels remain owned by each client. An evidence-driven AI advisor prioritizes and proposes actions across *verified control metadata*, not raw user/medical/child/visa records. No AI can bypass role gates, step-up, human review or independent client-owned readback.

**Included:** 10 canonical routes in `app/application-registry.ts`: software-blueprint-hub, boi-ech, health-care, ru-life, bauman-master-ai, price-report-tunggiabao, pc-manager, nc03-modem, cad-cam-3d, growup-mychildren. Dynamic Catalog must use the same versioned capability-driven rendering, never fake a management endpoint.

**Not included:** building a second app/site/repository, replacing app-owned device registries or D1, combining business data into a new global DB, reimplementing Bơi ếch pedagogy/payment logic centrally, cross-client unrestricted mutations, paid AI providers, production changes without Owner authorization.

## Verified source baseline vs hypotheses

Read-only source audit at the baseline commit:

- `app/apps/boi-ech/boi-ech-control-center.tsx` ~130 KB, 9 role-filtered destinations; compact primary navigation (Overview, Devices, Owner Accounts, Oversight) plus expandable specialist tools (Policies, AI, Roles, Reports, Content). Visible provenance/connection state, manual sync, one account modal.
- Separate shells already exist for Bauman (~21 KB), RU_LIFE (~31 KB), Health_Care (~33 KB), PC Manager (~8 KB), PriceReport (~18 KB), while CAD/GrowUP and generic `application-workspace.tsx` have further variants. No validated reason to copy more shells.
- `app/management-dashboard-v2.tsx` ~120 KB. It uses a **1-second clock state** in its large parent and a focus-triggered operations refresh. `app/page.tsx` imports **8 dashboard stylesheets**. These are performance/maintenance investigation candidates, **not yet confirmed root causes**.
- Existing `app/ai-control-center.tsx` is specifically the Bơi ếch learning AI control surface, **not** a proven universal operations AI.
- Existing `docs/UNIVERSAL_MANAGEMENT_CONTRACT_V1.md`, `docs/AUTOMATION_SOURCE_OF_TRUTH.md`, `docs/CONTROL_PLANE_TOPOLOGY.md` define the canonical contract and source ownership. Reuse instead of creating parallel APIs.

**Measurements missing:** real browser CPU, p50/p95 latency, React commits, memory footprint, request count, CSS coverage, long tasks, client runtime readiness. Mark these `UNVERIFIED` until captured at an exact SHA and environment. CI green is not UX PASS.

## One shared shell, app-owned capabilities

Shared UI architecture (server-owned presentation only):

1. **Common shell** — breadcrumb Server / Client / App; app name/role; verified status with source and timestamp; consistent typography, spacing, 4–5 primary tasks and expandable specialized tools; appearance and accessible responsive modes.
2. **Universal screens, only when real capabilities exist** — overview, connection/contract, account/role summary, device inventory and policy, automation, audit, reports, AI decisions. Disabled/unavailable states explain *why*, never show fake controls.
3. **Specialized slots** — Bơi ếch manager/teacher/learner and payments; Bauman sub-clients; RU_LIFE sessions; Health privacy; PC Manager outbound-only typed commands; GrowUP child privacy; PriceReport accounting; CAD/NC03 local-only paths.
4. **Single operations projection** — per-app authoritative adapter: `appId, contractVersion, source, verifiedAt, revision, capability, permission, liveState, latency, actionableEvidence`; app data remains in originating client. No central write to business DB.
5. **Trust boundaries** — protected mutation on server/owning client, Owner/reviewer authority; command ID/idempotency, expected version/CAS, independent readback, step-up confirmation, reason, audit and failure classification. Cross-app batch acts on *explicit selected apps*; partial success is reported per app and field.

## AI operations adviser — not an omnipotent automation switch

- **L0 facts:** canonical read-only metrics and source citations only; `unknown` is distinct from zero, offline, unsupported and stale.
- **L1 deterministic rules (free/local):** duplicate registration, authorization drift, contract mismatch, stale devices, recurring request errors, performance anomalies, policy deviations, reopen/retry patterns.
- **L2 prioritization:** ranked incidents/actions with evidence references, confidence level, severity, affected apps, expected impact and reversal path. Unverified evidence can only produce *needs verification*, never an executable authorization.
- **L3 human decision:** AI drafts plan and per-app diffs; system shows dry-run and prerequisite matrix. Only signed-in authorized human decides. A permission-checked command follows the existing client contract and is independently read back. No model output is executable code/SQL/remote shell.
- **L4 optional advanced AI:** only a separately approved provider adapter with data minimization, fixed budget, consent, portability and deterministic fallback. Default ZERO-SPEND; no raw healthcare, child, passport/visa or private credential data enters AI context.

Do not duplicate Bơi ếch teaching assistant or Blueprint Graph Intelligence business logic. Share *evidence formats and contracts* when proven compatible.

## Bounded delivery: 7 rounds × at most 3 steps = at most 21 planned Work Packages

A “round” is a focused Work session, **not** one model/tool call. One current `activeNextAction` only; max one READY implementation WP at a time; finish/record PASS, FAIL or BLOCKED before moving on. Do not run repeated CI if unchanged exact SHA and evidence already covers the scope. Unexpected work must be proved and entered as an amendment before expanding the budget. No empty/fabricated packages.

| Round | Three bounded steps | Checkpoint / exit |
|---|---|---|
| **R0 — Baseline and bottleneck proof** | R0.1 source audit; R0.2 measure 10/50/200-app fixtures across desktop/tablet/mobile with runtime CPU/requests/commits; R0.3 rank confirmed root causes + freeze UX/contract matrix | Named measurements + reproducible slow flows + no invented root cause |
| **R1 — P0 speed and freeze fixes** | R1.1 isolate 1-second clock/render; R1.2 coalesce focus/visibility refresh and bound requests without changing verification; R1.3 validate loading/retry/cancel, duplicate-click and 0 data regressions | Measurable improvement vs R0; every affected protected path still fail-closed |
| **R2 — Reusable shell + real pilot** | R2.1 distill Bơi ếch UX tokens/navigation and check B4 Project Profile; R2.2 implement one shared ClientAdminShell with a **capability-driven dynamic client route** (R11) and slots; R2.3 migrate **Bauman + PriceReport** as representative pilot | Two apps and an enrolled non-static fixture render one shell with proper auth, without losing client contracts |
| **R3 — Shared control projections** | R3.1 normalize source/state/capability snapshots and trust boundary; R3.2 unify *read-only* central queues/policies/audit summaries plus R11–R14 compatibility truth; R3.3 stage explicitly authorized writes with CAS/idempotency/readback and partial outcome | No cross-client business DB, no duplicate approval, no false success; federation remains migration-gated until independently proven |
| **R4 — Controlled app migration** | R4.1 RU_LIFE + Health; R4.2 PC Manager + CAD + NC03; R4.3 GrowUP + Blueprint; align Bơi ếch shell only after preserving specialist behavior | All 10 canonical routes have correct common UX and honest capability states |
| **R5 — AI decision support** | R5.1 evidence schema & privacy/threat guard; R5.2 local deterministic diagnostics and **blind-labeled adversarial evaluation fixtures**; R5.3 decision cockpit, per-app dry-run, explainability, permission + human approval tests | AI can propose but cannot authorize, execute, invent evidence or leak sensitive data; zero recurring spend |
| **R6 — Clean-up and release evidence** | R6.1 remove **proven-dead** CSS/components and benchmark p95, rerenders, request budget; R6.2 10-app role/browser E2E + responsive/contrast + security + backup/restore/rollback drills; R6.3 constitutional evidence attestation and Owner/human UX gates (**independent A/B recorded externally**) | Evidence-led closeout; Owner/release decision separate; no automatic merge or publish |

### Definition of DONE for every WP

- Existing behavior baseline and exact owner identified, no overwrite of concurrent Draft PR work.
- Changed only necessary files, no copy-paste business logic, no new shadow API/database or stale UI.
- Red/green regression on exact SHA; CI typecheck, lint, build, existing tests, then actual browser where relevant.
- Before/after measurements for claimed performance gains; no fabricated p95. Loading feedback ≤200 ms and local interaction acknowledgement ≤100 ms are reference NFR targets, not measured status.
- Security, per-app readback, dynamic Catalog and degraded/offline modes remain correct; WCAG keyboard/focus/contrast checked.
- Source/evidence links, risk, decisions, rollback and one Next Action written to the ledger.

### Execution budget and stop rules

- Up to **7 rounds, 21 WPs**, each 3 steps max. Budget is a planning limit, not a guarantee every unknown bug fits.
- One active READY WP, no parallel refactor of 10 apps, no release triggered merely to preview CSS.
- On `NO_READY_WORK` stop immediately with one blocker and fallback, no new tests/commits/PRs.
- On detected P0 security/data fault stop other rounds, document proof and escalate Owner; never bypass gate.
- Existing production is kept intact until staged QA + human acceptance + separate Owner release approval.
- For each future chat: read latest `main`, this plan, ledger, candidate SHA and real diff; act only on the next eligible WP; at end persist status/evidence/nextAction. Output exactly **one** Next Action button with text fallback.


## Constitutional review amendment — 2026-11-19

**Assessment:** The original seven-round plan is a delivery decomposition, **NOT a Constitutional Compliance Attestation**. A green CI or an adoption manifest is insufficient. Reviewed against Software-Blueprint-Hub \`docs/UNIVERSAL-CONSTITUTION.md\` (ACTIVE 1.3.0), \`docs/CONSTITUTION-ENFORCEMENT.md\`, \`docs/CONSTITUTION-COMPLIANCE-ATTESTATION.v1.md\`, \`docs/CONSTITUTION-AUTHORITY-PROTOCOL.v1.md\`, \`docs/NFR-CAPACITY-BUDGETS.v1.md\`, \`docs/CI-TEST-CONTRACT.v1.md\`, \`docs/UNIVERSAL-CENTURY-GRADE-CONSTRUCTION-STANDARD.v1.md\`. Existing adoption: \`.blueprint/constitution-adoption.json\` = **B4** enforced. **Universal gate readiness = UNVERIFIED**, not COMPLIANT.

**Independent A/B reviewers:** User has delegated this external track and asked this modernization effort not to execute it. **EXTERNAL_PENDING** is a truthful exception to the implementation *scope*, **never a Constitutional waiver, PASS, or a license to bypass any mandatory human review/Owner decision**. Owner UX acceptance, security, critical test evidence, and distinct production authorization remain part of this program.

### B4 Project Profile and ecosystem position (review baseline, not an invented new product)

- **Primary personas:** Owner supervises portfolio; delegated manager handles approved scoped management; reviewer/publisher have distinct existing control-plane roles; viewing-only operator observes verified state. End users of client apps are **not central superadmins**.
- **Jobs:** locate any registered client, see true connection/capability/role, inspect risk, resolve one scoped operational incident, recover from uncertain writes, use shared navigation without recreating client identity or Business DB.
- **Five critical journeys:** (1) enter Central -> client admin with valid role -> return; (2) unknown/dynamic client contract discovery -> capability-based management surface without central source patch; (3) device/account approval + cross-app scope/expiry/revocation with no duplicate trust; (4) synchronized policy write -> CAS/idempotency -> client-owned independent readback -> audit; (5) AI-generated recommendation -> evidence/confidence -> human confirmation/decline -> independently protected and verifiable result (or read-only).
- **Critical impact:** identity and device access, scoped destructive administration, payments, medical/child/education/accounting metadata. B4 applies; do not silently downclassify. Each sensitive app retains stricter local gates.
- **Topology:** **E2 target** (operationally coordinated multi-domain ecosystem), **verified E-level UNVERIFIED** pending real cross-app identity, scoped approval and interoperation evidence. No E3 claim. The existing \`Application-Management\` repo is management plane; \`Software-Blueprint-Hub\` is Constitution authority; clients retain domain ownership. This plan is not a new registry/constitution/AI service.
- **Budget:** ZERO-SPEND core, local-first, no new paid provider, no second site/repository/control DB. Any optional AI provider requires reviewed dependency budget and consent; unverified external assumptions are blocked.
- **Scope boundary:** redesign **client admin UX and operations control plane only**. Learning pedagogy and Russian subject-specific S100/R200 obligations remain with existing educational app owners. If their *learning content* changes, start that app's qualified domain acceptance — never silently mark it complete from Central UI tests.

### Must-fix architecture mismatches and migration status

1. **Dynamic Catalog vs static admin routes (R11):** current Overview tiles resolve \`manageHref\` by lookup in \`staticApps\`. Newly enrolled dynamic-only clients can have a valid manifest but **no clickable central admin tile**. Add a **safe generic internal management route bound to validated Catalog appId + server authorization + live capability** in R2.2. No public runtime URL fallback, no source changes per new app, no duplicate route registry. Test at least one dynamic-only fixture. This is a **source-confirmed divergence**, not a claim that existing production was observed failing.
2. **Federated identity/device (R11–R14):** Bơi ếch and other clients have separate authorization/device contracts. Shared account-first centrally scoped approval, cross-origin handoff, replay protection, revocation freshness, delegated app/environment permissions and offline behavior are **MIGRATION_GATED / UNVERIFIED** pending an authenticated compatibility pilot. Until proven, leave current safer per-app auth intact; never blindly treat app/device registration as owner permission or auto-approve unknown devices. Central admin-device registry != client user-device registry != client entitlement/session.
3. **No universal superadmin (R26):** central may orchestrate approved commands only through client-owned versioned endpoint; source-owned business data/transactions never move to shared D1. Device/AI/policy snapshots are projections with source revision, TTL and unknown/stale marking. No duplicating unique Bơi ếch payment/learning logic, Health medical data, GrowUP child records, RU_LIFE sensitive identities, PriceReport accounting, NC03 modem secrets.
4. **Unifying UI ≠ unifying domain semantics:** reuse shell/navigation/accessibility/permission/status components. Do not force all clients into nine Bơi ếch tabs or a single generic device/payment workflow. Declare real capability presence/absence and permissions per app and per action; avoid fake toggles.
5. **Central policy vs app policy:** one **read and orchestration plane**, not an unreviewed single authoritatively writable database. Cross-app batch is explicit app-scoped and partial results are per app/field; unknown, timed-out or failed readback never show “saved”. Keep per-app rollback and idempotency authority.

### Formal gap and gate matrix — owner, proof, fail mode

| Gate | Constitution mapping | Required evidence / completion predicate | Default if absent |
|---|---|---|---|
| **G00 Profile and topology** | Product 1; R15/R21/R23–R27; B4 | Project Profile reviewed, exact B4/STRUCTURED, proposed E2 target vs actual verified edges; scope delta; vertical slice; owner/capability/RACI matrix | UNVERIFIED |
| **G01 Architecture & compatibility** | Architecture 2; R2/R11/R13/R18/R26/R27 | Existing-vs-new modules, dynamic-only app route fixture, versioned manifest and deprecation plan, compatibility tests, parent/subclient boundary | BLOCKED |
| **G02 Identity, auth, role matrix** | Security 5; R5/R9/R11–R14 | Owner/manager/reviewer/publisher/viewer, anonymous/blocked/expired; central vs app ownership, denial cases, step-up, cross-app delegation, stolen/replayed grants, revoke deadline | BLOCKED |
| **G03 Data/privacy/recovery** | Data 3; 9.6/9.7; R5/R14/R26 | Per-entity source-of-truth, classification, retention/expiry, access minimization, secure redaction, export/backup and **successful isolated restore** with exact version | UNVERIFIED |
| **G04 Real UI/UX** | UI 4; 9.3/9.4; R6/R13; §11 | Figma/UX design not required; existing Bơi ếch navigation comparison, desktop/tablet/mobile interaction, keyboard/focus, accessible forms, computed text contrast >=4.5:1, large text >=3:1, UI boundary >=3:1, human UX acceptance | UNVERIFIED |
| **G05 Performance & capacity** | 9.1/9.5; R6/R10/R18 | Exact fixture/browser/device/network/SHA; p50/p95 latency and request counts, memory, React commits, long tasks, CSS coverage, bundle weight, 10/50/200 **synthetic** clients, before/after and uncertainty | UNVERIFIED |
| **G06 Reliability and safe persistence** | QA 6; R4/R5/R7/R9/R20 | Concurrent double clicks, timeout/abort, fetch coalescing, stale cache, CAS conflicts, idempotent commands, independent GET/readback, partial failure/rollback; fail closed, no false zero/PASS | BLOCKED |
| **G07 AI verification & safety** | Security/QA/sovereignty; R3/R9/R18/R26 | Local deterministic reference + withheld labeled blind/adversarial fixtures, error taxonomy, false-positive/negative measurement, provenance, prompt-injection resistance, PII boundary, no autonomous mutations | UNVERIFIED |
| **G08 Clean migration / entropy** | Architecture 2; 9.2/9.5; R2/R18 | Exact old/new imports, dependency/CSS/route/logic owner, screenshots and perf parity, measurable reduction without deleting live paths or tests, migration/rollback decisions | UNVERIFIED |
| **G09 Real environment / operations** | Operations 7; R1/R3/R8/R20/R22 | Offline/local vs Preview vs Production identity, exact SHA, versioned diagnostics and correlated logs, no secret leakage, isolated integration, release artifact identity, no accidental remote writes | BLOCKED |
| **G10 Governance / attestation** | Governance 8; R1/R3/R8/R15–R20; CA-006 | Canonical quality evidence per 7 pillars and Universal gates, traceable file/SHA/runtime/time, accurate compliant/blocked states, separate Owner Project/Production gates | UNVERIFIED |
| **G11 Rollout / resilience** | Operations 7; 9.5/9.6; R5/R20/R26/R27 | One vertical slice -> canary by app -> forward/rollback, signed release SHA, rollback/restore **tested**, independent per-app revert, monitoring and acceptance with no unresolved P0/P1 | BLOCKED |

**Every gate applies before product acceptance as relevant**; gates may be satisfied proportionately and at the appropriate round, not all as a prerequisite to measuring the baseline. \`UNVERIFIED\` means no exact proof in this plan, not confirmation of a defect. \`BLOCKED\` means a later action is prohibited until its prerequisite passes. Adoption CI PASS is not a compliance attestation.

### AI decision contract — explicit safety and anti-fabrication

- Every evidence item: stable \`appId\` + bounded context, capability/version, source/issuer, \`observedAt\`, \`verifiedAt\`, source revision, request/command correlation, sensitivity label, freshness class and signed/read-only result if available. **Missing != zero; stale != current; reported != applied.**
- Every suggestion: evidence IDs, root-cause hypothesis, confidence calibration, impacted apps, reversible action plan, dry-run diff, compatibility prerequisites, alternatives, Owner-facing explanation and explicit abstention condition. A language model's statement is **not** evidence or authorization.
- Blind QA fixtures (not independent A/B reviewer): withheld labels, normal/edge/malicious observations, cross-app privilege confusion, incomplete manifests, partial CAS writes, transport retries, missing/stale/unavailable inputs, adversarial content/prompt injection. Report confusion matrix, precision/recall and critical-security false-accept counts. Set acceptance threshold **before** evaluating; never tune thresholds after seeing held-out labels without versioned re-evaluation.
- Privileged operations use **existing signed server/client gates only**; model never executes SQL, arbitrary scripts, remote shells, mass approvals or self-signed PASS. Decision orchestration is fail-closed, scoped and human-confirmed. If AI engine is absent, rules/operational controls remain usable.
- Sensitive raw domain payloads are excluded by default from the AI projection (medical, child, education records, payments, visa/passport, secrets). Review any new dependency under existing \`docs/DEPENDENCY_BUDGET.json\` prior to use.

### Runtime performance acceptance and triage contract

At R0.2 capture **read-only local/QA** data from the existing app (do not deploy Production): navigation startup, tab changes, opening app admin, filtered 10/50/200 synthetic clients, focus/visibility, policy read, stable idle, long-list scroll, and degraded/unavailable scenarios. Capture p50/p95 for device classes, network/CPU/browser conditions, request counts by endpoint, duplicate/abort count, long tasks, React render commits, memory trend, actual initial JS/CSS sizes, error/unknown rate. **No fabricated hard benchmark for an app whose baseline is missing**. Record measurement methodology and variance.

Recommended first UX targets from Blueprint NFR: local action acknowledgement <=100 ms; network-backed pending visible <=200 ms; no indefinitely frozen spinner; tables paginate/virtualize when volume requires; reduced motion and full keyboard access. For all other p95/performance budgets set a reviewed target *after* source baseline and fix only measured harmful bottlenecks. Hard-block if speed gains are achieved by disabling authorization, fake cache freshness, dropping evidence, suppressing errors, weakening tests or leaking client records.

### Phased release and recovery policy

- Required per-app matrix: stable app ID -> owner -> environment -> versioned contract -> supported capabilities -> central identity/roles -> client-owned API/audit/DB -> privacy sensitivity -> operational degradation -> migration and rollback.
- Risk-based pilot: **Bauman + PriceReport** plus one dynamic-only Catalog fixture; prove on real isolated runtime before expanding to all ten; include offline/local-only path (NC03) and privileged Windows/outbound-only PC Manager semantics in later focused slices. A Source-based control claim is never REAL-UX-VERIFIED.
- Before production: isolated backup/export and successful restore/recovery test on the right authoritative owner; deploy against a pinned SHA only; independent per-client canary/rollback, live readback and post-release observation; never broad cross-app publish as one flag.
- **Constitutional authority**, **Project authority**, **Quality Gate attestation**, **human UX acceptance**, **independent A/B reviewer track**, **Owner release authorization** are separate. No one category implies the others. A/B excluded from this WP execution yet tracked EXTERNAL_PENDING; if mandatory at a future gate, remain blocked until its actual human resolution.
- **Repair loop:** observe/diagnose -> smallest owner edit -> focused and affected existing tests -> evaluate -> close/revert/re-diagnose; no same-hypothesis replay without fresh evidence; **after three genuinely distinct failed remedies of one root defect stop speculative writes**, do not consume tokens/WPs with guesses.
- Every WP stores exact base/head SHA, touched paths, rationale, proof, blockers, revert method, stage (CODED/STATIC-TESTED/INTEGRATION-VERIFIED/REAL-UX-VERIFIED/DEPLOYED/OBSERVED), explicit stop predicate and **one** Next Action.

## Current status

**R0.1 — SOURCE-AUDIT ONLY:** inspected GitHub source at baseline SHA; file/commit references now recorded in the ledger. This does not certify code/runtime UX, operational security, Constitutional compliance or performance.  
**R0.2 — READY:** capture real runtime baseline in isolated ZERO-SPEND environment; the app's existing local-first procedure is described by `docs/LOCAL_FIRST_RELEASE_STANDARD.md`.  
**R0.3+ — BLOCKED** until prerequisites are met.

No runtime feature refactor is authorized by this planning checkpoint alone. 
