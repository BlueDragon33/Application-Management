import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const isWindows = process.platform === "win32";
const npx = isWindows ? "npx.cmd" : "npx";

function commandSpec(command, args) {
  if (!isWindows || !/\.cmd$/i.test(command)) return { file: command, args };
  return {
    file: process.env.ComSpec || "cmd.exe",
    args: ["/d", "/s", "/c", command, ...args],
  };
}

function executeJson(cwd, args) {
  const spec = commandSpec(npx, args);
  const result = spawnSync(spec.file, spec.args, {
    cwd,
    encoding: "utf8",
    shell: false,
    env: {
      ...process.env,
      CI: process.env.CI || "1",
      WRANGLER_SEND_METRICS: "false",
      npm_config_update_notifier: "false",
    },
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    const detail = (result.stderr || result.stdout || "").trim();
    throw new Error(detail || `Wrangler thất bại với mã ${result.status}.`);
  }
  try {
    return JSON.parse(result.stdout || "[]");
  } catch {
    throw new Error("Không đọc được JSON từ Wrangler khi kiểm tra D1 local.");
  }
}

function resultRows(payload) {
  if (!Array.isArray(payload)) return [];
  return payload.flatMap((item) => Array.isArray(item?.results) ? item.results : []);
}

function normalizeMigrationSql(sql) {
  return sql
    .replace(/--.*$/gm, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\s+/g, " ")
    .replaceAll("`", "")
    .trim()
    .replace(/;$/, "")
    .trim()
    .toLowerCase();
}

export function planBoiDeviceTypeOverrideJournalRepair({
  migrationNames,
  appliedNames,
  deviceColumns,
  migrationSql,
}) {
  const target = "0016_device_type_override.sql";
  const normalized = normalizeMigrationSql(migrationSql);
  const expected = "alter table device_access add column device_type_override text";
  const sorted = [...migrationNames].sort((a, b) => a.localeCompare(b, "en"));
  const applied = new Set(appliedNames);
  const pending = sorted.filter((name) => !applied.has(name));
  const firstPending = pending[0] ?? null;
  const column = deviceColumns.find((item) => item?.name === "device_type_override") ?? null;

  if (!migrationNames.includes(target)) return { repair: false, reason: "migration-missing" };
  if (applied.has(target)) return { repair: false, reason: "already-applied" };
  if (firstPending !== target) return { repair: false, reason: "earlier-migration-pending", firstPending };
  if (!column) return { repair: false, reason: "column-missing" };
  if (String(column.type || "").toUpperCase() !== "TEXT" || Number(column.notnull || 0) !== 0) {
    return { repair: false, reason: "column-shape-mismatch" };
  }
  if (normalized !== expected) return { repair: false, reason: "migration-sql-changed" };
  return { repair: true, reason: "schema-ahead-of-journal" };
}

export function reconcileBoiLocalMigrationJournal(boiRoot) {
  const migrationDir = join(boiRoot, "drizzle");
  const migrationPath = join(migrationDir, "0016_device_type_override.sql");
  if (!existsSync(migrationPath)) {
    return { repaired: false, reason: "migration-missing" };
  }

  const migrationNames = readdirSync(migrationDir)
    .filter((name) => /^\d+.*\.sql$/i.test(name))
    .sort((a, b) => a.localeCompare(b, "en"));
  const migrationSql = readFileSync(migrationPath, "utf8");

  const tableRows = resultRows(executeJson(boiRoot, [
    "wrangler", "d1", "execute", "boi-ech-local",
    "--local", "--config", "wrangler.local.jsonc",
    "--command", "SELECT name FROM sqlite_master WHERE type='table' AND name='d1_migrations'",
    "--json",
  ]));
  if (!tableRows.some((row) => row?.name === "d1_migrations")) {
    return { repaired: false, reason: "journal-missing" };
  }

  const deviceColumns = resultRows(executeJson(boiRoot, [
    "wrangler", "d1", "execute", "boi-ech-local",
    "--local", "--config", "wrangler.local.jsonc",
    "--command", "PRAGMA table_info(device_access)",
    "--json",
  ]));
  const appliedRows = resultRows(executeJson(boiRoot, [
    "wrangler", "d1", "execute", "boi-ech-local",
    "--local", "--config", "wrangler.local.jsonc",
    "--command", "SELECT name FROM d1_migrations ORDER BY id",
    "--json",
  ]));
  const appliedNames = appliedRows
    .map((row) => typeof row?.name === "string" ? row.name : "")
    .filter(Boolean);

  const plan = planBoiDeviceTypeOverrideJournalRepair({
    migrationNames,
    appliedNames,
    deviceColumns,
    migrationSql,
  });
  if (!plan.repair) return { repaired: false, ...plan };

  executeJson(boiRoot, [
    "wrangler", "d1", "execute", "boi-ech-local",
    "--local", "--config", "wrangler.local.jsonc",
    "--command", "INSERT OR IGNORE INTO d1_migrations(name) VALUES ('0016_device_type_override.sql')",
    "--json",
  ]);

  const verifyRows = resultRows(executeJson(boiRoot, [
    "wrangler", "d1", "execute", "boi-ech-local",
    "--local", "--config", "wrangler.local.jsonc",
    "--command", "SELECT name FROM d1_migrations WHERE name='0016_device_type_override.sql' LIMIT 1",
    "--json",
  ]));
  if (!verifyRows.some((row) => row?.name === "0016_device_type_override.sql")) {
    throw new Error("Không thể đồng bộ journal migration 0016 của Bơi ếch.");
  }

  return { repaired: true, reason: plan.reason };
}
