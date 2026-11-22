# Academic Workspaces — local browser acceptance runbook (2026-11-09)

**Source scope:** Application-Management PR #383. **Application code baseline:** `0b88edae530a986839ca629f863687c45063ff3c`; select and verify the latest exact PR HEAD when running the optional browser harness. **Constitution:** Blueprint OS 1.3.0, B4. **Release:** HOLD / DRAFT; no production or preview publication.

## Evidence ledger (do not conflate gates)

| Gate | Status | Evidence |
|---|---|---|
| Real TSX in simulated DOM: Next Action button + navigation/focus | PASS on Node/jsdom | `tests/academic-workspaces.dom-qa.test.mjs` |
| Invalid/cross-account data, JSON import/export, cross-tab guard | PASS on Node/jsdom for exercised paths | Same test and domain test |
| Keyboard file import can receive focus | PASS in DOM; physical browser still unverified | Same test; visually clipped rather than `hidden` input |
| Authored input/project/button computed CSS colors | PASS in DOM for selected pairs only | Same test; not real browser/gradient or theme proof |
| Full regression + production-shaped build | PASS | Exact-SHA CI runs referenced in PR checkpoint |
| Chrome desktop real browser + DevTools responsive | **BLOCKED** | No checked-out repository/local server in connected execution host; no candidate URL |
| iPhone Safari actual device | **BLOCKED** | No authorized candidate origin; loopback-only `LOCAL_DEV_AUTH` must not be exposed over LAN |
| Real browser computed-contrast + screen-reader / keyboard, mobile Safari | **UNVERIFIED** | No authenticated browser session for candidate |
| Offline installed cold start | **UNVERIFIED** | Local web-dev server is not proof of an installed offline app |
| Production/merge | **HOLD** | Owner and independent technical acceptance pending |

## Local reproducible QA — desktop only (no provider, cloud or production mutation)

Prerequisites: owner-controlled laptop with **existing** checkout of `BlueDragon33/Application-Management`, Node >=22.13 and npm; dependencies may need prior installation while internet is available. Do not use an untrusted repository mirror.

1. From the **Application-Management repository directory**, use `git fetch origin`, then `git switch --detach 0b88edae530a986839ca629f863687c45063ff3c`. Verify `git rev-parse HEAD` returns that exact SHA; never test arbitrary `main` and attribute results to PR #383.
2. If needed, run `npm ci --no-audit --no-fund` (dependency install is local; no new external service). Run `npm run local`. The existing `scripts/run-local.mjs` creates local-only `.dev.vars` if absent, confirms `LOCAL_DEV_AUTH=1`, applies local D1 migrations, and launches Vite at `http://127.0.0.1:3000`. **It does not migrate remote D1.** Keep secrets untracked. Do not copy `.dev.vars` to Production.
### Automated local Chromium check (opt-in; never Production)

The existing `npm run local` serves only on `127.0.0.1:3000`. The additional script `scripts/academic-workspaces-browser-qa.mjs` exercises real Chromium against that loopback instance, **without adding Playwright to application runtime dependencies**. It refuses any URL override, demands a clean tracked worktree and exact HEAD SHA, creates a disposable browser profile, and blocks browser requests to non-loopback origins. Reports and 320/375/430/768/1280px screenshots are saved under a temporary OS directory. It does not touch deployment or remote D1.

On Windows PowerShell, use two local terminals in the same source checkout:

```powershell
# First terminal: after checkout of the exact PR HEAD and verifying 'git status' is clean
npm run local
```

```powershell
# Second terminal: from the same Application-Management checkout
# Only if the optional Playwright Chromium dependency is not already available:
npm install --no-save --package-lock=false --ignore-scripts --no-audit --no-fund playwright@1.55.1
npx playwright install chromium

$expectedSha = (git rev-parse HEAD).Trim()
node scripts/academic-workspaces-browser-qa.mjs --sha $expectedSha
```

**Verify `$expectedSha` matches PR #383's current full 40-character HEAD before accepting results.** The automated runner is intentionally not called by the default CI, to avoid repeated browser downloads / GitHub Actions costs. It is an opt-in **local Chrome** check, never a substitute for Safari, actual device touch, VoiceOver, full gradient-composited WCAG verification, or owner acceptance. A failure must be captured with the temporary QA report and repaired only on the allowed feature branch.

3. Open **desktop browser** routes:
   - `http://127.0.0.1:3000/tools/thesis-planner`
   - `http://127.0.0.1:3000/apps/coursework-workbench`
4. For Thesis: click **HƯỚNG DẪN / MỞ VIỆC TIẾP THEO**; inspect focus and scroll to the first incomplete milestone; populate topic and evidence, save, reload; export JSON and restore through native file picker. Verify data remains local and no approval is invented.
5. For Coursework: create two independent tasks with different subjects and due dates; switch and modify them; mark a milestone with evidence and confirm the other is not affected; navigate using Next Action; reload and verify both records; export and import JSON, compare state; reject invalid JSON without changing the original store. Always back up test data before destructive exercises.
6. Keyboard: from browser address bar, tab through navigation, headings with linked targets, text fields, Next Action, **Xuất JSON**, **Nhập JSON**. Verify visible focus ring on the import label when its file input receives focus; press Enter/Space on native input and verify picker opens. Then Esc cancels without mutating state. Confirm no essential flow requires a mouse.
7. Chrome DevTools device emulation: measure at **320, 375, 430, 768, 1280 CSS px**. Inspect for horizontal overflow, clipped controls, stacked grid, browser zoom, focus, textarea usability and keyboard overlap; attach actual screenshots with viewport dimensions. This is **emulated responsive QA**, **not** physical iPhone acceptance.
8. For contrast: read actual **getComputedStyle()** of normal text, actionable buttons, focus and hover, input boundaries, selected project and gradients at representative and worst positions; compare against composited backgrounds at WCAG 2.2 AA **4.5:1 normal**, **3:1 large text**, **3:1 meaningful non-text indicators**. Record element, selector, color, composited background, ratio and device/browser version. Do not rely solely on static CSS or the jsdom color test.
9. Open a second tab in the same test profile; edit state then verify the first tab locks conflicting writes and shows a recovery notice. Use a fresh browser profile for privacy test; **localStorage namespacing is not encryption and does not isolate people sharing one browser profile**.
10. Save exact SHA, build/test logs, screenshots, expected-vs-observed, PASS/FAIL per scenario and all omitted checks. Attach minimal redacted evidence to PR #383; never attach personal information, tokens or unpublished research.

**iPhone boundary:** The current `npm run local` binds to `127.0.0.1`, and `LOCAL_DEV_AUTH` accepts *only loopback Host*. Do **not** change it to `0.0.0.0`, expose insecure LAN authentication or create a public tunnel without explicit security architecture and owner approval. Physical Safari remains BLOCKED pending an owner-approved HTTPS Preview/local-device architecture with real auth and exact candidate readback; the Cloudflare Preview deploy workflow is currently intentionally dormant (`if: ${{ false }}`).

## Failure triage and release

- If route/auth fails: verify loopback host, `.dev.vars`, app boot, local D1 migrations and revision before touching feature logic.
- If browser UI fails: capture reproducible steps and DOM/screenshot evidence, repair **one scoped cause**, add a regression, rerun exact-SHA CI, then recheck same device.
- If check is unavailable: record `BLOCKED` or `UNVERIFIED`; **never** mark `NOT_RUN` as `PASS`.
- Independent reviewer + Owner must accept the actual device journeys. PR stays DRAFT, no merge or Production deployment. Core academic extraction is still deferred.
