import { COOKIE_NAME } from "@shared/const";
import { z } from "zod";
import {
  getPublicContentSnapshot,
  getLessonTranscript,
  getOriginalLecturesContent,
} from "./content";
import {
  getCompactDirectoryContent,
  getTargetedCourseWorkspace,
} from "./workspaceContent";
import {
  listStudyNotes,
  listStudyProgress,
  saveStudyNote,
  saveStudyProgress,
} from "./db";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";

const progressInput = z.object({
  courseId: z.string().trim().min(1).max(160),
  lessonId: z.string().trim().min(1).max(200),
  status: z.enum(["not_started", "in_progress", "complete"]),
  positionSeconds: z.number().finite().min(0).max(31_536_000),
});

export const appRouter = router({
  // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),
  content: router({
    // Mtime-aware content readers make incoming manifest updates visible without reparsing unchanged files.
    snapshot: publicProcedure.query(() => getPublicContentSnapshot()),
    catalog: publicProcedure.query(() => getCompactDirectoryContent()),
    media: publicProcedure.query(() => getOriginalLecturesContent()),
    workspace: publicProcedure
      .input(
        z.object({
          courseId: z.string().trim().min(1).max(160),
          scope: z.enum(["course", "program"]).default("course"),
        })
      )
      .query(({ input }) =>
        getTargetedCourseWorkspace(input.courseId, input.scope)
      ),
    transcript: publicProcedure
      .input(z.object({ lessonId: z.string().trim().min(1).max(200) }))
      .query(({ input }) => getLessonTranscript(input.lessonId)),
  }),
  study: router({
    progress: router({
      // The scope only separates browser query-cache entries; the server always scopes by ctx.user.id.
      list: protectedProcedure
        .input(z.object({ scope: z.number().int().positive() }))
        .query(({ ctx }) => listStudyProgress(ctx.user.id)),
      upsert: protectedProcedure
        .input(progressInput)
        .mutation(async ({ ctx, input }) => {
          return saveStudyProgress({
            ...input,
            userId: ctx.user.id,
            positionSeconds: Math.floor(input.positionSeconds),
          });
        }),
    }),
    notes: router({
      // The scope only separates browser query-cache entries; the server always scopes by ctx.user.id.
      list: protectedProcedure
        .input(z.object({ scope: z.number().int().positive() }))
        .query(({ ctx }) => listStudyNotes(ctx.user.id)),
      upsert: protectedProcedure
        .input(
          z.object({
            courseId: z.string().trim().min(1).max(160),
            content: z.string().max(50_000),
          })
        )
        .mutation(async ({ ctx, input }) => {
          return saveStudyNote({ ...input, userId: ctx.user.id });
        }),
    }),
  }),
});

export type AppRouter = typeof appRouter;
