import { getControlDatabase } from "./control-device.server";
import type { RuLifeIntegrationHealth } from "./ru-life-integration-health.server";

export type RuLifeIntegrationIncident = {
  id: number;
  severity: "degraded" | "down";
  code: string;
  message: string;
  targetUrl: string;
  startedAt: string;
  lastSeenAt: string;
  resolvedAt: string | null;
  occurrences: number;
};

type IncidentRow = {
  id: number;
  severity: "degraded" | "down";
  code: string;
  message: string;
  target_url: string;
  started_at: string;
  last_seen_at: string;
  resolved_at: string | null;
  occurrences: number;
};

let ready: Promise<void> | null = null;

async function ensureTable() {
  if (ready) return ready;
  ready = (async () => {
    const database = await getControlDatabase();
    await database.batch([
      database.prepare(`CREATE TABLE IF NOT EXISTS ru_life_integration_incidents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        severity TEXT NOT NULL,
        code TEXT NOT NULL,
        message TEXT NOT NULL,
        target_url TEXT NOT NULL,
        started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        resolved_at TEXT,
        occurrences INTEGER NOT NULL DEFAULT 1
      )`),
      database.prepare("CREATE INDEX IF NOT EXISTS ru_life_incidents_open_idx ON ru_life_integration_incidents(resolved_at, started_at)"),
    ]);
  })().catch((error) => {
    ready = null;
    throw error;
  });
  return ready;
}

function publicState(row: IncidentRow): RuLifeIntegrationIncident {
  return {
    id: row.id,
    severity: row.severity,
    code: row.code,
    message: row.message,
    targetUrl: row.target_url,
    startedAt: row.started_at,
    lastSeenAt: row.last_seen_at,
    resolvedAt: row.resolved_at,
    occurrences: row.occurrences,
  };
}

export async function recordRuLifeIntegrationHealth(health: RuLifeIntegrationHealth) {
  await ensureTable();
  const database = await getControlDatabase();
  const open = await database.prepare(`SELECT id, severity, code, message, target_url, started_at, last_seen_at, resolved_at, occurrences
    FROM ru_life_integration_incidents WHERE resolved_at IS NULL ORDER BY id DESC LIMIT 1`).first<IncidentRow>();

  if (health.overall === "healthy") {
    if (open) {
      await database.prepare("UPDATE ru_life_integration_incidents SET resolved_at = CURRENT_TIMESTAMP, last_seen_at = CURRENT_TIMESTAMP WHERE id = ?")
        .bind(open.id).run();
    }
    return;
  }

  if (open && open.code === health.code && open.severity === health.overall) {
    await database.prepare(`UPDATE ru_life_integration_incidents
      SET message = ?, target_url = ?, last_seen_at = CURRENT_TIMESTAMP, occurrences = occurrences + 1
      WHERE id = ?`)
      .bind(health.message.slice(0, 500), health.targetUrl.slice(0, 500), open.id).run();
    return;
  }

  if (open) {
    await database.prepare("UPDATE ru_life_integration_incidents SET resolved_at = CURRENT_TIMESTAMP WHERE id = ?")
      .bind(open.id).run();
  }
  await database.prepare(`INSERT INTO ru_life_integration_incidents
    (severity, code, message, target_url) VALUES (?, ?, ?, ?)`)
    .bind(health.overall, health.code.slice(0, 80), health.message.slice(0, 500), health.targetUrl.slice(0, 500)).run();
}

export async function listRuLifeIntegrationIncidents(limit = 30) {
  await ensureTable();
  const database = await getControlDatabase();
  const rows = await database.prepare(`SELECT id, severity, code, message, target_url, started_at, last_seen_at, resolved_at, occurrences
    FROM ru_life_integration_incidents ORDER BY id DESC LIMIT ?`)
    .bind(Math.max(1, Math.min(100, limit))).all<IncidentRow>();
  return rows.results.map(publicState);
}
