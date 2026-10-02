CREATE TABLE IF NOT EXISTS `deploy_ops_credentials` (
  `provider` text PRIMARY KEY NOT NULL,
  `credential_ciphertext` text NOT NULL,
  `credential_iv` text NOT NULL,
  `fingerprint` text NOT NULL,
  `created_by` text NOT NULL,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `deploy_ops_credentials_updated_idx` ON `deploy_ops_credentials` (`updated_at`);
