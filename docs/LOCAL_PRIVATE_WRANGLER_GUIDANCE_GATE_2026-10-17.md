# Blueprint OS 1.3.0 — Private Wrangler Secret & Guidance Gate (2026-10-17)

**Authority:** [Application-Management Draft PR #360](https://github.com/BlueDragon33/Application-Management/pull/360), no merge, publish or self-ratification.

## Actual verified implementation

- Child source Draft [BAUMAN-CONTROL #366](https://github.com/BlueDragon33/Bauman-master-ai-system/pull/366) at `0afe07e7e0f1d8cfd0dec66e887a3545f4e27947`: Windows + Ubuntu actual Worker/D1 localhost test [CI #39005447548](https://github.com/BlueDragon33/Bauman-master-ai-system/actions/runs/39005447548), both PASS.
- Child source Draft [PRICE-CONTROL #133](https://github.com/BlueDragon33/PriceReport_Tunggiabao/pull/133) at `d6e910e6c0c7b0cdb1a395381f2be0d65eb7ca3d`: Windows + Ubuntu actual Worker/D1 localhost test [CI #39005464711](https://github.com/BlueDragon33/PriceReport_Tunggiabao/actions/runs/39005464711), both PASS, using pinned compatible Wrangler 4.151.1.
- Both real source-worker CI tests run a restricted **temporary `.dev.vars` file** with random per-boot proof. The file belongs to an isolated disposable project and is removed after QA. On Windows the runner applies explicit current-user-only DACL via icacls; Unix uses 0700 dir / 0600 file. The proof is absent from Wrangler process argv and inherited process environment; only a temporary Worker binding and the gateway fixture know the value.
- The gateway fixture rejects direct backend requests without proof (HTTP 403), strips caller-provided proof, forwards an authenticated request and verifies migrated **real local D1** health and the application management contract. Shutdown preflight is intentionally 503.
- App Manager `scripts/local-ops-private-wrangler-proof.mjs` provides an equivalent per-boot private-file mechanism; test coverage and the actual temporary Wrangler/Miniflare D1 fixture are in Local Offline Smoke on Windows/Linux. **App Manager does not yet wire this to user ports 3003/3009** because the source changes are Draft and have not passed human review.

## Security limitations (strict)

- Private ACL mitigates access by **other OS users**. It does **not** establish unbypassability against a malicious process running under the **same Windows user** with access to the Wrangler process, its temp project or memory. The proof must not be described as an absolute same-user security boundary.
- Do not place `LOCAL_OPS_INGRESS_PROOF`, `*_CONTROL_SERVICE_SECRET` or other sensitive values into `--var` argv in managed mode. Existing legacy launcher paths still use `--var` for inter-app control secrets; **managed secret-safe startup remains BLOCKED** until all such values use a validated private channel and source MAIN SHA is admitted.
- No actual Windows BaumanWeb 7-app/13-unit shutdown is authorized. A private file, a 403, ingress drain of proxy-accepted requests, or D1 health/readback from temporary fixtures is insufficient for all-isolate D1 flush or safe process stop. App Manager `run-all` remains `UNSUPPORTED`; 10/10 blocked and 0 READY.
- Only real process-bound stop acknowledgments, complete D1 transaction drain, observed child tree termination and port readback can advance a unit, and Blueprint review is independent.

## Hướng dẫn / Next Action regression policy (technical enforcement)

The **Hướng dẫn · Next Action** control must stay available in the Offline Ops panel **and** in the persistent Management Quick Actions dock. It opens a concrete operational guide/Quality Gates and offers copying the continuation instruction; never enables auto-publish. `tests/blueprint-guidance-required.test.mjs` checks actual buttons, interactive handlers and blocked fallback; CI runs the test on Windows/Linux. The enforceable *consequence* of removing/disabling the required control or falsifying gate status is **test FAILURE and release gate BLOCK**, with root-cause correction and exact-SHA readback required. It is not a punitive action against people or a fake automated Constitution approval.

## Next step

After source review/admission, implement guarded ports 3003/3009 with non-argv secret delivery for all relevant inter-app secrets, prove true Windows source identity and no direct bypass under specified OS threat model, add real durable in-flight D1 write & cross-isolate barrier, graceful stop/ACK, descendant PID and port-release checks. Keep fail closed until then.
