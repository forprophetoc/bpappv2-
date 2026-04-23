ALTER TABLE `estimates` ADD COLUMN `firstName` text;
--> statement-breakpoint
ALTER TABLE `estimates` ADD COLUMN `lastName` text;
--> statement-breakpoint
ALTER TABLE `estimates` ADD COLUMN `serviceType` text NOT NULL DEFAULT 'bathtub';
--> statement-breakpoint
ALTER TABLE `estimates` ADD COLUMN `transformationImageUrl` text;
--> statement-breakpoint
ALTER TABLE `estimates` ADD COLUMN `transformationPrice` integer;
--> statement-breakpoint
ALTER TABLE `estimates` ADD COLUMN `bathroomSinkPrice` integer;
--> statement-breakpoint
ALTER TABLE `estimates` ADD COLUMN `kitchenSinkPrice` integer;
--> statement-breakpoint
ALTER TABLE `estimates` ADD COLUMN `bookingLink` text;
--> statement-breakpoint
ALTER TABLE `estimates` ADD COLUMN `calendarEmbed` text;
