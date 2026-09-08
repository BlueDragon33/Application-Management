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

export const managedAppDevices = sqliteTable("managed_app_devices", {
  appId: text("app_id").notNull(),
  deviceId: text("device_id").notNull(),
  displayCode: text("display_code").notNull().unique(),
  publicKeyJwk: text("public_key_jwk").notNull(),
  status: text("status").notNull().default("pending"),
  label: text("label"),
  deviceClass: text("device_class").notNull().default("unknown"),
  osName: text("os_name").notNull().default("Unknown"),
  browserName: text("browser_name").notNull().default("Unknown"),
  modelHint: text("model_hint"),
  screen: text("screen"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  approvedAt: text("approved_at"),
  blockedAt: text("blocked_at"),
  lastSeenAt: text("last_seen_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  approvedBy: text("approved_by"),
}, (table) => [
  index("managed_app_devices_app_status_idx").on(table.appId, table.status, table.createdAt),
]);

export const managedAppChallenges = sqliteTable("managed_app_challenges", {
  nonce: text("nonce").primaryKey(),
  appId: text("app_id").notNull(),
  deviceId: text("device_id").notNull(),
  expiresAt: integer("expires_at").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index("managed_app_challenges_device_idx").on(table.appId, table.deviceId, table.expiresAt),
]);

export const medicineRules = sqliteTable("medicine_rules", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  synonymsJson: text("synonyms_json").notNull().default("[]"),
  level: integer("level").notNull(),
  category: text("category").notNull(),
  basis: text("basis").notNull(),
  sourceIdsJson: text("source_ids_json").notNull().default("[]"),
  reviewRequired: integer("review_required").notNull().default(0),
  condition: text("condition"),
  enabled: integer("enabled").notNull().default(1),
  updatedBy: text("updated_by"),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("medicine_rules_level_idx").on(table.level)]);

export const medicineReviews = sqliteTable("medicine_reviews", {
  id: text("id").primaryKey(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  status: text("status").notNull().default("pending"),
  medicineName: text("medicine_name"),
  ocrText: text("ocr_text").notNull(),
  matchedRuleIdsJson: text("matched_rule_ids_json").notNull().default("[]"),
  proposedLevel: integer("proposed_level").notNull(),
  confidence: integer("confidence").notNull().default(0),
  note: text("note"),
  adminNote: text("admin_note"),
  decision: text("decision"),
  reviewedBy: text("reviewed_by"),
  reviewedAt: text("reviewed_at"),
  publicTokenHash: text("public_token_hash"),
}, (table) => [index("medicine_reviews_status_idx").on(table.status, table.createdAt)]);

export const medicineAuditLog = sqliteTable("medicine_audit_log", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  actor: text("actor").notNull(),
  action: text("action").notNull(),
  target: text("target").notNull(),
  detailJson: text("detail_json").notNull().default("{}"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const medicineSettings = sqliteTable("medicine_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const medicineRateLimits = sqliteTable("medicine_rate_limits", {
  key: text("key").primaryKey(),
  count: integer("count").notNull().default(1),
  expiresAt: integer("expires_at").notNull(),
});