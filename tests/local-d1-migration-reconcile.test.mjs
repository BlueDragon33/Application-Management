import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { planBoiDeviceTypeOverrideJournalRepair } from "../scripts/local-d1-migration-reconcile.mjs";

const migrationSql = "ALTER TABLE `device_access` ADD COLUMN `device_type_override` text;";

function plan(overrides = {}) {
  return planBoiDeviceTypeOverrideJournalRepair({
    migrationNames: ["0014_old.sql", "0015_previous.sql", "0016_device_type_override.sql", "0017_next.sql"],
    appliedNames: ["0014_old.sql", "0015_previous.sql"],
    deviceColumns: [
      { name: "device_id", type: "TEXT", notnull: 1 },
      { name: "device_type_override", type: "TEXT", notnull: 0 },
    ],
    migrationSql,
    ...overrides,
  });
}

test("repairs journal only when 0016 is first pending and its column already exists", () => {
  assert.deepEqual(plan(), { repair: true, reason: "schema-ahead-of-journal" });
});

test("does not mark 0016 when the schema still needs the migration", () => {
  const result = plan({ deviceColumns: [{ name: "device_id", type: "TEXT", notnull: 1 }] });
  assert.equal(result.repair, false);
  assert.equal(result.reason, "column-missing");
});

test("does not skip an earlier unapplied migration", () => {
  const result = plan({ appliedNames: ["0014_old.sql"] });
  assert.equal(result.repair, false);
  assert.equal(result.reason, "earlier-migration-pending");
  assert.equal(result.firstPending, "0015_previous.sql");
});

test("does not rewrite history when 0016 is already applied", () => {
  const result = plan({ appliedNames: ["0014_old.sql", "0015_previous.sql", "0016_device_type_override.sql"] });
  assert.equal(result.repair, false);
  assert.equal(result.reason, "already-applied");
});

test("does not mark a migration whose SQL has changed or whose existing column shape is incompatible", () => {
  assert.equal(plan({ migrationSql: "ALTER TABLE device_access ADD COLUMN device_type_override INTEGER;" }).reason, "migration-sql-changed");
  assert.equal(plan({ deviceColumns: [{ name: "device_type_override", type: "INTEGER", notnull: 0 }] }).reason, "column-shape-mismatch");
});

test("both local launch paths reconcile Boi journal before wrangler migrations apply", () => {
  for (const path of ["scripts/run-local-system.mjs", "scripts/run-local-offline-v2.mjs"]) {
    const source = fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
    const repair = source.indexOf("reconcileBoiLocalMigrationJournal(paths.boi)");
    const migrate = source.indexOf('"migrations", "apply", "boi-ech-local"');
    assert.ok(repair >= 0, `${path} missing Boi migration reconciliation`);
    assert.ok(migrate > repair, `${path} must reconcile before applying Boi migrations`);
  }
});
