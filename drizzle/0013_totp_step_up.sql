ALTER TABLE `control_sessions` ADD COLUMN `auth_method` text DEFAULT 'password' NOT NULL;
--> statement-breakpoint
ALTER TABLE `control_sessions` ADD COLUMN `step_up_at` integer;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `control_mfa_factors` (
  `account_email` text PRIMARY KEY NOT NULL,
  `factor_type` text DEFAULT 'totp' NOT NULL,
  `secret_ciphertext` text NOT NULL,
  `secret_iv` text NOT NULL,
  `enabled` integer DEFAULT 0 NOT NULL,
  `verified_at` integer,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  FOREIGN KEY (`account_email`) REFERENCES `control_accounts`(`email`) ON UPDATE CASCADE ON DELETE CASCADE
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `control_mfa_factors_enabled_idx`
  ON `control_mfa_factors` (`enabled`);
