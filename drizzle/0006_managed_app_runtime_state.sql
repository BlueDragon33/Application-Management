ALTER TABLE `managed_app_catalog` ADD COLUMN `last_contract_connected_at` text;
--> statement-breakpoint
ALTER TABLE `managed_app_catalog` ADD COLUMN `last_probe_at` text;
--> statement-breakpoint
ALTER TABLE `managed_app_catalog` ADD COLUMN `last_probe_error` text;
