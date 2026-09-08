CREATE TABLE `managed_app_device_profiles` (
	`app_id` text NOT NULL,
	`device_id` text NOT NULL,
	`person_name` text,
	`person_code` text,
	`group_name` text,
	`purpose` text,
	`admin_note` text,
	`updated_by` text,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	PRIMARY KEY(`app_id`, `device_id`)
);
--> statement-breakpoint
CREATE INDEX `managed_app_device_profiles_person_idx` ON `managed_app_device_profiles` (`app_id`,`person_code`,`person_name`);
