ALTER TABLE `exams` ADD `celcat_event_id` text;--> statement-breakpoint
CREATE INDEX `exams_celcat_idx` ON `exams` (`celcat_event_id`);