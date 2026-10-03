-- Keep Deploy & Ops limited to the supported Vercel + Neon providers.
DELETE FROM deploy_ops_credentials WHERE provider NOT IN ('vercel', 'neon');

CREATE TABLE `deploy_ops_targets_next` (
  `app_id` text PRIMARY KEY NOT NULL,
  `repository` text NOT NULL,
  `vercel_enabled` integer DEFAULT 0 NOT NULL,
  `vercel_project_id` text,
  `vercel_team_id` text,
  `neon_enabled` integer DEFAULT 0 NOT NULL,
  `neon_project_id` text,
  `neon_branch` text,
  `created_by` text NOT NULL,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
INSERT INTO `deploy_ops_targets_next` (
  app_id, repository, vercel_enabled, vercel_project_id, vercel_team_id,
  neon_enabled, neon_project_id, neon_branch, created_by, created_at, updated_at
)
SELECT
  app_id, repository, vercel_enabled, vercel_project_id, vercel_team_id,
  neon_enabled, neon_project_id, neon_branch, created_by, created_at, updated_at
FROM `deploy_ops_targets`;
DROP TABLE `deploy_ops_targets`;
ALTER TABLE `deploy_ops_targets_next` RENAME TO `deploy_ops_targets`;
CREATE INDEX IF NOT EXISTS `deploy_ops_targets_updated_idx` ON `deploy_ops_targets` (`updated_at`);

CREATE TABLE `deploy_ops_runs_next` (
  `id` text PRIMARY KEY NOT NULL,
  `app_id` text NOT NULL,
  `source_sha` text NOT NULL,
  `status` text DEFAULT 'pending' NOT NULL,
  `detail_json` text DEFAULT '{}' NOT NULL,
  `created_by` text NOT NULL,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `published_at` text
);
INSERT INTO `deploy_ops_runs_next` (
  id, app_id, source_sha, status, detail_json, created_by, created_at, updated_at, published_at
)
SELECT
  id, app_id, source_sha, status, detail_json, created_by, created_at, updated_at, published_at
FROM `deploy_ops_runs`;
DROP TABLE `deploy_ops_runs`;
ALTER TABLE `deploy_ops_runs_next` RENAME TO `deploy_ops_runs`;
CREATE INDEX IF NOT EXISTS `deploy_ops_runs_app_sha_idx` ON `deploy_ops_runs` (`app_id`, `source_sha`, `created_at`);
