# R0.2 — API vs bootstrap vs first painted grid | read-only evidence attribution

**Date:** 2026-11-23 (UTC+03). **Policy:** Blueprint OS 1.3.0 ACTIVE, B4/STRUCTURED, ZERO-SPEND, human gates. **Evidence level:** exact SHA Windows local Chrome evidence, retrospective parsing of an *existing* QA archive. This document is **not another ledger** and does not grant G05 acceptance.

## Immutable provenance

- Source: user-uploaded `r02-evidence-package.zip`, SHA-256 `e6cc48519ade6ee33505b942c4ed1faf9fe3f9191052dbb85518807255ab7349`.
- Inside ZIP: `runner-evidence\r02-evidence.json`, `runner-evidence\baseline-vite.log`, `runner-evidence\candidate-vite.log`, `bundle-summary.json`.
- Baseline: `89a89ce2d3d8ed634ee9562c52744a99223a2b2a`; PR #417 candidate: `92f7fbf6e3b1664d2431694fc5aeaef5b27df5c6`; runner: `92b2026cd31be18828f2f743b65c6499e19d40aa`.
- 54 Chromium browser samples: 10/50/200 synthetic apps, 1440/800/390 px, 3 repetitions per stratum per revision; six independent local D1 Wrangler count readbacks and 54/54 managed-app counts matched. No page JS errors or Playwright failed requests. These observations confirm workload execution, **not React commit counts or visually painted readiness**.

## What “readyMs” actually measured

The original runner recorded `performance.now()` immediately before `page.goto`, then waited for `/api/operations` response and `response.json()` before reporting `readyMs`. Its `.amv2-content[data-view="applications"]` visibility check proves the *shell* is visible, **not that the synthetic cards have committed/painted**. Therefore call this historical metric `bootstrapReadyProxyMs`, **not true UI ready-to-interact**.

Vite’s `POST /api/operations 200 in Xs` lines were extracted sequentially in the same sample order (27 lines per revision). They round to about 0.1 s. `bootstrapReadyProxyMs - ViteApiMs` includes **pre-API authentication/center bootstrap, network, JSON parsing, browser scheduling and any UI effects**; it is *not* “React render duration” or necessarily elapsed time strictly after response.

## Measured decomposition (all 3 viewports pooled, n=9 per app-count per revision)

| Fixture | Variant | Bootstrap proxy p50 | Vite /api/operations p50 | Difference of per-sample times p50 |
|---|---|---:|---:|---:|
| 10 | Baseline | 2576 ms | 2000 ms | 536 ms |
| 10 | Candidate | 2526 ms | 2000 ms | 526 ms |
| 50 | Baseline | 2556 ms | 2000 ms | 529 ms |
| 50 | Candidate | 2662 ms | 2100 ms | 575 ms |
| 200 | Baseline | 2655 ms | 2000 ms | 649 ms |
| 200 | Candidate | 2873 ms | 2100 ms | 773 ms |

At 200 apps: candidate bootstrap proxy p50 = **+218 ms**, rounded backend Vite API p50 = **+100 ms**, non-API difference median = **+124 ms**. Those differences need not add exactly because they are independent medians. Browser-native request timings were **not** collected in the original archive, so API timing is an estimate from rounded developer-server logs only.

Baseline 10-app desktop runs contain early warmup outliers (3905, 5045, 3761 ms), while the 200-app three-viewport p50 regressions ranged **+6.6%, +8.5%, +9.8%**. All baseline runs preceded all candidate runs, confounding the revision comparison with time/order/cache effects. With only three samples per viewport, p95 degenerates to the maximum and must not be accepted as meaningful p95 evidence.

## Source-level route analysis; NOT root-cause proof

- `app/api/operations/route.ts::buildBootstrap` uses `Promise.all` of seven specialized client loaders and `probeDynamicManagedApplications()`, followed by summary/permissions/settings projection. Without per-loader spans, the 2s backend wall time cannot be assigned to any particular client or D1 operation.
- `app/open-contract.server.ts::probeDynamicManagedApplications` calls `Promise.all` over enabled catalog rows; fixture endpoints and per-application parsing/normalization scale with the catalog. The contract loader was not changed by PR #417. It is a candidate *source of absolute scaling cost*, not proven to cause the *revision difference*.
- `app/management-dashboard-v2.tsx` builds `activeApps`, derived summaries/filters and the `ApplicationsView` card list. Source includes manual sort and full card rendering; neither was introduced by the isolated clock change in PR #417. There is **no direct measured React commit time**.
- PR #417 isolates the one-second Overview clock and revalidates automation snapshot freshness; it does not change the `/api/operations` bootstrap implementation. **Do not blame the clock change or refactor lists based on temporal association alone.**

## CPU, React, interaction, contrast: evidence gaps and focused instrumentation

The existing archive captures post-ready three-second Chromium CDP `TaskDuration` and `JSHeapUsedSize`. At 200 apps, average heap improved 26.86 to 14.72 MB and post-ready CDP TaskDuration 156 to 26 ms. **Neither is startup process CPU**. The original report explicitly marks React commits and composited contrast `UNVERIFIED`.

The Draft PR #414 QA runner has an opt-in `R02_FOCUSED=1` mode (no Production instrumentation, original 54-sample mode unchanged) for **40 targeted cases only**:
- 50 apps × mobile 390 px × baseline/candidate × 5; 200 apps × desktop/tablet/mobile × baseline/candidate × 5.
- Playwright request timing of the actual `/api/operations` response, measured on the same browser clock as the bootstrap proxy.
- Independent **first painted synthetic-card grid** measurement (waits for at least fixture count cards and two animation frames). A missing full grid fails closed.
- Chromium renderer startup `Performance.getMetrics TaskDuration` delta, and CPU seconds of the *owned Vite Node PID*. These **do not equal total Chrome/Worker/OS process CPU**, which remains UNVERIFIED.
- Browser-side filter-input-to-next-two-RAF latency (a safe local-only non-mutating user interaction), with explicit UNVERIFIED fallback if not observable.
- React DevTools hook attempt to count page-wide commits, marked UNVERIFIED unless the hook demonstrably receives commits; not a React Profiler render-duration measurement.
- Computed foreground and entire ancestor background style stack for text; this does **not** prove final composited background/contrast on gradients or transparency, so WCAG contrast remains UNVERIFIED pending a validated screenshot or equivalent renderer-level inspection.

The focused source is **instrumentation only**. It neither modifies PR #417 application logic nor claims a newly executed Windows trace. It is not permission to rerun the unchanged full 54-sample matrix.

## Acceptance and action

- **R0.2:** `MEASURED_NOT_ACCEPTED` — original exploratory Windows data measured, focused attribution not yet measured.
- **G05:** `UNVERIFIED`. Missing robust paired samples, real visually ready time, React commits/Profiler duration, whole-process CPU, final-surface contrast and interaction thresholds. No auto-PASS.
- **Only Active Next Action:** execute one targeted, exact-SHA Windows QA package in the authorized local workspace if the actor has permission, and analyze its one ZIP. If execution unavailable, stop at a single factual blocker; no unrelated refactor, no merge/ratify/publish, no Reviewer A/B mutation.
