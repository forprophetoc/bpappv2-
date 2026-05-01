ALTER TABLE `estimates` ADD `firstName` text;--> statement-breakpoint
ALTER TABLE `estimates` ADD `lastName` text;--> statement-breakpoint
ALTER TABLE `estimates` ADD `serviceType` text DEFAULT 'bathtub' NOT NULL;--> statement-breakpoint
ALTER TABLE `estimates` ADD `transformationImageUrl` text;--> statement-breakpoint
ALTER TABLE `estimates` ADD `transformationPrice` integer;--> statement-breakpoint
ALTER TABLE `estimates` ADD `bathroomSinkPrice` integer;--> statement-breakpoint
ALTER TABLE `estimates` ADD `kitchenSinkPrice` integer;--> statement-breakpoint
ALTER TABLE `estimates` ADD `bookingLink` text;--> statement-breakpoint
ALTER TABLE `estimates` ADD `calendarEmbed` text;--> statement-breakpoint
ALTER TABLE `estimates` ADD `phone` text;--> statement-breakpoint
ALTER TABLE `estimates` ADD `address` text;--> statement-breakpoint
ALTER TABLE `estimates` ADD `duration` text DEFAULT '3 Hours';--> statement-breakpoint
ALTER TABLE `estimates` ADD `notes` text;--> statement-breakpoint
ALTER TABLE `estimates` ADD `status` text DEFAULT 'New Lead';--> statement-breakpoint
ALTER TABLE `estimates` ADD `viewedAt` integer;--> statement-breakpoint
ALTER TABLE `estimates` ADD `ghlContactId` text;