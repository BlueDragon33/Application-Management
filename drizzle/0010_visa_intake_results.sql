CREATE TABLE IF NOT EXISTS `visa_intake_results` (
  `id` text PRIMARY KEY NOT NULL,
  `submission_id` text NOT NULL UNIQUE,
  `link_id` text NOT NULL,
  `file_name` text NOT NULL,
  `mime_type` text DEFAULT 'application/pdf' NOT NULL,
  `file_size` integer NOT NULL,
  `pdf_blob` blob NOT NULL,
  `uploaded_by` text NOT NULL,
  `uploaded_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `visa_intake_results_link_idx` ON `visa_intake_results` (`link_id`, `uploaded_at`);
