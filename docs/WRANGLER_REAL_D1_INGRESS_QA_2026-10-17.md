# Wrangler/Miniflare live HTTP ingress + local D1 shutdown feasibility — 2026-10-17

Coordinating project: [Application Management PR #360](https://github.com/BlueDragon33/Application-Management/pull/360). Source child Drafts: [BAUMAN-CONTROL #366](https://github.com/BlueDragon33/Bauman-master-ai-system/pull/366) and [PRICE-CONTROL #133](https://github.com/BlueDragon33/PriceReport_Tunggiabao/pull/133). **No merge, publish, or Blueprint self-ratification.**

## Real mechanisms now exercised in CI

1. `scripts/local-ops-wrangler-ingress.mjs`: a local-only Node HTTP gateway that forwards requests to a fixed numeric 127.0.0.1 upstream port, counts admitted HTTP requests until the response completes, and refuses new requests once drain begins. It waits for HTTP ingress close without sending any signal to Wrangler. Canceled/uncertain requests invalidate evidence.
2. `tests/fixtures/wrangler-d1-flight-worker.mjs`: a **disposable test-only Cloudflare Worker** that waits inside an HTTP request, executes actual `env.DB.prepare(...).bind(...).run()`, and returns only once committed. Not imported into BAUMAN-CONTROL or PRICE-CONTROL.
3. `scripts/local-ops-real-wrangler-drain-smoke.mjs`: starts actual locally installed Wrangler dev / Miniflare with disposable `--persist-to` D1 and randomly chosen 127.0.0.1 ports. It starts an in-flight D1-writing request through the ingress; drains admitted requests, confirms committed data via Wrangler Worker GET, then terminates **only the disposable QA child** for test teardown, checks port/process evidence, and reads D1 back using a separate Wrangler CLI process. No user D1 data or remote service is touched.
4. The workflow exercises this scenario on both Windows and Linux with exact commit logs. Independent unit tests assert that the ingress never grants full shutdown or all-isolate drain merely when active proxy requests reach 0.

## Stop/exit boundary — still BLOCKED

- **No real service shutdown authorization.** The ingress cannot prove every Worker isolate, service binding or internal scheduled job uses this gateway. The upstream is reachable directly on localhost and any direct traffic can bypass the gateway.
- A successful disposable-worker readback proves a D1 write survived *that isolated fixture* teardown; it does not prove safe D1 flush for the full BAUMAN-CONTROL or PRICE-CONTROL Worker on Windows.
- Terminating the owned **test fixture** via SIGTERM is not a gracefully acknowledged Worker shutdown. It must never be generalized to terminating a user's live Wrangler/Miniflare process.
- A Windows captured process-tree exit or closed port is an additional observation, not sufficient proof of Worker D1 commit barriers.
- Both source Draft workers continue answering HTTP **503** for `/_local/ops/drain-preflight`. The App Manager 13-unit contract continues returning UNSUPPORTED; auto-restart remains disabled.
- Readiness must be advanced only when app-specific drain across all Worker isolates is verified, durable readback from actual app DB is demonstrated, bound IPC/HTTP stop acknowledgments are genuine, the owned Windows process tree is fully exited and all managed TCP ports are free, followed by independent Blueprint review.

The flow is an **actual Wrangler process and actual temporary D1 backend** test, not a fake simulation of Wrangler. The *worker itself and credentials/storage are isolated QA fixtures*, not the real user apps.
