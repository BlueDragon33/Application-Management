CREATE TABLE IF NOT EXISTS `managed_contract_apps` (
  `application_id` text PRIMARY KEY NOT NULL,
  `name` text NOT NULL,
  `short_name` text NOT NULL,
  `initials` text NOT NULL,
  `classification` text NOT NULL,
  `category_label` text NOT NULL,
  `repository` text,
  `control_origin` text,
  `runtime_origin` text,
  `manifest_path` text DEFAULT '/.well-known/application-management.json' NOT NULL,
  `contract_version` text DEFAULT 'application-management.contract.v1' NOT NULL,
  `auth_mode` text DEFAULT 'none' NOT NULL,
  `token_ciphertext` text,
  `token_iv` text,
  `token_expires_at` integer,
  `manifest_json` text DEFAULT '{}' NOT NULL,
  `capabilities_json` text DEFAULT '{}' NOT NULL,
  `endpoints_json` text DEFAULT '{}' NOT NULL,
  `enabled` integer DEFAULT 1 NOT NULL,
  `state` text DEFAULT 'pending' NOT NULL,
  `last_probe_at` text,
  `last_error` text,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `managed_contract_apps_state_idx`
  ON `managed_contract_apps` (`state`, `enabled`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `managed_contract_apps_classification_idx`
  ON `managed_contract_apps` (`classification`, `enabled`);
