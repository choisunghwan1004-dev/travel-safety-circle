CREATE TABLE `deliveries` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`channel` text NOT NULL,
	`recipient` text NOT NULL,
	`status` text NOT NULL,
	`provider_id` text,
	`created_at` text NOT NULL,
	`error` text
);
