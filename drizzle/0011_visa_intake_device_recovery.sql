ALTER TABLE `visa_intake_submissions` ADD COLUMN `device_hash` text;
--> statement-breakpoint
ALTER TABLE `visa_intake_submissions` ADD COLUMN `device_code` text;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `visa_intake_submissions_link_device_idx` ON `visa_intake_submissions` (`link_id`, `device_hash`);
