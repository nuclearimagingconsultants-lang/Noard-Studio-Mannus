CREATE TABLE IF NOT EXISTS `publicContentManifests` (
  `manifestType` varchar(16) NOT NULL,
  `manifestJson` longtext NOT NULL,
  `manifestSha256` varchar(64) NOT NULL,
  `manifestBytes` int unsigned NOT NULL,
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `publicContentManifests_manifestType` PRIMARY KEY (`manifestType`),
  CONSTRAINT `publicContentManifests_manifestType_check` CHECK (`manifestType` IN ('base', 'medical')),
  CONSTRAINT `publicContentManifests_manifestSha256_check` CHECK (`manifestSha256` REGEXP '^[0-9a-f]{64}$')
);
