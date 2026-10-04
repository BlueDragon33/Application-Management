import { sql } from "drizzle-orm";
import { blob, index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

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
  status: text("status").notNull().default("pending"),
  detailJson: text("detail_json").notNull().default("{}"),
  createdBy: text("created_by").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  publishedAt: text("published_at"),
}, (table) => [
  index("deploy_ops_runs_app_sha_idx").on(table.appId, table.sourceSha, table.createdAt),
]);


export const deployOpsCredentials = sqliteTable("deploy_ops_credentials", {
  provider: text("provider").primaryKey(),
  credentialCiphertext: text("credential_ciphertext").notNull(),
  credentialIv: text("credential_iv").notNull(),
  fingerprint: text("fingerprint").notNull(),
  createdBy: text("created_by").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index("deploy_ops_credentials_updated_idx").on(table.updatedAt),
]);


export const visaIntakeLinks = sqliteTable("visa_intake_links", {
  id: text("id").primaryKey(),
  tokenHash: text("token_hash").notNull().unique(),
  label: text("label").notNull().default(""),
  status: text("status").notNull().default("active"),
  defaultsJson: text("defaults_json").notNull().default("{}"),
  createdBy: text("created_by").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  expiresAt: text("expires_at"),
}, (table) => [
  index("visa_intake_links_status_created_idx").on(table.status, table.createdAt),
]);

export const visaIntakeSubmissions = sqliteTable("visa_intake_submissions", {
  queueNo: integer("queue_no").primaryKey({ autoIncrement: true }),
  id: text("id").notNull().unique(),
  linkId: text("link_id").notNull(),
  status: text("status").notNull().default("pending"),
  applicantName: text("applicant_name").notNull(),
  passportNo: text("passport_no").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  payloadJson: text("payload_json").notNull(),
  validationJson: text("validation_json").notNull().default("{}"),
  submittedAt: text("submitted_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  reviewedBy: text("reviewed_by"),
  reviewedAt: text("reviewed_at"),
  reviewNote: text("review_note"),
  importedApplicantId: text("imported_applicant_id"),
}, (table) => [
  index("visa_intake_submissions_status_queue_idx").on(table.status, table.queueNo),
  index("visa_intake_submissions_link_queue_idx").on(table.linkId, table.queueNo),
]);


export const visaIntakeResults = sqliteTable("visa_intake_results", {
  id: text("id").primaryKey(),
  submissionId: text("submission_id").notNull().unique(),
  linkId: text("link_id").notNull(),
  fileName: text("file_name").notNull(),
  mimeType: text("mime_type").notNull().default("application/pdf"),
  fileSize: integer("file_size").notNull(),
  pdfBlob: blob("pdf_blob").notNull(),
  uploadedBy: text("uploaded_by").notNull(),
  uploadedAt: text("uploaded_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index("visa_intake_results_link_idx").on(table.linkId, table.uploadedAt),
]);
