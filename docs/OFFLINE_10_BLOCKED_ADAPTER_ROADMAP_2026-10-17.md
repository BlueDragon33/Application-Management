# BaumanWeb · Adapter roadmap and safely implemented foundations

**Scope:** Application-Management PR #360, draft only. **Authority:** Blueprint OS 1.3.0 (not self-approved). **Audit date:** 2026-10-17.

The source-backed 13-unit audit is `control/local-ops-shutdown-evidence.json`. The machine-executable 10-unit roadmap is `control/local-ops-blocked-adapter-plan.json`.

## What was actually implemented in App Manager

1. `scripts/local-ops-managed-process.mjs` maps managed `npx.cmd vite` or `npx.cmd wrangler` to a verified, installed **local Node binary** without invoking the Windows `cmd.exe → npx.cmd` chain. It refuses a missing or symlink-escaped binary; unrecognized/pinned wrappers remain **unverified** and cannot imply safe drain. Only managed launches opt into the direct mapping; interactive/manual behavior remains unchanged. `run-all` and `run-local-system` now call the adapter before spawning managed child services.
2. `scripts/local-ops-windows-process-tree.mjs` makes a **read-only** process ancestry snapshot from Windows CIM, captures PID descendants before any attempted graceful shutdown, and requires them all to disappear **after** the managed parent exits. It cannot stop processes, cannot verify D1 durability, and fails closed if enumeration is unavailable. On non-Windows, existing child-exit and port gates remain.
3. `scripts/local-ops-drain-adapter.mjs` is a request/transaction gate scaffold. It denies new operations after drain starts, waits for pending requests and transactions, and requires explicit `verifyDurable`, `onStopAccepting`, `onClose` callbacks. Unless an actual service supplies these hooks, it refuses to claim drain.
4. `scripts/local-ops-runtime-drain-preflight.mjs` is a strict **local-only** per-service receipt verifier at `127.0.0.1`, requiring the exact source SHA, boot nonce, process PID, complete request/D1 hook coverage, zero pending work, durable storage readback and graceful-exit capability. HTTP 302, missing credentials, missing endpoint and mismatched receipt fail closed. A successful receipt is *pre-stop evidence only*, never a full-stack restart approval.
5. Tests exercise live local fixtures on Windows/Linux, simulated in-flight writes, timeout/incorrect ACK rejection, direct process PID launching, read-only PID genealogy, and forged runtime receipts. These tests **do not provide 10 real services' drain/exit proof**.

## Ten blocked units — implementation sequence

| Unit | Adapter | Storage/drain dependency | Actual gap |
|---|---|---|---|
| `run-all` | supervisor IPC | child DAG includes multiple D1s | Force-stop legacy branch, no 13-unit true ACK |
| `run-local-system` | nested supervisor | health/RU/Bauman/Boi/Admin D1 | Cannot attest nested `npx.cmd` descendants or durable writes |
| `ADMIN` | direct local Vite + receipt verifier | learning-management-db | No integrated request+DB transaction hooks |
| `HEALTH` | direct local Vite + receipt verifier | health-care-local-db | No authenticated drain endpoint or durability ACK |
| `RU` | direct local Vite + receipt verifier | ru-life-local | No authenticated drain endpoint or durability ACK |
| `BAUMAN-CONTROL` | direct local Wrangler + receipt verifier | bauman-control-local | Wrangler worker D1 writes cannot be inferred from HTTP health |
| `BOI` | direct local Vite + receipt verifier | boi-ech-local | No app-owned request/DB instrumentation |
| `GROWUP-CONTROL` | Node JSON drain | JSON state registry | Need atomic durable file commit/close ACK, no signal handler today |
| `PRICE-CONTROL` | pinned-wrapper audit + Wrangler receipt | price-report-control-local-db | Requested pinned `wrangler@4.136.3` may not match local package; wrapper PID and D1 drain unproven |
| `PRICE` | direct local Vite + receipt verifier | browser state/unknown writes | No app-owned exit/drain receipt |

## Required gates before an individual service may advance

- Source-specific implementation and tests in that **service's own repository**; the hub must not falsely approve child code it does not run.
- Prove that the managed child is the correct local process (path, PID, SHA, boot nonce), **including Windows descendants** and no unexpected `npx.cmd` wrappers.
- Drain: stop accepting new requests/writes, prove outstanding operations reached zero, prove all real D1/SQLite writes durable, then issue a bound ACK; never infer transaction commit from port close or a fixture.
- Commit shutdown only after complete preflight; observe actual process exit and port release; reject PID survivors or write/readback mismatches.
- Run offline-first Windows cold-start/modify/store/restart/readback against **isolated non-user fixture first**, then human-reviewed production-shaped machine acceptance. Avoid `taskkill /F`, remote D1 and deployment.

## Five work waves and honest status

The ordered waves are `process-ownership → runtime-drain → sqlite-d1 → supervisor-commit → acceptance`. The code above implements **foundational pieces** for process-ownership, receipt verification and an instrumentable drain library only. The real 10 units still have `ready=false`, `approved=false`, `permitAutoRestart=false`; both `run-all` and `run-local-system` still advertise `UNSUPPORTED` in actual IPC preflight. **Do not enable full-stack auto-restart.**

Windows GitHub Actions is genuine Windows for the fixture tests, but it is **not the user's installed BaumanWeb** and does not validate full live application D1 shutdown. Preview/Production publication remains explicitly held.
