import { and, desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser,
  studyNotes,
  studyProgress,
  users,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    throw new Error("Database is not available");
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = "admin";
      updateSet.role = "admin";
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db
    .select()
    .from(users)
    .where(eq(users.openId, openId))
    .limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function listStudyProgress(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  return db
    .select()
    .from(studyProgress)
    .where(eq(studyProgress.userId, userId))
    .orderBy(desc(studyProgress.updatedAt));
}

export async function saveStudyProgress(input: {
  userId: number;
  courseId: string;
  lessonId: string;
  status: "not_started" | "in_progress" | "complete";
  positionSeconds: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const updatedAt = new Date();
  await db
    .insert(studyProgress)
    .values(input)
    .onDuplicateKeyUpdate({
      set: {
        status: input.status,
        positionSeconds: input.positionSeconds,
        updatedAt,
      },
    });
  const [saved] = await db
    .select()
    .from(studyProgress)
    .where(
      and(
        eq(studyProgress.userId, input.userId),
        eq(studyProgress.courseId, input.courseId),
        eq(studyProgress.lessonId, input.lessonId)
      )
    )
    .limit(1);
  if (!saved) throw new Error("Progress save could not be confirmed");
  return saved;
}

export async function listStudyNotes(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  return db
    .select()
    .from(studyNotes)
    .where(eq(studyNotes.userId, userId))
    .orderBy(desc(studyNotes.updatedAt));
}

export async function saveStudyNote(input: {
  userId: number;
  courseId: string;
  content: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const updatedAt = new Date();
  await db
    .insert(studyNotes)
    .values(input)
    .onDuplicateKeyUpdate({
      set: { content: input.content, updatedAt },
    });
  const [saved] = await db
    .select()
    .from(studyNotes)
    .where(
      and(
        eq(studyNotes.userId, input.userId),
        eq(studyNotes.courseId, input.courseId)
      )
    )
    .limit(1);
  if (!saved) throw new Error("Note save could not be confirmed");
  return saved;
}
