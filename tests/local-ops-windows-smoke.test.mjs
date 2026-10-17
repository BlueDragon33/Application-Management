// Windows real Node process restart proof for the localhost *helper*, not all apps.
// Never executes START_BAUMANWEB.vbs --start, changes user repositories, or opens Production.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { copyFile, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const BASE = "http://127.0.0.1:3011";
const ORIGIN = "http://127.0.0.1:3000";

async function launch(dir) {
  const child = spawn(process.execPath, [join(dir, "scripts", "local-ops-daemon.mjs")], {
    cwd: dir, env: { ...process.env, CI: "1" },
    stdio: ["ignore", "pipe", "pipe"], windowsHide: true,
  });
  let output = "";
  for (const stream of [child.stdout, child.stderr])
    stream.on("data", b => { output = (output + String(b)).slice(-3000); });
  const end = Date.now() + 12_000;
  while (Date.now() < end) {
    if (child.exitCode !== null) throw new Error("daemon exited early: " + output);
    try {
      const response = await fetch(BASE + "/session", {
        headers: { origin: ORIGIN }, redirect: "manual",
        signal: AbortSignal.timeout(700),
      });
      if (response.ok) return { child, session: await response.json(), output };
    } catch {}
    await delay(150);
  }
  child.kill();
  throw new Error("daemon did not bind loopback: " + output);
}
async function stop(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return; // SIGTERM exitCode is null on Windows
  const exited = new Promise(resolve => child.once("exit", resolve));
  child.kill();
  await Promise.race([exited, delay(5000).then(() => { throw new Error("daemon termination timeout"); })]);
}

test("Windows: BaumanWeb temporary helper cold start, authenticated readback, stop/restart and token rotation",
  { skip: process.platform !== "win32" }, async t => {
    const base = await mkdtemp(join(tmpdir(), "am-win-"));
    const dir = join(base, "BaumanWeb", "Application-Management");
    t.after(() => rm(base, { recursive: true, force: true }));
    await mkdir(join(dir, "scripts"), { recursive: true });
    await mkdir(join(dir, "control"), { recursive: true });
    await copyFile(join(ROOT, "scripts", "local-ops-daemon.mjs"), join(dir, "scripts", "local-ops-daemon.mjs"));
    await copyFile(join(ROOT, "scripts", "local-ops-source-identity.mjs"), join(dir, "scripts", "local-ops-source-identity.mjs"));
    await copyFile(join(ROOT, "scripts", "local-ops-managed-startup-policy.mjs"), join(dir, "scripts", "local-ops-managed-startup-policy.mjs"));
    await copyFile(join(ROOT, "scripts", "local-ops-shutdown-contract.mjs"), join(dir, "scripts", "local-ops-shutdown-contract.mjs"));
    await copyFile(join(ROOT, "scripts", "local-ops-windows-process-tree.mjs"), join(dir, "scripts", "local-ops-windows-process-tree.mjs"));
    await copyFile(join(ROOT, "control", "local-ops-apps.json"), join(dir, "control", "local-ops-apps.json"));
    await writeFile(join(dir, "package.json"), '{"type":"module"}\n');
    let first, second;
    try {
      first = await launch(dir);
      assert.equal(first.session.token.length >= 32, true);
      const status = await fetch(BASE + "/status", {
        headers: { origin: ORIGIN, authorization: "Bearer " + first.session.token },
      });
      assert.equal(status.status, 200);
      const data = await status.json();
      assert.equal(data.workspace, "BaumanWeb");
      assert.equal(data.runtime, "stopped");
      assert.equal(data.restartRequired, false);
      await stop(first.child);
      second = await launch(dir);
      assert.notEqual(second.session.token, first.session.token, "restart must rotate ephemeral token");
      const stale = await fetch(BASE + "/status", {
        headers: { origin: ORIGIN, authorization: "Bearer " + first.session.token },
      });
      assert.equal(stale.status, 401, "old session invalid after helper restart");
      const fresh = await fetch(BASE + "/status", {
        headers: { origin: ORIGIN, authorization: "Bearer " + second.session.token },
      });
      assert.equal(fresh.status, 200);
      assert.equal((await fresh.json()).runtime, "stopped", "no cross-app runtime was falsely started");
      console.log(JSON.stringify({ result: "WINDOWS_HELPER_RESTART_PASS",
        scope: "temporary BaumanWeb helper only", networkBinding: "127.0.0.1",
        sessionRotation: true, realCrossAppRuntime: "NOT_TESTED",
        realUserData: "UNTOUCHED" }));
    } finally {
      await stop(second?.child);
      await stop(first?.child);
    }
  });
