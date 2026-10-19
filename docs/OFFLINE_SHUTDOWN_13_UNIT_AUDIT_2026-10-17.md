# BaumanWeb · 13-Unit Graceful Shutdown Audit · 2026-10-17

**Authority:** Blueprint OS 1.3.0 · PR #360 Draft · no merge/publish.
**Audit base:** Application-Management PR `bbc0c3469227db6ac920b33c4f033ae75f028cb7`.
**Source:** GitHub repositories at the exact main SHAs recorded in `control/local-ops-shutdown-evidence.json`.
**Conclusion:** **0/13 full graceful drain+exit attestations**. Three *candidates* have an existing HTTP `server.close` path but none has production D1/in-flight drain and process-bound exit proof. **Full-stack auto-restart stays BLOCKED.**

| Unit | Exact code source | D1/state drain evidence | IPC/HTTP shutdown & exit | Windows real test | Gate |
|---|---|---|---|---|---|
| run-all | Application-Management `scripts/run-all.mjs` | Nested writes unproven | IPC preflight explicitly UNSUPPORTED; legacy `taskkill /F` on Windows | None | BLOCKED |
| run-local-system | Application-Management `scripts/run-local-system.mjs` | 5 local D1 migrations; no flush proof | IPC preflight UNSUPPORTED; legacy `taskkill /F` | None | BLOCKED |
| ADMIN | Application-Management core `npx vite:3000` | learning-management-db D1; no in-flight drain | No per-child IPC/HTTP drain or exit ACK | None | BLOCKED |
| HEALTH | Health_Care `wrangler.local.jsonc`; Vite:3001 | health-care-local-db D1 | No authenticated drain/exit ACK | None | BLOCKED |
| RU | RU_LIFE `wrangler.local.jsonc`; Vite:3002 | ru-life-local D1 | No authenticated drain/exit ACK | None | BLOCKED |
| BAUMAN-CONTROL | Bauman-master-ai-system `control-service/wrangler.local.jsonc`; Wrangler:3003 | bauman-control-local D1 | No authenticated drain/exit ACK | None | BLOCKED |
| BOI | BOIECH_AI `boi-ech/wrangler.local.jsonc`; Vite:3004 | boi-ech-local D1 | No authenticated drain/exit ACK | None | BLOCKED |
| BAUMAN-RUNTIME | Bauman-master-ai-system `scripts/serve-local-runtime.mjs`; Node:3005 | Static HTTP file reads, no local D1 binding in server | SIGINT/TERM `server.close` but 1500ms forced exit; no drain ACK | None | CANDIDATE ONLY |
| GROWUP-CONTROL | GrowUP_MyChildren `control-service/local-control.mjs`; Node:3007 | Synchronous JSON state save, no verified flush contract | No explicit shutdown/exit handler or authenticated drain ACK | None | BLOCKED |
| GROWUP | Application-Management `scripts/run-all.mjs`; Node static:3006 | Static file reads, no local D1 binding in server | `server.close` present; parent may exit before close callback | None | CANDIDATE ONLY |
| PRICE-CONTROL | PriceReport_Tunggiabao `control-service/wrangler.local.jsonc`; Wrangler:3009 | price-report-control-local-db D1 | No authenticated drain/exit ACK | None | BLOCKED |
| PRICE | PriceReport_Tunggiabao `package.json`; Vite:3008 | No server D1 binding shown; browser state separate | No authenticated drain/exit ACK | None | BLOCKED |
| NC03 | NC03_Modem `scripts/serve-local.mjs`; Node:3010 | No D1 binding verified; modem actions may be active | SIGINT/TERM `server.close` exists, no modem operation drain ACK | None | CANDIDATE ONLY |

## What is and is not actually verified

- Source paths and relevant code features were inspected via GitHub, including source SHA recorded for each unit. `control/local-ops-shutdown-evidence.json` is the machine-readable evidence contract; no review or acceptance authority is implied.
- Existing Windows GitHub Actions proves the **supervisor IPC coordinator with synthetic 13-unit acknowledgments, Git fixture source SHA, helper session token rotation, and isolated D1 fixture writes**. It **does not** prove any of the 13 *real* services safely flushes and exits on Windows.
- Windows-specific process risk: `npx.cmd`/Vite/Wrangler children may have grandchildren; a parent exit or a freed TCP port is not a proof all SQLite/D1 transactions committed. Existing legacy `taskkill /F` remains unsafe as a restart mechanism.
- Genuine prerequisites for each unit are process ownership, a nonce-bound authenticated shutdown channel, stop-accepting-new-requests, bounded in-flight request count reaching 0, verified persistence/transaction commit as applicable, exit completion evidence, and TCP release readback. Those requirements must be tested on Windows with the real application before the unit may be promoted.
- `scripts/local-ops-shutdown-evidence.mjs` provides a **read-only** local source audit, e.g. `node scripts/local-ops-shutdown-evidence.mjs --workspace C:\\BaumanWeb`. It never starts/stops apps, writes D1, changes repo branches, or authorizes releases. Results remain `ready:false` even when exact Git HEAD matches: source provenance is **not** runtime drain evidence.
- Honest next implementation order: (1) make `run-all` and `run-local-system` never force-close under graceful mode and wait for ACK; (2) introduce per-child drain/exit adapter on supported Node endpoints; (3) handle `npx.cmd` process ancestry and Wrangler D1 persistence/quiescence; (4) Windows real offline full-stack QA; (5) Blueprint review. Until then `run-all` correctly returns UNSUPPORTED and auto-restart remains disabled.

## Current machine verification

For each unit: **actualDrainAttested=false, actualExitAttested=false, autoRestartApproved=false**. Do not mistake a GitHub Actions green badge, source-compatible script or simulated shutdown ACK for a real Windows acceptance.
