import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const controlMembers = sqliteTable("control_members", {
  email: text("email").primaryKey(),
  displayName: text("display_name"),
  role: text("role").notNull().default("reviewer"),
  status: text("status").notNull().default("active"),
  createdBy: text("created_by").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const controlDevices = sqliteTable("control_devices", {
  deviceId: text("device_id").primaryKey(),
  displayCode: text("display_code").notNull().unique(),
  publicKeyJwk: text("public_key_jwk").notNull(),
  email: text("email").notNull(),
  status: text("status").notNull().default("pending"),
  label: text("label"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  approvedAt: text("approved_at"),
  blockedAt: text("blocked_at"),
  lastSeenAt: text("last_seen_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index("control_devices_email_idx").on(table.email),
]);

export const controlChallenges = sqliteTable("control_challenges", {
  nonce: text("nonce").primaryKey(),
  deviceId: text("device_id").notNull(),
  expiresAt: integer("expires_at").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const controlAuditLog = sqliteTable("control_audit_log", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  actor: text("actor").notNull(),
  action: text("action").notNull(),
  target: text("target").notNull(),
  detailJson: text("detail_json").notNull().default("{}"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});


export const managedAppCatalog = sqliteTable("managed_app_catalog", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  shortName: text("short_name").notNull(),
  category: text("category").notNull(),
  origin: text("origin").notNull(),
  publicUrl: text("public_url"),
  repository: text("repository"),
  contractPath: text("contract_path").notNull().default("/api/application-management/contract"),
  enabled: integer("enabled").notNull().default(1),
  credentialCiphertext: text("credential_ciphertext"),
  credentialIv: text("credential_iv"),
  createdBy: text("created_by").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index("managed_app_catalog_category_idx").on(table.category),
  index("managed_app_catalog_enabled_idx").on(table.enabled),
]);


export const deployOpsTargets = sqliteTable("deploy_ops_targets", {
  appId: text("app_id").primaryKey(),
  repository: text("repository").notNull(),
  vercelEnabled: integer("vercel_enabled").notNull().default(0),
  vercelProjectId: text("vercel_project_id"),
  vercelTeamId: text("vercel_team_id"),
  neonEnabled: integer("neon_enabled").notNull().default(0),
  neonProjectId: text("neon_project_id"),
  neonBranch: text("neon_branch"),
  tinyfishEnabled: integer("tinyfish_enabled").notNull().default(0),
  tinyfishTargetUrl: text("tinyfish_target_url"),
  tinyfishGoal: text("tinyfish_goal"),
  createdBy: text("created_by").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index("deploy_ops_targets_updated_idx").on(table.updatedAt),
]);

export const deployOpsRuns = sqliteTable("deploy_ops_runs", {
  id: text("id").primaryKey(),
  appId: text("app_id").notNull(),
  sourceSha: text("source_sha").notNull(),
  tinyfishRunId: text("tinyfish_run_id").unique(),
  tinyfishStatus: text("tinyfish_status"),
  tinyfishResultJson: text("tinyfish_result_json"),
  callbackNonceHash: text("callback_nonce_hash"),
  status: text("status").notNull().default("pending"),
  detailJson: text("detail_json").notNull().default("{}"),
  createdBy: text("created_by").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  publishedAt: text("published_at"),
}, (table) => [
  index("deploy_ops_runs_app_sha_idx").on(table.appId, table.sourceSha, table.createdAt),
]);
