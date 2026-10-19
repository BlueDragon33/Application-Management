import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import { pullRepository } from "../scripts/local-ops-daemon.mjs";

function git(cwd, ...args) {
  return execFileSync("git", args, {
    cwd, encoding: "utf8", timeout: 25_000, windowsHide: true,
    env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
  }).trim();
}

// The fetch endpoint is a *local bare fixture*, not a real GitHub account.
// Only this injectable test runner translates an explicitly trusted HTTPS
// remote to the fixture's local transport. The production Git runner remains
// locked to https/ssh GitHub origin and protocol.file.allow=never.
function fixtureRunner(cwd, args) {
  if (args[0] === "config" && args[1] === "--get" && args[2] === "remote.origin.url")
    return "https://github.com/BlueDragon33/test-fixture.git";
  if (args[0] === "remote" && args[1] === "get-url" && args[2] === "origin")
    return "https://github.com/BlueDragon33/test-fixture.git";
  if (args[0] === "-c" && args.includes("fetch"))
    return git(cwd, ...args.slice(4));
  return git(cwd, ...args);
}

test("real Git: Pull clean main via fast-forward, verify exact SHA, skip dirty and diverged without reset", async t => {
  const tmp = mkdtempSync(join(tmpdir(), "baumanweb-offline-git-"));
  t.after(() => rmSync(tmp, { recursive: true, force: true }));
  const remote = join(tmp, "remote.git");
  const seed = join(tmp, "seed");
  const local = join(tmp, "local");
  mkdirSync(seed);
  git(tmp, "init", "--bare", remote);
  git(seed, "init", "-b", "main");
  git(seed, "config", "user.name", "Offline QA");
  git(seed, "config", "user.email", "offline-qa@example.test");
  writeFileSync(join(seed, "content.txt"), "first\n");
  git(seed, "add", ".");
  git(seed, "commit", "-m", "first");
  git(seed, "remote", "add", "origin", remote);
  git(seed, "push", "-u", "origin", "main");
  git(remote, "symbolic-ref", "HEAD", "refs/heads/main");
  git(tmp, "clone", remote, local);
  git(local, "config", "user.name", "Offline QA");
  git(local, "config", "user.email", "offline-qa@example.test");

  const old = git(local, "rev-parse", "HEAD");
  writeFileSync(join(seed, "content.txt"), "second\n");
  git(seed, "add", "content.txt");
  git(seed, "commit", "-m", "second");
  git(seed, "push", "origin", "main");
  const expected = git(seed, "rev-parse", "HEAD");

  const pulled = await pullRepository(local, fixtureRunner);
  assert.equal(pulled.state, "updated", JSON.stringify(pulled));
  assert.equal(pulled.from, old);
  assert.equal(pulled.sha, expected);
  assert.equal(pulled.restartRequired, true);
  assert.equal(git(local, "rev-parse", "HEAD"), expected);
  assert.equal(git(local, "status", "--porcelain"), "");

  // Uncommitted change must survive without a fetch or reset.
  writeFileSync(join(local, "content.txt"), "unsaved work\n");
  const dirty = await pullRepository(local, fixtureRunner);
  assert.equal(dirty.state, "skipped");
  assert.equal(git(local, "rev-parse", "HEAD"), expected);
  git(local, "restore", "content.txt");

  // A local commit that isn't an ancestor of the remote must never be discarded.
  writeFileSync(join(local, "local.txt"), "user branch\n");
  git(local, "add", "local.txt");
  git(local, "commit", "-m", "local only");
  const localHead = git(local, "rev-parse", "HEAD");
  writeFileSync(join(seed, "upstream.txt"), "third\n");
  git(seed, "add", "upstream.txt");
  git(seed, "commit", "-m", "upstream third");
  git(seed, "push", "origin", "main");
  const diverged = await pullRepository(local, fixtureRunner);
  assert.equal(diverged.state, "skipped");
  assert.equal(git(local, "rev-parse", "HEAD"), localHead);
  assert.equal(git(local, "status", "--porcelain"), "");
});
