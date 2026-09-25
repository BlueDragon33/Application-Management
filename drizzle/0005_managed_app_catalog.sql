CREATE TABLE IF NOT EXISTS `managed_app_catalog` (
  `id` text PRIMARY KEY NOT NULL,
  `name` text NOT NULL,
  `short_name` text NOT NULL,
  `category` text NOT NULL,
  `origin` text NOT NULL,
  `public_url` text,
  `repository` text,
  `contract_path` text DEFAULT '/api/application-management/contract' NOT NULL,
  `enabled` integer DEFAULT 1 NOT NULL,
  `credential_ciphertext` text,
  `credential_iv` text,
  `created_by` text NOT NULL,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `managed_app_catalog_category_idx` ON `managed_app_catalog` (`category`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `managed_app_catalog_enabled_idx` ON `managed_app_catalog` (`enabled`);
