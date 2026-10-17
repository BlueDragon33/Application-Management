# Source Repo D1 Instrumentation Checkpoint · 2026-10-17

**Coordinating Draft:** [Application-Management PR #360](https://github.com/BlueDragon33/Application-Management/pull/360) at parent baseline `400c8d4d78a34d48403957e706be80380b60d1e7`.
**Safety:** Offline-first, no merge, no Production/Preview, Blueprint OS 1.3.0 ratification pending.

| Unit | Draft PR / SHA | Worker entry wired | Windows + Linux CI | Real shutdown authority |
|---|---|---|---|---|
| BAUMAN-CONTROL | [Bauman #366](https://github.com/BlueDragon33/Bauman-master-ai-system/pull/366) · `caf96b51400fbce74bf86e0f30cc178e3b140eb5` | `control-service/src/automation-contract.ts` tracks actual per-request D1 operations | [Offline D1 Observer workflow](https://github.com/BlueDragon33/Bauman-master-ai-system/actions/runs/38998280819) PASS both OS | **BLOCKED** |
| PRICE-CONTROL | [Price #133](https://github.com/BlueDragon33/PriceReport_Tunggiabao/pull/133) · `ff36f4ee8dc935aea25b0c0043bbcdaee100009b` | `control-service/src/index.ts` tracks actual per-request D1 operations | [Offline D1 Observer workflow](https://github.com/BlueDragon33/PriceReport_Tunggiabao/actions/runs/38998290242) PASS both OS | **BLOCKED** |

## Actual implementation and evidence

- Both Worker entrypoints wrap `env.DB` using `local-d1-observer.ts` and count active asynchronous D1 `prepare().bind().run/first/all/raw`, `batch`, and `exec` operations during real fetch execution. CI strict typechecks and existing contract tests the actual Worker bundle.
- The Workers deliberately expose `/_local/ops/drain-preflight` as **503**, with fixed `WORKER_ISOLATE_D1_DRAIN_UNVERIFIED` status and no mutating control. Do not treat per-isolate counters as a full-stack drain ACK. No remote shutdown endpoint has been enabled.
- The new GitHub Actions jobs on Windows and Ubuntu use **real Wrangler D1 local** with disposable `--persist-to` storage, performing CREATE→INSERT→SELECT→UPDATE→SELECT over five independent Wrangler Node subprocesses. These readbacks demonstrate local SQLite persistence but **not** a multi-isolate Worker transaction barrier during a process tree shutdown.
- Additional tests exercise pending D1 promise counts, `run`, `first`, `batch`, `exec`, failed D1 operations, and 503 fail-closed response. No personal/local user D1 store was touched.
- Full Windows `npx.cmd`/Wrangler child-tree exit, SQLite D1 flush during real active request, independent service PID/nonce/SHA receipts, all Worker isolates quiescent and graceful close completion remain **UNVERIFIED**. Source draft PRs are not merged into main, so user runtime is NOT running this instrumented version.
- All **10/10 BLOCKED**, including both controls, stay `ready=false`, `approved=false`, `permitAutoRestart=false` in `control/local-ops-blocked-adapter-plan.json`; 13/13 full-stack shutdown preflight still UNSUPPORTED.

## Next technical gate

Per source repo, add a trusted Windows-local supervisor → Worker/Miniflare shutdown mechanism with **real** D1 in-flight request accounting across all isolates, a durable commit/readback barrier and bound process-exit proof. Worker isolates cannot by themselves attest Windows PID descendants or claim cross-isolate drain. Proceed per service with fail-closed negative tests; no fake completion.
