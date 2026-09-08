ALTER TABLE `bauman_devices` ADD `status` text DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE `bauman_devices` ADD `block_reason` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `bauman_devices` ADD `version` integer DEFAULT 0 NOT NULL;
