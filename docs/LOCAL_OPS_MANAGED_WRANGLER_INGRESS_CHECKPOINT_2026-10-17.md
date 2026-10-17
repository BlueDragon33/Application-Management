# Managed-local Wrangler ingress: Draft-only security and safety checkpoint

**Date:** 2026-10-17. [App Manager PR #360](https://github.com/BlueDragon33/Application-Management/pull/360).
Child Drafts: [Bauman #366](https://github.com/BlueDragon33/Bauman-master-ai-system/pull/366) and [PriceReport #133](https://github.com/BlueDragon33/PriceReport_Tunggiabao/pull/133).

## Implemented and inspected

- The actual Worker fetch entrypoints on both child Draft branches now enforce an opt-in `LOCAL_OPS_GATEWAY_REQUIRED=1` mode. In that mode, HTTP direct to Wrangler backend without matching per-boot `x-local-ops-ingress-proof` returns **403**; when the setting is enabled with an invalid/missing secret, the Worker returns **503**. The default nonmanaged deployment has no behavior change.
- `scripts/local-ops-wrangler-ingress.mjs` accepts an opt-in high-entropy `managedIngressProof`, **strips** any caller-supplied proof header and injects its own. Real localhost integration tests verify forged direct backend requests get 403, gateway-owned forwarding works, and no boot proof leaks via `status()`.
- The legacy `run-all` and `run-local-system` **do not yet switch production-shaped ports 3003/3009** to hidden backend ports. The child Worker source changes exist only on Draft PR branches and the central launcher requires verified `main` source snapshots. Enabling the guarded gateway on an unupdated `main` would fail source readiness, or give false confidence. Runtime integration remains **BLOCKED** until child changes can be reviewed and admitted through official gates.
- **Same-user process threat:** Wrangler `--var` puts proof values in command-line arguments; a local process running under the same OS account may inspect them. An HTTP 403 test is **not evidence of an unbypassable OS-level security boundary**. Before integration, establish protected per-runtime secret delivery or equivalent boundary, verify all request entrypoints, and test direct backend access under Windows on actual child processes.

## Pinned toolchain blocker

PriceReport #133 now pins Wrangler **4.151.1** and `@cloudflare/workers-types` **5.20261016.1** together in the npm-generated package-lock; a CI `npm ci` + `npm run gate` verifies the consistent graph. Previously locked Wrangler 4.92.0 could not execute the Worker compatibility date 2026-09-22; the new lockfile removes that toolchain mismatch on the unmerged source branch only. Do not claim the user's local installation was upgraded.

## Next production-shaped safety conditions

1. Review & stage child source commits without bypassing Blueprint gates. Ensure main-versioned source matches the exact loaded Worker build; no silent self-approval.
2. Bind gateway to client-facing 3003/3009, Worker to a verified internal port and prove boot identity + all HTTP entrypoints require gateway authentication; securely deliver the per-boot secret without argv exposure.
3. Quiesce all Worker isolates, reject new mutating work, wait for every real D1 write, then independently perform durable commit/readback validation. Proxy request count alone is insufficient.
4. Only after authenticated process-bound stop ACK, graceful Windows descendant exit, all source SHA readback and managed ports release may a single-unit READY be proposed for external review.

**Current:** 10/10 BLOCKED; two actual Worker ingress guards implemented in Draft, not live; no real child shutdown; auto-restart disabled. No merge, no publish, no Blueprint self-ratification.
