CREATE TABLE `estimates` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`firstName` text,
	`lastName` text,
	`service` text NOT NULL,
	`serviceType` text DEFAULT 'bathtub' NOT NULL,
	`price` integer NOT NULL,
	`beforeUrl` text NOT NULL,
	`afterUrl` text NOT NULL,
	`transformationImageUrl` text,
	`transformationPrice` integer,
	`bathroomSinkPrice` integer,
	`kitchenSinkPrice` integer,
	`baseColor` text,
	`flakeColor` text,
	`maintenancePlanPrice` integer,
	`uvClearCoatPrice` integer,
	`upperCabinetColor` text,
	`lowerCabinetColor` text,
	`softCloseHingeUpgrade` integer,
	`hardwareReplacement` integer,
	`hardwareUpgrade` integer,
	`stripFee` integer,
	`bookingLink` text,
	`calendarEmbed` text,
	`email` text,
	`phone` text,
	`address` text,
	`duration` text DEFAULT '3 Hours',
	`notes` text,
	`status` text DEFAULT 'New Lead',
	`viewedAt` integer,
	`companyName` text,
	`companyLogoUrl` text,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	`updatedAt` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `estimates_slug_unique` ON `estimates` (`slug`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`openId` text NOT NULL,
	`name` text,
	`email` text,
	`loginMethod` text,
	`role` text DEFAULT 'user' NOT NULL,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	`updatedAt` integer DEFAULT (unixepoch()) NOT NULL,
	`lastSignedIn` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_openId_unique` ON `users` (`openId`);