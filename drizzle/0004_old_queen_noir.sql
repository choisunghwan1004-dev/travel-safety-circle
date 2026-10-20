CREATE TABLE `user_ai_keys` (
	`owner` text PRIMARY KEY NOT NULL,
	`ciphertext` text NOT NULL,
	`iv` text NOT NULL,
	`last_four` text NOT NULL,
	`updated_at` text NOT NULL
);
