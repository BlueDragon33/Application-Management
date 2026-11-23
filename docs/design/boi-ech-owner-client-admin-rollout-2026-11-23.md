# Bơi Ếch Owner V18 → ClientAdminShell | 10-app rollout contract

**Source:** `app/apps/boi-ech/boi-ech-control-center.tsx` + `boi-ech-shell.module.css` at `main@89a89ce2...`. **Plan authority:** Blueprint OS 1.3.0 B4/STRUCTURED and the **single** canonical execution ledger `docs/superpowers/plans/2026-11-19-unified-admin-ai-performance.execution.json` in Draft PR #414. This document is a UX/component *specification*, not a second ledger or G04/G05 attestation.

## Goal

All 10 existing client admin surfaces under Application Management share one predictable **Bơi Ếch-style Owner information architecture**, while each app retains its own server permission checks, source-of-truth, category capabilities and domain-specific subpanels. A UI shell must **not** generate new contract endpoints, centralize child/health/accounting/learning data, or grant permissions merely by rendering a button.

### What is actually reusable from Bơi Ếch

- **Hierarchy:** back to server → client identity → source/connection status → **3–4 primary tasks** → expandable specialist tools → boundary/role/device identity → topbar title/description/visible sync state.
- **Behavior:** primary/specialist active states, keyboard focus and Escape, no double navigation, responsive tablet/mobile, clean empty/loading/error states and honest unknown/offline labels.
- **Style:** minimal paper/blue/nav hierarchy, high-contrast text, consistent panels and compact tables, not colorful decoration.
- **Scope-specific slots:** Bơi Ếch account approval and learning hierarchy are **not copied** into Health, PriceReport or any other app; only real capabilities appear.
- **CSS constraint:** Bơi Ếch currently has 1398 lines of scoped CSS with historical overrides and notes referring to Bauman. **Do not bulk-copy the cascade.** Distill stable interaction tokens into one shared component/CSS layer; keep Bơi Ếch itself as product-level UX exemplar and independently verify its actual appearance.

## Rollout inventory — all ten canonical first-level clients

| Client | Current admin owner/entry | Intended primary tasks | Specialized slots & hard boundary | Rollout gate |
|---|---|---|---|---|
| **Bơi Ếch** `boi-ech` | `apps/boi-ech/boi-ech-control-center.tsx` | Overview; Devices/Progress; Owner Accounts; Teacher/Learner | Policy, AI, Roles, Reports, Content. Preserve payments, account hierarchy and delegated approval | Reference; parity verification only, no forced rewrite |
| **Bauman** `bauman-master-ai` | `apps/bauman-master-ai/bauman-admin.tsx` | Overview; Devices/Access; Subclients | Contract; Study Plan; BM- registry and learner-site separation | **PILOT SOURCE STAGED** in PR #419, browser/role QA pending |
| **PriceReport** `price-report-tunggiabao` | `apps/price-report-tunggiabao/price-report-admin.tsx` | Overview; Devices/Access; Device Experience | Contract; KT- registry, accounting/client data never projected centrally | **PILOT SOURCE STAGED** in PR #419, browser/role QA pending |
| **Health** `health-care` | `apps/health-care/health-care-admin.tsx` | Overview; Devices/Access; Session Policy | Content Review and Audit only for authorized roles; never expose raw medical records | Pending pilot QA and privacy-specific role tests |
| **RU_LIFE** `ru-life` | `apps/ru-life/ru-life-admin.tsx` | Overview; HN Devices/Access; Sessions | Audit for authorized roles; RU-owned session validity + sensitive identity boundary | Pending pilot QA and HN session contract proof |
| **PC Manager** `pc-manager` | `apps/pc-manager/pc-manager-admin.tsx` | Overview; Desktop Devices; Updates/Entitlements | Typed commands only, outbound-only Gateway, no remote shell/no fake online | Pending pilot QA and Windows native proof |
| **CAD CAM 3D** `cad-cam-3d` | `apps/cad-cam-3d/cad-admin.tsx` | Overview; UI Policy; Devices | Contract; CAD- registry namespace and scope | Pending pilot QA and app-authority validation |
| **NC03 Modem** `nc03-modem` | `application-workspace.tsx` generic route | Overview; Client Capabilities; Device classes where real | Local modem secrets never surfaced; local-first; no phantom remote actions | Pending dynamic/capability/localhost proof |
| **GrowUP** `growup-mychildren` | `apps/growup-mychildren/growup-admin.tsx` | Overview; Privacy Boundary; Contract | Child/health/backup data is denied; no remote approval without real backend | Pending privacy/role QA |
| **Blueprint Hub** `software-blueprint-hub` | `application-workspace.tsx` generic route | Overview; Contract; real subclients only | Constitution owner authority remains Hub; no shell-generated compliance PASS | Pending independent authority check |

All rows refer to **existing** routes and owner modules; do not create new websites or databases. Dynamic-only Catalog clients must eventually have a validated generic **internal** admin route bound to `appId` plus authenticated capabilities; do not substitute a public runtime link (R11 gap).

## Shared shell component contract (Draft pilot)

