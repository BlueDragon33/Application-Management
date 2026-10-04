CREATE TABLE `visa_intake_invites` (
  `id` text PRIMARY KEY NOT NULL,
  `token_hash` text NOT NULL UNIQUE,
  `label` text NOT NULL DEFAULT '',
  `status` text NOT NULL DEFAULT 'open',
  `common_json` text NOT NULL,
  `created_by` text NOT NULL,
  `created_at` text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `submitted_at` text
);
--> statement-breakpoint
CREATE INDEX `visa_intake_invites_status_created_idx` ON `visa_intake_invites` (`status`,`created_at`);
--> statement-breakpoint
CREATE TABLE `visa_intake_submissions` (
  `queue_no` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `submission_id` text NOT NULL UNIQUE,
  `invite_id` text NOT NULL UNIQUE,
  `applicant_json` text NOT NULL,
  `status` text NOT NULL DEFAULT 'submitted',
  `submitted_at` text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `reviewed_at` text,
  `reviewed_by` text,
  `imported_at` text
);
--> statement-breakpoint
CREATE INDEX `visa_intake_submissions_status_queue_idx` ON `visa_intake_submissions` (`status`,`queue_no`);