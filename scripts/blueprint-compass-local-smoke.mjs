import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { createServer } from "node:net";
import { fileURLToPath } from "node:url";

// Real local workerd HTTP checks. No upstream fixtures, writes, deployment, or cloud credentials.
const root = fileURLToPath(new URL("../", import.meta.url));
assert.ok(!existsSync(new URL("../.dev.vars", import.meta.url)), "Use a disposable checkout without developer credentials.");
const probe = createServer();
await new Promise(resolve => probe.listen(0, "127.0.0.1", resolve));
const port = probe.address().port;
await new Promise(resolve => probe.close(resolve));
const origin = `http://127.0.0.1:${port}`;
const child = spawn(process.execPath, [fileURLToPath(new URL("../node_modules/vite/bin/vite.js", import.meta.url)), "--host", "127.0.0.1", "--port", String(port), "--strictPort"], {
  cwd: root, detached: process.platform !== "win32", stdio: ["ignore", "pipe", "pipe"],
  env: { ...process.env, LOCAL_DEV_AUTH: "1", LOCAL_DEV_USER_ID: "compass-local-qa", LOCAL_DEV_USER_EMAIL: "compass.qa@example.test", LOCAL_DEV_USER_NAME: "Compass QA", CONTROL_OWNER_EMAILS: "compass.qa@example.test", CONTROL_PLANE_NETWORK_MODE: "local" },
});
let tail = "";
for (const stream of [child.stdout, child.stderr]) stream.on("data", data => { tail = (tail + data).slice(-4000); });
const checks = [];
const read = (path, init = {}) => fetch(`${origin}${path}`, { redirect: "manual", signal: AbortSignal.timeout(20000), ...init });
try {
  const deadline = Date.now() + 60000;
  let ready = false;
  while (Date.now() < deadline && child.exitCode === null) {
    try { await read("/", { signal: AbortSignal.timeout(1000) }); ready = true; break; } catch { /* Wait for local compilation. */ }
    await new Promise(resolve => setTimeout(resolve, 350));
  }
  assert.ok(ready, `Local Vite/workerd runtime did not start. ${tail}`);
  const tool = await read("/tools/blueprint-compass");
  assert.equal(tool.status, 200);
  assert.match(await tool.text(), /<h1>Blueprint Compass<\/h1>/);
  checks.push("local-tool-200");
  const legacy = await read("/apps/software-blueprint-hub");
  assert.equal(legacy.status, 307);
  assert.equal(new URL(legacy.headers.get("location"), origin).pathname, "/tools/blueprint-compass");
  checks.push("legacy-tool-redirect");
  const unknown = await read("/api/tools/blueprint-compass?id=unknown");
  assert.equal(unknown.status, 400);
  assert.equal((await unknown.json()).status, "UNKNOWN_PROJECT");
  checks.push("unknown-project-400");
  const unauthenticated = await read("/api/tools/blueprint-compass?id=application-management", { headers: { "x-forwarded-host": "nonlocal.example.invalid" } });
  assert.equal(unauthenticated.status, 401);
  checks.push("nonlocal-identity-401");
  const mutation = await read("/api/tools/blueprint-compass?id=application-management", { method: "POST" });
  assert.equal(mutation.status, 405);
  checks.push("mutation-405");
  const upstream = [];
  for (const [id, repository] of [["software-blueprint-hub", "BlueDragon33/Software-Blueprint-Hub"], ["application-management", "BlueDragon33/Application-Management"]]) {
    const response = await read(`/api/tools/blueprint-compass?id=${id}`);
    const body = await response.json();
    assert.match(response.headers.get("cache-control"), /no-store/);
    assert.equal(body.repository, repository);
    assert.equal(body.verdict.qaPassed, false);
    assert.equal(body.verdict.productionAuthorized, false);
    if (response.status === 200) {
      assert.equal(body.ok, true);
      assert.match(body.head, /^[0-9a-f]{40}$/);
      assert.equal(body.canonicalGateVerified, false);
      assert.equal(body.humanReviewVerified, false);
      upstream.push({ id, status: "LIVE_READ_PASS", head: body.head });
    } else {
      assert.equal(response.status, 502);
      assert.equal(body.ok, false);
      assert.equal(body.status, "UNVERIFIED");
      upstream.push({ id, status: "BLOCKED_UNVERIFIED" });
    }
  }
  console.log(JSON.stringify({ localRoutingAndAuth: "PASS", checks, upstream, browserE2E: "NOT_RUN", fullAcceptance: false }, null, 2));
} finally {
  try { process.platform === "win32" ? child.kill("SIGTERM") : process.kill(-child.pid, "SIGTERM"); } catch { /* Already stopped. */ }
}