- `app/components/client-admin-shell.tsx`: `ClientAdminSidebar<T>` and `ClientAdminTopbar`. Input explicitly passes `appId`, category, nav items, verified-state *label and source note*, app-owned data-boundary, current role and device code. **Presentation-only:** no `fetch`, no `operationsAction`, no token, no localStorage, no authorization decisions inside shell.
- `client-admin-shell.module.css`: only layout/primary-vs-specialist nav/focus/reduced-motion and responsive rules. Base tokens from `application-admin.module.css`. Do not globally overwrite Bơi Ếch or child-admin CSS.
- **Pilot** Bauman and PriceReport keep every state/action function, role gate, device-operation endpoint, step-up and readback. Change only sidebar/header markup.
- No fake `online`, `approved`, or `saved` from UI. Actual source owner and `verifiedAt` belong in data/readback layer; shell simply displays truthful state provided by client.

## Acceptance checklist per client (cannot infer PASS from CI)

- [ ] 1. Exact pinned SHA; existing role gate unchanged: Owner/reviewer/publisher/viewer/pending/blocked/expired test as appropriate, including denied changes.
- [ ] 2. Responsive 1440/800/390px: primary navigation, expandable specialists, tables/scrolling, long names, content and notices fit; compare screenshot with Bơi Ếch reference. No clipping/overlap, no colored UI excess.
- [ ] 3. Keyboard Tab/Enter/Escape, visible focus, labeled roles/status, meaningful loading/empty/error; real computed contrast across controls, not only page title.
- [ ] 4. Navigation enters every *supported* module without losing local selection, retry/timeout and browser back behavior; unsupported actions explain why and do not pretend enabled.
- [ ] 5. Device approval/lock/delete roles, confirmation, anti-double-click, expected revision/CAS, idempotency, independent client readback, fail-closed unknown results. No mutation verified from a screenshot alone.
- [ ] 6. Independent real contract/source/connection readback; online, offline, metadata-only, stale, unavailable, unsupported are distinguished. No false zeros.
- [ ] 7. For Health, GrowUP, RU_LIFE, PriceReport and PC Manager: adversarial denial/PII boundary, client-owned DB/session, local/Production isolation, app-specific rollback.
- [ ] 8. Headless screenshot is evidence, not Owner acceptance; no merge/publish/ratify/Constitution gate PASS without independent authorized approval.

## Delivery sequence

1. **Source-only pilot** in Draft PR #419: common shell + Bauman/PriceReport, no business mutations changed. Typecheck/build/tests, browser preview only if separately authorized. Pilot stays **UNVERIFIED** until role/browser tests and canonical prior dependencies pass.
2. **Shared control-plane dependencies:** keep central Overview and per-app permissions aligned, including accurate online/cached/source status; a new account-first capability must remain migration gated until independent cross-client evidence.
3. **Migrate remaining shells in deliberate groups:** Health/RU_LIFE with privacy, then PC/CAD/NC03 with local/native constraints, then GrowUP/Blueprint; Bơi Ếch is finally checked for visual parity, not flattened into generic business tabs.
4. **Closeout:** screenshots/interaction/regression/security QA across ten apps plus owner review, rollback, restore; update only canonical ledger and seek explicit independent release authority. ZERO-SPEND, no auto-merge or Production.

**One next action now:** complete source CI for Draft PR #419, then authorized local authenticated Bauman + PriceReport browser pilot. R0.2 G05 UNVERIFIED does not auto-become PASS; R2 implementation is staging, not final accepted WP.


## R2.3 local QA Owner fixture (not Production approval)

**Root cause of observed Pending:** `LOCAL_DEV_AUTH=1` accepts a loopback test identity, but does not authorize the device or make an arbitrary email an Owner. `isOwnerEmail()` requires a matching active `control_accounts` owner or an exact match in `CONTROL_OWNER_EMAILS`; `registerControlDevice()` leaves other newly registered devices `pending`. Existing IndexedDB P-256 credentials bound to a previous local email may instead produce `DEVICE_BOUND_TO_OTHER_USER`. Both are correct fail-closed behaviors, not a reason to bypass the role gate.

Previous manual command set `LOCAL_DEV_USER_EMAIL=qa-r23@example.test` but omitted matching `CONTROL_OWNER_EMAILS`, causing the fixture to fall into pending. Use the **isolated** launcher on an approved, detached QA checkout (not `main`, Production or a developer environment containing `.dev.vars`):

```powershell
# Stop the old localhost:5188 Vite process first. In a detached QA worktree:
node scripts/run-r23-owner-pilot-qa.mjs --check-only
node scripts/run-r23-owner-pilot-qa.mjs
```

The launcher configures `LOCAL_DEV_USER_EMAIL` and `CONTROL_OWNER_EMAILS` to the **same synthetic test-only identity**, creates/migrates **local** D1, then runs Vite bound to `127.0.0.1:5191`. Port 5191 isolates browser IndexedDB credentials from the prior 5188 session. It refuses any inherited Production/remote Cloudflare setting and never signs in to Production, writes real role data, or issues release approval.

Acceptance remains strict: this local Owner fixture can unblock **visual layout QA**, but **cannot** certify real authenticated role matrices, Bauman BM-/PriceReport KT- independent source readbacks, G04, G05 or Production. Pending, blocked, wrong-account and failed P-256 proofs must still be tested separately. Automated source guard: `tests/r23-owner-local-qa-guard.test.mjs`. No merge/publish until canonical gates pass.
