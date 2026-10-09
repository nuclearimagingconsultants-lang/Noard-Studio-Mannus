CREATE TABLE `studyNotes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`courseId` varchar(160) NOT NULL,
	`content` text NOT NULL,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `studyNotes_id` PRIMARY KEY(`id`),
	CONSTRAINT `studyNotes_user_course_unique` UNIQUE(`userId`,`courseId`)
);
--> statement-breakpoint
CREATE TABLE `studyProgress` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`courseId` varchar(160) NOT NULL,
	`lessonId` varchar(200) NOT NULL,
	`status` enum('not_started','in_progress','complete') NOT NULL DEFAULT 'not_started',
	`positionSeconds` int NOT NULL DEFAULT 0,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `studyProgress_id` PRIMARY KEY(`id`),
	CONSTRAINT `studyProgress_user_course_lesson_unique` UNIQUE(`userId`,`courseId`,`lessonId`)
);
--> statement-breakpoint
ALTER TABLE `studyNotes` ADD CONSTRAINT `studyNotes_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `studyProgress` ADD CONSTRAINT `studyProgress_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `studyNotes_user_updated_idx` ON `studyNotes` (`userId`,`updatedAt`);--> statement-breakpoint
CREATE INDEX `studyProgress_user_updated_idx` ON `studyProgress` (`userId`,`updatedAt`);