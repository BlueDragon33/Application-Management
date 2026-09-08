ALTER TABLE `managed_app_devices` ADD COLUMN `device_class_override` text;
--> statement-breakpoint
ALTER TABLE `managed_app_devices` ADD COLUMN `classification_confidence` integer NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE `managed_app_devices` ADD COLUMN `classification_source` text NOT NULL DEFAULT 'legacy';
--> statement-breakpoint
ALTER TABLE `managed_app_devices` ADD COLUMN `classifier_version` integer NOT NULL DEFAULT 1;
--> statement-breakpoint
ALTER TABLE `managed_app_devices` ADD COLUMN `classification_detail_json` text NOT NULL DEFAULT '{}';
