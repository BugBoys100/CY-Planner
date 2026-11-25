ALTER TABLE `celcat_events` ADD `code` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `celcat_events` ADD `cancelled` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `courses` ADD `code` text;--> statement-breakpoint
CREATE INDEX `courses_code_idx` ON `courses` (`code`);