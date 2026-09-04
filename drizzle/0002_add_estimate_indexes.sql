CREATE INDEX IF NOT EXISTS `idx_estimates_createdAt` ON `estimates` (`createdAt`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_estimates_status` ON `estimates` (`status`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_estimates_ghlContactId` ON `estimates` (`ghlContactId`);
