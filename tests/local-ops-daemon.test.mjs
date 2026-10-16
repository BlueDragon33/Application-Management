import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { pullRepository, createLocalOpsServer } from "../scripts/local-ops-daemon.mjs";

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

function fakeGit({ branch = "main", dirty = "", before = "aaa", remote = "bbb", ancestor = true } = {}) {
  const calls = [];
  let updated = false;
  const runner = async (_cwd, args) => {
    calls.push(args);
    if (args[0] === "symbolic-ref") return branch;
    if (args[0] === "status") return dirty;
    if (args[0] === "rev-parse" && args[1] === "HEAD") return updated ? remote : before;
    if (args[0] === "rev-parse" && args[1] === "FETCH_HEAD") return remote;
    if (args[0] === "merge-base" && !ancestor) throw new Error("not ancestor");
    if (args[0] === "merge") updated = true;
    return "";
  };
  return { runner, calls };
}

test("pull-all updates only clean main repositories with fast-forward", async () => {
  const local = fakeGit();
  const result = await pullRepository("/unimportant/example", local.runner);
  assert.equal(result.state, "updated");
  assert.ok(local.calls.some(args => args[0] === "merge" && args[1] === "--ff-only"));
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
    const forged = await fetch(url + "/session", { headers: { origin: "https://evil.example", host: "127.0.0.1:3011" } });
    assert.equal(forged.status, 403);
    const allowed = await fetch(url + "/session", { headers: { origin: "http://127.0.0.1:3000", host: "127.0.0.1:3011" } });
    assert.equal(allowed.status, 200);
    const session = await allowed.json();
    assert.ok(session.token.length >= 32);
    const rejected = await fetch(url + "/pull-all", {
      method: "POST", headers: { origin: "http://127.0.0.1:3000", host: "127.0.0.1:3011" },
    });
    assert.equal(rejected.status, 401);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});
