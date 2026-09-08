CREATE TABLE `bauman_audit` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`actor` text NOT NULL,
	`action` text NOT NULL,
	`device_id` text NOT NULL,
	`site_id` text,
	`detail` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `bauman_challenges` (
	`nonce` text PRIMARY KEY NOT NULL,
	`device_id` text NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `bauman_challenges_device_idx` ON `bauman_challenges` (`device_id`);--> statement-breakpoint
CREATE INDEX `bauman_challenges_expiry_idx` ON `bauman_challenges` (`expires_at`);--> statement-breakpoint
CREATE TABLE `bauman_devices` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`email` text NOT NULL,
	`public_key` text NOT NULL,
	`label` text DEFAULT '' NOT NULL,
	`kind` text DEFAULT 'unknown' NOT NULL,
	`detected_kind` text DEFAULT 'unknown' NOT NULL,
	`kind_override` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`last_seen_at` integer
);
--> statement-breakpoint
CREATE INDEX `bauman_devices_user_idx` ON `bauman_devices` (`user_id`);--> statement-breakpoint
CREATE TABLE `bauman_grants` (
	`device_id` text NOT NULL,
	`site_id` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`expires_at` integer,
	`requested_at` integer NOT NULL,
	`decided_at` integer,
	`decided_by` text,
	`reason` text DEFAULT '' NOT NULL,
	`version` integer DEFAULT 0 NOT NULL,
	`last_seen_at` integer,
	PRIMARY KEY(`device_id`, `site_id`),
	FOREIGN KEY (`device_id`) REFERENCES `bauman_devices`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `bauman_grants_status_idx` ON `bauman_grants` (`status`,`requested_at`);--> statement-breakpoint
