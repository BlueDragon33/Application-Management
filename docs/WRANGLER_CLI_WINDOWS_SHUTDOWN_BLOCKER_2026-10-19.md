# Blueprint OS 1.3.0 — Wrangler CLI native shutdown: Windows QA blocker (2026-10-19)

Scope: Application-Management **candidate branch only**, disposable local QA. This document is an investigation, not a ratification, user acceptance, or permission to stop/restart any runtime.

## Existing exact-SHA evidence (do not rerun unchanged tests)

- Original candidate `8c84784f73f653cc99d6a8851e9b1f4bda822a60`: actual owner Windows Node v24.15.0 log readback proves seven tests / seven pass / zero fail; exit status was **not recorded** (`PASS_LOG_ONLY`).
- Source log classifier candidate `4aca5e84454d710d260101677a3d1f8a8341a6d7`: owner Windows detached-worktree readback, original report preserved, main checkout unchanged.
- Existing `scripts/local-ops-wrangler-api-process-bound-qa.mjs` proves disposable Wrangler **API** `unstable_dev().stop()` and local D1 readback, explicitly **not** graceful shutdown of an independent `wrangler dev` CLI.
- Existing `scripts/local-ops-real-wrangler-drain-smoke.mjs` uses `SIGTERM` only for disposable fixture cleanup. Its positive persistence readback cannot certify CLI graceful exit.
- Bauman PR #366, PriceReport PR #133, App-manager PR #360 remain Draft, 10/10 adapters BLOCKED, zero READY.

## Root cause: no verified native Windows CLI stop acknowledgement

1. On Windows, Node `subprocess.kill('SIGINT')` and `subprocess.kill('SIGTERM')` terminate the target abruptly; they do not run a verifiable graceful CLI shutdown callback. **Never count such a kill as a graceful ACK.**
2. Wrangler `dev` supports an interactive terminal session with `[x] to exit`. A non-interactive `child_process.spawn` with piped stdio / `CI=1` cannot assume this prompt or that `x` works; even observed exit is not a cryptographically bound `nonce/PID/SHA` acknowledgement.
3. Cloudflare documents `unstable_dev().stop()` for a **programmatic API-owned runtime**, not as an external stop command for an independent `wrangler dev` CLI process.
4. Local ingress drained is not proof of workerd `waitUntil` / background D1 writes drained; per-Worker isolate counters are not a global isolate census. A row readback alone is not a commit barrier across bindings.
5. Windows CLI process exit does not prove the entire captured subprocess tree terminated or both gateway and backend loopback ports were released.

Sources, checked 2026-10-19:
- https://nodejs.org/api/child_process.html#subprocesskillsignal
- https://nodejs.org/api/process.html#signal-events
- https://developers.cloudflare.com/workers/wrangler/api/
- https://developers.cloudflare.com/workers/wrangler/commands/workers/
- https://github.com/cloudflare/workers-sdk/issues/4131
- https://github.com/cloudflare/workers-sdk/issues/7025

## Technical implementation

`scripts/local-ops-wrangler-cli-stop-probe.mjs` is a **read-only, fail-closed native CLI capability experiment**. It verifies the detached worktree's exact HEAD and declared pinned Wrangler version; classifies Windows SIGINT/SIGTERM, interactive `x`, Ctrl+C, API `stop()`, and no stop mechanism. It intentionally refuses every route without a provider/CLI-native authenticated shutdown barrier. It does **not** spawn Wrangler, install packages, start D1, kill processes, listen on ports, delete storage, or modify the checkout.

Safe command from a detached Windows QA worktree at the newest candidate SHA:

```powershell
node .\scripts\local-ops-wrangler-cli-stop-probe.mjs --expected-sha (git rev-parse HEAD)
```

Expected state: `BLOCKED_NO_AUTHENTICATED_CLI_GRACEFUL_STOP`, `stopAuthorized=false`, `autoRestartAllowed=false`, `cliRuntimeSpawned=false`, `d1Touched=false`. Exit code 0 means only that **inspection completed**, not that CLI shutdown passed.

## Conditions before any direct CLI Windows test with temporary D1

**Do not launch a new headless Wrangler CLI with only `child.kill()` available for cleanup**; a hung test can leave workerd processes and open ports. Require, in order:

1. An owned isolated process / console session with a **verified** CLI-native cooperative exit transport (not merely `x` written to a pipe or console-group broadcast).
2. Gateway close to new requests and independently enforced backend admission control.
3. Source-level coverage of all D1 bindings, `waitUntil` background writes, active requests, and a verifiable isolate inventory. No unchecked event or direct ingress route.
4. No background D1 work; independent Wrangler CLI local persisted-storage readback with a proper commit barrier, using **disposable** storage.
5. Supervisor/child nonce, own PID, exact Git SHA and request ID authenticated acknowledgements; reject mismatches/replay.
6. Cooperative shutdown ACK followed by actual exit; capture and recheck Windows descendant PIDs and verify both temporary ports can be rebound.
7. Windows test log and explicit result at exact SHA, then required CI and independent quality review; only then consider a draft gate change. Never automatically ratify.

Absent any one requirement: `D1_GLOBAL_QUIESCENCE_BLOCKED`, `WINDOWS_WRANGLER_CLI_ACK_UNVERIFIED`, `10/10 BLOCKED`, `0 READY`, `CI PENDING`, `NO AUTO-RESTART`. Do not merge/rebase/publish or trigger GitHub-hosted Actions simply to rerun already-passed evidence.
