CREATE TABLE `ru_life_devices` (
	`device_id` text PRIMARY KEY NOT NULL,
	`display_code` text NOT NULL,
	`public_key_jwk` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`user_name` text,
	`user_code` text,
	`label` text,
	`device_class` text DEFAULT 'unknown' NOT NULL,
	`detected_device_class` text DEFAULT 'unknown' NOT NULL,
	`device_class_override` text,
	`device_class_override_by` text,
	`device_class_override_at` text,
	`classification_confidence` integer DEFAULT 0 NOT NULL,
	`classification_source` text,
	`os_name` text,
	`browser_name` text,
	`model_hint` text,
	`screen` text,
	`profile_json` text DEFAULT '{}' NOT NULL,
	`edit_enabled` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`approved_at` text,
	`blocked_at` text,
	`last_seen_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`approved_by` text,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ru_life_devices_display_code_unique` ON `ru_life_devices` (`display_code`);--> statement-breakpoint
CREATE INDEX `ru_life_devices_status_idx` ON `ru_life_devices` (`status`);--> statement-breakpoint
CREATE INDEX `ru_life_devices_user_code_idx` ON `ru_life_devices` (`user_code`);--> statement-breakpoint
CREATE TABLE `ru_life_challenges` (
	`nonce` text PRIMARY KEY NOT NULL,
	`device_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `ru_life_challenges_device_idx` ON `ru_life_challenges` (`device_id`);--> statement-breakpoint
CREATE TABLE `ru_life_sessions` (
	`session_id` text PRIMARY KEY NOT NULL,
	`device_id` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`last_seen_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`revoked_at` text,
	`revoked_by` text,
	`revoke_reason` text
);
--> statement-breakpoint
CREATE INDEX `ru_life_sessions_device_idx` ON `ru_life_sessions` (`device_id`);--> statement-breakpoint
CREATE INDEX `ru_life_sessions_status_idx` ON `ru_life_sessions` (`status`);--> statement-breakpoint
CREATE TABLE `ru_life_audit_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`actor` text NOT NULL,
	`action` text NOT NULL,
	`target` text NOT NULL,
	`detail_json` text DEFAULT '{}' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
