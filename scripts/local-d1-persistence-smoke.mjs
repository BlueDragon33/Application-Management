#!/usr/bin/env node
// Temporary D1-only persistence proof: never reads or writes real BaumanWeb D1.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const exec = promisify(execFile);
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const WRANGLER = join(ROOT, "node_modules", "wrangler", "bin", "wrangler.js");
const DB = "learning-management-db";
const CONFIG = "wrangler.local.jsonc";

function args(persist, sql) {
  // This is intentionally an allowlisted local-only command. Never --remote.
  return [WRANGLER, "d1", "execute", DB, "--config", CONFIG, "--local",
    "--persist-to", persist, "--command", sql, "--json"];
}
async function localD1(persist, sql) {
  const argv = args(persist, sql);
  assert.ok(argv.includes("--local"));
  assert.ok(!argv.some(x => x === "--remote" || x === "--preview"));
  const result = await exec(process.execPath, argv, {
    cwd: ROOT, timeout: 75_000, maxBuffer: 1024 * 1024,
    env: { ...process.env, CI: "1", WRANGLER_SEND_METRICS: "false" },
    windowsHide: true,
  });
  const text = result.stdout.trim();
  const left = text.indexOf("[");
  if (left === -1) throw new Error("WRANGLER_D1_JSON_NOT_FOUND: " + text.slice(-280));
  return JSON.parse(text.slice(left));
}
async function main() {
  const temp = await mkdtemp(join(tmpdir(), "am-d1-persistence-"));
  const marker = randomUUID().replace(/-/g, "");
  const persist = join(temp, "db");
  try {
    const create = await localD1(persist,
      "CREATE TABLE IF NOT EXISTS __am_local_qa_persistence (id TEXT PRIMARY KEY, value TEXT NOT NULL)");
    assert.ok(Array.isArray(create), "wrangler JSON envelope missing");
    await localD1(persist,
      "INSERT INTO __am_local_qa_persistence (id, value) VALUES ('" + marker + "', 'offline-retained')");
    // Each invocation is a separate Wrangler process. No runtime or in-memory DB reuse.
    const readback = await localD1(persist,
      "SELECT id,value FROM __am_local_qa_persistence WHERE id='" + marker + "'");
    const rows = readback.flatMap(x => Array.isArray(x?.results) ? x.results : []);
    assert.deepEqual(rows, [{ id: marker, value: "offline-retained" }]);
    console.log(JSON.stringify({ result: "LOCAL_D1_PERSISTENCE_PASS", scope: "temporary-isolated-store",
      processes: 3, database: DB, offline: true, dataProductionTouched: false,
      realBaumanWebD1: "NOT_TESTED", fullCrossAppState: "NOT_TESTED" }));
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
}
main().catch(e => { console.error("LOCAL_D1_PERSISTENCE_FAIL: " + (e?.stack || e)); process.exitCode = 1; });
