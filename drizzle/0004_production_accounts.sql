CREATE TABLE IF NOT EXISTS `control_accounts` (
  `email` text PRIMARY KEY NOT NULL,
  `display_name` text NOT NULL,
  `phone` text,
  `role` text DEFAULT 'owner' NOT NULL,
  `password_salt` text NOT NULL,
  `password_hash` text NOT NULL,
  `password_iterations` integer DEFAULT 310000 NOT NULL,
  `must_change_password` integer DEFAULT 1 NOT NULL,
  `failed_attempts` integer DEFAULT 0 NOT NULL,
  `locked_until` integer,
  `status` text DEFAULT 'active' NOT NULL,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `control_sessions` (
  `session_id_hash` text PRIMARY KEY NOT NULL,
  `email` text NOT NULL,
  `expires_at` integer NOT NULL,
  `created_at` integer NOT NULL,
  `last_seen_at` integer NOT NULL,
  FOREIGN KEY (`email`) REFERENCES `control_accounts`(`email`) ON UPDATE CASCADE ON DELETE CASCADE
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `control_sessions_email_idx` ON `control_sessions` (`email`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `control_sessions_expiry_idx` ON `control_sessions` (`expires_at`);
