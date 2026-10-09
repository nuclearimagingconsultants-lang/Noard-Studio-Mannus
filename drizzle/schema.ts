import {
  index,
  int,
  longtext,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/** Private learner state; IDs are catalog identifiers, while userId scopes every row to the real Manus user. */
export const studyProgress = mysqlTable(
  "studyProgress",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    courseId: varchar("courseId", { length: 160 }).notNull(),
    lessonId: varchar("lessonId", { length: 200 }).notNull(),
    status: mysqlEnum("status", ["not_started", "in_progress", "complete"])
      .notNull()
      .default("not_started"),
    positionSeconds: int("positionSeconds").notNull().default(0),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    uniqueIndex("studyProgress_user_course_lesson_unique").on(
      table.userId,
      table.courseId,
      table.lessonId
    ),
    index("studyProgress_user_updated_idx").on(table.userId, table.updatedAt),
  ]
);

export const studyNotes = mysqlTable(
  "studyNotes",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    courseId: varchar("courseId", { length: 160 }).notNull(),
    content: text("content").notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    uniqueIndex("studyNotes_user_course_unique").on(
      table.userId,
      table.courseId
    ),
    index("studyNotes_user_updated_idx").on(table.userId, table.updatedAt),
  ]
);

export type StudyProgress = typeof studyProgress.$inferSelect;
export type StudyNote = typeof studyNotes.$inferSelect;

/**
 * Public, producer-owned media manifests. This table deliberately has no user
 * identity or learner state: the trusted local sync CLI is its only writer.
 */
export const publicContentManifests = mysqlTable("publicContentManifests", {
  manifestType: varchar("manifestType", { length: 16 }).primaryKey(),
  manifestJson: longtext("manifestJson").notNull(),
  manifestSha256: varchar("manifestSha256", { length: 64 }).notNull(),
  manifestBytes: int("manifestBytes", { unsigned: true }).notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type PublicContentManifest = typeof publicContentManifests.$inferSelect;
