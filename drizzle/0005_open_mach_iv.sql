CREATE TABLE `alert_monitors` (
	`owner` text PRIMARY KEY NOT NULL,
	`last_at` text NOT NULL,
	`result` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `notification_settings` (
	`owner` text PRIMARY KEY NOT NULL,
	`ciphertext` text NOT NULL,
	`iv` text NOT NULL,
	`updated_at` text NOT NULL
);
