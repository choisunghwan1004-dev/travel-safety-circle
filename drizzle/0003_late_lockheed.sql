-- ai_usage was already introduced in 0002; this migration only adds the lookup cache.
CREATE TABLE `lookup_cache` (
	`id` text PRIMARY KEY NOT NULL,
	`data` text NOT NULL,
	`expires_at` integer NOT NULL
);
