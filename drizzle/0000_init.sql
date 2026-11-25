CREATE TABLE `celcat_events` (
	`id` text PRIMARY KEY NOT NULL,
	`course_id` integer,
	`subject` text NOT NULL,
	`raw_subject` text DEFAULT '' NOT NULL,
	`session_type` text DEFAULT 'AUTRE' NOT NULL,
	`category` text DEFAULT '' NOT NULL,
	`start` integer NOT NULL,
	`end` integer NOT NULL,
	`all_day` integer DEFAULT false NOT NULL,
	`room` text DEFAULT '' NOT NULL,
	`teacher` text DEFAULT '' NOT NULL,
	`groups` text DEFAULT '' NOT NULL,
	`raw_description` text DEFAULT '' NOT NULL,
	`color` text,
	`synced_at` integer NOT NULL,
	FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `celcat_events_start_idx` ON `celcat_events` (`start`);--> statement-breakpoint
CREATE INDEX `celcat_events_course_idx` ON `celcat_events` (`course_id`,`session_type`,`start`);--> statement-breakpoint
CREATE TABLE `course_links` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`course_id` integer NOT NULL,
	`label` text NOT NULL,
	`url` text NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `course_links_course_idx` ON `course_links` (`course_id`);--> statement-breakpoint
CREATE TABLE `courses` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`color` text DEFAULT '#6366f1' NOT NULL,
	`source` text DEFAULT 'manual' NOT NULL,
	`memo` text DEFAULT '' NOT NULL,
	`archived` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `courses_slug_idx` ON `courses` (`slug`);--> statement-breakpoint
CREATE TABLE `custom_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`course_id` integer,
	`kind` text DEFAULT 'devoir' NOT NULL,
	`title` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`starts_at` integer NOT NULL,
	`ends_at` integer,
	`all_day` integer DEFAULT false NOT NULL,
	`linked_celcat_event_id` text,
	`linked_session_type` text,
	`done` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `custom_events_starts_idx` ON `custom_events` (`starts_at`);--> statement-breakpoint
CREATE TABLE `exams` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`course_id` integer NOT NULL,
	`title` text NOT NULL,
	`starts_at` integer NOT NULL,
	`duration_minutes` integer DEFAULT 120 NOT NULL,
	`location` text DEFAULT '' NOT NULL,
	`revision_level` text DEFAULT 'medium' NOT NULL,
	`revision_percent` integer DEFAULT 50 NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `exams_starts_idx` ON `exams` (`starts_at`);--> statement-breakpoint
CREATE TABLE `files` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`course_id` integer NOT NULL,
	`folder_id` integer,
	`name` text NOT NULL,
	`stored_name` text NOT NULL,
	`mime_type` text DEFAULT 'application/octet-stream' NOT NULL,
	`size` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`folder_id`) REFERENCES `folders`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `files_course_idx` ON `files` (`course_id`);--> statement-breakpoint
CREATE INDEX `files_folder_idx` ON `files` (`folder_id`);--> statement-breakpoint
CREATE TABLE `folders` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`course_id` integer NOT NULL,
	`parent_id` integer,
	`name` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`parent_id`) REFERENCES `folders`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `folders_course_idx` ON `folders` (`course_id`);--> statement-breakpoint
CREATE INDEX `folders_parent_idx` ON `folders` (`parent_id`);--> statement-breakpoint
CREATE TABLE `notes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`course_id` integer NOT NULL,
	`folder_id` integer,
	`title` text NOT NULL,
	`content` text DEFAULT '' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`folder_id`) REFERENCES `folders`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `notes_course_idx` ON `notes` (`course_id`);--> statement-breakpoint
CREATE INDEX `notes_folder_idx` ON `notes` (`folder_id`);--> statement-breakpoint
CREATE TABLE `push_subscriptions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`endpoint` text NOT NULL,
	`p256dh` text NOT NULL,
	`auth` text NOT NULL,
	`user_agent` text DEFAULT '' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `push_subscriptions_endpoint_idx` ON `push_subscriptions` (`endpoint`);--> statement-breakpoint
CREATE TABLE `revision_sessions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`exam_id` integer NOT NULL,
	`course_id` integer NOT NULL,
	`date` text NOT NULL,
	`start_time` text,
	`duration_minutes` integer DEFAULT 90 NOT NULL,
	`title` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`done` integer DEFAULT false NOT NULL,
	`done_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`exam_id`) REFERENCES `exams`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `revision_sessions_date_idx` ON `revision_sessions` (`date`);--> statement-breakpoint
CREATE INDEX `revision_sessions_exam_idx` ON `revision_sessions` (`exam_id`);--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
