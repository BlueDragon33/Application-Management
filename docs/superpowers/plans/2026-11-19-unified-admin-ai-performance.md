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
| **R2 — Reusable shell + real pilot** | R2.1 distill Bơi ếch UX tokens/navigation; R2.2 implement one shared ClientAdminShell and capability slots; R2.3 migrate **Bauman + PriceReport** as representative pilot | Two apps share shell without losing app-specific contract/roles |
| **R3 — Shared control projections** | R3.1 normalize source/state/capability snapshots; R3.2 unify *read-only* central queues/policies/audit summaries; R3.3 add staged, explicitly authorized write flow with CAS/idempotency/readback and partial outcome | No cross-client business DB, no duplicate write, no false success |
| **R4 — Controlled app migration** | R4.1 RU_LIFE + Health; R4.2 PC Manager + CAD + NC03; R4.3 GrowUP + Blueprint; align Bơi ếch shell only after preserving specialist behavior | All 10 canonical routes have correct common UX and honest capability states |
| **R5 — AI decision support** | R5.1 evidence schema & privacy guard; R5.2 local deterministic diagnostics/ranking; R5.3 decision cockpit, per-app dry-run, permission + human approval tests | AI may propose, never silently mutate; zero recurring spend |
| **R6 — Clean-up and release evidence** | R6.1 remove **proven-dead** CSS/components and benchmark p95, rerenders, request budget; R6.2 10-app role/browser E2E + responsive + accessibility + rollback; R6.3 independent review/Owner gates and distinct per-app release decisions | Evidence-led closeout; no automatic merge or publish |

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

## Current status

**R0.1 — DONE_SOURCE_AUDIT:** this document only, verified from GitHub source at baseline SHA. This is not live browser/performance evidence.  
**R0.2 — READY:** capture real runtime baseline in isolated ZERO-SPEND environment; the app's existing local-first procedure is described by `docs/LOCAL_FIRST_RELEASE_STANDARD.md`.  
**R0.3+ — BLOCKED** until prerequisites are met.

No runtime feature refactor is authorized by this planning checkpoint alone. 
