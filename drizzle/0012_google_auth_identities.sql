CREATE TABLE IF NOT EXISTS `control_auth_identities` (
  `provider` text NOT NULL,
  `provider_subject` text NOT NULL,
  `account_email` text NOT NULL,
  `provider_email` text NOT NULL,
  `email_verified` integer DEFAULT 0 NOT NULL,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  PRIMARY KEY (`provider`, `provider_subject`),
  FOREIGN KEY (`account_email`) REFERENCES `control_accounts`(`email`) ON UPDATE CASCADE ON DELETE CASCADE
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `control_auth_identities_provider_account_idx`
  ON `control_auth_identities` (`provider`, `account_email`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `control_auth_identities_provider_email_idx`
  ON `control_auth_identities` (`provider`, `provider_email`);
