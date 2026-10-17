# Managed Wrangler launch hard gate and actual Windows port readback — 2026-10-17

Status: **Draft technical checkpoint**, Blueprint OS 1.3.0; no merge, publish, ratification or live installation.

## Owned changes

1. `scripts/local-ops-managed-startup-policy.mjs` implements executable managed startup admission. Both `run-all.mjs` and `run-local-system.mjs` invoke it BEFORE dependency installation, D1 migrations or child spawn. Guarded source files AND independent review/exact-SHA/runtime authority are mandatory; current main sources are not admitted, so managed startup is BLOCKED.
2. `assertNoManagedArgvSecrets` refuses all managed `--var`, `*_SECRET` argv and unverified `npx` wrappers. Legacy/manual paths are unchanged and may still contain `--var` and `taskkill /F`; do NOT claim these are already removed globally. Managed startup rejects these paths before any mutation.
3. `scripts/local-ops-private-wrangler-proof.mjs` now supports temporary private `.dev.vars` with both gateway proof and other validated control-service bindings (no newlines, restricted binding keys, no reserved LOCAL_OPS overrides). Owner ACLs on Windows / 0600 on Linux. No secret in Wrangler argv or child process environment.
4. `scripts/local-ops-real-wrangler-drain-smoke.mjs` exercises real disposable Wrangler/Miniflare Worker, D1 in-flight write, private proof, bypass denial and durable readback. It now also rebinds former gateway/backend localhost ports after fixture exit (Windows/Linux) and checks Windows descendants separately. SIGTERM is fixture cleanup ONLY, not production graceful exit evidence.
5. Dashboard topbar, Offline Ops and Quick Actions retain the mandatory Hướng dẫn · Next Action control, checked by `tests/blueprint-guidance-required.test.mjs`. Missing required control or fabricated readiness causes CI FAIL / release gate hold; no fabricated approval.

## Source Draft references

- BAUMAN-CONTROL: https://github.com/BlueDragon33/Bauman-master-ai-system/pull/366 HEAD 0afe07e7e0f1d8cfd0dec66e887a3545f4e27947; real Windows/Linux Worker D1 gateway PASS, service-wide drain/exit BLOCKED.
- PRICE-CONTROL: https://github.com/BlueDragon33/PriceReport_Tunggiabao/pull/133 HEAD d6e910e6c0c7b0cdb1a395381f2be0d65eb7ca3d; real Windows/Linux Worker D1 gateway PASS, pinned Wrangler 4.151.1, service-wide drain/exit BLOCKED.

## Scope and remaining gates

Real user BaumanWeb stack ports 3000–3010 have NOT been restarted or accepted. The temporary private file's ACL does not prove isolation from a malicious process running under the SAME Windows user. The source PRs are still Draft, without official review/ratification. Managed startup therefore REJECTS instead of launching legacy processes with secrets in argv. 10/10 BLOCKED, auto-restart DISABLED. Real cross-isolate D1 drain, authenticated stop ACK, true service Windows exit, and full port readback remain prerequisites for per-unit READY.
