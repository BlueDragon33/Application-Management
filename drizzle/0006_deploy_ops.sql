CREATE TABLE IF NOT EXISTS `deploy_ops_targets` (
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
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `deploy_ops_targets_updated_idx` ON `deploy_ops_targets` (`updated_at`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `deploy_ops_runs` (
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
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `deploy_ops_runs_app_sha_idx` ON `deploy_ops_runs` (`app_id`, `source_sha`, `created_at`);
