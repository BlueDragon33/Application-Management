CREATE TABLE IF NOT EXISTS `visa_intake_links` (
  `id` text PRIMARY KEY NOT NULL,
  `token_hash` text NOT NULL UNIQUE,
  `label` text DEFAULT '' NOT NULL,
  `status` text DEFAULT 'active' NOT NULL,
  `defaults_json` text DEFAULT '{}' NOT NULL,
  `created_by` text NOT NULL,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `expires_at` text
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `visa_intake_links_status_created_idx` ON `visa_intake_links` (`status`, `created_at`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `visa_intake_submissions` (
  `queue_no` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `id` text NOT NULL UNIQUE,
  `link_id` text NOT NULL,
  `status` text DEFAULT 'pending' NOT NULL,
  `applicant_name` text NOT NULL,
  `passport_no` text NOT NULL,
  `email` text NOT NULL,
  `phone` text NOT NULL,
  `payload_json` text NOT NULL,
  `validation_json` text DEFAULT '{}' NOT NULL,
  `submitted_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `reviewed_by` text,
  `reviewed_at` text,
  `review_note` text,
  `imported_applicant_id` text
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `visa_intake_submissions_status_queue_idx` ON `visa_intake_submissions` (`status`, `queue_no`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `visa_intake_submissions_link_queue_idx` ON `visa_intake_submissions` (`link_id`, `queue_no`);
