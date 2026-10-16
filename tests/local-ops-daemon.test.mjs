import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { pullRepository, createLocalOpsServer, probe, requiresRestart } from "../scripts/local-ops-daemon.mjs";
import { createServer, request as httpRequest } from "node:http";

const manifest = JSON.parse(readFileSync(new URL("../control/local-ops-apps.json", import.meta.url), "utf8"));
const registry = readFileSync(new URL("../app/application-registry.ts", import.meta.url), "utf8");
const dashboard = readFileSync(new URL("../app/management-dashboard-v2.tsx", import.meta.url), "utf8");

test("every registered App Manager client has an explicit local capability or documented non-web boundary", () => {
  for (const item of manifest.apps) {
    assert.match(registry, new RegExp('id: "' + item.id + '"'));
    assert.ok(item.port === null || Number.isInteger(item.port));
    if (item.port === null) assert.ok(item.note, item.id + " needs clear unsupported reason");
  }
  for (const id of ["boi-ech", "health-care", "ru-life", "bauman-master-ai", "growup-mychildren", "price-report-tunggiabao", "nc03-modem"]) {
    assert.ok(manifest.apps.find((app) => app.id === id)?.port, "missing required port: " + id);
  }
});

test("dashboard offers verified mode separation, not preview fallback or shell bridge", () => {
  assert.match(dashboard, /<OfflineOpsPanel local=\{localRuntime\} mode=\{operatingMode\}/);
  assert.match(dashboard, /const fallback = publishedUrl\(app\?\.publicUrl\)/);
  assert.match(dashboard, /launchOffline\(appId\)/);
  assert.doesNotMatch(dashboard, /window\.open\(app\?\.ssoStartUrl \?\? app\?\.previewUrl/);
});

function fakeGit({
  branch = "main", dirty = "", before = "a".repeat(40), remote = "b".repeat(40),
  ancestor = true, origin = "https://github.com/BlueDragon33/Application-Management.git",
  resolvedOrigin = origin, raceAfterFetch = false, afterOverride = null, dirtyAfter = false,
} = {}) {
  const calls = [];
  let updated = false;
  let fetched = false;
  const runner = async (_cwd, args) => {
    calls.push(args);
    if (args[0] === "symbolic-ref") return branch;
    if (args[0] === "status") return dirtyAfter && updated ? " M generated.txt" : dirty;
    if (args[0] === "config" && args[1] === "--get") return origin;
    if (args[0] === "remote" && args[1] === "get-url") return resolvedOrigin;
    if (args[0] === "rev-parse" && args[1] === "HEAD") {
      return updated ? (afterOverride || remote) : fetched && raceAfterFetch ? "c".repeat(40) : before;
    }
    if (args[0] === "rev-parse" && args[1] === "FETCH_HEAD") return remote;
    if (args[0] === "-c" && args.includes("fetch")) { fetched = true; return ""; }
    if (args[0] === "merge-base" && !ancestor) throw new Error("not ancestor");
    if (args[0] === "merge") updated = true;
    return "";
  };
  return { runner, calls, before, remote };
}

test("pull-all updates only clean main repositories with fast-forward", async () => {
  const local = fakeGit();
  const result = await pullRepository("/unimportant/example", local.runner);
  assert.equal(result.state, "updated");
  assert.equal(result.sha, local.remote, "full remote SHA must be read back");
  assert.equal(result.from, local.before);
  assert.equal(result.restartRequired, true);
  assert.ok(local.calls.some(args => args[0] === "merge" && args[1] === "--ff-only"));
  assert.ok(local.calls.some(args => args[0] === "-c" && args.includes("protocol.file.allow=never")));
  assert.ok(!local.calls.some(args => args.some(value => /reset|force|rebase/.test(value))));
});

test("pull-all leaves dirty, feature branch and divergent repos untouched", async () => {
  for (const values of [{ dirty: " M src/main.ts" }, { branch: "feature" }, { ancestor: false }]) {
    const client = fakeGit(values);
    const result = await pullRepository("/unimportant/example", client.runner);
    assert.equal(result.state, "skipped");
    assert.ok(!client.calls.some(args => args[0] === "merge"));
  }
});

test("local companion rejects requests without exact 3000 loopback Origin", async () => {
  const server = createLocalOpsServer();
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const url = "http://127.0.0.1:" + address.port;
  try {
    const forged = await fetch(url + "/session", { headers: { origin: "https://evil.example" } });
    assert.equal(forged.status, 403);
    const allowed = await fetch(url + "/session", { headers: { origin: "http://127.0.0.1:3000" } });
    assert.equal(allowed.status, 200);
    const session = await allowed.json();
    assert.ok(session.token.length >= 32);
    const rejected = await fetch(url + "/pull-all", {
      method: "POST", headers: { origin: "http://127.0.0.1:3000" },
    });
    assert.equal(rejected.status, 401);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});

test("Pull all refuses non-GitHub origins, local-file remotes and rewritten fetch targets", async () => {
  for (const values of [
    { origin: "file:///tmp/fake.git" },
    { origin: "ext::evil" },
    { origin: "https://evil.example/BlueDragon33/app" },
    { origin: "https://github.com/other-owner/repo" },
    { origin: "https://user:token@github.com/BlueDragon33/repo" },
    { origin: "https://github.com/BlueDragon33/repo", resolvedOrigin: "file:///tmp/fake.git" },
  ]) {
    const client = fakeGit(values);
    const result = await pullRepository("/unimportant/example", client.runner);
    assert.equal(result.state, "skipped", JSON.stringify(values));
    assert.ok(!client.calls.some(args => args.includes("fetch")), "untrusted origin must not fetch");
  }
});

test("Pull all fails closed when repo changes during fetch or readback differs", async () => {
  for (const [values, expected] of [
    [{ raceAfterFetch: true }, "skipped"],
    [{ afterOverride: "d".repeat(40) }, "error"],
    [{ dirtyAfter: true }, "error"],
  ]) {
    const client = fakeGit(values);
    const result = await pullRepository("/unimportant/example", client.runner);
    assert.equal(result.state, expected, JSON.stringify(values));
    if (expected === "skipped") assert.ok(!client.calls.some(args => args[0] === "merge"));
  }
});

test("localhost API rejects unexpected Host, origin and command methods", async () => {
  const server = createLocalOpsServer();
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const base = "http://127.0.0.1:" + server.address().port;
  try {
    const trustedOrigin = "http://127.0.0.1:3000";
    // node:fetch may normalize/override Host; raw HTTP proves the server
    // actually rejects a forged Host header over an on-loopback connection.
    const badHostCode = await new Promise((resolve, reject) => {
      const request = httpRequest(base + "/session", {
        headers: { origin: trustedOrigin, host: "evil.example:" + server.address().port },
      }, response => {
        response.resume();
        response.once("end", () => resolve(response.statusCode));
      });
      request.once("error", reject);
      request.end();
    });
    assert.equal(badHostCode, 403);
    const missingOrigin = await fetch(base + "/session");
    assert.equal(missingOrigin.status, 403);
    const allowed = await fetch(base + "/session", { headers: { origin: trustedOrigin } });
    assert.equal(allowed.status, 200);
    assert.equal(allowed.headers.get("access-control-allow-origin"), trustedOrigin);
    const { token } = await allowed.json();
    const unauthorized = await fetch(base + "/pull-all", { method: "POST", headers: {
      origin: trustedOrigin, authorization: "Bearer fake",
    } });
    assert.equal(unauthorized.status, 401);
    const arbitrary = await fetch(base + "/run-command", { method: "POST", headers: {
      origin: trustedOrigin, authorization: "Bearer " + token,
    }, body: JSON.stringify({ cmd: "whoami" }) });
    assert.equal(arbitrary.status, 404);
    const status = await fetch(base + "/status", { headers: {
      origin: trustedOrigin, authorization: "Bearer " + token,
    } });
    assert.equal(status.status, 200);
    assert.equal((await status.json()).pull, null, "unauthorized request never schedules git operation");
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});

test("offline port probe rejects HTTP redirect even when target is reachable", async () => {
  const server = createServer((req, res) => {
    if (req.url === "/redirect") {
      res.writeHead(302, { location: "https://example.com/online" }); res.end();
    } else { res.writeHead(200); res.end("local"); }
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  try {
    assert.equal(await probe(port, "/redirect"), false, "redirect cannot prove offline runtime");
    assert.equal(await probe(port, "/health"), true);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});

test("runtime source drift requires a cold restart only after a successful Pull", () => {
  const updated = [{ state: "updated", sha: "a".repeat(40) }];
  for (const state of ["stopped", "starting", "error"])
    assert.equal(requiresRestart(state, updated), false);
  assert.equal(requiresRestart("running", updated), true);
  assert.equal(requiresRestart("running", [{ state: "current" }, { state: "skipped" }]), false);
});
