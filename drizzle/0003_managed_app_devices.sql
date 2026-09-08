CREATE TABLE `managed_app_devices` (
	`app_id` text NOT NULL,
	`device_id` text NOT NULL,
	`display_code` text NOT NULL,
	`public_key_jwk` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`label` text,
	`device_class` text DEFAULT 'unknown' NOT NULL,
	`os_name` text DEFAULT 'Unknown' NOT NULL,
	`browser_name` text DEFAULT 'Unknown' NOT NULL,
	`model_hint` text,
	`screen` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`approved_at` text,
	`blocked_at` text,
	`last_seen_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`approved_by` text,
	PRIMARY KEY(`app_id`, `device_id`)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `managed_app_devices_code_unique` ON `managed_app_devices` (`display_code`);
--> statement-breakpoint
CREATE INDEX `managed_app_devices_app_status_idx` ON `managed_app_devices` (`app_id`,`status`,`created_at`);
--> statement-breakpoint
CREATE TABLE `managed_app_challenges` (
	`nonce` text PRIMARY KEY NOT NULL,
	`app_id` text NOT NULL,
	`device_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `managed_app_challenges_device_idx` ON `managed_app_challenges` (`app_id`,`device_id`,`expires_at`);
