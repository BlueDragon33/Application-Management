# R0.2 — 40-case focused Windows QA evidence review

**Status:** R0.2 = MEASURED_NOT_ACCEPTED; G05 = UNVERIFIED. This is an evidence report under the **existing canonical ledger**, not a second approval ledger.

**Source:** User-uploaded local `r02-evidence-package(1).zip`, independently opened and validated (ZIP CRC OK), SHA-256 `e7706007c9bb3670c7052d6ed9eed0bbb0a5453f3946503139a35b09b5970cb4`. Archive contains `runner-evidence/r02-evidence.json`, two Vite logs, eight real Chromium screenshots, one bundle summary, and owned runner stdout/stderr. No raw screenshot, host identity, credentials, or whole ZIP is published here.

**Time:** 2026-11-22T21:55:58.482Z to 22:02:49.459Z (UTC). Native Windows, Chrome `157.0.8103.79`, Node `v24.15.0`, isolated D1 and local loopback QA. Baseline `89a89ce2d3d8ed634ee9562c52744a99223a2b2a`, PR #417 `92f7fbf6e3b1664d2431694fc5aeaef5b27df5c6`; SHA-pinned runner `efabe0ee9b5d7ef5f421bc29daeb874c1867dad9`.

## Quality of observed evidence

- Exactly **40/40** browser sessions: four strata (50 apps mobile; 200 apps desktop/tablet/mobile) × two variants × five repetitions. **40/40 HTTP 200**, **40/40** matched app API counts, **4/4** independent Wrangler **local** D1 count readbacks matched, 0 Playwright request failures, 0 page JavaScript errors; QA teardown reports both owned worktrees and session removed.
- **40/40** expected card grids actually rendered: **66** cards with 50 fixture apps and **216** with 200 fixture apps (including 16 built-ins). Two `requestAnimationFrame` callbacks after card DOM appearance form the **visual-paint proxy**, not a compositor/physical-display timestamp.
- **40/40** React DevTools hook observations; commits counted **on the whole page and through the later filter interaction**, not scoped to the dashboard or equivalent to React Profiler render duration.
- **40/40** filter input-to-two-RAF DOM response measurements; this is not physical input-to-photon latency or a production interaction SLA.

## Direct focused comparison (p50, n=5 per variant and stratum)

| Apps | Viewport | Painted-grid proxy baseline → candidate (ms) | Change | `/api/operations` browser timing baseline → candidate (ms) | Whole-page React commits p50 | Filter input-to-2RAF p50 (ms) |
|---:|---|---:|---:|---:|---:|---:|
| 50 | Mobile 390×844 | 2967 → 2770 | −6.6% | 2093.5 → 2072.4 | 15 → 10 | 11.7 → 11.2 |
| 200 | Desktop 1440×900 | 3024 → 2959 | −2.1% | 2069.9 → 2074.2 | 15 → 10 | 17.3 → 27.6 |
| 200 | Tablet 800×900 | 2901 → 2955 | +1.9% | 2071.6 → 2073.5 | 15 → 10 | 32.3 → 17.3 |
| 200 | Mobile 390×844 | 2966 → 2993 | +0.9% | 2064.6 → 2072.1 | 15 → 10 | 15.1 → 14.7 |

The earlier n=3 preliminary readyMs slowdown of +6.6/+8.5/+9.8% at 200 apps **did not replicate** in this n=5 fully-rendered-grid measurement. The earlier `readyMs` measured JSON/bootstrap/shell, not all painted cards. Both studies run all baseline samples before candidate samples and are susceptible to order/cache/noise effects; do not present this as statistically proven noninferiority or a definitive improvement.

**API vs UI:** browser `/api/operations` latency remains ~2.07 s at 200 apps in both variants; request payload ~622,702 JSON bytes for 200 fixtures, and 107 total requests per browser session in either variant. Main client authentication and `/api/center` have fast request logs compared with `/api/operations`. Browser TTFB is almost the entire API request duration, not transfer. No per-specialized-loader spans have been captured, so the exact source of the ~2.07 s cannot be assigned to any app. `buildBootstrap` concurrently awaits seven specialized adapters and the Dynamic Catalog; this is a *candidate critical path*, not a proven per-loader root cause. PR #417 does not change that backend route.

**Render and resource signals:** 200-app desktop JS heap p50 **27.58 → 15.45 MB (−44.0%)**. Whole-page React commits p50 **15 → 10 (−33.3%)** on all four strata. At desktop 200, Chromium renderer startup TaskDuration p50 **617.7 → 605.4 ms** (−2.0%), while tablet/mobile show modest increases. Owned **Vite main Node PID** CPU delta desktop 200 p50 **0.281 → 0.266 CPU seconds**, with mixed results by viewport; this **excludes Chromium renderer, subprocesses, Workers and total system CPU**. No assertion of global CPU gain.

**Interaction:** 200-app desktop filter p50 **17.3 → 27.6 ms** (worse), tablet **32.3 → 17.3 ms** (better), mobile **15.1 → 14.7 ms** (similar). These are lightweight local DOM-response signals and cannot certify 100ms device ACK/200ms pending SLA; no consistent regression pattern.

**Contrast:** Eight real screenshots capture desktop/tablet/mobile grids. 50-mobile and 200-tablet/mobile screenshot pairs are byte-identical between revisions (200-desktop screenshots differ). For the tested desktop title, screenshot pixel and CSS colors `rgb(242,245,244)` on `rgb(10,15,14)` imply about **17.60:1** contrast for *that color pair*. Full-screen WCAG, gradient overlays, small controls, focus states and compositor-level contrast **UNVERIFIED**. Screenshots are not uploaded to the repository.

## Disposition / single next action

1. **No confirmed PR #417 startup performance regression** from this focused evidence; preserving its clock isolation is safer than an unsupported app rewrite.
2. The remaining **absolute** ~2.07s API bootstrap is real and common to both revisions; its *causal* internal path is **not measured**. Do not change timeout/authorization/D1 behavior without targeted spans.
3. **R0.2 = MEASURED_NOT_ACCEPTED, G05 = UNVERIFIED**; missing total CPU, robust paired and out-of-order repeat, React Profiler duration, full WCAG and production UX acceptance.
4. **One Active Next Action:** in QA-only, source-pinned context, instrument per-loader duration for seven specialized adapters and Dynamic Catalog without exposing secrets, with one owned local read-only probe; only propose a minimal code fix if a real critical-path cause is identified. Do not repeat unchanged 54/40 browser matrices, touch Reviewer A/B, trigger Production, merge or publish.
