# Multi-isolate ACK & process-bound graceful gateway QA — 2026-10-17

**Blueprint OS Constitution:** 1.3.0. Coordinating [Application-Management Draft PR #360](https://github.com/BlueDragon33/Application-Management/pull/360). **NEVER self-review, merge, publish, ratify, or set READY.**

## Authoritative review/GitHub source readback (checked in-session)

| Unit | PR head (Draft) | Current remote main | Reviews | Admission |
|---|---|---|---|---|
| BAUMAN-CONTROL | [Bauman #366](https://github.com/BlueDragon33/Bauman-master-ai-system/pull/366) `0afe07e7e0f1d8cfd0dec66e887a3545f4e27947` | `34cf28ee66e51c0bbca42ac248830075fd9ae2d9` | **0** | BLOCKED |
| PRICE-CONTROL | [PriceReport #133](https://github.com/BlueDragon33/PriceReport_Tunggiabao/pull/133) `d6e910e6c0c7b0cdb1a395381f2be0d65eb7ca3d` | `9e8df71f2839989b067af79ef22c389f541664e5` | **0** | BLOCKED |

The Bauman **main advanced** since the previous checkpoint. A previously recorded `sourceMainAtAudit` is historic, NOT its current SHA; current main must be read back before any admission. Source check via Git is necessary but does not prove the reviewer approved the actual source build. No caller-provided `reviewed:true` or local review data can authorize startup.

## New fail-closed evidence modules

1. `scripts/local-ops-isolate-drain-ledger.mjs`: HMAC-SHA256 authenticated, freshness/sequence checked intake of drain ACK **from a declared set**. Each receipt is tied to service, boot nonce, process PID and exact source SHA, isolate ID, closed read/write admission, zero active request/D1 transactions, all-binding instrumentation flag, durability readback and commit barrier. Rejects modified MAC, wrong PID/nonce/SHA, stale/duplicate/replay, unknown isolate, active writes or missing barrier. Every status **explicitly** says `authoritativeRuntimeIsolateInventory=false`, `allWorkerIsolatesDrained=false`, `permitShutdown=false` and `autoRestartAllowed=false`, even if every declared isolate signs a healthy receipt. Cloudflare Workers does not supply an independently attested exhaustive isolate enumeration through this module.
2. `tests/fixtures/local-ops-graceful-gateway-child.mjs` + `scripts/local-ops-process-bound-gateway-qa.mjs`: spawn a **real disposable Node IPC child** on Windows/Linux. The parent supplies a fresh nonce, SHA and request ID through an owned IPC channel, confirms actual child PID and loopback listening port, holds an HTTP request, checks that an early stop is denied, verifies incorrect nonce is denied, releases the request, receives ACK only after Node HTTP listener closes, independently waits for process exit and rebinds the listening port. Windows also checks captured child PID descendants are gone.
3. The process-bound child is **NOT** Wrangler, Vite, Cloudflare Worker nor a real D1 writer. It proves only how a separately managed **Node gateway fixture** can be drained and closed safely; actual Wrangler D1 still needs its own independent stop authority and D1 commit barrier. The separately existing real temporary Wrangler+D1 in-flight fixture tests real D1 persistence, but its SIGTERM is **only QA teardown**, not a graceful Worker shutdown ACK. These are distinct evidence scopes and must NEVER be merged into an imagined full-stack PASS.

## Mandatory fail-closed conditions

- Both control-source PRs remain Draft with zero GitHub reviews and are not admitted to the live managed BaumanWeb stack.
- **10/10 BLOCKED**, **0 READY**; source admission, global isolate inventory, all D1 bindings, stop ACK from real Wrangler, windows process exit and full managed port release are still unverified. Full-stack auto-restart stays disabled.
- Missing **Hướng dẫn · Next Action** in the real App Manager UI causes required Windows/Linux regression to FAIL. No merge/publish or automated ratification.

## Next safe action

Implement a runtime-owned *exhaustive* worker request/isolate inventory or an alternate provider-backed quiescence barrier for the real BAUMAN-CONTROL and PRICE-CONTROL Worker deployments, then process-bound graceful Wrangler exit without taskkill and perform live Windows BaumanWeb reception after independent source review and verified exact SHA. Do not convert declared-set receipts into global runtime authority.

## Refreshed source review and malformed ACK quarantine (this checkpoint)

- Read-only GitHub review lookup: Bauman #366 and PriceReport #133 both still Draft with **zero reviews** and no merge. At this audit, Bauman `main=cec06d57df9d3224239213a6f08c4e184a2121cb`; PR #366 is **27 commits behind main / 5 ahead**. PriceReport `main=9e8df71f2839989b067af79ef22c389f541664e5`; PR #133 is **0 behind / 10 ahead**. These are observations, not source admission, and may change again.
- `createIsolateDrainLedger()` now copies the declared isolate array at ledger construction so callers cannot mutate the expected inventory after initiation. A bad MAC, unknown isolate, stale frame, failed D1 barrier or replay **taints the current ledger attempt**: even if all declared IDs later return valid ACKs, `declaredSetComplete` remains false. This is stricter audit semantics only; exhaustive Cloudflare isolate count still never claimed.
- Disposable real Node IPC gateway now requires child-supplied process PID on commands and verifies nonce/PID/SHA for both boot and stop-preflight. Negative Windows/Linux tests reject mismatched source SHA and PID, in addition to old nonce and in-flight cases. It is **not** the real Wrangler lifecycle.
